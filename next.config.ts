import type { NextConfig } from "next";
import path from "node:path";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

// Bundle analyzer: `ANALYZE=true npm run build` opens a treemap report
// in the browser for each compiled route + chunk. Off by default so
// normal builds stay fast.
const withAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

const nextConfig: NextConfig = {
  // F12-K49: standalone output dla Docker deployu na Hetzner/Coolify.
  // .next/standalone zawiera zminimalizowany server.js + tylko wymagane
  // dependencies — image ~150MB zamiast ~500MB.
  output: "standalone",
  // Avatars/attachments are served from Supabase Storage (public bucket URLs).
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
  turbopack: {
    root: path.join(__dirname),
  },
  // Hard no-index for the entire app — complements the <meta> in root
  // layout and the /robots.ts route. Covers crawlers that ignore HTML
  // meta but respect headers.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

// Sentry wraps the config after the analyzer so source-map upload runs
// on the analyzed output. Opts:
//   silent      → quiet logs outside CI
//   org/project → only used when SENTRY_AUTH_TOKEN is available (Vercel)
//   widenClientFileUpload → better stack traces on minified client chunks
//   tunnelRoute → proxies Sentry events through /monitoring-errors so
//                 ad-blockers don't swallow them
// Source-map upload is skipped automatically when SENTRY_AUTH_TOKEN is
// absent, so local `npm run build` stays fast.
const withSentry = (config: NextConfig) =>
  withSentryConfig(config, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: !process.env.CI,
    widenClientFileUpload: true,
    tunnelRoute: "/monitoring-errors",
  });

export default withSentry(withAnalyzer(nextConfig));
