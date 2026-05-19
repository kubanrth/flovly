"use client";

// F11-19 (#15): tryb ciemny dla całej apki. CSS variables dla `.dark`
// są już w globals.css — ten toggle:
// 1) czyta zapisaną preferencję z localStorage (z fallbackiem na
//    prefers-color-scheme media query)
// 2) toggluje klasę `dark` na <html>
// 3) zapisuje preferencję
//
// Toggle renderowany w sidebarze koło avatara użytkownika.

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "danielos:theme";

function readInitial(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeToggle({
  variant = "sidebar",
  collapsed = false,
}: {
  variant?: "sidebar" | "compact" | "labeled";
  // F12-K15: gdy variant='labeled' i collapsed=false, button pokazuje
  // tekstowy label obok ikonki — dużo bardziej discoverable niż samą
  // ikonkę w nagłówku sidebar'a (klient zgłosił że nie wiedział że
  // toggle istnieje).
  collapsed?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage / system preference on mount. setState
  // here is intentional — we're synchronising with external state
  // (localStorage), exactly the use case useEffect is designed for.
  useEffect(() => {
    const initial = readInitial();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* swallow — Safari private mode etc. */
    }
  };

  // Avoid hydration mismatch — render an inert placeholder until effect runs.
  if (!mounted) {
    if (variant === "labeled") {
      return (
        <button
          type="button"
          aria-label="Tryb"
          // F12-K57b: dopasowane do innych nav-rowów w sidebarze.
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[0.88rem] text-muted-foreground max-md:gap-3 max-md:rounded-md max-md:px-3 max-md:py-3 max-md:text-[1rem]"
        >
          <Sun size={15} className="shrink-0 max-md:size-[18px]" />
          {!collapsed && <span className="truncate">Tryb…</span>}
        </button>
      );
    }
    return (
      <button
        type="button"
        aria-label="Tryb"
        className={
          variant === "sidebar"
            ? "grid h-8 w-8 place-items-center rounded-md text-muted-foreground"
            : "grid h-7 w-7 place-items-center rounded-md text-muted-foreground"
        }
      >
        <Sun size={14} />
      </button>
    );
  }

  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? "Tryb jasny" : "Tryb ciemny";

  if (variant === "labeled") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        // F12-K57b: dopasowane do innych nav-rowów w sidebarze.
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[0.88rem] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground max-md:gap-3 max-md:rounded-md max-md:px-3 max-md:py-3 max-md:text-[1rem]"
      >
        <Icon size={15} className="shrink-0 max-md:size-[18px]" />
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={
        variant === "sidebar"
          ? "grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          : "grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      }
    >
      <Icon size={14} />
    </button>
  );
}

// Inline script to set the `dark` class BEFORE React hydrates — prevents
// flash of light theme on initial paint when user prefers dark. Drop into
// <head> in the root layout.
export const themeBootScript = `
  (function() {
    try {
      var k = '${KEY}';
      var s = window.localStorage.getItem(k);
      var sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var dark = s === 'dark' || (s !== 'light' && sys);
      if (dark) document.documentElement.classList.add('dark');
    } catch (e) {}
  })();
`;
