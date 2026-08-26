// Self-check: `npx tsx components/canvas/create-once.check.ts`
import assert from "node:assert/strict";
import { createOnce } from "./create-once";

const conflict = Object.assign(new Error("unique"), { code: "P2002" });

void (async () => {
  // Happy path: create wins, read is never consulted.
  let reads = 0;
  assert.equal(await createOnce(async () => "made", async () => { reads++; return "read"; }), "made");
  assert.equal(reads, 0);

  // Lost the race: fall back to whatever the winner wrote.
  assert.equal(await createOnce(async () => { throw conflict; }, async () => "winner"), "winner");

  // Conflict but nothing to read — the original error must surface, not null.
  await assert.rejects(createOnce(async () => { throw conflict; }, async () => null), /unique/);

  // Any other failure propagates untouched.
  await assert.rejects(createOnce(async () => { throw new Error("boom"); }, async () => "x"), /boom/);

  console.log("create-once ok");
})();
