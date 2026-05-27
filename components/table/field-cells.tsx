"use client";

import { startTransition, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, ExternalLink, Mail, Phone, Star, X } from "lucide-react";
import { setTaskCustomValueAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import {
  decodeCellValue,
  formatCellValue,
  type FieldOptions,
  type FieldType,
  type SelectOption,
} from "@/lib/table-fields";

interface CellProps {
  taskId: string;
  columnId: string;
  type: FieldType;
  raw: string;
  options: FieldOptions | null;
  disabled: boolean;
}

// Submit a new stored string for this (task, column). Empty = clear.
function commit(taskId: string, columnId: string, value: string) {
  const fd = new FormData();
  fd.set("taskId", taskId);
  fd.set("columnId", columnId);
  fd.set("value", value);
  startTransition(() => setTaskCustomValueAction(fd));
}

// Read-only fallback used by every type when the user can't edit.
function ReadOnly({
  type,
  raw,
  options,
}: {
  type: FieldType;
  raw: string;
  options: FieldOptions | null;
}) {
  const decoded = decodeCellValue(type, raw);
  if (decoded === null || decoded === "") return <Dash />;
  return (
    <span className="truncate text-[0.88rem]">
      {formatCellValue(type, decoded, options)}
    </span>
  );
}

function Dash() {
  return <span className="font-mono text-[0.7rem] text-muted-foreground/60">—</span>;
}

export function FieldCell(props: CellProps) {
  if (props.disabled) return <ReadOnly type={props.type} raw={props.raw} options={props.options} />;
  switch (props.type) {
    case "TEXT":
    case "URL":
    case "EMAIL":
    case "PHONE":
      return <TextLikeCell {...props} />;
    case "LONG_TEXT":
      return <LongTextCell {...props} />;
    case "NUMBER":
      return <NumberCell {...props} />;
    case "DATE":
      return <DateCell {...props} />;
    case "CHECKBOX":
      return <CheckboxCell {...props} />;
    case "SINGLE_SELECT":
      return <SingleSelectCell {...props} />;
    case "MULTI_SELECT":
      return <MultiSelectCell {...props} />;
    case "RATING":
      return <RatingCell {...props} />;
    case "CREATED_TIME":
    case "LAST_MODIFIED_TIME":
    case "AUTO_NUMBER":
    case "USER":
    case "ATTACHMENT":
      // Computed / not yet implemented — render decoded value read-only.
      return <ReadOnly type={props.type} raw={props.raw} options={props.options} />;
  }
}

// Plain text input — also handles URL / EMAIL / PHONE since they store
// the raw string. The visual affordance differs (icon prefix + click
// to follow) so we render that on top of the input.
function TextLikeCell({ taskId, columnId, type, raw }: CellProps) {
  const followHref =
    type === "URL"
      ? raw && /^https?:\/\//.test(raw)
        ? raw
        : raw
          ? `https://${raw}`
          : null
      : type === "EMAIL"
        ? raw
          ? `mailto:${raw}`
          : null
        : type === "PHONE"
          ? raw
            ? `tel:${raw.replace(/\s+/g, "")}`
            : null
          : null;

  return (
    <div className="flex items-center gap-1.5">
      <input
        type={type === "EMAIL" ? "email" : type === "URL" ? "url" : "text"}
        defaultValue={raw}
        placeholder={
          type === "URL"
            ? "https://…"
            : type === "EMAIL"
              ? "ktoś@example.com"
              : type === "PHONE"
                ? "+48…"
                : "—"
        }
        onBlur={(e) => {
          if (e.currentTarget.value === raw) return;
          commit(taskId, columnId, e.currentTarget.value.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        className="w-full bg-transparent text-[0.88rem] outline-none placeholder:text-muted-foreground/40 focus-visible:text-foreground"
      />
      {followHref && (
        <a
          href={followHref}
          target={type === "URL" ? "_blank" : undefined}
          rel={type === "URL" ? "noreferrer" : undefined}
          aria-label={type === "URL" ? "Otwórz link" : type === "EMAIL" ? "Wyślij email" : "Zadzwoń"}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          {type === "URL" ? <ExternalLink size={11} /> : type === "EMAIL" ? <Mail size={11} /> : <Phone size={11} />}
        </a>
      )}
    </div>
  );
}

function LongTextCell({ taskId, columnId, raw }: CellProps) {
  return (
    <textarea
      defaultValue={raw}
      rows={1}
      placeholder="—"
      onBlur={(e) => {
        if (e.currentTarget.value === raw) return;
        commit(taskId, columnId, e.currentTarget.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          (e.currentTarget as HTMLTextAreaElement).blur();
        }
      }}
      className="w-full resize-y bg-transparent text-[0.88rem] outline-none placeholder:text-muted-foreground/40 focus-visible:text-foreground"
    />
  );
}

function NumberCell({ taskId, columnId, raw, options }: CellProps) {
  const isCurrency = options?.numberFormat === "currency";
  const isPercent = options?.numberFormat === "percent";
  const suffix = isCurrency ? options?.numberCurrency ?? "PLN" : isPercent ? "%" : null;
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        step={options?.numberFormat === "integer" ? 1 : "any"}
        defaultValue={raw}
        placeholder="—"
        onBlur={(e) => {
          if (e.currentTarget.value === raw) return;
          commit(taskId, columnId, e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        className="w-full bg-transparent text-right font-mono text-[0.86rem] outline-none placeholder:text-muted-foreground/40 focus-visible:text-foreground"
      />
      {suffix && raw && (
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

// We store DATE as either YYYY-MM-DD (no time) or full ISO. Native
// pickers are clumsy for "no time" dates, so we branch on dateIncludeTime.
function DateCell({ taskId, columnId, raw, options }: CellProps) {
  const includeTime = options?.dateIncludeTime ?? false;
  const initial = formatForInput(raw, includeTime);
  return (
    <input
      type={includeTime ? "datetime-local" : "date"}
      defaultValue={initial}
      onBlur={(e) => {
        if (e.currentTarget.value === initial) return;
        const v = e.currentTarget.value;
        // datetime-local omits TZ; storing as-is is fine since we render
        // it back through the same locale formatter.
        commit(taskId, columnId, v);
      }}
      className="w-full bg-transparent font-mono text-[0.8rem] outline-none focus-visible:text-foreground"
    />
  );
}

function formatForInput(raw: string, includeTime: boolean): string {
  if (!raw) return "";
  // Already in the right shape?
  if (!includeTime && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (includeTime && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw.slice(0, 16);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  if (includeTime) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function CheckboxCell({ taskId, columnId, raw }: CellProps) {
  const checked = raw === "true" || raw === "1";
  return (
    <button
      type="button"
      onClick={() => commit(taskId, columnId, checked ? "" : "true")}
      aria-pressed={checked}
      aria-label={checked ? "Odznacz" : "Zaznacz"}
      className={`grid h-5 w-5 place-items-center rounded-md border transition-colors ${
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-transparent hover:border-primary/50"
      }`}
    >
      <Check size={12} />
    </button>
  );
}

function SingleSelectCell({ taskId, columnId, raw, options }: CellProps) {
  const opts = options?.selectOptions ?? [];
  const current = opts.find((o) => o.value === raw);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full px-2.5 text-[0.74rem] font-semibold transition-opacity hover:opacity-90"
        style={{
          color: current ? current.color : "var(--muted-foreground)",
          background: current ? `${current.color}1F` : "transparent",
          border: current ? "none" : "1px dashed var(--border)",
        }}
      >
        <span className="truncate">{current ? current.value : "wybierz…"}</span>
        <ChevronDown size={11} className="shrink-0 opacity-70" />
      </button>
      {open && (
        <SelectMenu
          opts={opts}
          selected={current ? [current.value] : []}
          onClose={() => setOpen(false)}
          onPick={(v) => {
            commit(taskId, columnId, v === raw ? "" : v);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function MultiSelectCell({ taskId, columnId, raw, options }: CellProps) {
  const opts = options?.selectOptions ?? [];
  const decoded = decodeCellValue("MULTI_SELECT", raw) as string[] | null;
  const selected = Array.isArray(decoded) ? decoded : [];
  const [open, setOpen] = useState(false);

  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    const stored = next.length === 0 ? "" : JSON.stringify(next);
    commit(taskId, columnId, stored);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-md border border-dashed border-border px-1 py-0.5 text-left transition-colors hover:border-primary/50"
      >
        {selected.length === 0 ? (
          <span className="px-1 text-[0.74rem] text-muted-foreground">wybierz…</span>
        ) : (
          selected.map((v) => {
            const opt = opts.find((o) => o.value === v);
            const color = opt?.color ?? "#64748B";
            return (
              <span
                key={v}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-semibold"
                style={{ color, background: `${color}1F` }}
              >
                {v}
              </span>
            );
          })
        )}
      </button>
      {open && (
        <SelectMenu
          opts={opts}
          selected={selected}
          onClose={() => setOpen(false)}
          onPick={toggle}
          multi
        />
      )}
    </div>
  );
}

function SelectMenu({
  opts,
  selected,
  onClose,
  onPick,
  multi = false,
}: {
  opts: SelectOption[];
  selected: string[];
  onClose: () => void;
  onPick: (value: string) => void;
  multi?: boolean;
}) {
  // Gdy dropdown otwiera się przy ostatnim wierszu tabeli,
  // top-[calc(100%+4px)] uciekał poza viewport. Sprawdzamy po mount,
  // czy bottom dropdownu mieści się — jeśli nie, flipujemy nad anchor.
  const ulRef = useRef<HTMLUListElement>(null);
  const [flipUp, setFlipUp] = useState(false);

  useLayoutEffect(() => {
    if (!ulRef.current) return;
    const rect = ulRef.current.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 8) {
      setFlipUp(true);
    }
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label="Zamknij"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default"
      />
      <ul
        ref={ulRef}
        className={`absolute left-0 z-50 max-h-60 w-48 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-[0_10px_30px_-12px_rgba(10,10,40,0.25)] ${
          flipUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]"
        }`}
      >
        {opts.length === 0 && (
          <li className="px-2 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/70">
            brak opcji — skonfiguruj kolumnę
          </li>
        )}
        {opts.map((o) => {
          const isSelected = selected.includes(o.value);
          return (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => onPick(o.value)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-[0.82rem] transition-colors hover:bg-accent"
              >
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-semibold"
                  style={{ color: o.color, background: `${o.color}1F` }}
                >
                  {o.value}
                </span>
                {isSelected && (
                  multi ? <Check size={12} className="text-primary" /> : <X size={12} className="text-muted-foreground" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function RatingCell({ taskId, columnId, raw, options }: CellProps) {
  const max = options?.ratingMax ?? 5;
  const n = Math.max(0, Math.min(max, Number.parseInt(raw || "0", 10) || 0));
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < n;
        return (
          <button
            key={i}
            type="button"
            onClick={() => {
              const next = i + 1 === n ? 0 : i + 1;
              commit(taskId, columnId, next === 0 ? "" : String(next));
            }}
            aria-label={`Ustaw ${i + 1} z ${max}`}
            className={`grid h-5 w-5 place-items-center rounded-sm transition-colors ${
              filled ? "text-amber-500" : "text-muted-foreground/30 hover:text-amber-400"
            }`}
          >
            <Star size={12} fill={filled ? "currentColor" : "none"} />
          </button>
        );
      })}
    </div>
  );
}
