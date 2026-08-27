import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { AcceptInviteForm } from "./accept-form";
import { APP_NAME, Wordmark } from "@/components/brand/mark";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { IconBoards, IconGrid, IconWarning } from "@/components/ui/icons";

// F6 (redesign v5): karta 400px na `--canvas`, prymitywy z `components/ui/*`.
// Prisma flow + branching stanów zaproszenia bez zmian; akceptacja nadal
// przechodzi przez `acceptInviteAction` (weryfikacja tokenu na serwerze).

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  MEMBER: "Członek",
  VIEWER: "Tylko podgląd",
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <div data-ui="invite-page" className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <main data-ui="invite-card" className="surface w-[400px] max-w-full p-6">
        <div className="flex justify-center">
          <Wordmark size="lg" />
        </div>
        {children}
      </main>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-xs font-medium text-foreground">{children}</span>
    </div>
  );
}

export default async function InvitePage({
  params,
}: {
  // Next 16: params jest Promise<{}>, musi być await'owany.
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await db.invitation.findUnique({
    where: { token },
    include: {
      workspace: { select: { name: true, deletedAt: true } },
      board: { select: { name: true } },
      inviter: { select: { name: true, email: true } },
    },
  });

  // Server Component — Date.now() jest deterministyczne per request na serwerze
  // (w przeciwieństwie do client renderu, gdzie React Compiler wyłapuje impurity).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const invalidState = !invitation
    ? "not-found"
    : invitation.workspace.deletedAt
      ? "workspace-deleted"
      : invitation.acceptedAt
        ? "already-used"
        : invitation.expiresAt.getTime() < now
          ? "expired"
          : null;

  // ── Niepoprawny / wygasły / wykorzystany token ──
  if (invalidState || !invitation) {
    const message = {
      "not-found": "Zaproszenie nie istnieje lub zostało cofnięte.",
      "workspace-deleted": "Przestrzeń, do której masz zaproszenie, już nie istnieje.",
      "already-used": "To zaproszenie zostało już wykorzystane.",
      expired: "To zaproszenie wygasło. Poproś administratora o nowe.",
    }[invalidState as "not-found" | "workspace-deleted" | "already-used" | "expired"];

    return (
      <Shell>
        <div className="mt-5 flex flex-col items-center gap-2 text-center">
          <span className="grid size-9 place-items-center rounded-lg bg-chip-red-bg text-danger-text">
            <IconWarning width={18} height={18} />
          </span>
          <h1 className="text-md font-semibold text-foreground">Zaproszenie nieprawidłowe</h1>
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
      </Shell>
    );
  }

  const existingUser = await db.user.findUnique({
    where: { email: invitation.email },
    select: { passwordHash: true },
  });
  const isExistingUser = Boolean(existingUser?.passwordHash);

  const inviterName = invitation.inviter.name ?? invitation.inviter.email;
  const isBoardScope = Boolean(invitation.boardId);

  return (
    <Shell>
      <div className="mt-5 text-center">
        <h1 className="text-md font-semibold text-foreground">
          Zaproszenie do „{invitation.workspace.name}”
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isExistingUser
            ? `Masz już konto w ${APP_NAME} — wpisz hasło, żeby dołączyć.`
            : "Ustaw hasło, aby założyć konto i dołączyć."}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2.5 rounded-md border border-border bg-canvas px-3 py-2.5">
        <Avatar name={inviterName} size={28} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-foreground">{inviterName}</div>
          <div className="text-2xs text-fg-3">zaprasza Cię do współpracy</div>
        </div>
      </div>

      {/* Zakres zaproszenia — cała przestrzeń vs pojedyncza tablica. */}
      <div data-ui="invite-scope" className="mt-3 rounded-md border border-border px-3 py-2">
        <Row label="Zakres">
          <Chip hue={isBoardScope ? "blue" : "orange"} size="lg">
            {isBoardScope ? (
              <IconBoards width={12} height={12} />
            ) : (
              <IconGrid width={12} height={12} />
            )}
            {isBoardScope ? "Tablica" : "Cała przestrzeń"}
          </Chip>
        </Row>
        <Row label="Przestrzeń">{invitation.workspace.name}</Row>
        {isBoardScope && <Row label="Tablica">{invitation.board?.name ?? "—"}</Row>}
        <Row label="Rola">{ROLE_LABEL[invitation.role] ?? invitation.role}</Row>
      </div>

      <AcceptInviteForm
        token={invitation.token}
        email={invitation.email}
        isExistingUser={isExistingUser}
        workspaceId={invitation.workspaceId}
      />
    </Shell>
  );
}
