"use client";

// Custom-field cells (all 16 FieldTypes). Inline editors commit on blur/Enter via
// setTaskCustomValueAction; computed types read from the row (`computed` prop).

import { startTransition } from "react";
import { setTaskCustomValueAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import { decodeCellValue, formatCellValue, type FieldOptions, type FieldType, type SelectOption } from "@/lib/table-fields";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/dropdown-menu";
import { IconExternal, IconMail, IconPhone, IconStar, IconStarFilled } from "@/components/ui/icons";
import { hueForColor } from "@/components/ui/status-hue";
import { memberName, type ListMember } from "@/components/table/types";

interface CellProps {
  taskId: string;
  columnId: string;
  type: FieldType;
  raw: string;
  options: FieldOptions | null;
  disabled: boolean;
  // USER cells need the member list; computed types read row data.
  members?: ListMember[];
  computed?: { createdAt: string; updatedAt: string; autoNumber: number };
}

function commit(taskId: string, columnId: string, value: string) {
  const fd = new FormData();
  fd.set("taskId", taskId);
  fd.set("columnId", columnId);
  fd.set("value", value);
  startTransition(() => setTaskCustomValueAction(fd));
}

const INPUT = "h-7 w-full min-w-0 rounded-sm bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-n-400";
const MENU_TRIGGER = "inline-flex h-7 max-w-full items-center gap-1 rounded-sm px-1 text-left outline-none hover:bg-n-100 data-popup-open:bg-n-100";

function Dash() {
  return <span className="text-n-400">—</span>;
}

function ReadOnly({ type, raw, options }: { type: FieldType; raw: string; options: FieldOptions | null }) {
  const decoded = decodeCellValue(type, raw);
  if (decoded === null || decoded === "") return <Dash />;
  return <span className={cn("block truncate text-sm", type === "NUMBER" && "text-right font-mono text-xs tabular-nums")}>{formatCellValue(type, decoded, options)}</span>;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" });
}

export function FieldCell(props: CellProps) {
  switch (props.type) {
    case "CREATED_TIME":
      return props.computed ? <span className="block truncate font-mono text-xs text-fg-2">{fmtDateTime(props.computed.createdAt)}</span> : <Dash />;
    case "LAST_MODIFIED_TIME":
      return props.computed ? <span className="block truncate font-mono text-xs text-fg-2">{fmtDateTime(props.computed.updatedAt)}</span> : <Dash />;
    case "AUTO_NUMBER":
      return props.computed ? <span className="block font-mono text-xs text-fg-2">{props.computed.autoNumber}</span> : <Dash />;
    case "USER":
      return <UserCell {...props} />;
    case "ATTACHMENT": {
      const arr = decodeCellValue("ATTACHMENT", props.raw) as unknown[] | null;
      return arr && arr.length > 0 ? <span className="text-xs text-fg-2">{arr.length}</span> : <Dash />;
    }
  }
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
  }
}

function TextLikeCell({ taskId, columnId, type, raw }: CellProps) {
  const href =
    type === "URL" ? (raw ? (/^https?:\/\//.test(raw) ? raw : `https://${raw}`) : null)
    : type === "EMAIL" ? (raw ? `mailto:${raw}` : null)
    : type === "PHONE" ? (raw ? `tel:${raw.replace(/\s+/g, "")}` : null)
    : null;
  return (
    <div className="flex items-center gap-1">
      <input
        key={raw}
        type={type === "EMAIL" ? "email" : type === "URL" ? "url" : "text"}
        defaultValue={raw}
        placeholder={type === "URL" ? "https://…" : type === "EMAIL" ? "ktoś@example.com" : type === "PHONE" ? "+48…" : "—"}
        aria-label="Wartość"
        onBlur={(e) => e.currentTarget.value !== raw && commit(taskId, columnId, e.currentTarget.value.trim())}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.currentTarget.value = raw;
            e.currentTarget.blur();
          }
        }}
        className={INPUT}
      />
      {href && (
        <a href={href} target={type === "URL" ? "_blank" : undefined} rel={type === "URL" ? "noreferrer" : undefined} aria-label={type === "URL" ? "Otwórz link" : type === "EMAIL" ? "Wyślij email" : "Zadzwoń"} className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-n-500 hover:bg-n-100 hover:text-foreground" onClick={(e) => e.stopPropagation()}>
          {type === "URL" ? <IconExternal width={12} height={12} /> : type === "EMAIL" ? <IconMail width={12} height={12} /> : <IconPhone width={12} height={12} />}
        </a>
      )}
    </div>
  );
}

function LongTextCell({ taskId, columnId, raw }: CellProps) {
  return (
    <textarea
      key={raw}
      defaultValue={raw}
      rows={1}
      placeholder="—"
      aria-label="Wartość"
      onBlur={(e) => e.currentTarget.value !== raw && commit(taskId, columnId, e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={cn(INPUT, "h-7 resize-none py-1 leading-5")}
    />
  );
}

function NumberCell({ taskId, columnId, raw, options }: CellProps) {
  const suffix = options?.numberFormat === "currency" ? (options.numberCurrency ?? "PLN") : options?.numberFormat === "percent" ? "%" : null;
  return (
    <div className="flex items-center gap-1">
      <input
        key={raw}
        type="number"
        step={options?.numberFormat === "integer" ? 1 : "any"}
        defaultValue={raw}
        placeholder="—"
        aria-label="Wartość"
        onBlur={(e) => e.currentTarget.value !== raw && commit(taskId, columnId, e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        className={cn(INPUT, "text-right font-mono text-xs tabular-nums")}
      />
      {suffix && raw && <span className="shrink-0 font-mono text-[10px] text-n-500">{suffix}</span>}
    </div>
  );
}

function formatForInput(raw: string, includeTime: boolean): string {
  if (!raw) return "";
  if (!includeTime && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (includeTime && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw.slice(0, 16);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return includeTime ? `${day}T${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
}

function DateCell({ taskId, columnId, raw, options }: CellProps) {
  const includeTime = options?.dateIncludeTime ?? false;
  const initial = formatForInput(raw, includeTime);
  return (
    <input
      key={raw}
      type={includeTime ? "datetime-local" : "date"}
      defaultValue={initial}
      aria-label="Data"
      onBlur={(e) => e.currentTarget.value !== initial && commit(taskId, columnId, e.currentTarget.value)}
      className={cn(INPUT, "font-mono text-xs")}
    />
  );
}

function CheckboxCell({ taskId, columnId, raw }: CellProps) {
  const checked = raw === "true" || raw === "1";
  return <Checkbox size="sm" checked={checked} ariaLabel={checked ? "Odznacz" : "Zaznacz"} onCheckedChange={(c) => commit(taskId, columnId, c ? "true" : "")} />;
}

function optionChip(o: SelectOption | undefined, value: string, size: "sm" | "md" = "md") {
  return <Chip hue={o ? hueForColor(o.color) : "gray"} size={size}>{o?.value ?? value}</Chip>;
}

function SingleSelectCell({ taskId, columnId, raw, options }: CellProps) {
  const opts = options?.selectOptions ?? [];
  const current = opts.find((o) => o.value === raw);
  return (
    <Menu>
      <MenuTrigger aria-label="Wybierz opcję" className={MENU_TRIGGER}>
        {raw ? optionChip(current, raw) : <span className="inline-flex h-5 items-center rounded-sm border border-dashed border-n-300 px-[7px] text-2xs text-n-500">wybierz…</span>}
      </MenuTrigger>
      <MenuContent align="start" className="w-48">
        {opts.length === 0 && <MenuItem disabled>Brak opcji — skonfiguruj kolumnę</MenuItem>}
        <MenuRadioGroup value={raw} onValueChange={(v) => commit(taskId, columnId, v === raw ? "" : String(v))}>
          {opts.map((o) => (
            <MenuRadioItem key={o.value} value={o.value} closeOnClick>{optionChip(o, o.value, "sm")}</MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

function MultiSelectCell({ taskId, columnId, raw, options }: CellProps) {
  const opts = options?.selectOptions ?? [];
  const decoded = decodeCellValue("MULTI_SELECT", raw) as string[] | null;
  const selected = Array.isArray(decoded) ? decoded : [];
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    commit(taskId, columnId, next.length === 0 ? "" : JSON.stringify(next));
  };
  return (
    <Menu>
      <MenuTrigger aria-label="Wybierz opcje" className={cn(MENU_TRIGGER, "w-full")}>
        {selected.length === 0 ? (
          <span className="inline-flex h-5 items-center rounded-sm border border-dashed border-n-300 px-[7px] text-2xs text-n-500">wybierz…</span>
        ) : (
          <span className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">
            {selected.map((v) => <span key={v}>{optionChip(opts.find((o) => o.value === v), v, "sm")}</span>)}
          </span>
        )}
      </MenuTrigger>
      <MenuContent align="start" className="w-48">
        {opts.length === 0 && <MenuItem disabled>Brak opcji — skonfiguruj kolumnę</MenuItem>}
        {opts.map((o) => (
          <MenuCheckboxItem key={o.value} checked={selected.includes(o.value)} closeOnClick={false} onCheckedChange={() => toggle(o.value)}>
            {optionChip(o, o.value, "sm")}
          </MenuCheckboxItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

function RatingCell({ taskId, columnId, raw, options }: CellProps) {
  const max = options?.ratingMax ?? 5;
  const n = Math.max(0, Math.min(max, Number.parseInt(raw || "0", 10) || 0));
  return (
    <div className="flex items-center" role="radiogroup" aria-label="Ocena">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < n;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={i + 1 === n}
            aria-label={`Ustaw ${i + 1} z ${max}`}
            onClick={() => {
              const next = i + 1 === n ? 0 : i + 1;
              commit(taskId, columnId, next === 0 ? "" : String(next));
            }}
            className={cn("inline-flex size-5 items-center justify-center rounded-sm outline-none hover:text-warning", filled ? "text-warning" : "text-n-300")}
          >
            {filled ? <IconStarFilled width={13} height={13} /> : <IconStar width={13} height={13} />}
          </button>
        );
      })}
    </div>
  );
}

function UserCell({ taskId, columnId, raw, members, disabled }: CellProps) {
  const m = members?.find((x) => x.id === raw);
  const display = m ? (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Avatar name={memberName(m)} src={m.avatarUrl} size={20} />
      <span className="truncate text-sm">{memberName(m)}</span>
    </span>
  ) : raw ? (
    <span className="truncate text-sm text-fg-2">{raw}</span>
  ) : (
    <Dash />
  );
  if (disabled || !members) return display;
  return (
    <Menu>
      <MenuTrigger aria-label="Wybierz osobę" className={MENU_TRIGGER}>{display}</MenuTrigger>
      <MenuContent align="start" className="max-h-[50vh] w-56 overflow-y-auto">
        <MenuRadioGroup value={raw} onValueChange={(v) => commit(taskId, columnId, v === raw ? "" : String(v))}>
          {members.map((u) => (
            <MenuRadioItem key={u.id} value={u.id} closeOnClick>
              <Avatar name={memberName(u)} src={u.avatarUrl} size={20} />
              {memberName(u)}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
