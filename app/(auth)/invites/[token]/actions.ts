"use server";

import bcrypt from "bcrypt";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { acceptInviteSchema } from "@/lib/schemas/invitation";
import { writeAudit } from "@/lib/audit";
import { AuthError } from "next-auth";

type FieldErrors = { password?: string; name?: string };

export type AcceptInviteState =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: FieldErrors }
  | null;

export async function acceptInviteAction(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const parsed = acceptInviteSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    name: formData.get("name") || undefined,
  });

  if (!parsed.success) {
    const fe: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "password" || k === "name") fe[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const invitation = await db.invitation.findUnique({
    where: { token: parsed.data.token },
    include: {
      workspace: { select: { id: true, name: true, deletedAt: true } },
      board: { select: { id: true } },
    },
  });

  if (!invitation || invitation.workspace.deletedAt) {
    return { ok: false, error: "Zaproszenie nie istnieje lub zostało cofnięte." };
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Zaproszenie wygasło. Poproś admina o nowe." };
  }
  if (invitation.acceptedAt) {
    return { ok: false, error: "Zaproszenie zostało już wykorzystane." };
  }

  const existingUser = await db.user.findUnique({
    where: { email: invitation.email },
  });

  let userId: string;
  if (existingUser) {
    if (!existingUser.passwordHash) {
      return {
        ok: false,
        error: "To konto nie ma ustawionego hasła. Skontaktuj się z administratorem.",
      };
    }
    const valid = await bcrypt.compare(parsed.data.password, existingUser.passwordHash);
    if (!valid) {
      return { ok: false, fieldErrors: { password: "Nieprawidłowe hasło dla istniejącego konta." } };
    }
    userId = existingUser.id;
  } else {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const newUser = await db.user.create({
      data: {
        email: invitation.email,
        name: parsed.data.name ?? invitation.email.split("@")[0],
        passwordHash,
        emailVerified: new Date(), // invitation acceptance counts as email verification
      },
    });
    userId = newUser.id;
  }

  // Invitation.boardId distinguishes scope.
  // - workspace scope (boardId null): upsert WorkspaceMembership with the
  //   invited role. No board membership.
  // - board scope (boardId set): ensure baseline workspace membership
  //   exists (MEMBER if newly created — they need at least workspace
  //   access to navigate), then upsert BoardMembership with the invited
  //   role. Re-using same role for workspace would over-grant access for
  //   board-only invites; baseline MEMBER + restrictive board ACL gates
  //   the actual reach.
  await db.$transaction(async (tx) => {
    if (invitation.boardId) {
      await tx.workspaceMembership.upsert({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
        // Don't downgrade an existing higher role on subsequent board
        // invites — only ensure they exist as workspace member.
        update: {},
        create: {
          workspaceId: invitation.workspaceId,
          userId,
          role: "MEMBER",
        },
      });
      await tx.boardMembership.upsert({
        where: { boardId_userId: { boardId: invitation.boardId, userId } },
        update: { role: invitation.role },
        create: {
          boardId: invitation.boardId,
          userId,
          role: invitation.role,
        },
      });
    } else {
      await tx.workspaceMembership.upsert({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
        update: { role: invitation.role },
        create: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
        },
      });
    }
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
  });

  await writeAudit({
    workspaceId: invitation.workspaceId,
    objectType: invitation.boardId ? "Board" : "Workspace",
    objectId: invitation.boardId ?? invitation.workspaceId,
    actorId: userId,
    action: invitation.boardId ? "board.inviteAccepted" : "workspace.inviteAccepted",
    diff: {
      email: invitation.email,
      role: invitation.role,
      boardId: invitation.boardId ?? null,
    },
  });

  // Always redirect to the workspace after acceptance:
  //  - already signed in as invitation.email → redirect to /w/<id>
  //  - otherwise → signIn with redirectTo (next-auth handles the redirect)
  const session = await auth();
  const target = `/w/${invitation.workspaceId}`;
  if (session?.user?.email === invitation.email) {
    // redirect() throws NEXT_REDIRECT — Next.js takes over the response.
    redirect(target);
  }

  try {
    await signIn("credentials", {
      email: invitation.email,
      password: parsed.data.password,
      redirectTo: target,
    });
    return { ok: true }; // unreachable — signIn redirects
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "Logowanie nie powiodło się. Spróbuj ponownie." };
    }
    throw error;
  }
}
