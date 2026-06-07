"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Settings2, Check } from "lucide-react";

export interface ContactsTableRow {
  id: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  nip: string | null;
  regon: string | null;
  vatNumber: string | null;
  website: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  updatedAt: string;
  owner: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
}

type ColumnKey =
  | "company"
  | "person"
  | "position"
  | "email"
  | "phone"
  | "nip"
  | "regon"
  | "vatNumber"
  | "website"
  | "address"
  | "owner"
  | "updated";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  // Width hint so the table doesn't get too cramped when many columns are on.
  minWidth: number;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "company", label: "Firma", minWidth: 180 },
  { key: "person", label: "Osoba", minWidth: 160 },
  { key: "position", label: "Stanowisko", minWidth: 140 },
  { key: "email", label: "Email", minWidth: 200 },
  { key: "phone", label: "Telefon", minWidth: 130 },
  { key: "nip", label: "NIP", minWidth: 100 },
  { key: "regon", label: "REGON", minWidth: 100 },
  { key: "vatNumber", label: "VAT UE", minWidth: 110 },
  { key: "website", label: "WWW", minWidth: 160 },
  { key: "address", label: "Adres", minWidth: 200 },
  { key: "owner", label: "Opiekun", minWidth: 140 },
  { key: "updated", label: "Aktualizacja", minWidth: 110 },
];

const DEFAULT_VISIBLE: ColumnKey[] = [
  "company",
  "person",
  "email",
  "phone",
  "owner",
  "updated",
];

const STORAGE_KEY = "flovly:contacts-columns";

export function ContactsTable({
  workspaceId,
  rows,
}: {
  workspaceId: string;
  rows: ContactsTableRow[];
}) {
  // Start with the default set so SSR + first paint match. Sync from
  // localStorage in an effect to avoid hydration mismatch.
  const [visible, setVisible] = useState<Set<ColumnKey>>(
    new Set(DEFAULT_VISIBLE),
  );
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        const known = parsed.filter((k): k is ColumnKey =>
          ALL_COLUMNS.some((c) => c.key === k),
        );
        // Refuse to render with zero columns — at least company stays on.
        if (known.length > 0) setVisible(new Set(known));
      }
    } catch {
      /* localStorage disabled — stay on defaults */
    }
  }, []);

  const persistVisible = (next: Set<ColumnKey>) => {
    setVisible(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      /* localStorage disabled */
    }
  };

  const visibleColumns = useMemo(
    () => ALL_COLUMNS.filter((c) => visible.has(c.key)),
    [visible],
  );
  const minWidth = visibleColumns.reduce((sum, c) => sum + c.minWidth, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-end gap-2 border-b border-border bg-muted/30 px-3 py-2">
        <ColumnsToggle
          visible={visible}
          onChange={persistVisible}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left" style={{ minWidth }}>
          <thead className="border-b border-border bg-muted/50">
            <tr className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              {visibleColumns.map((c) => (
                <th key={c.key} className="px-4 py-2">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ContactRow
                key={row.id}
                workspaceId={workspaceId}
                row={row}
                columns={visibleColumns}
              />
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="px-4 py-8 text-center text-[0.88rem] text-muted-foreground">
          Brak kontaktów. Dodaj pierwszy żeby zacząć.
        </p>
      )}
    </div>
  );
}

function ContactRow({
  workspaceId,
  row,
  columns,
}: {
  workspaceId: string;
  row: ContactsTableRow;
  columns: ColumnDef[];
}) {
  const personName = [row.firstName, row.lastName].filter(Boolean).join(" ") || null;
  const addressLine = [
    row.street,
    [row.postalCode, row.city].filter(Boolean).join(" "),
    row.country !== "PL" ? row.country : null,
  ]
    .filter(Boolean)
    .join(", ");

  const cellFor = (key: ColumnKey) => {
    switch (key) {
      case "company":
        return (
          <Link
            href={`/w/${workspaceId}/contacts/${row.id}`}
            className="block truncate text-[0.92rem] font-medium transition-colors hover:text-primary"
          >
            {row.companyName ?? "—"}
          </Link>
        );
      case "person":
        return (
          <span className="block truncate text-[0.88rem]">
            {personName ?? "—"}
          </span>
        );
      case "position":
        return <Cell value={row.position} />;
      case "email":
        return row.email ? (
          <a
            href={`mailto:${row.email}`}
            className="truncate font-mono text-[0.78rem] text-foreground transition-colors hover:text-primary"
          >
            {row.email}
          </a>
        ) : (
          <Cell value={null} />
        );
      case "phone":
        return row.phone ? (
          <a
            href={`tel:${row.phone}`}
            className="font-mono text-[0.82rem] transition-colors hover:text-primary"
          >
            {row.phone}
          </a>
        ) : (
          <Cell value={null} />
        );
      case "nip":
        return <Cell value={row.nip} mono />;
      case "regon":
        return <Cell value={row.regon} mono />;
      case "vatNumber":
        return <Cell value={row.vatNumber} mono />;
      case "website":
        return row.website ? (
          <a
            href={row.website.startsWith("http") ? row.website : `https://${row.website}`}
            target="_blank"
            rel="noreferrer"
            className="truncate text-[0.82rem] transition-colors hover:text-primary"
          >
            {row.website.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          <Cell value={null} />
        );
      case "address":
        return <Cell value={addressLine || null} />;
      case "owner":
        return row.owner ? (
          <span className="inline-flex items-center gap-2">
            <span className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.55rem] font-bold text-white">
              {row.owner.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.owner.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                (row.owner.name ?? row.owner.email).slice(0, 2).toUpperCase()
              )}
            </span>
            <span className="truncate text-[0.82rem]">
              {row.owner.name ?? row.owner.email.split("@")[0]}
            </span>
          </span>
        ) : (
          <Cell value={null} />
        );
      case "updated":
        return (
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
            {formatRelative(row.updatedAt)}
          </span>
        );
    }
  };

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-accent/30">
      {columns.map((c) => (
        <td key={c.key} className="px-4 py-3 align-middle">
          {cellFor(c.key)}
        </td>
      ))}
    </tr>
  );
}

function Cell({ value, mono }: { value: string | null; mono?: boolean }) {
  if (!value) {
    return <span className="font-mono text-[0.7rem] text-muted-foreground/50">—</span>;
  }
  return (
    <span
      className={
        mono
          ? "truncate font-mono text-[0.78rem]"
          : "truncate text-[0.86rem]"
      }
    >
      {value}
    </span>
  );
}

function ColumnsToggle({
  visible,
  onChange,
}: {
  visible: Set<ColumnKey>;
  onChange: (next: Set<ColumnKey>) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggle = (key: ColumnKey) => {
    const next = new Set(visible);
    if (next.has(key)) {
      // Keep at least the company column on so the table never goes to zero
      // visible columns (would render an empty header).
      if (key === "company") return;
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(next);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Wybierz kolumny do wyświetlenia"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <Settings2 size={11} /> Kolumny ({visible.size})
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-[240px] overflow-hidden rounded-lg border border-border bg-popover shadow-[0_16px_40px_-16px_rgba(10,10,40,0.35)]">
          <ul className="flex max-h-[60vh] flex-col overflow-y-auto p-1">
            {ALL_COLUMNS.map((c) => {
              const on = visible.has(c.key);
              return (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    disabled={c.key === "company"}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.86rem] transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span
                      className="grid h-4 w-4 shrink-0 place-items-center rounded-sm border"
                      style={{
                        borderColor: on
                          ? "var(--primary)"
                          : "var(--border)",
                        background: on ? "var(--primary)" : "transparent",
                      }}
                    >
                      {on && (
                        <Check size={9} className="text-white" strokeWidth={3} />
                      )}
                    </span>
                    <span className="flex-1 truncate">{c.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "przed chwilą";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min temu`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} h temu`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)} d temu`;
  return new Date(iso).toLocaleDateString("pl-PL");
}
