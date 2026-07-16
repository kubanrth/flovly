import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const ATTACHMENTS_BUCKET = "attachments";
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
// Video dostaje wyższy próg (50 MB) — typowe nagrania screen-capture'a klienta
// (np. Loom-export, Cleanshot mp4) potrafią przekroczyć 25 MB. Sprawdzane
// dodatkowo w isAllowedSize() obok ogólnego MAX_ATTACHMENT_BYTES.
export const MAX_VIDEO_ATTACHMENT_BYTES = 50 * 1024 * 1024;
export const SIGNED_DOWNLOAD_TTL_SECONDS = 15 * 60; // 15-minute download URL per brief

// F12-K134: SVG dozwolone z mitigacją XSS. SVG może zawierać <script> —
// niebezpieczne TYLKO gdy plik jest otwarty jako dokument (nawigacja do
// URL). Mitigacja: signed URL dla SVG minted z download:true (Content-
// Disposition: attachment → browser pobiera zamiast renderować), a
// thumbnails renderujemy przez <img src> gdzie skrypty NIE wykonują się
// (spec: SVG w <img> = static image, no scripting context).
//
// Video: dozwolone tylko popularne format'y (mp4 / webm / quicktime). Nie
// dodajemy mkv / avi / wmv żeby uniknąć egzotycznych dekoderów + żeby Safari
// też potrafiło to puścić w <video>. Limit 50 MB per plik (MAX_VIDEO_*).
export const ALLOWED_ATTACHMENT_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "text/markdown",
]);

export function isVideoMime(mime: string): boolean {
  return mime.startsWith("video/");
}

// Cap zależny od typu pliku — video dostaje wyższy próg niż dokumenty.
export function maxBytesForMime(mime: string): number {
  return isVideoMime(mime) ? MAX_VIDEO_ATTACHMENT_BYTES : MAX_ATTACHMENT_BYTES;
}

let cached: SupabaseClient | null = null;

// Service-role client — never ship this to the client. All upload/download
// URLs are generated here and handed to the browser as short-lived tokens.
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase storage env missing");
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

// Deterministic storage key layout: w/{wsId}/t/{taskId}/{randomId}-{safe-name}.
// Keeps paths scoped so a future per-workspace delete / migration is trivial.
export function buildAttachmentKey(params: {
  workspaceId: string;
  taskId: string;
  filename: string;
}): string {
  const safe = sanitizeFilename(params.filename);
  const rand = randomId();
  return `w/${params.workspaceId}/t/${params.taskId}/${rand}-${safe}`;
}

function sanitizeFilename(name: string): string {
  // Keep it ASCII-ish, strip path separators and control chars, cap length.
  const stripped = name
    .replace(/[\\/]/g, "_")
    .replace(/[^\w.\-]/g, "_")
    .replace(/_+/g, "_");
  return stripped.length > 120 ? stripped.slice(-120) : stripped || "file";
}

function randomId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export async function createSignedUploadUrl(key: string): Promise<{
  signedUrl: string;
  token: string;
  path: string;
}> {
  const { data, error } = await supabaseAdmin()
    .storage.from(ATTACHMENTS_BUCKET)
    .createSignedUploadUrl(key);
  if (error || !data) throw error ?? new Error("createSignedUploadUrl failed");
  return { signedUrl: data.signedUrl, token: data.token, path: data.path };
}

export async function createSignedDownloadUrl(
  key: string,
  ttlSeconds: number = SIGNED_DOWNLOAD_TTL_SECONDS,
  // F12-K134: forceDownload → Supabase dodaje Content-Disposition: attachment.
  // Wymagane dla SVG (XSS gdy otwarty jako dokument) — browser pobiera
  // zamiast renderować inline.
  opts?: { forceDownload?: boolean },
): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .storage.from(ATTACHMENTS_BUCKET)
    .createSignedUrl(key, ttlSeconds, opts?.forceDownload ? { download: true } : undefined);
  if (error || !data) throw error ?? new Error("createSignedUrl failed");
  return data.signedUrl;
}

// Download a storage object straight into a Buffer — used when we need
// the bytes server-side (email attachments, PDF export, etc.). Avoids
// round-tripping through a signed URL.
export async function downloadAttachmentBuffer(key: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin()
    .storage.from(ATTACHMENTS_BUCKET)
    .download(key);
  if (error || !data) throw error ?? new Error("downloadAttachment failed");
  const arr = await data.arrayBuffer();
  return Buffer.from(arr);
}

export async function deleteAttachmentObject(key: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .storage.from(ATTACHMENTS_BUCKET)
    .remove([key]);
  if (error) throw error;
}

// Confirms that the client actually uploaded the object before we commit a
// row. Catches abandoned uploads where a signed URL was issued but the
// client never PUT'd the bytes — without this, we'd fill Attachment with
// rows pointing at empty storage keys.
export async function storageObjectExists(key: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .storage.from(ATTACHMENTS_BUCKET)
    .list(key.slice(0, key.lastIndexOf("/")), {
      search: key.slice(key.lastIndexOf("/") + 1),
      limit: 1,
    });
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_ATTACHMENT_MIMES.has(mime);
}

export function isImageMime(mime: string): boolean {
  // F12-K134: SVG dozwolone dla thumbnails — <img src="…svg"> to bezpieczny
  // kontekst (skrypty w SVG nie wykonują się w <img>). Download link dla
  // SVG jest minted z forceDownload (zob. createSignedDownloadUrl).
  return mime.startsWith("image/");
}

export function isSvgMime(mime: string): boolean {
  return mime === "image/svg+xml";
}
