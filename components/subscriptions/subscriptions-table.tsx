"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  ExternalLink,
  FolderKanban,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  createSubscriptionAction,
  createSubscriptionProjectAction,
  deleteSubscriptionAction,
  deleteSubscriptionProjectAction,
  patchSubscriptionAction,
  toggleSubscriptionProjectMemberAction,
} from "@/app/(app)/w/[workspaceId]/subscriptions/actions";

type Cycle = "MONTHLY" | "YEARLY";

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

// F12-K140/141: "Excel, ale ładnie narysowany" + projekty i dostępy.
// Edycja inline (onBlur → patch), select cyklu/projektu zapisuje od razu,
// sumy liczone lokalnie (optymistycznie).
export function SubscriptionsTable({
  workspaceId,
  isAdmin,
  rows: serverRows,
  projects,
  members,
}: {
  workspaceId: string;
  isAdmin: boolean;
  rows: SubscriptionRow[];
  projects: SubscriptionProjectItem[];
  members: WorkspaceMemberItem[];
}) {
  const [rows, setRows] = useState<SubscriptionRow[]>(serverRows);
  useEffect(() => setRows(serverRows), [serverRows]);
  const [projectsOpen, setProjectsOpen] = useState(false);
  // Filtr widoku po projekcie ("" = wszystkie widoczne).
  const [projectFilter, setProjectFilter] = useState("");

  const projectName = useMemo(() => {
    const map = new Map(projects.map((p) => [p.id, p.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : null);
  }, [projects]);

  const visible = projectFilter
    ? rows.filter((r) => r.projectId === projectFilter)
    : rows;

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
    startTransition(() => void createSubscriptionAction(fd));
  };

  const removeRow = (id: string, name: string) => {
    if (!confirm(`Usunąć subskrypcję${name ? ` „${name}"` : ""}?`)) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => void deleteSubscriptionAction(fd));
  };

  // Sumy liczone z WIDOCZNYCH wierszy (filtr projektu = suma per projekt).
  const totals = useMemo(() => {
    let monthly = 0;
    let yearly = 0;
    for (const r of visible) {
      if (r.cycle === "MONTHLY") {
        monthly += r.amountCents;
        yearly += r.amountCents * 12;
      } else {
        monthly += r.amountCents / 12;
        yearly += r.amountCents;
      }
    }
    return { monthly, yearly };
  }, [visible]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 py-6 md:py-10">
      <header className="flex flex-col gap-2">
        <span className="eyebrow flex items-center gap-2">
          <CreditCard size={12} /> Subskrypcje
        </span>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-[2rem] font-bold leading-tight tracking-[-0.025em] md:text-[2.4rem]">
            Subskrypcje firmy
          </h1>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setProjectsOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card/60 px-3 text-[0.84rem] transition-colors hover:border-primary/50"
            >
              <FolderKanban size={14} /> Projekty i dostępy
            </button>
          )}
        </div>
        <p className="max-w-[62ch] text-[0.94rem] leading-[1.55] text-muted-foreground">
          Kliknij w komórkę żeby edytować — zapisuje się samo.
          {!isAdmin && " Widzisz subskrypcje wspólne + projektów do których masz dostęp."}
        </p>
      </header>

      {/* KPI + filtr projektu */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Kpi label="Miesięcznie" value={fmtPln(totals.monthly)} highlight />
        <Kpi label="Rocznie" value={fmtPln(totals.yearly)} />
        <Kpi label="Subskrypcje" value={String(visible.length)} />
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card/40 p-4">
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
            Projekt
          </span>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-8 cursor-pointer rounded-md border border-border bg-background px-2 text-[0.86rem] outline-none focus:border-primary/50"
          >
            <option value="">Wszystkie</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card/40">
        <table className="w-full min-w-[860px] border-collapse text-[0.9rem]">
          <thead>
            <tr className="border-b border-border bg-card/70 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-semibold">Nazwa</th>
              <th className="w-[160px] px-3 py-2.5 text-left font-semibold">Projekt</th>
              <th className="w-[130px] px-3 py-2.5 text-right font-semibold">Kwota (PLN)</th>
              <th className="w-[140px] px-3 py-2.5 text-left font-semibold">Cykl</th>
              <th className="w-[120px] px-3 py-2.5 text-right font-semibold">Mies.</th>
              <th className="w-[120px] px-3 py-2.5 text-right font-semibold">Rocznie</th>
              <th className="w-[44px] px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  {projectFilter
                    ? "Brak subskrypcji w tym projekcie."
                    : "Brak subskrypcji — dodaj pierwszą poniżej."}
                </td>
              </tr>
            )}
            {visible.map((r) => {
              const monthly = r.cycle === "MONTHLY" ? r.amountCents : r.amountCents / 12;
              const yearly = r.cycle === "MONTHLY" ? r.amountCents * 12 : r.amountCents;
              return (
                <tr key={r.id} className="group transition-colors hover:bg-accent/40">
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        defaultValue={r.name}
                        placeholder="np. Figma, Slack…"
                        maxLength={200}
                        onBlur={(e) => {
                          if (e.target.value === r.name) return;
                          patchLocal(r.id, { name: e.target.value });
                          send(r.id, { name: e.target.value });
                        }}
                        className="h-9 w-full rounded-md bg-transparent px-2 font-medium outline-none transition-colors hover:bg-background/60 focus:bg-background focus:ring-1 focus:ring-primary/40"
                      />
                      {r.url && (
                        <a
                          href={r.url.startsWith("http") ? r.url : `https://${r.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                          title={r.url}
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={r.projectId ?? ""}
                      onChange={(e) => {
                        const projectId = e.target.value || null;
                        patchLocal(r.id, { projectId });
                        send(r.id, { projectId: e.target.value });
                      }}
                      className="h-9 w-full cursor-pointer rounded-md border border-transparent bg-transparent px-1.5 text-[0.84rem] outline-none transition-colors hover:bg-background/60 focus:border-primary/40 focus:bg-background"
                    >
                      <option value="">— wspólna —</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                      {/* Projekt niewidoczny dla usera (przypięty przez admina) —
                          pokaż nazwę pasywnie żeby select nie kłamał. */}
                      {r.projectId && !projects.some((p) => p.id === r.projectId) && (
                        <option value={r.projectId}>{projectName(r.projectId)}</option>
                      )}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      inputMode="decimal"
                      defaultValue={r.amountCents ? (r.amountCents / 100).toFixed(2) : ""}
                      placeholder="0,00"
                      onBlur={(e) => {
                        const n = Number(e.target.value.replace(",", ".").replace(/\s/g, ""));
                        const cents = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
                        if (cents === r.amountCents) return;
                        patchLocal(r.id, { amountCents: cents });
                        send(r.id, { amountPln: e.target.value });
                      }}
                      className="h-9 w-full rounded-md bg-transparent px-2 text-right font-mono outline-none transition-colors hover:bg-background/60 focus:bg-background focus:ring-1 focus:ring-primary/40"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      value={r.cycle}
                      onChange={(e) => {
                        const cycle = e.target.value as Cycle;
                        patchLocal(r.id, { cycle });
                        send(r.id, { cycle });
                      }}
                      className="h-9 w-full cursor-pointer rounded-md border border-transparent bg-transparent px-1.5 text-[0.86rem] outline-none transition-colors hover:bg-background/60 focus:border-primary/40 focus:bg-background"
                    >
                      <option value="MONTHLY">Miesięcznie</option>
                      <option value="YEARLY">Rocznie</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[0.84rem] text-muted-foreground">
                    {fmtPln(monthly)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-[0.84rem] text-muted-foreground">
                    {fmtPln(yearly)}
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => removeRow(r.id, r.name)}
                      aria-label="Usuń subskrypcję"
                      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {visible.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-primary/30 bg-card/70 font-semibold">
                <td className="px-4 py-3" colSpan={4}>
                  <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
                    Suma ({visible.length}
                    {projectFilter ? ` · ${projectName(projectFilter)}` : ""})
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-mono text-primary">
                  {fmtPln(totals.monthly)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-primary">
                  {fmtPln(totals.yearly)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 font-sans text-[0.86rem] font-semibold text-white shadow-brand transition-transform hover:-translate-y-[1px]"
        >
          <Plus size={14} /> Dodaj subskrypcję
        </button>
      </div>

      {projectsOpen && (
        <ProjectsDialog
          workspaceId={workspaceId}
          projects={projects}
          members={members}
          onClose={() => setProjectsOpen(false)}
        />
      )}
    </div>
  );
}

// F12-K141: admin zarządza projektami + dostępami (checkbox per user).
function ProjectsDialog({
  workspaceId,
  projects,
  members,
  onClose,
}: {
  workspaceId: string;
  projects: SubscriptionProjectItem[];
  members: WorkspaceMemberItem[];
  onClose: () => void;
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
    if (
      !confirm(
        `Usunąć projekt „${name}"? Subskrypcje wrócą do puli wspólnej (nie znikną).`,
      )
    )
      return;
    const fd = new FormData();
    fd.set("projectId", projectId);
    startTransition(() => void deleteSubscriptionProjectAction(fd));
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Projekty i dostępy"
        className="flex max-h-[85dvh] w-full max-w-[560px] flex-col gap-4 overflow-y-auto rounded-t-2xl border border-border bg-card p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[1.2rem] font-bold">Projekty i dostępy</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-[0.84rem] leading-[1.5] text-muted-foreground">
          Zaznaczeni użytkownicy widzą subskrypcje przypisane do projektu.
          Administratorzy widzą zawsze wszystko.
        </p>

        {/* Nowy projekt */}
        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addProject()}
            placeholder="Nazwa projektu, np. Kickback…"
            maxLength={120}
            className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-[0.9rem] outline-none focus:border-primary/60"
          />
          <button
            type="button"
            onClick={addProject}
            disabled={!newName.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-gradient px-3 text-[0.86rem] font-semibold text-white shadow-brand disabled:opacity-60"
          >
            <Plus size={14} /> Dodaj
          </button>
        </div>

        {projects.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[0.86rem] text-muted-foreground">
            Brak projektów — dodaj pierwszy powyżej.
          </p>
        )}

        {projects.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-2 rounded-xl border border-border bg-background/40 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-semibold">
                <FolderKanban size={14} className="text-primary" /> {p.name}
              </span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
                  <Users size={11} /> {p.memberIds.length}
                </span>
                <button
                  type="button"
                  onClick={() => removeProject(p.id, p.name)}
                  aria-label="Usuń projekt"
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => {
                const active = p.memberIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(p.id, m.id)}
                    aria-pressed={active}
                    className={`inline-flex h-8 items-center rounded-full border px-3 text-[0.8rem] transition-colors ${
                      active
                        ? "border-primary/50 bg-primary/15 font-semibold text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card/40 p-4">
      <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span
        className={`font-display text-[1.6rem] font-bold ${highlight ? "bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function fmtPln(cents: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
