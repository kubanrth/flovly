import { test, expect } from "./fixtures/console-errors";

// Pins the dnd-kit hydration mismatch (aria-describedby="DndDescribedBy-N"
// differs server/client because DndContext has no stable `id`). The global
// console-errors fixture ignores this exact pattern so the rest of the suite
// gives signal; this spec is the single place it must FAIL until fixed.
// Fix: pass `id="…"` to <DndContext> in components/workspaces/sortable-workspaces.tsx
// (and the kanban / mobile table DndContexts), like sidebar.tsx already does.
test("pages hydrate without dnd-kit aria-describedby mismatch", async ({ page }) => {
  const mismatches: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /DndDescribedBy/.test(msg.text())) mismatches.push(msg.text().slice(0, 80));
  });
  await page.goto("/workspaces");
  await page.waitForLoadState("networkidle");
  expect(mismatches, "hydration mismatch on /workspaces").toEqual([]);
});
