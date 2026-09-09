import assert from "node:assert/strict";
import { ACCESS_MODE, accessLabel, canSeeResource } from "./resource-access";

const admin = { role: "ADMIN" as const, userId: "a" };
const member = { role: "MEMBER" as const, userId: "m" };
const inny = { role: "MEMBER" as const, userId: "x" };
const viewer = { role: "VIEWER" as const, userId: "v" };

// ── private (Hasła, Kontakty, Whiteboardy): prywatne, dopóki ktoś nie udostępni ──
const haslo = { ownerIds: ["m"], accessUserIds: [] as string[] };
assert.equal(canSeeResource("SECRET", admin, haslo), true, "admin widzi wszystko");
assert.equal(canSeeResource("SECRET", member, haslo), true, "autor widzi swoje");
assert.equal(canSeeResource("SECRET", inny, haslo), false, "obcy nie widzi bez udostępnienia");
assert.equal(canSeeResource("SECRET", inny, { ...haslo, accessUserIds: ["x"] }), true, "udostępnione = widzi");
assert.equal(canSeeResource("CANVAS", viewer, { ownerIds: [null], accessUserIds: ["v"] }), true, "VIEWER też widzi to, co mu dano");

// ── restrict (Subskrypcje, Zadania, Widoki): lista działa jak ograniczenie ──
const zadanie = { ownerIds: ["m"], accessUserIds: [] as string[] };
assert.equal(canSeeResource("TASK", inny, zadanie), true, "bez listy widzą wszyscy uprawnieni");
assert.equal(canSeeResource("TASK", inny, { ...zadanie, accessUserIds: ["z"] }), false, "lista zawęża krąg");
assert.equal(canSeeResource("TASK", member, { ...zadanie, accessUserIds: ["z"] }), true, "autor zostaje mimo listy");
assert.equal(canSeeResource("SUBSCRIPTION", admin, { accessUserIds: ["z"] }), true, "admin nadal widzi");

// Tryby są rozdzielone świadomie — pusta lista znaczy co innego w każdym z nich.
assert.equal(ACCESS_MODE.SECRET, "private");
assert.equal(ACCESS_MODE.BOARD_VIEW, "restrict");

assert.equal(accessLabel("SECRET", 0), "Tylko Ty i administratorzy");
assert.equal(accessLabel("TASK", 0), "Wszyscy w przestrzeni");
assert.equal(accessLabel("TASK", 3), "Dostęp: 3");

console.log("resource-access: OK");
