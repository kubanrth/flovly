import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not app code: mockups, design refs, one-off scripts.
    "docs/**",
    "design-refs/**",
    "flovly v2/**",
    "scripts/**",
    "Design system specifications*/**",
  ]),
]);

export default eslintConfig;
