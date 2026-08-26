// Self-check for the pure Roadmapa (B6) helpers:
// `npx tsx components/roadmap/roadmap-model.check.ts`
import assert from "node:assert/strict";
import {
  MONTH_W,
  arcAngle,
  arcPath,
  arrowHead,
  axisWidth,
  docToText,
  doneStatusIds,
  markerFontSize,
  markerHue,
  markerSize,
  milestoneLabel,
  monthColumns,
  progressOf,
  sortMilestones,
  spanX,
  textToDoc,
  xForTs,
} from "./roadmap-model";

const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d).toISOString();
const now = new Date(2026, 7, 20).getTime(); // 20 sie 2026

// ── axis ─────────────────────────────────────────────────────────────────────
const months = monthColumns([{ startAt: iso(2026, 8, 10), stopAt: iso(2026, 11, 27) }], now);
assert.deepEqual(
  months.map((m) => new Date(m.ts).getMonth()),
  [7, 8, 9, 10],
  "sierpień → listopad",
);
assert.equal(axisWidth(months), 4 * MONTH_W);
// Empty roadmap still gets a two-column grid around today.
assert.equal(monthColumns([], now).length, 2);
// Garbage dates never widen the axis.
assert.equal(monthColumns([{ startAt: "nope", stopAt: "" }], now).length, 2);

assert.equal(xForTs(months[0]!.ts, months), 0);
assert.equal(xForTs(months[2]!.ts, months), 2 * MONTH_W);
// Mid-September (day 16 of 30) sits ~half-way through its column.
const midSep = xForTs(new Date(2026, 8, 16).getTime(), months);
assert.ok(midSep > MONTH_W * 1.4 && midSep < MONTH_W * 1.6, `midSep=${midSep}`);
// Out-of-range timestamps clamp instead of drawing off-canvas.
assert.equal(xForTs(new Date(2020, 0, 1).getTime(), months), 0);
assert.equal(xForTs(new Date(2030, 0, 1).getTime(), months), axisWidth(months));
assert.equal(xForTs(Number.NaN, months), 0);

const bar = spanX(iso(2026, 9, 1), iso(2026, 9, 8), months, 220);
assert.equal(bar.left, MONTH_W);
assert.equal(bar.width, 220, "minWidth wins over a 7-day span");
assert.ok(spanX(iso(2026, 8, 1), iso(2026, 11, 1), months).width > 220);

// ── done statuses + progress ────────────────────────────────────────────────
const cols = [
  { id: "a", name: "Do zrobienia", order: 0 },
  { id: "b", name: "W trakcie", order: 1 },
  { id: "c", name: "Gotowe", order: 2 },
];
assert.deepEqual([...doneStatusIds(cols)], ["c"]);
// No "done"-ish name → the terminal column (by order, not array position).
assert.deepEqual(
  [...doneStatusIds([
    { id: "x", name: "Backlog", order: 5 },
    { id: "y", name: "Testy", order: 1 },
  ])],
  ["x"],
);
assert.deepEqual([...doneStatusIds([])], []);

const done = doneStatusIds(cols);
assert.deepEqual(progressOf([{ statusColumnId: "c" }, { statusColumnId: "a" }], done), {
  done: 1,
  total: 2,
  pct: 50,
});
assert.deepEqual(progressOf([], done), { done: 0, total: 0, pct: 0 });
assert.deepEqual(progressOf([{ statusColumnId: null }], done), { done: 0, total: 1, pct: 0 });

// ── markers ──────────────────────────────────────────────────────────────────
assert.equal(markerHue(0), "gray");
assert.equal(markerHue(20), "blue"); // B6: 1/5
assert.equal(markerHue(70), "green"); // B6: 7/10
assert.equal(markerHue(100), "green");
// Diameters read straight off B6-roadmapa-markery.
assert.deepEqual([4, 5, 8, 10].map(markerSize), [40, 44, 48, 52]);
assert.equal(markerFontSize(52), 15);
assert.equal(markerFontSize(40), 14);

// ── ordering ─────────────────────────────────────────────────────────────────
assert.deepEqual(
  sortMilestones([
    { title: "B", startAt: iso(2026, 9, 1), stopAt: iso(2026, 10, 10) },
    { title: "A", startAt: iso(2026, 8, 1), stopAt: iso(2026, 9, 25) },
    { title: "C", startAt: iso(2026, 9, 1), stopAt: iso(2026, 9, 30) },
  ]).map((m) => m.title),
  ["A", "C", "B"],
);
assert.equal(milestoneLabel(0), "M1");
assert.equal(milestoneLabel(3), "M4");

// ── arcs ─────────────────────────────────────────────────────────────────────
assert.equal(arcPath(100, 200, 400, 200, -60), "M 100 200 C 200 140, 300 140, 400 200");
// End tangent points right-and-down when the arc bows upwards.
const ang = arcAngle(100, 200, 400, 200, -60);
assert.ok(Math.cos(ang) > 0 && Math.sin(ang) > 0, `angle=${ang}`);
const head = arrowHead(400, 200, 0, 6);
assert.match(head, /^M 400 200 L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ Z$/);

// ── opis ⇄ doc ───────────────────────────────────────────────────────────────
const docJson = textToDoc("Pierwszy wiersz\nDrugi");
assert.equal(docToText(JSON.parse(docJson)), "Pierwszy wiersz\nDrugi");
assert.equal(textToDoc("   "), "", "puste = wyczyść opis");
assert.equal(docToText(null), "");
assert.equal(docToText({ type: "doc", content: [{ type: "paragraph" }] }), "");
// Marks/nested inline nodes flatten instead of vanishing.
assert.equal(
  docToText({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] }],
  }),
  "ab",
);

console.log("roadmap model ok");
