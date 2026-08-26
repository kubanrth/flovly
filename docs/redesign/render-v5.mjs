// Render Claude Design .dc.html mockups to plain HTML + PNG (reference for critics).
// Usage: node docs/redesign/render-v5.mjs   (needs puppeteer from workspace root)
// ponytail: throwaway; delete with extract-v5.mjs once redesign ships.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "../../../../node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "v5");
const outHtml = join(root, "preview"), outPng = join(root, "png");
mkdirSync(outHtml, { recursive: true }); mkdirSync(outPng, { recursive: true });

function toPlain(src) {
  const helmet = /<helmet>([\s\S]*?)<\/helmet>/.exec(src)?.[1] ?? "";
  const dc = /<x-dc>([\s\S]*?)<\/x-dc>/.exec(src)?.[1] ?? src;
  const body = dc.replace(/<helmet>[\s\S]*?<\/helmet>/, "");
  const w = /&quot;width&quot;:(\d+)/.exec(src)?.[1] ?? "1440";
  const h = /&quot;height&quot;:(\d+)/.exec(src)?.[1] ?? "900";
  return { html: `<!DOCTYPE html><html><head><meta charset="utf-8">${helmet}</head><body>${body}</body></html>`, w: +w, h: +h };
}

const files = readdirSync(root).filter((f) => f.endsWith(".dc.html"));
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
for (const f of files) {
  const { html, w, h } = toPlain(readFileSync(join(root, f), "utf8"));
  const name = f.replace(".dc.html", "");
  writeFileSync(join(outHtml, name + ".html"), html);
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load", timeout: 30000 }).catch(() => {});
  await Promise.race([page.evaluate(() => document.fonts.ready), new Promise((r) => setTimeout(r, 8000))]);
  await page.screenshot({ path: join(outPng, name + ".png"), fullPage: true });
  console.log(`${name} ${w}x${h}`);
}
await browser.close();
// self-check: every mockup produced a png
const pngs = readdirSync(outPng).length;
if (pngs !== files.length) { console.error(`FAIL ${pngs}/${files.length}`); process.exit(1); }
console.log(`ok ${pngs}/${files.length}`);
