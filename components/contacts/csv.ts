// CSV → contact rows for the „Import CSV” dialog. Pure, so
// `contact-model.check.ts` can assert the parser.

export const CSV_FIELDS = [
  "companyName", "firstName", "lastName", "position", "email", "phone",
  "nip", "regon", "vatNumber", "website", "street", "postalCode", "city", "country",
] as const;

export type CsvField = (typeof CSV_FIELDS)[number];
export type ImportedContact = Partial<Record<CsvField, string>>;

// Polish and English header spellings we accept; anything else is ignored.
const HEADERS: Record<string, CsvField> = {
  firma: "companyName", "nazwa firmy": "companyName", nazwa: "companyName", company: "companyName", companyname: "companyName",
  imie: "firstName", "imię": "firstName", firstname: "firstName",
  nazwisko: "lastName", lastname: "lastName",
  stanowisko: "position", position: "position",
  email: "email", "e-mail": "email", mail: "email",
  telefon: "phone", tel: "phone", phone: "phone",
  nip: "nip", regon: "regon", vat: "vatNumber", "vat ue": "vatNumber", vatnumber: "vatNumber",
  www: "website", strona: "website", website: "website",
  ulica: "street", street: "street",
  kod: "postalCode", "kod pocztowy": "postalCode", postalcode: "postalCode",
  miasto: "city", city: "city",
  kraj: "country", country: "country",
};

/** Splits one CSV line, honouring "" quoting. */
function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

const hasIdentity = (c: ImportedContact) =>
  Boolean(c.companyName || c.firstName || c.lastName || c.email);

export function parseContactsCsv(text: string): { rows: ImportedContact[]; skipped: number } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], skipped: 0 };

  const head = lines[0]!;
  const sep = (head.split(";").length > head.split(",").length ? ";" : ",");
  const columns = splitLine(head, sep).map((h) => HEADERS[h.toLowerCase()] ?? null);

  const rows: ImportedContact[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, sep);
    const row: ImportedContact = {};
    columns.forEach((field, i) => {
      const value = cells[i];
      if (field && value) row[field] = value.slice(0, 160);
    });
    if (hasIdentity(row)) rows.push(row);
    else skipped++;
  }
  return { rows, skipped };
}
