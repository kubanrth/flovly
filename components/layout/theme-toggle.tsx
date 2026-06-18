"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "danielos:theme";

function readInitial(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark") return saved;
  // v4: dark = default w app'ce (klient preferuje). User może
  // przełączyć ręcznie — wybór persistuje w localStorage.
  return "dark";
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
  collapsed?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Synchronising with external state (localStorage) — setState in effect is intentional.
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
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[0.88rem] text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/[0.05] hover:text-foreground max-md:gap-3 max-md:rounded-md max-md:px-3 max-md:py-3 max-md:text-[1rem]"
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
      // v4: dark = default w app'ce. User może wybrać 'light' i wybór persistuje.
      var dark = s !== 'light';
      if (dark) document.documentElement.classList.add('dark');
    } catch (e) {}
  })();
`;
