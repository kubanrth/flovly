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
    await expect(page.locator('p[role="alert"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('p[role="alert"]')).toContainText(/Nieprawidłowy|nie powiodło/i);
  });
});

test.describe("logout", () => {
  // Session strategy is JWT (lib/auth.ts) — signing out here only clears this
  // context's cookie, the shared storageState stays valid for later specs.
  test("logout returns to /secure-access-portal", async ({ page }) => {
    await page.goto("/workspaces");
    await page.locator('[data-ui="topbar"]').getByRole("button", { name: "Menu użytkownika" }).click();
    // signOutAction is a server action answering 303 + x-action-redirect; assert
    // that step separately so a dropped redirect is distinguishable from a
    // menu-click miss.
    const signOut = page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]);
    await page.locator('[data-ui="avatar-menu"]').getByRole("menuitem", { name: "Wyloguj" }).click();
    const resp = await signOut;
    expect(resp.headers()["x-action-redirect"] ?? "").toContain("/secure-access-portal");
    await page.waitForURL(/secure-access-portal/, { timeout: 10_000 });
    await expect(page).toHaveURL(/secure-access-portal/);
  });
});
