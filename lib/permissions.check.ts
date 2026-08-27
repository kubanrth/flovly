// Self-check macierzy uprawnień: `npx tsx lib/permissions.check.ts`
//
// Powstał po tym, jak wyszło, że sejf haseł nie miał w katalogu ANI JEDNEJ
// akcji, przez co `passwords/actions.ts` sprawdzało samo członkostwo i rola
// tylko-do-odczytu mogła odszyfrować wszystkie hasła przestrzeni.
import assert from "node:assert/strict";
import { can } from "./permissions";

// VIEWER to gość z podglądem. Nie tworzy, nie kasuje i — przede wszystkim —
// nie odszyfrowuje sekretów.
const VIEWER_MUST_NOT = [
  "secret.read",
  "secret.manage",
  "subscription.manage",
  "workspaceEvent.manage",
  "brief.create",
  "task.create",
  "task.update",
  "task.delete",
  "board.create",
  "board.delete",
  "workspace.inviteMember",
  "workspace.changeRole",
] as const;
for (const action of VIEWER_MUST_NOT) {
  assert.equal(can("VIEWER", action), false, `VIEWER nie może mieć ${action}`);
}

// …ale nadal ma czytać i komentować, inaczej rola traci sens.
for (const action of ["board.view", "task.comment", "poll.vote", "wiki.read", "contact.read", "deal.read"] as const) {
  assert.equal(can("VIEWER", action), true, `VIEWER musi mieć ${action}`);
}

// MEMBER zachowuje dostęp sprzed zmiany — naprawiamy dziurę, nie odbieramy
// zespołowi narzędzi.
for (const action of ["secret.read", "secret.manage", "subscription.manage", "workspaceEvent.manage", "brief.create"] as const) {
  assert.equal(can("MEMBER", action), true, `MEMBER musi mieć ${action}`);
  assert.equal(can("ADMIN", action), true, `ADMIN musi mieć ${action}`);
}

// Tylko ADMIN zarządza przestrzenią.
for (const action of ["workspace.delete", "workspace.changeRole", "workspace.removeMember"] as const) {
  assert.equal(can("ADMIN", action), true);
  assert.equal(can("MEMBER", action), false, `MEMBER nie może mieć ${action}`);
}

console.log("permissions matrix ok");
