"use client";

import { createContext, useContext } from "react";

export type TaskViewMode = "panel" | "modal" | "page";

// Provided by TaskModalShell so the header ✕ / mobile ← inside TaskDetail can
// close the intercepting route. Null on the full page (no shell).
export const TaskShellContext = createContext<{ mode: TaskViewMode; close: () => void } | null>(null);
export const useTaskShell = () => useContext(TaskShellContext);
