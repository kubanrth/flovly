import { z } from "zod";

// Single permissive shape — every field optional so the user can save a "thin"
// contact (just an email, or just a company name) and fill the rest later.
// At least one of [companyName, firstName, lastName, email] must be present so
// the table doesn't fill with truly empty rows.
const richDoc = z
  .object({
    type: z.string().optional(),
    content: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const contactFieldsSchema = z.object({
  firstName: z.string().trim().max(80).optional().or(z.literal("")),
  lastName: z.string().trim().max(80).optional().or(z.literal("")),
  position: z.string().trim().max(120).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .max(255)
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Niepoprawny email.",
    ),
  phone: z.string().trim().max(40).optional().or(z.literal("")),

  companyName: z.string().trim().max(160).optional().or(z.literal("")),
  nip: z.string().trim().max(20).optional().or(z.literal("")),
  regon: z.string().trim().max(20).optional().or(z.literal("")),
  vatNumber: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(255).optional().or(z.literal("")),

  street: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
  country: z.string().trim().max(60).optional().or(z.literal("")),

  ownerId: z.string().trim().min(1).optional().or(z.literal("")),
  notesJson: richDoc.nullable().optional(),
});

export type ContactFieldsInput = z.infer<typeof contactFieldsSchema>;

// Reject the case where the user saves a totally empty form — at least one
// identifying field must be filled so the row is findable.
export function hasIdentity(fields: ContactFieldsInput): boolean {
  return Boolean(
    (fields.companyName && fields.companyName.length > 0) ||
      (fields.firstName && fields.firstName.length > 0) ||
      (fields.lastName && fields.lastName.length > 0) ||
      (fields.email && fields.email.length > 0),
  );
}
