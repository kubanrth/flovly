"use client";
import { useCallback, useEffect, useState } from "react";

// SSR-safe localStorage preference (keys prefixed `ui:`), synced across tabs.
export function useUiPref<T>(key: string, fallback: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    const read = () => {
      try {
        const raw = window.localStorage.getItem(key);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValue(raw === null ? fallback : (JSON.parse(raw) as T));
      } catch {
        /* ignore */
      }
    };
    read();
    const onStorage = (e: StorageEvent) => { if (e.key === key) read(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback((next: T) => {
    setValue(next);
    try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
  }, [key]);
  return [value, set];
}

export type Density = "compact" | "comfortable" | "spacious";
export const DENSITY_PX: Record<Density, number> = { compact: 28, comfortable: 36, spacious: 44 };
