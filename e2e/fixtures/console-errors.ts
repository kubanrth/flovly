import { test as base, expect } from "@playwright/test";

// Filter out noisy errors that are not real bugs (3rd-party telemetry, hydration
// noise unrelated to the test). Add patterns here as you discover them.
const IGNORED_ERROR_PATTERNS: RegExp[] = [
  /SuppressMe/,
  /Failed to fetch.*\/_next\/static/, // dev HMR
  /ResizeObserver loop/, // benign chrome quirk
  /\[HMR\]/,
  /sentry/i,
  /Download the React DevTools/,
  // KNOWN APP BUG (2026-08-26): dnd-kit DndContext without a stable `id` →
  // aria-describedby="DndDescribedBy-N" differs server/client on /workspaces,
  // kanban and the mobile table. Tracked by e2e/00-hydration.spec.ts, which
  // FAILS until fixed; ignored here so it doesn't mask every other spec.
  // Remove this pattern together with that spec's failure.
  /hydration-mismatch[\s\S]*DndDescribedBy/,
];

function isIgnored(text: string) {
  return IGNORED_ERROR_PATTERNS.some((p) => p.test(text));
}

type Fixtures = {
  consoleErrors: string[];
};

export const test = base.extend<Fixtures>({
  // auto: true — without it the fixture only ran for tests that destructured
  // `consoleErrors`, i.e. never; the "hard-fail on console errors" guarantee
  // was silently off.
  consoleErrors: [
    async ({ page }, provide) => {
      const errors: string[] = [];

      page.on("pageerror", (err) => {
        const msg = `pageerror: ${err.message}`;
        if (!isIgnored(msg)) errors.push(msg);
      });
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          if (!isIgnored(text)) errors.push(`console.error: ${text}`);
        }
      });

      await provide(errors);

      // Hard-fail any test that triggered an uncaught error.
      if (errors.length > 0) {
        throw new Error(`Console errors caught:\n  - ${errors.join("\n  - ")}`);
      }
    },
    { auto: true },
  ],
});

export { expect };
