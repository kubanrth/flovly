// Support ticket attachments via signed redirect — see /api/brief-image.
// Path layout: w/<wid>/support/<tid>/...

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ATTACHMENTS_BUCKET, supabaseAdmin } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { path } = await params;
  const storageKey = path.join("/");
  if (!storageKey) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const parts = storageKey.split("/");
  if (parts.length < 5 || parts[0] !== "w" || parts[2] !== "support") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const workspaceId = parts[1];

  const membership = await db.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
    select: { id: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin()
    .storage.from(ATTACHMENTS_BUCKET)
    .createSignedUrl(storageKey, 60 * 60);
  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.redirect(data.signedUrl, 302);
}
