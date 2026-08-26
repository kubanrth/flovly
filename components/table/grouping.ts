import type { ChipHue } from "@/components/ui/chip";
import { PRIORITY_META, PRIORITY_VALUES, type TaskPriorityValue } from "@/lib/task-priority";
import { formatCellValue, parseFieldOptions } from "@/lib/table-fields";
import { bucketForPreset } from "@/lib/group-presets";
import { hueForColor } from "@/components/ui/status-hue";
import type { BoardTableColumn, BoardTableTask, CustomTableColumn } from "@/components/table/types";

export interface GroupBucket {
  key: string;
  label: string;
  hue: ChipHue;
  rows: BoardTableTask[];
  // "Σ 23 200 zł" per visible NUMBER column, already formatted.
  sums: { columnId: string; text: string }[];
}

export const PRIORITY_HUE: Record<TaskPriorityValue, ChipHue> = { URGENT: "red", HIGH: "orange", MEDIUM: "yellow", LOW: "gray", NONE: "gray" };

export function priorityLabel(p: TaskPriorityValue) {
  return p === "NONE" ? "Brak priorytetu" : `${PRIORITY_META[p].shortCode} ${PRIORITY_META[p].label}`;
}

// Sum of NUMBER custom columns over rows; skips blanks/NaN. Returns formatted text per column.
export function sumNumberColumns(rows: BoardTableTask[], numberColumns: CustomTableColumn[]): GroupBucket["sums"] {
  return numberColumns.map((c) => {
    let sum = 0;
    for (const r of rows) {
      const n = Number(r.customValues[c.id] ?? "");
      if (r.customValues[c.id] && Number.isFinite(n)) sum += n;
    }
    return { columnId: c.id, text: formatCellValue("NUMBER", sum, parseFieldOptions(c.options)) };
  });
}

// Ordered buckets; the rendering side iterates without re-sorting. Rows keep the
// incoming (already sorted) order inside each bucket.
export function groupTasks(
  rows: BoardTableTask[],
  groupBy: string | null,
  ctx: { statusColumns: BoardTableColumn[]; customColumns: CustomTableColumn[] },
): GroupBucket[] {
  const numberColumns = ctx.customColumns.filter((c) => c.type === "NUMBER");
  const finish = (b: Omit<GroupBucket, "sums">): GroupBucket => ({ ...b, sums: sumNumberColumns(b.rows, numberColumns) });
  if (!groupBy) return [finish({ key: "_all", label: "", hue: "gray", rows })];

  if (groupBy.startsWith("preset:")) {
    const map = new Map<string, { rows: BoardTableTask[]; label: string; color?: string; order: number }>();
    for (const t of rows) {
      const d = bucketForPreset(groupBy, t);
      const e = map.get(d.key);
      if (e) e.rows.push(t);
      else map.set(d.key, { rows: [t], label: d.label, color: d.color, order: d.order });
    }
    return [...map.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([key, v]) => finish({ key, label: v.label, hue: v.color ? hueForColor(v.color) : "gray", rows: v.rows }));
  }

  if (groupBy === "statusColumnId") {
    const order = ["", ...ctx.statusColumns.map((s) => s.id)];
    const map = new Map<string, BoardTableTask[]>();
    for (const t of rows) {
      const k = t.statusColumnId ?? "";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return [...map.entries()]
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([k, r]) => {
        const s = ctx.statusColumns.find((x) => x.id === k);
        return finish({ key: k || "_empty", label: s?.name ?? "Bez statusu", hue: s ? hueForColor(s.colorHex) : "gray", rows: r });
      });
  }

  if (groupBy === "priority") {
    const map = new Map<TaskPriorityValue, BoardTableTask[]>();
    for (const t of rows) {
      if (!map.has(t.priority)) map.set(t.priority, []);
      map.get(t.priority)!.push(t);
    }
    return PRIORITY_VALUES.filter((p) => map.has(p)).map((p) =>
      finish({ key: p, label: priorityLabel(p), hue: PRIORITY_HUE[p], rows: map.get(p)! }),
    );
  }

  const custom = ctx.customColumns.find((c) => c.id === groupBy);
  const map = new Map<string, BoardTableTask[]>();
  for (const t of rows) {
    const raw =
      groupBy === "title" ? t.title
      : groupBy === "startAt" ? (t.startAt ?? "")
      : groupBy === "stopAt" ? (t.stopAt ?? "")
      : groupBy === "milestone" ? (t.milestone?.title ?? "")
      : (t.customValues[groupBy] ?? "");
    const k = raw || "_empty";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  }
  return [...map.entries()].map(([k, r]) => {
    if (k === "_empty") return finish({ key: k, label: "— brak —", hue: "gray", rows: r });
    if (custom?.type === "SINGLE_SELECT") {
      const opt = (parseFieldOptions(custom.options).selectOptions ?? []).find((o) => o.value === k);
      return finish({ key: k, label: opt?.value ?? k, hue: opt ? hueForColor(opt.color) : "gray", rows: r });
    }
    if (custom?.type === "CHECKBOX") return finish({ key: k, label: k === "true" || k === "1" ? "Zaznaczone" : "Niezaznaczone", hue: "gray", rows: r });
    if (custom?.type === "RATING") return finish({ key: k, label: `${k} ★`, hue: "yellow", rows: r });
    if (groupBy === "startAt" || groupBy === "stopAt") {
      const d = new Date(k);
      return finish({ key: k, label: Number.isNaN(d.getTime()) ? k : d.toLocaleDateString("pl-PL", { dateStyle: "medium" }), hue: "gray", rows: r });
    }
    return finish({ key: k, label: k, hue: "gray", rows: r });
  });
}
