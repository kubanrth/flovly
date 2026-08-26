import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const STORAGE = "e2e/.auth/admin.json";
const EMAIL = "admin@danielos.local";
const PASSWORD = "danielos-demo-2026";

setup("authenticate as admin", async ({ page }) => {
  // Ensure dir exists (playwright won't create it).
  fs.mkdirSync(path.dirname(STORAGE), { recursive: true });

  await page.goto("/secure-access-portal");

  // Form uses name= attributes (see login-form.tsx).
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();

  // Successful auth bounces to /workspaces. If user not seeded, we'll get an
  // error toast and timeout here — that's the intended fail-fast.
  try {
    await page.waitForURL(/\/workspaces|\/$/, { timeout: 15_000 });
  } catch {
    // Surface DB-not-seeded explicitly.
    const errorText = await page.locator('[role="alert"]').textContent().catch(() => null);
    throw new Error(
      `Auth failed — likely DB not seeded (no ${EMAIL} user).\n` +
        `Run: npm run db:seed\n` +
        `Server error message: ${errorText ?? "(none)"}`,
    );
  }

  await expect(page).toHaveURL(/\/workspaces/);

  await page.context().storageState({ path: STORAGE });
});

// Board view config (filters/groupBy/widths) persists per view, so a test that
// sets a filter would hide rows for every later test. Reset the seed board's
// TABLE view before each run — keeps specs order-independent.
setup("reset seed fixtures", async () => {
  execFileSync("npx", ["tsx", "e2e/reset-fixtures.ts"], { stdio: "inherit" });
});
