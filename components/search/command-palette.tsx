"use client";

// F12-K83: Cmd+K command palette — globalny launcher dla wszystkich (app)
// routes. Pokazuje workspaces / boards / top tasks / shortcut actions.
// Renderowany w (app) layoucie żeby keyboard handler zawsze nasłuchiwał.
//
// Co świadomie pominięto:
//  • async search (np. po SQL po tytułach tasków) — cmdk filtruje statycznie
//    listę przekazaną w propsach. Top-10 tasków z layoutu wystarcza dla
//    pierwszej iteracji; later można podmienić na /api/search?q=.
//  • cmdk@1.x korzysta z React Context wewnętrznie — bez problemu zip'uje
//    się z naszym Dialog (base-ui), bo cmdk renderuje tylko children,
//    nie tworzy własnych portali.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import {
  Bell,
  Folder,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Sparkles,
  UserPlus,
} from "lucide-react";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

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
  boardId: string;
  workspaceId: string;
  workspaceName: string;
}

export interface CommandPaletteData {
  workspaces: CommandPaletteWorkspace[];
  boards: CommandPaletteBoard[];
  // Top 10 most recent tasks przypisane do usera; (app) layout dobiera.
  tasks: CommandPaletteTask[];
}

export function CommandPalette({ data }: { data: CommandPaletteData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Globalny cmd+k / ctrl+k toggle. Esc handled przez cmdk + Dialog.
  // input/textarea/contentEditable focus → ignoruj (user pisze w polu).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isToggle = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (!isToggle) return;
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      // Cmd+K w polu wpisywanym też powinno otworzyć paletę (intentional override),
      // ale tylko gdy nie ma żadnej kombinacji która konflikuje — np. cmd+k
      // jest used jako Tiptap "insert link" → tam Tiptap rejestruje wcześniejszy
      // listener (capture phase) i e.defaultPrevented będzie true.
      if (inField && e.defaultPrevented) return;
      e.preventDefault();
      // Toggle: jeśli zamkniete → otwórz; jeśli otwarte → zamknij i wyczyść.
      setOpen((v) => {
        if (v) setQuery("");
        return !v;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset query po zamknięciu — wrapper który toggle'uje open + czyści input
  // w jednym setState batchu (bez effect → setState cascade).
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

  // Cmd+1 / Cmd+2 — przeskok do pierwszego workspace / pierwszej tablicy.
  // Bezpiecznie: nasłuchuje tylko gdy paleta otwarta i są dane.
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

  const sections = useMemo(
    () => buildSections(data, navigate),
    [data, navigate],
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpenAndReset}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            // z-[100] === Z.modalBackdrop (F12-K104).
            "fixed inset-0 z-[100] bg-black/30 supports-backdrop-filter:backdrop-blur-sm",
            "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-100",
          )}
        />
        <DialogPrimitive.Popup
          // z-[110] === Z.modal (F12-K104) — nad sidebar (z-40) i toaster (z-[80]).
          // Margin-top żeby paleta wyświetlała się "z góry" jak Spotlight.
          className={cn(
            "dialog-glass fixed left-1/2 top-[18%] z-[110] w-[600px] max-w-[calc(100%-2rem)] -translate-x-1/2 overflow-hidden rounded-2xl outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-100",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            Szybkie wyszukiwanie
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Wpisz frazę aby przeszukać workspaces, tablice, zadania i akcje.
          </DialogPrimitive.Description>

          <Command
            label="Command palette"
            // cmdk default: arrow keys + enter; nasz UI tylko stylowanie.
            className="flex max-h-[480px] flex-col"
          >
            <div className="flex items-center gap-2.5 border-b border-black/5 px-4 py-3 dark:border-white/10">
              <Search size={16} className="text-muted-foreground" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Szukaj workspace, tablicy, zadania, akcji..."
                aria-label="Wyszukaj workspace, tablicę, zadanie lub akcję"
                className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground/70 outline-none"
                autoFocus
              />
              <kbd className="font-mono text-[11px] text-muted-foreground/90 rounded-md border border-black/10 dark:border-white/10 px-1.5 py-0.5">
                Esc
              </kbd>
            </div>

            <Command.List className="flex-1 overflow-y-auto p-2">
              <Command.Empty>
                <EmptyState />
              </Command.Empty>

              {sections.map((section) => (
                <Command.Group
                  key={section.id}
                  heading={section.heading}
                  className="mb-1 px-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-muted-foreground/60"
                >
                  {section.items.map((item) => (
                    <Command.Item
                      key={item.key}
                      value={item.searchValue}
                      onSelect={() => {
                        setOpenAndReset(false);
                        item.onSelect();
                      }}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-foreground",
                        "data-[selected=true]:bg-[linear-gradient(135deg,rgba(124,92,255,0.16),rgba(210,71,181,0.10))]",
                        "data-[selected=true]:shadow-[inset_0_0_0_1px_rgba(124,92,255,0.22)]",
                      )}
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-white/40 text-foreground/70 dark:bg-white/[0.06]">
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.hint && (
                        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground/60">
                          {item.hint}
                        </span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>

            <div className="flex items-center justify-between gap-3 border-t border-black/5 px-4 py-2 text-[11px] text-muted-foreground/90 dark:border-white/10">
              <span>
                <kbd className="font-mono">↑↓</kbd> nawiguj ·{" "}
                <kbd className="font-mono">↵</kbd> wybierz
              </span>
              <span>
                <kbd className="font-mono">⌘1</kbd> workspace ·{" "}
                <kbd className="font-mono">⌘2</kbd> tablica
              </span>
            </div>
          </Command>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ─── Pure helper: builduje sekcje cmdk z paczki data ─────────────────────────
// Wyciągnięte poza komponent żeby useMemo miał stabilne deps (navigate + data).
function buildSections(
  d: CommandPaletteData,
  navigate: (href: string) => void,
): Section[] {
  const out: Section[] = [];

  if (d.workspaces.length > 0) {
    out.push({
      id: "workspaces",
      heading: "Workspace'y",
      items: d.workspaces.map((w) => ({
        key: `ws-${w.id}`,
        icon: <Folder size={14} />,
        label: w.name,
        searchValue: `workspace ${w.name}`,
        onSelect: () => navigate(`/w/${w.id}`),
      })),
    });
  }

  if (d.boards.length > 0) {
    out.push({
      id: "boards",
      heading: "Tablice",
      items: d.boards.map((b) => ({
        key: `b-${b.id}`,
        icon: <LayoutDashboard size={14} />,
        label: b.name,
        hint: b.workspaceName,
        searchValue: `tablica board ${b.name} ${b.workspaceName}`,
        onSelect: () =>
          navigate(`/w/${b.workspaceId}/b/${b.id}/table`),
      })),
    });
  }

  if (d.tasks.length > 0) {
    out.push({
      id: "tasks",
      heading: "Zadania",
      items: d.tasks.map((t) => ({
        key: `t-${t.id}`,
        icon: <Sparkles size={14} />,
        label: t.title,
        hint: t.workspaceName,
        searchValue: `zadanie task ${t.title} ${t.workspaceName}`,
        // Otwiera tablicę zawierającą task — modal taska otwiera się
        // przez ?task=<id> query (już istniejący pattern w Tabeli).
        onSelect: () =>
          navigate(
            `/w/${t.workspaceId}/b/${t.boardId}/table?task=${t.id}`,
          ),
      })),
    });
  }

  out.push({
    id: "actions",
    heading: "Akcje",
    items: [
      {
        key: "new-board",
        icon: <Plus size={14} />,
        label: "Nowa tablica",
        hint: d.workspaces[0]?.name,
        searchValue: "nowa tablica nowy board create",
        onSelect: () => {
          const ws = d.workspaces[0];
          if (ws) navigate(`/w/${ws.id}`);
          else navigate("/workspaces");
        },
      },
      {
        key: "invite",
        icon: <UserPlus size={14} />,
        label: "Zapraszaj członków",
        searchValue: "zapros zaproszenie invite members",
        onSelect: () => {
          const ws = d.workspaces[0];
          if (ws) navigate(`/w/${ws.id}/settings`);
          else navigate("/workspaces");
        },
      },
      {
        key: "notifs",
        icon: <Bell size={14} />,
        label: "Powiadomienia",
        searchValue: "powiadomienia inbox notifications",
        onSelect: () => navigate("/inbox"),
      },
      {
        key: "settings",
        icon: <Settings size={14} />,
        label: "Ustawienia konta",
        searchValue: "ustawienia profile konto settings",
        onSelect: () => navigate("/profile"),
      },
    ],
  });

  return out;
}

interface SectionItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  // Wartość po której cmdk filtruje przy `<Command.Input value=...>`.
  // Doklejamy synonimy żeby user mógł znaleźć po PL/EN naprzemiennie.
  searchValue: string;
  onSelect: () => void;
}

interface Section {
  id: string;
  heading: string;
  items: SectionItem[];
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-white/40 ring-1 ring-white/40 dark:bg-white/[0.05] dark:ring-white/10">
        <span
          className="grid size-9 place-items-center rounded-xl text-white"
          style={{ background: "linear-gradient(135deg, #7C5CFF, #E1318F)" }}
        >
          <Search size={16} />
        </span>
      </div>
      <div className="mt-3 text-[15px] font-semibold text-foreground">
        Brak wyników
      </div>
      <div className="mt-1 max-w-[280px] text-[12.5px] text-muted-foreground">
        Spróbuj innej frazy — palette przeszukuje workspace&apos;y, tablice,
        zadania i akcje.
      </div>
    </div>
  );
}
