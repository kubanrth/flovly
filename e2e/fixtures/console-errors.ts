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
];

function isIgnored(text: string) {
  return IGNORED_ERROR_PATTERNS.some((p) => p.test(text));
}

type Fixtures = {
  consoleErrors: string[];
};

export const test = base.extend<Fixtures>({
  consoleErrors: async ({ page }, use) => {
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

    await use(errors);

    // Hard-fail any test that triggered an uncaught error.
    if (errors.length > 0) {
      throw new Error(`Console errors caught:\n  - ${errors.join("\n  - ")}`);
    }
  },
});

export { expect };
