"use client";

// F12-K83 / F15: Cmd+K — globalna paleta wyszukiwania i poleceń dla wszystkich
// tras (app). Renderowana w (app) layoucie, żeby skrót zawsze nasłuchiwał.
//
// Wygląd (2026-09-13): „liquid glass" — jedyne szkło w aplikacji, świadomy
// akcent nad płaskim UI. Warstwy siedzą w app/globals.css (.glass-*); tutaj
// tylko treść, światło pod kursorem i filtr SVG dla załamania w Chromium.
//
// Świadomie pominięte: wyszukiwanie po serwerze (cmdk filtruje statyczną listę
// z layoutu — ostatnie zadania i wszystkie tablice użytkownika wystarczają),
// akcje kontekstowe na zaznaczonym wierszu listy.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type PointerEvent, type ReactNode } from "react";
import { Command } from "cmdk";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ATERON_OPEN_EVENT } from "@/components/czesiek/czesiek-fab";
import { cn } from "@/lib/utils";
import { hueFor } from "@/components/ui/avatar";
import { CHIP_HUE } from "@/components/ui/chip";
import { Kbd } from "@/components/ui/kbd";
import { hueForColor } from "@/components/ui/status-hue";
import {
  IconArrowRight, IconBell, IconBoards, IconFolder, IconPlus, IconRecent, IconSearch, IconSettings, IconSparkles, IconTasks, IconUsers,
} from "@/components/ui/icons";

// ─── Public shape — co (app) layout musi wstrzyknąć ─────────────────────────
export interface CommandPaletteWorkspace {
  id: string;
  name: string;
}

export interface CommandPaletteBoard {
  id: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
}

export interface CommandPaletteTask {
  id: string;
  title: string;
  displayId: number;
  boardId: string;
  boardName: string;
  workspaceId: string;
  workspaceName: string;
  status: { name: string; colorHex: string } | null;
}

export interface CommandPaletteData {
  workspaces: CommandPaletteWorkspace[];
  boards: CommandPaletteBoard[];
  // Ostatnio zmieniane zadania przypisane do użytkownika; (app) layout dobiera.
  tasks: CommandPaletteTask[];
}

// Ten sam zapis, co „Ostatnie" w pasku bocznym (localStorage `ui:recent`).
interface RecentItem { type: string; id: string; label: string; href: string }

export function CommandPalette({ data }: { data: CommandPaletteData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // „Ostatnie" czytamy przy każdym otwarciu — pasek boczny dopisuje wpis już
  // po zamontowaniu palety, więc stan z chwili montażu byłby nieaktualny.
  const [recent, setRecent] = useState<RecentItem[]>([]);
  useEffect(() => {
    if (!open) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecent(JSON.parse(window.localStorage.getItem("ui:recent") ?? "[]") as RecentItem[]);
    } catch {
      setRecent([]);
    }
  }, [open]);
  // Załamanie przez filtr SVG w backdrop-filter renderuje tylko Chromium;
  // gdzie indziej zostaje czyste rozmycie, więc nie ma co ryzykować.
  const [refract, setRefract] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRefract(typeof navigator !== "undefined" && "userAgentData" in navigator);
  }, []);

  // Globalny cmd+k / ctrl+k toggle. Esc obsługuje cmdk + Dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isToggle = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (!isToggle) return;
      const target = e.target as HTMLElement | null;
      const inField =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      // Cmd+K w polu też otwiera paletę — chyba że wcześniejszy listener
      // (np. Tiptap „wstaw link") już to zdarzenie skonsumował.
      if (inField && e.defaultPrevented) return;
      e.preventDefault();
      setOpen((v) => {
        if (v) setQuery("");
        return !v;
      });
    };
    // Pole w górnym pasku / skrót `/` (components/layout/hotkeys.tsx).
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("cmdk:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("cmdk:open", onOpen);
    };
  }, []);

  const setOpenAndReset = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setOpenAndReset(false);
      router.push(href);
    },
    [router, setOpenAndReset],
  );

  // Cmd+1 / Cmd+2 — skok do pierwszej przestrzeni / pierwszej tablicy.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "1" && data.workspaces[0]) {
        e.preventDefault();
        navigate(`/w/${data.workspaces[0].id}`);
      } else if (e.key === "2" && data.boards[0]) {
        e.preventDefault();
        const b = data.boards[0];
        navigate(`/w/${b.workspaceId}/b/${b.id}/table`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, data.workspaces, data.boards, navigate]);

  // iOS nie zmniejsza layoutu po otwarciu klawiatury — tylko widoczny obszar.
  // Bez tego dolna połowa palety (i wyniki) chowała się pod klawiaturą.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!open || !vv) return;
    const apply = () => document.documentElement.style.setProperty("--vvh", `${vv.height}px`);
    apply();
    vv.addEventListener("resize", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      document.documentElement.style.removeProperty("--vvh");
    };
  }, [open]);

  // Światło na szkle idzie za kursorem — zmienne czyta ::after w globals.css.
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const closePalette = useCallback(() => setOpenAndReset(false), [setOpenAndReset]);
  // „Ostatnie" tylko bez frazy — przy szukaniu ta sama tablica wpadałaby dwa razy.
  const szukanie = query.trim().length > 0;
  const sections = useMemo(
    () => buildSections(data, szukanie ? [] : recent, navigate, closePalette),
    [data, recent, szukanie, navigate, closePalette],
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpenAndReset}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            // z-[100] === Z.modalBackdrop (F12-K104).
            "glass-scrim fixed inset-0 z-[100]",
            "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-150",
          )}
        />
        <DialogPrimitive.Popup
          data-fullscreen-mobile=""
          data-ui="command-palette"
          onPointerMove={onPointerMove}
          // z-[110] === Z.modal (F12-K104) — nad paskiem bocznym (z-40) i toastami (z-[80]).
          className={cn(
            "glass-surface fixed left-1/2 top-[14%] z-[110] w-[640px] max-w-[calc(100%-2rem)] -translate-x-1/2 overflow-hidden outline-none",
            refract && "glass-refract",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[.97] data-open:slide-in-from-top-1 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[.98] duration-150",
            // Telefon: pełny ekran zamiast pływającej karty; wysokość z
            // visualViewport, bo iOS nie zmniejsza layoutu po otwarciu klawiatury.
            "max-md:inset-x-0 max-md:top-0 max-md:h-[var(--vvh,100dvh)] max-md:w-full max-md:max-w-none max-md:translate-x-0",
          )}
        >
          <LiquidGlassFilter />
          <DialogPrimitive.Title className="sr-only">Szybkie wyszukiwanie</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Wpisz frazę, aby przeszukać przestrzenie, tablice, zadania i akcje.
          </DialogPrimitive.Description>

          <Command label="Paleta poleceń" className="relative z-[1] flex max-h-[min(560px,72vh)] flex-col max-md:h-full max-md:max-h-none">
            <div className="flex items-center gap-3 px-4 py-3.5 max-md:py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-orange-500 text-ink shadow-[0_2px_6px_rgba(255,92,0,.35)]">
                <IconSearch width={15} height={15} />
              </span>
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Szukaj przestrzeni, tablicy, zadania…"
                aria-label="Szukaj przestrzeni, tablicy, zadania lub akcji"
                className="glass-input min-w-0 flex-1 border-0 bg-transparent text-[16px] font-medium text-foreground placeholder:font-normal placeholder:text-fg-3 outline-none"
                autoFocus
              />
              <Kbd className="bg-white/70 max-md:hidden">esc</Kbd>
              {/* Telefon nie ma klawisza Esc — potrzebny realny przycisk wyjścia. */}
              <button
                type="button"
                onClick={() => setOpenAndReset(false)}
                className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-n-700 outline-none active:bg-black/5 md:hidden"
              >
                Zamknij
              </button>
            </div>
            <div aria-hidden className="mx-4 h-px bg-black/[.07]" />

            <Command.List className="flex-1 overflow-y-auto px-2 pb-2 pt-1.5 [scrollbar-width:thin]">
              <Command.Empty>
                <EmptyState query={query} />
              </Command.Empty>

              {sections.map((section) => (
                <Command.Group
                  key={section.id}
                  heading={section.heading}
                  className="mb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.02em] [&_[cmdk-group-heading]]:text-fg-3"
                >
                  {section.items.map((item) => (
                    <Command.Item
                      key={item.key}
                      value={item.searchValue}
                      onSelect={() => {
                        setOpenAndReset(false);
                        item.onSelect();
                      }}
                      className="glass-row group flex min-h-[38px] cursor-pointer items-center gap-3 px-2.5 py-1.5 text-[13.5px] text-foreground outline-none"
                    >
                      {item.tile}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.meta}
                      <span
                        aria-hidden
                        className="grid size-5 shrink-0 place-items-center rounded-md bg-white/80 text-fg-2 opacity-0 shadow-[inset_0_0_0_1px_rgba(20,17,13,.08)] group-data-[selected=true]:opacity-100"
                      >
                        <IconArrowRight width={11} height={11} />
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>

            <div className="flex items-center justify-between gap-3 border-t border-black/[.07] px-4 py-2.5 text-[11.5px] text-fg-2 max-md:hidden">
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1"><Kbd className="bg-white/70">↑</Kbd><Kbd className="bg-white/70">↓</Kbd> nawiguj</span>
                <span className="flex items-center gap-1"><Kbd className="bg-white/70">↵</Kbd> otwórz</span>
                <span className="flex items-center gap-1"><Kbd className="bg-white/70">esc</Kbd> zamknij</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1"><Kbd className="bg-white/70">⌘1</Kbd> przestrzeń</span>
                <span className="flex items-center gap-1"><Kbd className="bg-white/70">⌘2</Kbd> tablica</span>
              </span>
            </div>
          </Command>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// Filtr „soczewki": miękki szum przesuwa piksele rozmytego tła o kilkanaście
// pikseli, przez co krawędzie i kontrasty pod szkłem lekko falują — jak w szkle
// o nierównej powierzchni. Skala celowo mała: to ma być tafla, nie kalejdoskop.
function LiquidGlassFilter() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <filter id="liquid-glass" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.0065 0.009" numOctaves="2" seed="11" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="2.5" result="soft" />
        <feDisplacementMap in="SourceGraphic" in2="soft" scale="26" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

// ─── Kafelki i metadane wierszy ──────────────────────────────────────────────
function Tile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("glass-tile grid size-[26px] shrink-0 place-items-center rounded-lg text-n-700", className)}>
      {children}
    </span>
  );
}

function InitialTile({ name }: { name: string }) {
  return (
    <span className={cn("grid size-[26px] shrink-0 place-items-center rounded-lg text-[12px] font-bold", CHIP_HUE[hueFor(name)])}>
      {(name.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}

function Meta({ children }: { children: ReactNode }) {
  return <span className="flex shrink-0 items-center gap-2 text-[11.5px] text-fg-3">{children}</span>;
}

function StatusDot({ colorHex, name }: { colorHex: string; name: string }) {
  return (
    <span className={cn("inline-flex h-[18px] items-center gap-1 rounded-sm px-1.5 text-[10.5px] font-medium", CHIP_HUE[hueForColor(colorHex)])}>
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />
      {name}
    </span>
  );
}

// ─── Sekcje z paczki data ────────────────────────────────────────────────────
function buildSections(
  d: CommandPaletteData,
  recent: RecentItem[],
  navigate: (href: string) => void,
  closePalette: () => void,
): Section[] {
  const out: Section[] = [];
  const boardById = new Map(d.boards.map((b) => [b.id, b]));

  // Ostatnio otwierane tablice (z paska bocznego) — tylko te, które nadal
  // istnieją i do których użytkownik ma dostęp.
  const ostatnie = recent.filter((r) => r.type === "board" && boardById.has(r.id)).slice(0, 4);
  if (ostatnie.length > 0) {
    out.push({
      id: "recent",
      heading: "Ostatnie",
      items: ostatnie.map((r) => {
        const b = boardById.get(r.id)!;
        return {
          key: `recent-${b.id}`,
          tile: <Tile><IconRecent width={14} height={14} /></Tile>,
          label: b.name,
          meta: <Meta>{b.workspaceName}</Meta>,
          searchValue: `ostatnie recent ${b.name} ${b.workspaceName}`,
          onSelect: () => navigate(r.href),
        };
      }),
    });
  }

  if (d.tasks.length > 0) {
    out.push({
      id: "tasks",
      heading: "Twoje zadania",
      items: d.tasks.map((t) => ({
        key: `t-${t.id}`,
        tile: <Tile><IconTasks width={14} height={14} /></Tile>,
        label: (
          <>
            <span className="mr-1.5 font-mono text-[11px] text-fg-3">#{t.displayId || "—"}</span>
            {t.title}
          </>
        ),
        meta: (
          <Meta>
            {t.status && <StatusDot colorHex={t.status.colorHex} name={t.status.name} />}
            <span className="max-w-[140px] truncate">{t.boardName}</span>
          </Meta>
        ),
        searchValue: `zadanie task #${t.displayId} ${t.title} ${t.boardName} ${t.workspaceName}`,
        // B2: ⌘K otwiera zadanie jako wyśrodkowany modal (intercepting route + ?mode=modal).
        onSelect: () => navigate(`/w/${t.workspaceId}/t/${t.id}?mode=modal`),
      })),
    });
  }

  if (d.boards.length > 0) {
    out.push({
      id: "boards",
      heading: "Tablice",
      items: d.boards.map((b) => ({
        key: `b-${b.id}`,
        tile: <Tile><IconBoards width={14} height={14} /></Tile>,
        label: b.name,
        meta: <Meta>{b.workspaceName}</Meta>,
        searchValue: `tablica board ${b.name} ${b.workspaceName}`,
        onSelect: () => navigate(`/w/${b.workspaceId}/b/${b.id}/table`),
      })),
    });
  }

  if (d.workspaces.length > 0) {
    out.push({
      id: "workspaces",
      heading: "Przestrzenie",
      items: d.workspaces.map((w) => ({
        key: `ws-${w.id}`,
        tile: <InitialTile name={w.name} />,
        label: w.name,
        meta: <Meta><IconFolder width={12} height={12} /> przestrzeń</Meta>,
        searchValue: `przestrzeń workspace ${w.name}`,
        onSelect: () => navigate(`/w/${w.id}`),
      })),
    });
  }

  const ws = d.workspaces[0];
  out.push({
    id: "actions",
    heading: "Akcje",
    items: [
      {
        key: "new-board",
        tile: <Tile className="bg-orange-500 text-ink shadow-none"><IconPlus width={14} height={14} /></Tile>,
        label: "Nowa tablica",
        meta: ws ? <Meta>{ws.name}</Meta> : undefined,
        searchValue: "nowa tablica nowy board create",
        onSelect: () => navigate(ws ? `/w/${ws.id}` : "/workspaces"),
      },
      {
        key: "ateron",
        tile: <Tile><IconSparkles width={14} height={14} /></Tile>,
        label: "Zapytaj AI",
        meta: <Meta>Ateron</Meta>,
        searchValue: "ai ateron asystent zapytaj czesiek",
        onSelect: () => {
          closePalette();
          // Panel siedzi pod layoutem przestrzeni i nasłuchuje tego zdarzenia.
          window.dispatchEvent(new Event(ATERON_OPEN_EVENT));
        },
      },
      {
        key: "invite",
        tile: <Tile><IconUsers width={14} height={14} /></Tile>,
        label: "Zaproś osoby do przestrzeni",
        searchValue: "zapros zaproszenie invite members osoby",
        onSelect: () => navigate(ws ? `/w/${ws.id}/settings` : "/workspaces"),
      },
      {
        key: "notifs",
        tile: <Tile><IconBell width={14} height={14} /></Tile>,
        label: "Powiadomienia",
        searchValue: "powiadomienia inbox notifications",
        onSelect: () => navigate("/inbox"),
      },
      {
        key: "settings",
        tile: <Tile><IconSettings width={14} height={14} /></Tile>,
        label: "Ustawienia konta",
        searchValue: "ustawienia profil konto settings",
        onSelect: () => navigate("/profile"),
      },
    ],
  });

  return out;
}

interface SectionItem {
  key: string;
  tile: ReactNode;
  label: ReactNode;
  meta?: ReactNode;
  // Po tym cmdk filtruje; doklejamy synonimy PL/EN, żeby trafić z obu stron.
  searchValue: string;
  onSelect: () => void;
}

interface Section {
  id: string;
  heading: string;
  items: SectionItem[];
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-white/70 text-fg-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,.9)]">
        <IconSearch width={18} height={18} />
      </span>
      <div className="mt-3 text-[14px] font-semibold text-foreground">Nic nie pasuje do „{query}”</div>
      <div className="mt-1 max-w-[300px] text-[12.5px] text-fg-2">
        Paleta przeszukuje przestrzenie, tablice, Twoje zadania i akcje. Spróbuj krótszej frazy albo numeru zadania.
      </div>
    </div>
  );
}
