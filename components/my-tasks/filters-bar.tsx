"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  Clock,
  History,
  Search,
  Sparkles,
  X,
} from "lucide-react";

export interface BoardOption {
  id: string;
  name: string;
  workspaceName: string;
}

export type SortMode =
  | "updatedDesc"
  | "updatedAsc"
  | "dueAsc"
  | "dueDesc"
  | "createdAsc"
  | "createdDesc";

const SORT_LABELS: Record<SortMode, string> = {
  updatedDesc: "Ostatnio zmienione",
  updatedAsc: "Najdawniej zmienione",
  dueAsc: "Najbliższy termin",
  dueDesc: "Najdalszy termin",
  createdAsc: "Najstarsze",
  createdDesc: "Najnowsze",
};

const SORT_ICONS: Record<SortMode, typeof Clock> = {
  updatedDesc: Clock,
  updatedAsc: History,
  dueAsc: ArrowUp,
  dueDesc: ArrowDown,
  createdAsc: History,
  createdDesc: Clock,
};

// Dropdown pogrupowany w sekcje z eyebrow nagłówkami zamiast
// płaskiej listy. Dużo czytelniejsze niż 6 opcji jedna pod drugą.
const SORT_GROUPS: { label: string; items: { mode: SortMode; description: string }[] }[] = [
  {
    label: "Modyfikacja",
    items: [
      { mode: "updatedDesc", description: "od najnowszej zmiany" },
      { mode: "updatedAsc", description: "od najstarszej zmiany" },
    ],
  },
  {
    label: "Termin",
    items: [
      { mode: "dueAsc", description: "najpierw bliższy" },
      { mode: "dueDesc", description: "najpierw dalszy" },
    ],
  },
  {
    label: "Utworzenie",
    items: [
      { mode: "createdDesc", description: "od najnowszego" },
      { mode: "createdAsc", description: "od najstarszego" },
    ],
  },
];

// URL-synced filter bar. Each interaction writes shallow to the search
// params so reloads and shareable links preserve state.
export function FiltersBar({
  boards,
  initialSearch,
  initialBoardIds,
  initialSort,
}: {
  boards: BoardOption[];
  initialSearch: string;
  initialBoardIds: string[];
  initialSort: SortMode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [selectedBoards, setSelectedBoards] = useState<Set<string>>(
    () => new Set(initialBoardIds),
  );
  const [sort, setSort] = useState<SortMode>(initialSort);

  const pushParams = useCallback(
    (mutator: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(params?.toString() ?? "");
      mutator(next);
      router.replace(next.toString().length > 0 ? `?${next.toString()}` : "?");
    },
    [params, router],
  );

  // Debounced search — avoid a router push on every keystroke.
  useEffect(() => {
    if (search === initialSearch) return;
    const id = setTimeout(() => {
      pushParams((p) => {
        if (search.trim()) p.set("search", search.trim());
        else p.delete("search");
      });
    }, 240);
    return () => clearTimeout(id);
  }, [search, initialSearch, pushParams]);

  const toggleBoard = (id: string) => {
    setSelectedBoards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      pushParams((p) => {
        if (next.size === 0) p.delete("boardIds");
        else p.set("boardIds", Array.from(next).join(","));
      });
      return next;
    });
  };

  const changeSort = (s: SortMode) => {
    setSort(s);
    pushParams((p) => {
      if (s === "updatedDesc") p.delete("sort");
      else p.set("sort", s);
    });
  };

  const clearAll = () => {
    setSearch("");
    setSelectedBoards(new Set());
    setSort("updatedDesc");
    router.replace("?");
  };

  const activeCount = useMemo(() => {
    let n = 0;
    if (search.trim()) n += 1;
    if (selectedBoards.size > 0) n += 1;
    if (sort !== "updatedDesc") n += 1;
    return n;
  }, [search, selectedBoards.size, sort]);

  // v4 segmented pill control — Dziś (active = brand gradient) / Tydzień / Zaległe / Wszystkie.
  // Filtry te są wizualne (chipy w v4 są ozdobne — nie zmieniamy props/funkcji),
  // więc używamy ich jako visual section divider nad search/sort/boards.
  const pillRow = (
    <div className="flex items-center gap-1.5 rounded-[14px] border border-white/60 bg-white/55 p-1 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
      <span className="rounded-[11px] bg-brand-gradient px-3 py-1.5 text-[0.75rem] font-semibold text-white shadow-brand">
        Dziś
      </span>
      <span className="rounded-[11px] border border-white/60 bg-white/40 px-3 py-1.5 text-[0.75rem] font-medium text-muted-foreground dark:border-white/10 dark:bg-white/[0.05]">
        Tydzień
      </span>
      <span className="rounded-[11px] border border-white/60 bg-white/40 px-3 py-1.5 text-[0.75rem] font-medium text-rose-500 dark:border-white/10 dark:bg-white/[0.05]">
        Zaległe
      </span>
      <span className="rounded-[11px] border border-white/60 bg-white/40 px-3 py-1.5 text-[0.75rem] font-medium text-muted-foreground dark:border-white/10 dark:bg-white/[0.05]">
        Wszystkie
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {pillRow}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="search"
            placeholder="Szukaj po tytule…"
            className="h-9 w-full rounded-[11px] border border-white/60 bg-white/60 pl-8 pr-3 text-[0.9rem] outline-none backdrop-blur-xl placeholder:text-muted-foreground/60 focus:border-primary/60 dark:border-white/10 dark:bg-white/[0.04]"
          />
        </div>

        <SortDropdown current={sort} onPick={(next) => changeSort(next)} />

        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex h-9 items-center gap-1.5 rounded-[11px] border border-white/60 bg-white/60 px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-xl transition-colors hover:border-destructive/60 hover:text-destructive dark:border-white/10 dark:bg-white/[0.04]"
          >
            <X size={12} /> wyczyść ({activeCount})
          </button>
        )}
      </div>

      {boards.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
            Tablica:
          </span>
          {boards.map((b) => {
            const on = selectedBoards.has(b.id);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => toggleBoard(b.id)}
                data-on={on ? "true" : "false"}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-white/60 px-3 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground transition-colors data-[on=true]:border-primary data-[on=true]:bg-primary/10 data-[on=true]:text-foreground hover:border-primary/40 dark:border-white/10"
              >
                <span className="truncate max-w-[140px]">{b.name}</span>
                <span className="text-muted-foreground/60 normal-case tracking-normal">
                  · {b.workspaceName}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Redesigned sort dropdown — pogrupowane sekcje z eyebrow
// nagłówkami, większe option items (z descriptionem), trigger pokazuje
// 'Sortuj: <label>' z ArrowUpDown ikoną zamiast clock'a (bardziej
// generic — sygnalizuje że to SORT, nie filter time'em).
function SortDropdown({
  current,
  onPick,
}: {
  current: SortMode;
  onPick: (v: SortMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3.5 text-[0.86rem] text-foreground transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
      >
        <ArrowUpDown size={13} className="text-muted-foreground" />
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
          Sortuj
        </span>
        <span className="font-medium">{SORT_LABELS[current]}</span>
        <ChevronDown
          size={13}
          className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-[280px] overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]"
        >
          {/* Header */}
          <div className="flex items-center gap-1.5 px-2 pt-1 pb-2">
            <Sparkles size={11} className="text-primary" />
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
              Sortowanie
            </span>
          </div>

          {SORT_GROUPS.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div className="mx-2 my-1 h-px bg-border" aria-hidden />}
              <div className="px-2 pt-1 pb-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground/70">
                {group.label}
              </div>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = SORT_ICONS[item.mode];
                  const active = item.mode === current;
                  return (
                    <li key={item.mode}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          onPick(item.mode);
                          setOpen(false);
                        }}
                        data-active={active ? "true" : "false"}
                        className="group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent data-[active=true]:bg-primary/10"
                      >
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors ${
                            active
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground group-hover:text-foreground"
                          }`}
                        >
                          <Icon size={13} />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col leading-tight">
                          <span
                            className={`text-[0.86rem] ${active ? "font-semibold text-foreground" : "text-foreground"}`}
                          >
                            {SORT_LABELS[item.mode]}
                          </span>
                          <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground/80">
                            {item.description}
                          </span>
                        </div>
                        {active && (
                          <Check size={14} className="shrink-0 text-primary" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
