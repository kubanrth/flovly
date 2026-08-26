// Self-check for the E2 „Czas pracy" maths:
//   TZ=Europe/Warsaw npx tsx components/time/time-math.check.ts
import assert from "node:assert/strict";
import {
  buildGrid,
  billableSeconds,
  csvRows,
  dayHead,
  dayKey,
  dayLong,
  fmtClock,
  fmtDuration,
  isoWeek,
  parseWeek,
  pct,
  rollUp,
  startOfWeek,
  sumSeconds,
  toCsv,
  visibleDayIndexes,
  weekDays,
  weekRangeLabel,
  type TimeEntryRow,
} from "./time-math";

const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

let seq = 0;
const entry = (over: Partial<TimeEntryRow> & { startedAt: string }): TimeEntryRow => ({
  id: `e${++seq}`,
  userId: "u1",
  userName: "Daniel",
  taskId: null,
  taskDisplayId: null,
  taskTitle: null,
  boardId: null,
  boardName: null,
  note: null,
  durationSeconds: 3600,
  billable: true,
  approvedAt: null,
  ...over,
});

// ─── tydzień: poniedziałek pierwszy, lokalna północ ─────────────────────────
const week = weekDays(new Date(2026, 7, 26, 14, 38)); // środa 26 sierpnia 2026
assert.equal(week.length, 7);
assert.equal(dayKey(week[0]!), "2026-08-24");
assert.equal(dayKey(week[6]!), "2026-08-30");
assert.ok(week.every((d) => d.getDay() === ((week[0]!.getDay() + week.indexOf(d)) % 7)));
assert.ok(week.every((d) => d.getHours() === 0 && d.getMinutes() === 0));
// Poniedziałek zostaje na miejscu, niedziela należy do tygodnia sprzed sześciu dni.
assert.equal(dayKey(startOfWeek(new Date(2026, 7, 24))), "2026-08-24");
assert.equal(dayKey(startOfWeek(new Date(2026, 7, 30, 23, 59))), "2026-08-24");

// DST — wiosenna zmiana czasu w PL wypada w niedzielę 2026-03-29 (doba ma 23 h),
// jesienna 2026-10-25 (25 h). Arytmetyka na milisekundach gubiłaby tu dzień.
const springWeek = weekDays(new Date(2026, 2, 25));
assert.deepEqual(springWeek.map(dayKey), [
  "2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27", "2026-03-28", "2026-03-29",
]);
const autumnWeek = weekDays(new Date(2026, 9, 21));
assert.equal(dayKey(autumnWeek[6]!), "2026-10-25");
assert.equal(new Set(autumnWeek.map(dayKey)).size, 7);
// Wpis w poniedziałek po jesiennej zmianie czasu nie może wpaść do niedzieli.
const dstGrid = buildGrid(
  [entry({ userId: "u1", startedAt: at(2026, 10, 26, 8), durationSeconds: 7200 })],
  weekDays(new Date(2026, 9, 26)),
  ["u1"],
);
assert.equal(dstGrid[0]!.daySeconds[0], 7200); // poniedziałek 26.10
assert.equal(dstGrid[0]!.daySeconds[6], 0);

// ─── wpis przez północ należy do dnia startu ────────────────────────────────
const midnight = buildGrid(
  [entry({ userId: "u1", startedAt: at(2026, 8, 25, 23, 30), durationSeconds: 3600 })], // wt 23:30 → śr 00:30
  week,
  ["u1"],
);
assert.equal(dstGrid.length, 1);
assert.equal(midnight[0]!.daySeconds[1], 3600); // wtorek
assert.equal(midnight[0]!.daySeconds[2], 0); // środa nietknięta
assert.equal(midnight[0]!.total, 3600);

// ─── siatka: scalanie po zadaniu, sortowanie, suma poza kolumnami ───────────
const entries: TimeEntryRow[] = [
  entry({ userId: "u1", startedAt: at(2026, 8, 25, 9), durationSeconds: 12_000, taskId: "t250", taskDisplayId: 250, taskTitle: "Konto", boardName: "P&R" }),
  entry({ userId: "u1", startedAt: at(2026, 8, 25, 14), durationSeconds: 3_600, taskId: "t250", taskDisplayId: 250, taskTitle: "Konto", boardName: "P&R" }),
  entry({ userId: "u1", startedAt: at(2026, 8, 25, 16), durationSeconds: 1_800, note: "spotkania", billable: false }),
  entry({ userId: "u2", userName: "Kuba", startedAt: at(2026, 8, 29, 10), durationSeconds: 5_400, taskId: "t255", taskDisplayId: 255, taskTitle: "Eksport", boardName: "Sklep" }),
  // Sobota — poza Pon–Pt, ale wciąż w sumie tygodnia.
  entry({ userId: "u2", userName: "Kuba", startedAt: at(2026, 8, 29, 10), durationSeconds: 900 }),
];
const grid = buildGrid(entries, week, ["u1", "u2"]);
assert.deepEqual(grid.map((r) => r.personId), ["u1", "u2"]);
const tuesday = grid[0]!.cells[1]!;
assert.equal(tuesday.length, 2); // dwa wpisy #250 scalone w jeden chip + „spotkania"
assert.equal(tuesday[0]!.label, "#250 Konto");
assert.equal(tuesday[0]!.seconds, 15_600); // posortowane malejąco
assert.equal(tuesday[1]!.label, "spotkania");
assert.equal(grid[0]!.total, 17_400);
assert.equal(grid[0]!.daySeconds[1], 17_400);
// Sobota nie jest kolumną Pon–Pt, ale wchodzi do sumy tygodnia osoby.
assert.equal(grid[1]!.total, 6_300);
assert.equal(grid[1]!.daySeconds[5], 6_300);
// Osoba bez wpisów nadal ma wiersz (siatka = wszyscy członkowie).
assert.equal(buildGrid([], week, ["u1", "u3"]).length, 2);
assert.equal(buildGrid([], week, ["u3"])[0]!.total, 0);
// Wpis spoza tygodnia nie wpada do żadnej kolumny ani do sumy osoby w siatce.
const outside = buildGrid([entry({ startedAt: at(2026, 9, 5, 9) })], week, ["u1"]);
assert.equal(outside[0]!.daySeconds.reduce((a, b) => a + b, 0), 0);

// ─── widoczne kolumny: Pon–Pt zawsze, weekend tylko z pracą ─────────────────
assert.deepEqual(visibleDayIndexes([], week), [0, 1, 2, 3, 4]);
assert.deepEqual(visibleDayIndexes([entry({ startedAt: at(2026, 8, 30, 11) })], week), [0, 1, 2, 3, 4, 6]); // niedziela

// ─── formatowanie ───────────────────────────────────────────────────────────
assert.equal(fmtDuration(0), "0m");
assert.equal(fmtDuration(2400), "40m");
assert.equal(fmtDuration(39_600), "11h 00m"); // minuty dopełniane zerem
assert.equal(fmtDuration(33_720), "9h 22m");
assert.equal(fmtDuration(-5), "0m");
assert.equal(fmtClock(2537), "0:42:17");
assert.equal(fmtClock(3600), "1:00:00");
assert.equal(pct(6115, 9700), 63);
assert.equal(pct(1, 0), 0);
assert.equal(dayHead(new Date(2026, 7, 24)), "Pon 24");
assert.equal(dayLong(new Date(2026, 7, 25)), "wtorek 25 sie");
assert.equal(weekRangeLabel(week), "24 – 30 sierpnia 2026");
assert.equal(weekRangeLabel(weekDays(new Date(2026, 8, 30))), "28 września – 4 października 2026");
assert.equal(weekRangeLabel(weekDays(new Date(2026, 11, 31))), "28 grudnia 2026 – 3 stycznia 2027");
assert.equal(isoWeek(new Date(2026, 7, 24)), 35);
assert.equal(isoWeek(new Date(2027, 0, 1)), 53); // piątek — ostatni tydzień 2026 wg ISO

// ─── parsowanie ?week= ──────────────────────────────────────────────────────
const now = new Date(2026, 7, 26);
assert.equal(dayKey(parseWeek("2026-08-27", now)), "2026-08-24");
assert.equal(dayKey(parseWeek(undefined, now)), "2026-08-24");
assert.equal(dayKey(parseWeek("nie-data", now)), "2026-08-24");

// ─── roll-upy raportu ───────────────────────────────────────────────────────
const perBoard = rollUp(entries, (e) => e.boardId ?? e.boardName, (e) => e.boardName ?? "—");
assert.deepEqual(perBoard.map((r) => r.label), ["P&R", "Sklep"]);
assert.equal(perBoard[0]!.seconds, 15_600);
assert.equal(perBoard[0]!.billableSeconds, 15_600);
const perUser = rollUp(entries, (e) => e.userId, (e) => e.userName);
assert.equal(perUser[0]!.label, "Daniel");
assert.equal(perUser[0]!.seconds, 17_400);
assert.equal(perUser[0]!.billableSeconds, 15_600); // „spotkania" niefakturowane
assert.equal(sumSeconds(entries), 23_700);
assert.equal(billableSeconds(entries), 21_900);

// ─── CSV ────────────────────────────────────────────────────────────────────
const rows = csvRows([
  entry({ userId: "u1", startedAt: at(2026, 8, 26, 9), note: 'notatka z "cudzysłowem"; i średnikiem', durationSeconds: 5_400 }),
  entry({ userId: "u1", startedAt: at(2026, 8, 25, 9), taskDisplayId: 250, taskTitle: "Konto", boardName: "P&R", billable: false }),
]);
assert.deepEqual(rows[0], ["data", "osoba", "zadanie", "tablica", "notatka", "godziny", "fakturowane", "zatwierdzone"]);
assert.equal(rows.length, 3);
assert.equal(rows[1]![0], "2026-08-25"); // najstarszy pierwszy
assert.equal(rows[1]![2], "#250 Konto");
assert.equal(rows[1]![6], "nie");
assert.equal(rows[2]![5], "1,50");
const csv = toCsv(rows);
assert.ok(csv.startsWith('"data";"osoba";'));
assert.ok(csv.includes('"notatka z ""cudzysłowem""; i średnikiem"'));
assert.equal(csv.split("\r\n").length, 3);

console.log("time-math.check.ts OK");
