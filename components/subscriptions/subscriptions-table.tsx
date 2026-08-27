"use client";

// E5 „Subskrypcje" — dwa kafle KPI (Miesięcznie / Rocznie prognoza), tabela na
// wspólnym prymitywie DataTable (wiersz 44 px) i edycja inline: nazwa, notka,
// kwota („129,99" → „129,99 zł"), cykl, projekt. Sumy liczy ./money.ts.
// Widoczność wierszy gate'uje zapytanie na serwerze — klient tylko filtruje widok.

import { startTransition, useEffect, useState } from "react";
import {
  createSubscriptionAction,
  createSubscriptionProjectAction,
  deleteSubscriptionAction,
  deleteSubscriptionProjectAction,
  patchSubscriptionAction,
  toggleSubscriptionProjectMemberAction,
} from "@/app/(app)/w/[workspaceId]/subscriptions/actions";
import { Avatar, hueFor } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CHIP_HUE, Chip } from "@/components/ui/chip";
import { DataFooter, DataTable, DataTd, DataTh, DataThead, DataTr } from "@/components/ui/data-table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import {
  IconExternal,
  IconFolder,
  IconMore,
  IconPlus,
  IconSubscriptions,
  IconTrash,
  IconUsers,
} from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { plPlural } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { centsToInput, formatPln, formatPlnRounded, parseAmountPln, rollUp, type Cycle } from "./money";

export interface SubscriptionRow {
  id: string;
  name: string;
  url: string | null;
  amountCents: number;
  cycle: Cycle;
  notes: string | null;
  projectId: string | null;
}

export interface SubscriptionProjectItem {
  id: string;
  name: string;
  memberIds: string[];
}

export interface WorkspaceMemberItem {
  id: string;
  name: string;
}

/** Sentinele filtra — pusty string jako wartość <Select> jest nieodróżnialny od „brak wyboru". */
const ALL = "all";
const NONE = "none";

const CYCLE_ITEMS = [
  { value: "MONTHLY" as const, label: "miesięczny" },
  { value: "YEARLY" as const, label: "roczny" },
];

const activePl = (n: number) => plPlural(n, "aktywna", "aktywne", "aktywnych");
const subPl = (n: number) => plPlural(n, "subskrypcja", "subskrypcje", "subskrypcji");

// Komórki edytowalne wyglądają jak tekst, dopiero hover/focus pokazuje pole.
const CELL_INPUT =
  "h-7 w-full min-w-0 rounded-sm border border-transparent bg-transparent px-1.5 outline-none " +
  "hover:border-input-border focus:border-orange-500 focus:bg-card focus:shadow-[var(--focus)]";

export function SubscriptionsTable({
  workspaceId,
  isAdmin,
  canManage,
  rows: serverRows,
  projects,
  members,
}: {
  workspaceId: string;
  isAdmin: boolean;
  /** `subscription.manage` — bez tego wiersze są tylko do odczytu. */
  canManage: boolean;
  rows: SubscriptionRow[];
  projects: SubscriptionProjectItem[];
  members: WorkspaceMemberItem[];
}) {
  const [rows, setRows] = useState<SubscriptionRow[]>(serverRows);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setRows(serverRows), [serverRows]);
  const [projectFilter, setProjectFilter] = useState<string>(ALL);
  const [projectsOpen, setProjectsOpen] = useState(false);
  // Świeżo dodany wiersz dostaje kursor w nazwie — inaczej „pusty wiersz" wygląda jak błąd.
  const [focusId, setFocusId] = useState<string | null>(null);

  const visible = rows.filter((r) =>
    projectFilter === ALL
      ? true
      : projectFilter === NONE
        ? r.projectId === null
        : r.projectId === projectFilter,
  );
  const totals = rollUp(visible);

  const patchLocal = (id: string, patch: Partial<SubscriptionRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const send = (id: string, fields: Record<string, string>) => {
    const fd = new FormData();
    fd.set("id", id);
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    startTransition(() => void patchSubscriptionAction(fd));
  };

  const addRow = () => {
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    startTransition(async () => {
      const res = await createSubscriptionAction(fd);
      if (res.ok) setFocusId(res.id);
    });
  };

  const removeRow = (id: string, name: string) => {
    if (!confirm(`Usunąć subskrypcję${name ? ` „${name}"` : ""}?`)) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => void deleteSubscriptionAction(fd));
  };

  const projectItems = [
    { value: NONE, label: "— wspólna —" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div data-ui="subscriptions" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2.5 px-8 pt-4 max-md:flex-wrap max-md:px-4">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Subskrypcje</h1>
        <span className="mt-1.5 text-xs text-fg-2">
          {visible.length} {activePl(visible.length)}
        </span>
        <span className="flex-1" />
        <Select
          size="sm"
          aria-label="Filtr projektu"
          className="w-[190px] max-md:w-full"
          value={projectFilter}
          onValueChange={setProjectFilter}
          items={[
            { value: ALL, label: "Wszystkie projekty" },
            { value: NONE, label: "Bez projektu" },
            ...projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
        {isAdmin && (
          <Button type="button" variant="secondary" onClick={() => setProjectsOpen(true)}>
            <IconFolder width={14} height={14} />
            Projekty i dostępy
          </Button>
        )}
        {canManage && (
          <Button type="button" onClick={addRow}>
            <IconPlus width={14} height={14} />
            Dodaj subskrypcję
          </Button>
        )}
      </header>

      <div className="flex shrink-0 gap-3 px-8 py-3.5 max-md:flex-col max-md:px-4">
        <Tile label="Miesięcznie" value={formatPlnRounded(totals.monthlyCents)} />
        <Tile label="Rocznie (prognoza)" value={formatPlnRounded(totals.yearlyCents)} />
      </div>

      {/* The DataTable owns the scroll (wrapperClassName below), not this
          column — otherwise its overflow-hidden becomes the sticky containing
          block and the 32px header scrolls away with the rows. */}
      <div className="flex min-h-0 flex-1 flex-col px-8 pb-5 max-md:px-4">
        {visible.length === 0 ? (
          <EmptyState
            className="mt-3"
            icon={<IconSubscriptions />}
            title={projectFilter === ALL ? "Brak subskrypcji" : "Brak subskrypcji w tym filtrze"}
            description={
              projectFilter === ALL
                ? "Dodaj pierwszą — wiersz wypełnisz w tabeli, zapisuje się sam."
                : "Zmień filtr projektu albo przypisz subskrypcję do tego projektu."
            }
            action={
              projectFilter === ALL && canManage ? (
                <Button type="button" onClick={addRow}>
                  <IconPlus width={14} height={14} />
                  Dodaj subskrypcję
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DataTable
            wrapperClassName="min-h-0 flex-1"
            className="min-w-[900px]"
            footer={
              <DataFooter>
                pokazano {visible.length} z {rows.length}
              </DataFooter>
            }
          >
            <DataThead>
              <tr>
                <DataTh width={300}>Usługa</DataTh>
                <DataTh width={180}>Projekt</DataTh>
                <DataTh width={150}>Cykl</DataTh>
                <DataTh width={140} align="right">
                  Kwota
                </DataTh>
                <DataTh>Status</DataTh>
              </tr>
            </DataThead>
            <tbody>
              {visible.map((r) => (
                <Row
                  key={r.id}
                  row={r}
                  projectItems={projectItems}
                  autoFocus={r.id === focusId}
                  onPatchLocal={patchLocal}
                  onSend={send}
                  onRemove={removeRow}
                />
              ))}
            </tbody>
          </DataTable>
        )}

        <p className="mt-2.5 text-xs text-fg-3">
          Kliknij w komórkę, żeby edytować — zapisuje się samo.
          {!isAdmin && " Widzisz subskrypcje wspólne i projektów, do których masz dostęp."}
        </p>
      </div>

      <footer className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-8 font-mono text-2xs text-muted-foreground max-md:px-4">
        {visible.length} {subPl(visible.length)} · {formatPlnRounded(totals.monthlyCents)}/mies
      </footer>

      {isAdmin && (
        <ProjectsDialog
          open={projectsOpen}
          onOpenChange={setProjectsOpen}
          workspaceId={workspaceId}
          projects={projects}
          members={members}
        />
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-lg border border-border bg-canvas px-3.5 py-3">
      <div className="mb-0.5 text-2xs text-fg-3">{label}</div>
      <div className="font-mono text-lg font-semibold">{value}</div>
    </div>
  );
}

function Row({
  row,
  projectItems,
  autoFocus,
  onPatchLocal,
  onSend,
  onRemove,
}: {
  row: SubscriptionRow;
  projectItems: { value: string; label: string }[];
  autoFocus: boolean;
  onPatchLocal: (id: string, patch: Partial<SubscriptionRow>) => void;
  onSend: (id: string, fields: Record<string, string>) => void;
  onRemove: (id: string, name: string) => void;
}) {
  const hue = hueFor(row.name || "Subskrypcja");
  const initial = (row.name.trim().charAt(0) || "?").toUpperCase();

  return (
    <DataTr className="h-11">
      <DataTd className="px-2">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "grid size-[26px] shrink-0 place-items-center rounded-md text-2xs font-bold",
              CHIP_HUE[hue],
            )}
            aria-hidden
          >
            {initial}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <input
              defaultValue={row.name}
              autoFocus={autoFocus}
              placeholder="np. Figma, Slack…"
              maxLength={200}
              aria-label="Nazwa usługi"
              onBlur={(e) => {
                if (e.target.value === row.name) return;
                onPatchLocal(row.id, { name: e.target.value });
                onSend(row.id, { name: e.target.value });
              }}
              className={cn(CELL_INPUT, "h-6 text-sm leading-4 font-medium")}
            />
            {row.notes && (
              <span className="truncate px-1.5 text-2xs text-fg-3" title={row.notes}>
                {row.notes}
              </span>
            )}
          </div>
        </div>
      </DataTd>

      <DataTd className="px-2">
        <Select
          size="sm"
          aria-label="Projekt"
          className="border-transparent bg-transparent hover:border-input-border"
          value={row.projectId ?? NONE}
          onValueChange={(v) => {
            const projectId = v === NONE ? null : v;
            onPatchLocal(row.id, { projectId });
            onSend(row.id, { projectId: v === NONE ? "" : v });
          }}
          items={projectItems}
        />
      </DataTd>

      <DataTd className="px-2">
        <Select
          size="sm"
          aria-label="Cykl rozliczeniowy"
          className="border-transparent bg-transparent hover:border-input-border"
          value={row.cycle}
          onValueChange={(cycle) => {
            onPatchLocal(row.id, { cycle });
            onSend(row.id, { cycle });
          }}
          items={CYCLE_ITEMS}
        />
      </DataTd>

      <DataTd className="px-2">
        <AmountCell
          cents={row.amountCents}
          onCommit={(raw) => {
            const cents = parseAmountPln(raw);
            if (cents === null || cents === row.amountCents) return;
            onPatchLocal(row.id, { amountCents: cents });
            onSend(row.id, { amountPln: raw });
          }}
        />
      </DataTd>

      <DataTd>
        <div className="flex items-center gap-2">
          <Chip hue="green" dot size="sm">
            Aktywna
          </Chip>
          <span className="flex-1" />
          <Menu>
            <MenuTrigger
              aria-label={`Opcje subskrypcji ${row.name || "bez nazwy"}`}
              className="grid size-6 shrink-0 place-items-center rounded-sm border border-border bg-card text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground focus-visible:shadow-[var(--focus)] active:bg-n-200 data-popup-open:bg-n-100"
            >
              <IconMore width={13} height={13} />
            </MenuTrigger>
            <MenuContent align="end">
              {row.url && (
                <>
                  <MenuItem
                    icon={<IconExternal />}
                    onClick={() =>
                      window.open(
                        row.url!.startsWith("http") ? row.url! : `https://${row.url}`,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    Otwórz stronę
                  </MenuItem>
                  <MenuSeparator />
                </>
              )}
              <MenuItem
                onClick={() => {
                  const next = window.prompt("Notatka do subskrypcji:", row.notes ?? "");
                  if (next === null || next === (row.notes ?? "")) return;
                  onPatchLocal(row.id, { notes: next || null });
                  onSend(row.id, { notes: next });
                }}
              >
                Notatka…
              </MenuItem>
              <MenuSeparator />
              <MenuItem destructive icon={<IconTrash />} onClick={() => onRemove(row.id, row.name)}>
                Usuń subskrypcję
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </DataTd>
    </DataTr>
  );
}

/**
 * Poza edycją komórka pokazuje „129,99 zł"; po wejściu w pole zostaje samo
 * „129,99", żeby dało się dopisać cyfrę bez kasowania jednostki.
 */
function AmountCell({ cents, onCommit }: { cents: number; onCommit: (raw: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && parseAmountPln(draft) === null;

  return (
    <input
      inputMode="decimal"
      aria-label="Kwota"
      aria-invalid={invalid || undefined}
      value={draft ?? formatPln(cents)}
      onFocus={() => setDraft(centsToInput(cents))}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
      onBlur={() => {
        if (draft !== null) onCommit(draft);
        setDraft(null);
      }}
      className={cn(CELL_INPUT, "text-right font-mono text-xs aria-invalid:border-danger")}
    />
  );
}

/* ───────────────── Projekty i dostępy (workspace ADMIN) ───────────────── */

function ProjectsDialog({
  open,
  onOpenChange,
  workspaceId,
  projects,
  members,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projects: SubscriptionProjectItem[];
  members: WorkspaceMemberItem[];
}) {
  const [newName, setNewName] = useState("");

  const addProject = () => {
    const name = newName.trim();
    if (!name) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("name", name);
    startTransition(() => void createSubscriptionProjectAction(fd));
    setNewName("");
  };

  const toggleMember = (projectId: string, userId: string) => {
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("userId", userId);
    startTransition(() => void toggleSubscriptionProjectMemberAction(fd));
  };

  const removeProject = (projectId: string, name: string) => {
    if (!confirm(`Usunąć projekt „${name}"? Subskrypcje wrócą do puli wspólnej (nie znikną).`)) return;
    const fd = new FormData();
    fd.set("projectId", projectId);
    startTransition(() => void deleteSubscriptionProjectAction(fd));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Projekty i dostępy</DialogTitle>
          <DialogDescription>
            Zaznaczone osoby widzą subskrypcje przypisane do projektu. Administratorzy widzą wszystko.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addProject();
                }
              }}
              placeholder="Nazwa projektu, np. Kickback…"
              maxLength={120}
              aria-label="Nazwa nowego projektu"
            />
            <Button type="button" onClick={addProject} disabled={!newName.trim()}>
              <IconPlus width={14} height={14} />
              Dodaj
            </Button>
          </div>

          {projects.length === 0 ? (
            <EmptyState
              icon={<IconFolder />}
              title="Brak projektów"
              description="Dodaj pierwszy powyżej — potem przypniesz do niego subskrypcje."
            />
          ) : (
            projects.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <IconFolder width={14} height={14} className="shrink-0 text-fg-3" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                  <span className="flex shrink-0 items-center gap-1 font-mono text-2xs text-fg-3">
                    <IconUsers width={11} height={11} />
                    {p.memberIds.length}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label={`Usuń projekt ${p.name}`}
                    onClick={() => removeProject(p.id, p.name)}
                  >
                    <IconTrash />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => {
                    const on = p.memberIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleMember(p.id, m.id)}
                        className={cn(
                          "inline-flex h-6 items-center gap-1.5 rounded-sm border border-border bg-card pr-2 pl-1 text-2xs font-medium text-muted-foreground outline-none",
                          "hover:border-input-border-hover hover:text-foreground focus-visible:shadow-[var(--focus)] active:bg-n-100",
                          "aria-pressed:border-orange-300 aria-pressed:bg-orange-50 aria-pressed:text-orange-800",
                        )}
                      >
                        <Avatar name={m.name} size={20} />
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Zamknij
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
