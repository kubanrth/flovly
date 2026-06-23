"use client";

// F12-K77: dialog importu zadań z CSV / XLS.
// Flow:
//   1. User klika "Importuj" w nagłówku tablicy
//   2. Drop zone → wybiera plik (.csv / .xlsx / .xls)
//   3. Klient parsuje (papaparse / read-excel-file) → pierwsze 5 wierszy preview
//   4. Mapping UI: dropdown per kolumna → field (Title*, Status, Priority, Assignees, StartAt, StopAt)
//   5. Submit → bulkImportTasksAction (max 500 wierszy per call)
//   6. Wynik: count utworzonych + ostrzeżenia (statusy/userzy nieznajdene)

import { startTransition, useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, AlertCircle, CheckCircle2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { bulkImportTasksAction } from "@/app/(app)/w/[workspaceId]/t/actions";

type TaskField =
  | "ignore"
  | "title"
  | "statusName"
  | "priority"
  | "assigneeNames"
  | "startAt"
  | "stopAt";

const FIELD_OPTIONS: { value: TaskField; label: string; required?: boolean }[] = [
  { value: "ignore", label: "— ignoruj —" },
  { value: "title", label: "Tytuł *", required: true },
  { value: "statusName", label: "Status" },
  { value: "priority", label: "Priorytet" },
  { value: "assigneeNames", label: "Osoby (oddzielone przecinkiem)" },
  { value: "startAt", label: "Data startu" },
  { value: "stopAt", label: "Deadline" },
];

// Heurystyka auto-mapping'u — jeśli nagłówek pliku CSV pasuje do typowych
// nazw, zmapujemy automatycznie. Klient może zmienić.
function guessField(header: string): TaskField {
  const h = header.toLowerCase().trim();
  if (h.match(/^(tytu[łl]|title|name|zadanie|task)/)) return "title";
  if (h.match(/^(status|stan|column|kolumna)/)) return "statusName";
  if (h.match(/^(priorytet|priority|pri\b|p\b)/)) return "priority";
  if (h.match(/^(osob|assign|przypisan|owner|odpowiedz)/)) return "assigneeNames";
  if (h.match(/(start|begin|rozpocz|otwarc)/)) return "startAt";
  if (h.match(/(stop|end|koniec|deadline|termin|due)/)) return "stopAt";
  return "ignore";
}

function normalizePriority(value: string): "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT" {
  const v = value.toLowerCase().trim();
  if (!v || v === "brak" || v === "none" || v === "-") return "NONE";
  if (v.match(/p0|urgent|pilne|pilny|najwy[żz]/)) return "URGENT";
  if (v.match(/p1|high|wysoki|wysoka/)) return "HIGH";
  if (v.match(/p2|medium|śred|srednia|sredni|normal/)) return "MEDIUM";
  if (v.match(/p3|low|niski|niska/)) return "LOW";
  return "NONE";
}

type ParsedFile = {
  headers: string[];
  rows: string[][];
  fileName: string;
};

export function ImportTasksDialog({
  workspaceId,
  boardId,
}: {
  workspaceId: string;
  boardId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<TaskField[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    warnings: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const reset = useCallback(() => {
    setParsed(null);
    setMapping([]);
    setParseError(null);
    setResult(null);
    setDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ─────────── File parsing ──────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setParseError(null);
    setResult(null);
    const lower = file.name.toLowerCase();
    try {
      let headers: string[];
      let rows: string[][];

      if (lower.endsWith(".csv")) {
        const Papa = (await import("papaparse")).default;
        const text = await file.text();
        const parsed = Papa.parse<string[]>(text, {
          skipEmptyLines: true,
        });
        if (parsed.errors.length > 0) {
          throw new Error(parsed.errors[0].message);
        }
        if (parsed.data.length === 0) throw new Error("Plik jest pusty.");
        headers = parsed.data[0].map((h) => String(h ?? "").trim());
        rows = parsed.data.slice(1).map((r) => r.map((c) => String(c ?? "")));
      } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        // read-excel-file nie ma .d.ts — any-cast import, runtime same.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const readXlsxFile = (await import("read-excel-file" as any)).default;
        const sheet = (await readXlsxFile(file)) as unknown[][];
        if (sheet.length === 0) throw new Error("Plik jest pusty.");
        headers = sheet[0].map((h) => String(h ?? "").trim());
        rows = sheet.slice(1).map((r) => r.map((c) => String(c ?? "")));
      } else {
        throw new Error("Obsługujemy tylko CSV i XLSX/XLS.");
      }

      // Sanity: max 500 rows.
      if (rows.length > 500) {
        rows = rows.slice(0, 500);
      }

      setParsed({ headers, rows, fileName: file.name });
      setMapping(headers.map(guessField));
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Nie udało się sparsować pliku.");
    }
  }, []);

  // ─────────── Submit import ─────────────────────────────────────────────

  const titleColIdx = useMemo(
    () => mapping.findIndex((f) => f === "title"),
    [mapping],
  );

  const handleImport = useCallback(() => {
    if (!parsed) return;
    if (titleColIdx === -1) {
      setParseError("Musisz wskazać kolumnę z tytułem zadania.");
      return;
    }
    const rows = parsed.rows
      .map((r) => {
        const row: Record<string, unknown> = {};
        for (let i = 0; i < mapping.length; i++) {
          const field = mapping[i];
          const cell = (r[i] ?? "").trim();
          if (!cell || field === "ignore") continue;
          if (field === "assigneeNames") {
            row.assigneeNames = cell
              .split(/[,;|]/)
              .map((s) => s.trim())
              .filter(Boolean);
          } else if (field === "priority") {
            row.priority = normalizePriority(cell);
          } else {
            row[field] = cell;
          }
        }
        return row;
      })
      .filter((r) => typeof r.title === "string" && (r.title as string).length > 0);

    if (rows.length === 0) {
      setParseError("Brak wierszy z poprawnym tytułem.");
      return;
    }

    setImporting(true);
    setParseError(null);
    startTransition(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await bulkImportTasksAction({ workspaceId, boardId, rows: rows as any });
      setImporting(false);
      if (!res.ok) {
        setParseError(res.error);
        return;
      }
      setResult({ created: res.created, warnings: res.warnings });
      router.refresh();
    });
  }, [parsed, mapping, titleColIdx, workspaceId, boardId, router]);

  // ─────────── Render ────────────────────────────────────────────────────

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <FileUp size={13} />
        <span>Import CSV/XLS</span>
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="dialog-glass rounded-2xl border-transparent sm:max-w-[680px]">
          <DialogHeader>
            <span className="eyebrow">Import zadań</span>
            <DialogTitle className="font-display text-[1.45rem] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
              Wczytaj <span className="text-brand-gradient">CSV / XLSX</span>
            </DialogTitle>
            <DialogDescription className="text-[0.9rem] leading-[1.55] text-muted-foreground">
              Przeciągnij plik albo kliknij &mdash; sprawdzimy nagłówki i automatycznie
              zmapujemy kolumny. Max 500 zadań naraz.
            </DialogDescription>
          </DialogHeader>

          {/* Result state */}
          {result && (
            <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <h4 className="font-display text-[1rem] font-semibold text-foreground">
                  Zaimportowano {result.created} zadań
                </h4>
              </div>
              {result.warnings.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-amber-600">
                    Ostrzeżenia ({result.warnings.length})
                  </span>
                  <ul className="flex flex-col gap-0.5 text-[0.82rem] text-muted-foreground">
                    {result.warnings.slice(0, 5).map((w, i) => (
                      <li key={i}>· {w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="self-end font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
              >
                Zamknij
              </button>
            </div>
          )}

          {/* Drop zone / parsing state */}
          {!result && !parsed && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) void handleFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              data-hover={dragOver ? "true" : "false"}
              className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background/50 px-6 transition-[border-color,background-color] hover:border-primary/40 data-[hover=true]:border-primary/60 data-[hover=true]:bg-primary/5"
            >
              <FileUp size={28} className="text-muted-foreground" />
              <p className="font-display text-[0.95rem] font-semibold text-foreground">
                Przeciągnij plik albo kliknij
              </p>
              <p className="text-[0.78rem] leading-[1.5] text-muted-foreground">
                CSV, XLSX, XLS · max 500 wierszy
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
            </div>
          )}

          {/* Mapping UI */}
          {!result && parsed && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-md border border-border bg-background/50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <FileUp size={14} className="text-primary" />
                  <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-foreground">
                    {parsed.fileName}
                  </span>
                  <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
                    · {parsed.rows.length} wierszy
                  </span>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Anuluj — wybierz inny plik"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Mapping table */}
              <div className="flex flex-col gap-1">
                <span className="eyebrow">Mapowanie kolumn</span>
                <div className="flex flex-col divide-y divide-border rounded-md border border-border">
                  {parsed.headers.map((header, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-display text-[0.86rem] font-semibold text-foreground">
                          {header || `(kolumna ${i + 1})`}
                        </span>
                        <span className="line-clamp-1 font-mono text-[0.62rem] text-muted-foreground/70">
                          przykład: {parsed.rows[0]?.[i] ?? "—"}
                        </span>
                      </div>
                      <span className="font-mono text-[0.66rem] text-muted-foreground/40">
                        →
                      </span>
                      <select
                        value={mapping[i]}
                        onChange={(e) => {
                          const next = [...mapping];
                          next[i] = e.target.value as TaskField;
                          setMapping(next);
                        }}
                        className="h-9 rounded-md border border-border bg-background px-2 text-[0.82rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        {FIELD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {titleColIdx === -1 && (
                  <p className="flex items-center gap-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-amber-600">
                    <AlertCircle size={11} />
                    Musisz wskazać kolumnę z tytułem zadania.
                  </p>
                )}
              </div>

              {parseError && (
                <p className="flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-destructive">
                  <AlertCircle size={11} />
                  {parseError}
                </p>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing || titleColIdx === -1}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px] disabled:opacity-60"
                >
                  {importing ? "Importuję…" : `Importuj ${parsed.rows.length} zadań`}
                </button>
              </div>
            </div>
          )}

          {/* Standalone parse error (przed wyborem pliku) */}
          {!parsed && parseError && (
            <p className="flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-destructive">
              <AlertCircle size={11} />
              {parseError}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
