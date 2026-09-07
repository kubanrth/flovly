import assert from "node:assert/strict";
import { canSeeDocument, visibleDocumentsWhere } from "./documents-model";

const doc = { uploaderId: "u-autor", accessUserIds: ["u-gosc"] };

// ADMIN widzi wszystko, także cudze i nieudostępnione.
assert.equal(canSeeDocument({ role: "ADMIN", userId: "u-admin" }, doc), true);
// Wgrywający widzi swoje niezależnie od listy dostępu.
assert.equal(canSeeDocument({ role: "MEMBER", userId: "u-autor" }, { ...doc, accessUserIds: [] }), true);
// Osoba z listy widzi, także VIEWER — dostęp nadaje się per osoba, nie per rola.
assert.equal(canSeeDocument({ role: "VIEWER", userId: "u-gosc" }, doc), true);
// Członek spoza listy nie widzi — ani MEMBER, ani VIEWER.
assert.equal(canSeeDocument({ role: "MEMBER", userId: "u-obcy" }, doc), false);
assert.equal(canSeeDocument({ role: "VIEWER", userId: "u-obcy" }, doc), false);

// Fragment `where` niesie tę samą regułę: admin bez filtra, reszta po autorze lub liście.
assert.deepEqual(visibleDocumentsWhere({ role: "ADMIN", userId: "x" }), {});
assert.deepEqual(visibleDocumentsWhere({ role: "MEMBER", userId: "u1" }), {
  OR: [{ uploaderId: "u1" }, { access: { some: { userId: "u1" } } }],
});

console.log("documents-model: OK");
