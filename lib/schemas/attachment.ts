import { z } from "zod";
import { maxBytesForMime } from "@/lib/storage";

// Size cap zależy od typu pliku — video do 50 MB, reszta do 25 MB. Refine
// po połączeniu mimeType + sizeBytes żeby zwrócić user-friendly komunikat
// zamiast generycznego "Number must be less than or equal to 26214400".
function withSizeRefine<T extends { mimeType: string; sizeBytes: number }>(
  schema: z.ZodType<T>,
) {
  return schema.superRefine((data, ctx) => {
    const limit = maxBytesForMime(data.mimeType);
    if (data.sizeBytes > limit) {
      const mb = Math.round(limit / (1024 * 1024));
      ctx.addIssue({
        code: "custom",
        path: ["sizeBytes"],
        message: `Plik przekracza limit ${mb} MB dla tego typu.`,
      });
    }
  });
}

export const requestAttachmentUploadSchema = withSizeRefine(
  z.object({
    taskId: z.string().min(1),
    filename: z.string().trim().min(1).max(240),
    mimeType: z.string().min(1).max(200),
    sizeBytes: z.number().int().positive(),
  }),
);

export const confirmAttachmentUploadSchema = withSizeRefine(
  z.object({
    taskId: z.string().min(1),
    storageKey: z.string().min(1),
    filename: z.string().trim().min(1).max(240),
    mimeType: z.string().min(1).max(200),
    sizeBytes: z.number().int().positive(),
  }),
);

export const deleteAttachmentSchema = z.object({
  id: z.string().min(1),
});

export type RequestAttachmentUploadInput = z.infer<typeof requestAttachmentUploadSchema>;
export type ConfirmAttachmentUploadInput = z.infer<typeof confirmAttachmentUploadSchema>;
