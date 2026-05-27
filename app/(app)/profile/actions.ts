"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { updateProfileSchema } from "@/lib/schemas/profile";

type FieldErrors = { name?: string; timezone?: string; avatar?: string };

export type ProfileFormState =
  | { ok: true; message: string }
  | { ok: false; error?: string; fieldErrors?: FieldErrors }
  | null;

const ALLOWED_AVATAR_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_AVATAR_BYTES = 2_000_000;

export async function updateProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");

  const parsed = updateProfileSchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    const fe: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "name" || k === "timezone") fe[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const avatar = formData.get("avatar");
  let avatarUrl: string | undefined;

  if (avatar instanceof File && avatar.size > 0) {
    if (!ALLOWED_AVATAR_TYPES.has(avatar.type)) {
      return {
        ok: false,
        fieldErrors: { avatar: "Dozwolone formaty: PNG, JPEG, WebP, GIF." },
      };
    }
    if (avatar.size > MAX_AVATAR_BYTES) {
      return {
        ok: false,
        fieldErrors: { avatar: "Plik jest większy niż 2 MB." },
      };
    }

    const ext = avatar.type.split("/")[1] ?? "png";
    const key = `${session.user.id}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await avatar.arrayBuffer());

    const sb = createSupabaseAdminClient();
    const { error: upErr } = await sb.storage
      .from("avatars")
      .upload(key, buffer, { contentType: avatar.type, upsert: false });

    if (upErr) {
      return { ok: false, error: `Upload nie powiódł się: ${upErr.message}` };
    }

    const { data: pub } = sb.storage.from("avatars").getPublicUrl(key);
    avatarUrl = pub.publicUrl;
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      name: parsed.data.name,
      timezone: parsed.data.timezone,
      ...(avatarUrl ? { avatarUrl } : {}),
    },
  });

  revalidatePath("/profile");
  revalidatePath("/workspaces");
  return { ok: true, message: avatarUrl ? "Zapisano. Awatar zaktualizowany." : "Zapisano." };
}
