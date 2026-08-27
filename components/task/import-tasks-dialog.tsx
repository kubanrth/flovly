"use client";

// Redesign v5 (B3): Import CSV/XLSX — dialog 560px, 3 kroki: Plik → Podgląd
// → Mapowanie kolumn. Klient parsuje (papaparse / read-excel-file), mapuje
// kolumny na pola i wysyła znormalizowane wiersze do bulkImportTasksAction
// (≤500). Mobile (<768): pełnoekranowy bottom sheet.

import { Fragment, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { IconArrowRight, IconCheck, IconFile, IconUpload } from "@/components/ui/icons";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";
import { plPlural, taskPl } from "@/lib/pluralize";
import { bulkImportTasksAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { ResponsiveDialog, useBoardMeta } from "./create-task-button";

type ImportRow = Parameters<typeof bulkImportTasksAction>[0]["rows"][number];
type TaskField = "ignore" | "title" | "statusName" | "stopAt" | "startAt" | "priority" | "assigneeNames";

// ponytail: Tagi i kolumny custom pominięte — bulkImportTasksAction ich nie przyjmuje (D7).
const FIELD_LABEL: Record<TaskField, string> = {
  title: "Tytuł",
  statusName: "Status",
  stopAt: "Koniec",
  startAt: "Start",
  priority: "Priorytet",
  assigneeNames: "Przypisani",
  ignore: "Pomiń kolumnę",
};
const FIELDS = Object.keys(FIELD_LABEL) as TaskField[];
const STEPS = ["Plik", "Podgląd", "Mapowanie kolumn"];

// Auto-mapowanie po nagłówku; klient może zmienić.
function guessField(header: string): TaskField {
  const h = header.toLowerCase().trim();
  if (/^(tytu[łl]|title|name|nazwa|zadanie|task)/.test(h)) return "title";
  if (/^(status|stan|column|kolumna)/.test(h)) return "statusName";
  if (/^(priorytet|priority|pri\b|p\b)/.test(h)) return "priority";
  if (/^(osob|assign|przypisan|owner|odpowiedz|kto)/.test(h)) return "assigneeNames";
  if (/start|begin|rozpocz|otwarc/.test(h)) return "startAt";
  if (/stop|end|koniec|deadline|termin|due/.test(h)) return "stopAt";
  return "ignore";
}

function normalizePriority(value: string): ImportRow["priority"] {
  const v = value.toLowerCase().trim();
  if (/p0|urgent|piln|najwy[żz]/.test(v)) return "URGENT";
  if (/p1|high|wysok/.test(v)) return "HIGH";
  if (/p2|medium|[śs]red|normal/.test(v)) return "MEDIUM";
  if (/p3|low|nisk/.test(v)) return "LOW";
  return "NONE";
}

const isDateLike = (s: string) => /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{1,2}[./]\d{1,2}[./]\d{4}$/.test(s);
const rowPl = (n: number) => plPlural(n, "wiersz", "wiersze", "wierszy");

type ParsedFile = { headers: string[]; rows: string[][]; fileName: string };

async function parseFile(file: File): Promise<ParsedFile> {
  const lower = file.name.toLowerCase();
  let sheet: unknown[][];
  if (lower.endsWith(".csv")) {
    const Papa = (await import("papaparse")).default;
    const out = Papa.parse<string[]>(await file.text(), { skipEmptyLines: true });
    if (out.errors.length > 0) throw new Error(out.errors[0].message);
    sheet = out.data;
  } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const readXlsxFile = (await import("read-excel-file/browser")).default;
    sheet = (await readXlsxFile(file)) as unknown as unknown[][];
  } else {
    throw new Error("Obsługujemy tylko CSV i XLSX/XLS.");
  }
  if (sheet.length === 0) throw new Error("Plik jest pusty.");
  const headers = sheet[0].map((h) => String(h ?? "").trim());
  const rows = sheet.slice(1, 501).map((r) => headers.map((_, i) => String(r[i] ?? "")));
  return { headers, rows, fileName: file.name };
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="mb-3.5 flex items-center gap-2">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const cur = n === step;
        return (
          <Fragment key={label}>
            {i > 0 && <span className="h-px w-6 shrink-0 bg-border" />}
            <span className={cn("inline-flex items-center gap-1.5 text-xs", cur ? "font-semibold text-foreground" : "text-fg-3")}>
              <span className={cn("inline-flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold", done ? "bg-chip-green-bg text-chip-green-fg" : cur ? "bg-orange-500 text-ink" : "bg-n-100 text-fg-3")}>
                {done ? <IconCheck width={10} height={10} strokeWidth={2.5} /> : n}
              </span>
              {label}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}

export function ImportTasksDialog({ workspaceId, boardId }: { workspaceId: string; boardId: string }) {
  const router = useRouter();
  const toast = useToast();
  const isMobile = useIsMobile();
  const size = isMobile ? "lg" : "md";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<TaskField[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const meta = useBoardMeta(workspaceId, boardId, open);

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setStep(1); setParsed(null); setMapping([]); setError(null); setDragOver(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const p = await parseFile(file);
      setParsed(p);
      setMapping(p.headers.map(guessField));
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się sparsować pliku.");
    }
  };

  const titleCol = mapping.indexOf("title");
  // Wiersze gotowe do wysłania — tylko z niepustym tytułem.
  const rows: ImportRow[] = parsed
    ? parsed.rows
        .map((r) => {
          const row: ImportRow = { title: "" };
          mapping.forEach((field, i) => {
            const cell = (r[i] ?? "").trim();
            if (!cell || field === "ignore") return;
            if (field === "assigneeNames") row.assigneeNames = cell.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
            else if (field === "priority") row.priority = normalizePriority(cell);
            else row[field] = cell;
          });
          return row;
        })
        .filter((r) => r.title.length > 0)
    : [];
  const n = rows.length;

  // „(w trakcie → W toku)" — pierwsza wartość kolumny i status, do którego trafi (case-insensitive jak w akcji).
  const statusHint = (col: number) => {
    const v = parsed?.rows.map((r) => r[col]?.trim()).find(Boolean);
    if (!v) return null;
    const match = meta?.statuses.find((s) => s.name.toLowerCase().trim() === v.toLowerCase());
    return `${v} → ${match?.name ?? meta?.statuses[0]?.name ?? "domyślny"}`;
  };

  const runImport = () => {
    if (titleCol === -1) return setError("Wskaż kolumnę z tytułem zadania.");
    if (n === 0) return setError("Brak wierszy z niepustym tytułem.");
    setError(null);
    startTransition(async () => {
      try {
        const res = await bulkImportTasksAction({ workspaceId, boardId, rows });
        if (!res.ok) return setError(res.error);
        toast.add({
          title: `Zaimportowano ${res.created} ${taskPl(res.created)}`,
          description: res.warnings.length ? `${res.warnings.length} ostrzeżeń · ${res.warnings[0]}` : undefined,
        });
        handleOpenChange(false);
        router.refresh();
      } catch {
        setError("Nie udało się zaimportować zadań.");
      }
    });
  };

  const footer = (
    <>
      {step === 3 && n > 0 && (
        <span className="text-xs text-fg-3 max-md:hidden">
          {n} {taskPl(n)} {plPlural(n, "trafi", "trafią", "trafi")} do tablicy <strong className="font-semibold text-n-700">{meta?.boardName ?? "…"}</strong>
        </span>
      )}
      <span className="flex-1" />
      {step === 1 ? (
        <Button variant="secondary" size={size} onClick={() => handleOpenChange(false)}>Anuluj</Button>
      ) : (
        <Button variant="secondary" size={size} onClick={() => setStep(step - 1)}>Wstecz</Button>
      )}
      {step === 2 && <Button variant="primary" size={size} onClick={() => setStep(3)}>Dalej</Button>}
      {step === 3 && (
        <Button variant="primary" size={size} loading={pending} disabled={pending || titleCol === -1 || n === 0} onClick={runImport}>
          Importuj {n} {taskPl(n)}
        </Button>
      )}
    </>
  );

  const last = (parsed?.headers.length ?? 0) - 1;
  const cellW = (i: number) => (i === 0 ? "flex-[2]" : "flex-1");

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><IconUpload />Import CSV/XLS</Button>
      <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" aria-label="Plik CSV lub XLSX"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />

      <ResponsiveDialog open={open} onOpenChange={handleOpenChange} title="Importuj zadania — CSV / XLSX" size="lg" dataUi="import-dialog" footer={footer}>
        <Stepper step={step} />

        {step === 1 && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) void handleFile(f); }}
            className={cn("flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input-border p-6 text-center outline-none hover:border-input-border-hover", dragOver && "border-orange-500 bg-orange-50")}
          >
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-n-100 text-n-600"><IconUpload /></span>
            <span className="text-base font-semibold">Przeciągnij plik albo kliknij</span>
            <span className="text-xs text-muted-foreground">CSV, XLSX, XLS · max 500 wierszy</span>
          </div>
        )}

        {step > 1 && parsed && (
          <>
            <div className="mb-3 flex h-9 items-center gap-2 rounded-sm border border-border px-2.5">
              <IconFile width={14} height={14} className="shrink-0 text-fg-3" />
              <span className="min-w-0 flex-1 truncate text-sm">{parsed.fileName}</span>
              <span className="shrink-0 font-mono text-2xs text-fg-3">{parsed.rows.length} {rowPl(parsed.rows.length)}</span>
              <Button variant="link" size="sm" onClick={() => fileInputRef.current?.click()}>Zmień plik</Button>
            </div>

            <div className="mb-3 overflow-hidden rounded-sm border border-border">
              <div className="flex h-8 items-center border-b border-border bg-canvas">
                {parsed.headers.map((h, i) => (
                  <span key={i} className={cn("eyebrow min-w-0 truncate px-2.5 text-muted-foreground", cellW(i), i < last && "border-r border-table-grid")}>{h || `Kolumna ${i + 1}`}</span>
                ))}
              </div>
              {parsed.rows.slice(0, 3).map((r, ri) => (
                <div key={ri} className={cn("flex", ri < 2 && "border-b border-n-100")}>
                  {parsed.headers.map((_, i) => (
                    <span key={i} className={cn("min-w-0 truncate px-2.5 py-1.5 text-xs", cellW(i), i < last && "border-r border-n-100", isDateLike(r[i]) && "font-mono text-2xs leading-4 text-muted-foreground")}>{r[i]}</span>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {step === 3 && parsed && (
          <div className="flex flex-col gap-2">
            {parsed.headers.map((h, i) => {
              const skip = mapping[i] === "ignore";
              const hint = mapping[i] === "statusName" ? statusHint(i) : null;
              return (
                <div key={i} className="flex items-center gap-2.5">
                  <span className={cn("w-[120px] shrink-0 truncate font-mono text-xs md:w-[170px]", skip ? "text-fg-3" : "text-n-700")}>{h || `Kolumna ${i + 1}`}</span>
                  <IconArrowRight width={14} height={14} className="shrink-0 text-fg-3" />
                  <Select<TaskField>
                    aria-label={`Mapowanie kolumny ${h || i + 1}`}
                    size={size}
                    value={mapping[i]}
                    onValueChange={(v) => setMapping(mapping.map((x, j) => (j === i ? v : x)))}
                    items={FIELDS.map((f) => ({
                      value: f,
                      label: f === "statusName" && hint ? <>Status <span className="ml-1 text-2xs text-fg-3">({hint})</span></> : FIELD_LABEL[f],
                    }))}
                    className={cn("flex-1", skip && "border-dashed border-n-400 text-fg-3")}
                  />
                </div>
              );
            })}
            {titleCol === -1 && <p className="text-xs text-danger-text">Wskaż kolumnę z tytułem zadania.</p>}
          </div>
        )}

        {error && <p className="mt-3 text-xs text-danger-text">{error}</p>}
      </ResponsiveDialog>
    </>
  );
}
