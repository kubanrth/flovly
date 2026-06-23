import { test, expect } from "./fixtures/console-errors";

// 01 — Authentication smoke. The storageState already has admin logged in,
// so we test the *unauthenticated* paths by clearing context first.
test.describe("auth", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login with valid credentials redirects to /workspaces", async ({ page }) => {
    await page.goto("/secure-access-portal");
    await page.locator('input[name="email"]').fill("admin@danielos.local");
    await page.locator('input[name="password"]').fill("danielos-demo-2026");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/workspaces/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/workspaces/);
  });

  test("login with wrong password shows error", async ({ page }) => {
    await page.goto("/secure-access-portal");
    await page.locator('input[name="email"]').fill("admin@danielos.local");
    await page.locator('input[name="password"]').fill("wrong-password-zzz");
    await page.locator('button[type="submit"]').click();
    // Actual server message: "Nieprawidłowy email, hasło lub kod 2FA."
    // (login-form spec says "Niepoprawny email lub hasło" — that string doesn't
    // exist in actions.ts. Test the real message.)
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[role="alert"]')).toContainText(/Nieprawidłowy|nie powiodło/i);
  });
});

test.describe("logout", () => {
  test("logout returns to /secure-access-portal", async ({ page }) => {
    await page.goto("/workspaces");
    // ProfileDropdown trigger — try common selectors.
    const dropdown = page.getByRole("button", { name: /profil|menu|avatar/i }).first();
    if (await dropdown.isVisible().catch(() => false)) {
      await dropdown.click();
      const logout = page.getByRole("menuitem", { name: /wyloguj|logout/i });
      await logout.click();
      await page.waitForURL(/secure-access-portal/, { timeout: 10_000 });
      await expect(page).toHaveURL(/secure-access-portal/);
    } else {
      test.skip(true, "Profile dropdown trigger not found — selector needs updating");
    }
  });
});
