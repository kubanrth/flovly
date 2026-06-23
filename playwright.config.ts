import { defineConfig, devices } from "@playwright/test";

// ponytail: minimal config, no env-driven projects/no fancy reporters.
// Single chromium project (+ mobile) keeps run fast; webServer omitted because
// the user said "assume already running" — we only fail if :3100 is dead.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  globalTimeout: 60 * 60 * 1000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // sequential — shared DB
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["setup"],
      testIgnore: /12-mobile-bottom-sheets\.spec\.ts/,
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 12"],
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["setup"],
      testMatch: /12-mobile-bottom-sheets\.spec\.ts/,
    },
  ],
});
