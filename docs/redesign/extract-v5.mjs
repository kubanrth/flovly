// One-off: pull Claude Design v5 mockups out of the Claude Code session
// transcript + persisted tool-result files and write them to docs/redesign/v5/.
// Usage: node docs/redesign/extract-v5.mjs <session.jsonl> <tool-results-dir>
// ponytail: throwaway importer, delete after v5/ is committed.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [jsonl, resultsDir] = process.argv.slice(2);
const outRoot = join(dirname(fileURLToPath(import.meta.url)));
const written = new Map();

function save(obj) {
  if (obj?.method !== "get_file" || typeof obj.path !== "string") return;
  if (!obj.path.startsWith("v5/")) return;
  if (obj.truncated) console.warn("TRUNCATED:", obj.path);
  const content = obj.isBase64 ? Buffer.from(obj.content, "base64") : obj.content;
  const dest = join(outRoot, obj.path);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content);
  written.set(obj.path, Buffer.byteLength(content));
}

function tryParse(s) {
  if (typeof s !== "string" || !s.startsWith('{"method":"get_file"')) return;
  try { save(JSON.parse(s)); } catch (e) { console.warn("bad json", e.message); }
}

// 1) persisted large results
if (resultsDir && existsSync(resultsDir)) {
  for (const f of readdirSync(resultsDir)) {
    if (f.endsWith(".txt")) tryParse(readFileSync(join(resultsDir, f), "utf8"));
  }
}
// 2) inline results inside the transcript
if (jsonl && existsSync(jsonl)) {
  for (const line of readFileSync(jsonl, "utf8").split("\n")) {
    if (!line.includes('\\"method\\":\\"get_file\\"') && !line.includes('"method":"get_file"')) continue;
    let rec; try { rec = JSON.parse(line); } catch { continue; }
    const blocks = rec?.message?.content ?? rec?.content ?? [];
    for (const b of Array.isArray(blocks) ? blocks : []) {
      if (b?.type !== "tool_result") continue;
      const parts = Array.isArray(b.content) ? b.content : [b.content];
      for (const p of parts) tryParse(typeof p === "string" ? p : p?.text);
    }
  }
}

const expected = 50;
console.log(`written ${written.size}/${expected}`);
for (const [p, n] of [...written].sort()) console.log(`${String(n).padStart(7)}  ${p}`);
// self-check: fail loudly if a file is suspiciously small (truncated write)
const tiny = [...written].filter(([p, n]) => p.endsWith(".html") && n < 5000);
if (tiny.length) { console.error("SUSPICIOUSLY SMALL:", tiny); process.exit(1); }
