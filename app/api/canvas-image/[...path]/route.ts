// Whiteboard images via signed redirect — see /api/brief-image.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCanvasImageDownloadUrl } from "@/app/(app)/w/[workspaceId]/c/actions";

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

  const signedUrl = await getCanvasImageDownloadUrl(storageKey, session.user.id);
  if (!signedUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.redirect(signedUrl, 302);
}
