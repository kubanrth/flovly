// Self-check for the pure Kontakty helpers: `npx tsx components/contacts/contact-model.check.ts`
import assert from "node:assert/strict";
import {
  contactKind,
  contactName,
  contactSubtitle,
  contactsCountLabel,
  docText,
  filterContacts,
  formatLastContact,
  initialsOf,
  KIND_HUE,
  type ContactRow,
} from "./contact-model";
import { parseContactsCsv } from "./csv";

const row = (over: Partial<ContactRow>): ContactRow => ({
  id: "c", companyName: null, firstName: null, lastName: null, position: null, email: null,
  phone: null, nip: null, city: null, dealCount: 0, owner: null,
  lastContactAt: "2026-08-20T10:00:00Z", lastContactNote: null,
  ...over,
});

// Kind: person wins over company; a bare company splits on deals.
assert.equal(contactKind(row({ companyName: "Legia", firstName: "Tomasz" })), "person");
assert.equal(contactKind(row({ companyName: "Legia", dealCount: 2 })), "client");
assert.equal(contactKind(row({ companyName: "PrintHouse" })), "supplier");
assert.equal(KIND_HUE[contactKind(row({ companyName: "Legia", dealCount: 1 }))], "green");
assert.equal(KIND_HUE[contactKind(row({ companyName: "PrintHouse" }))], "indigo");
assert.equal(KIND_HUE[contactKind(row({ lastName: "Sowińska" }))], "gray");

assert.equal(contactName(row({ companyName: "Legia", firstName: "Tomasz", lastName: "Wierzbicki" })), "Tomasz Wierzbicki");
assert.equal(contactName(row({ companyName: "Legia Warszawa S.A." })), "Legia Warszawa S.A.");
assert.equal(contactName(row({ email: "a@b.pl" })), "a@b.pl");
assert.equal(contactName(row({})), "—");

assert.equal(contactSubtitle(row({ companyName: "Legia", dealCount: 1, position: "sklep kibica" })), "klient · sklep kibica");
assert.equal(contactSubtitle(row({ companyName: "PrintHouse", position: "druk metek" })), "dostawca · druk metek");
assert.equal(contactSubtitle(row({ companyName: "Legia", firstName: "Tomasz", position: "e-commerce manager" })), "Legia · e-commerce manager");
assert.equal(contactSubtitle(row({ firstName: "Anna", position: "księgowość zewnętrzna" })), "księgowość zewnętrzna");
assert.equal(contactSubtitle(row({ firstName: "Anna" })), null);

assert.equal(initialsOf("Legia Warszawa S.A."), "LW");
assert.equal(initialsOf("KurierPro / DPD"), "KD");
assert.equal(initialsOf("P&R Kickback"), "PR");
assert.equal(initialsOf("&&&"), "?");

// Relative dates around a fixed „now” (local time, like the browser renders).
const now = new Date(2026, 7, 27, 12, 0);
assert.equal(formatLastContact(new Date(2026, 7, 27, 8).toISOString(), now), "dziś");
assert.equal(formatLastContact(new Date(2026, 7, 26, 23).toISOString(), now), "wczoraj");
assert.equal(formatLastContact(new Date(2026, 7, 24).toISOString(), now), "pon");
assert.equal(formatLastContact(new Date(2026, 7, 14).toISOString(), now), "14 sie");
assert.equal(formatLastContact(new Date(2025, 7, 14).toISOString(), now), "14 sie 2025");
assert.equal(formatLastContact("nonsense", now), "—");

const rows = [
  row({ id: "a", companyName: "Legia Warszawa S.A.", dealCount: 1, email: "esklep@legia.pl", owner: { id: "u1", name: "Daniel", email: "d@x.pl", avatarUrl: null } }),
  row({ id: "b", companyName: "PrintHouse", email: "biuro@printhouse.pl" }),
  row({ id: "c", firstName: "Tomasz", lastName: "Wierzbicki", companyName: "Legia", owner: { id: "u2", name: "Marta", email: "m@x.pl", avatarUrl: null } }),
];
const ids = (r: ContactRow[]) => r.map((x) => x.id);
assert.deepEqual(ids(filterContacts(rows, { q: "", kind: "all", ownerId: "all" })), ["a", "b", "c"]);
assert.deepEqual(ids(filterContacts(rows, { q: "legia", kind: "all", ownerId: "all" })), ["a", "c"]);
assert.deepEqual(ids(filterContacts(rows, { q: "", kind: "supplier", ownerId: "all" })), ["b"]);
assert.deepEqual(ids(filterContacts(rows, { q: "", kind: "all", ownerId: "u2" })), ["c"]);
assert.deepEqual(ids(filterContacts(rows, { q: "", kind: "all", ownerId: "none" })), ["b"]);
assert.deepEqual(ids(filterContacts(rows, { q: "PRINT", kind: "person", ownerId: "all" })), []);

assert.equal(contactsCountLabel(38), "38 firm i osób");
assert.equal(docText({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "demo  sklepu" }] }] }), "demo sklepu");
assert.equal(docText({ content: [{ text: "abcdef" }] }, 4), "abc…");
assert.equal(docText(null), "");

// CSV: header aliases, semicolon separator, quoted commas, rows without identity.
const csv = parseContactsCsv(
  'Firma;Imię;Nazwisko;E-mail;Telefon;NIP;Nieznana\n' +
  'Legia Warszawa S.A.;;;esklep@legia.pl;+48 22 318 20 00;521-30-15-379;x\n' +
  ';Anna;Sowińska;a.sowinska@ksiegowa.pl;;;\n' +
  ';;;;+48 500 000 000;;\n',
);
assert.equal(csv.skipped, 1);
assert.deepEqual(csv.rows, [
  { companyName: "Legia Warszawa S.A.", email: "esklep@legia.pl", phone: "+48 22 318 20 00", nip: "521-30-15-379" },
  { firstName: "Anna", lastName: "Sowińska", email: "a.sowinska@ksiegowa.pl" },
]);
assert.deepEqual(
  parseContactsCsv('company,city\n"Kowalski, s.c.",Łódź\n').rows,
  [{ companyName: "Kowalski, s.c.", city: "Łódź" }],
);
assert.deepEqual(parseContactsCsv("Firma\n").rows, []);

console.log("contact helpers ok");
