"use client";

// Shared Tablica state so the toolbar (rendered in the board header) and the
// board itself read one source. Toolbar filters are session state; collapsed
// columns and WIP limits persist in `ui:kanban:<boardId>` (localStorage —
// StatusColumn has no wipLimit/collapsed column in the schema).

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useUiPref } from "@/hooks/use-ui-pref";
import type { TaskPriorityValue } from "@/lib/task-priority";
import type { KanbanGroupBy, KanbanMember, KanbanSort, KanbanStatusColumn } from "@/components/kanban/kanban-model";

export interface KanbanMeta {
  workspaceId: string;
  boardId: string;
  viewId?: string;
  canEdit: boolean;
  canCreate: boolean;
  canManageBoard: boolean;
  statusColumns: KanbanStatusColumn[];
  members: KanbanMember[];
}

interface KanbanPrefs {
  collapsed: string[];
  wip: Record<string, number>;
}

export interface KanbanState extends KanbanMeta {
  search: string;
  setSearch: (q: string) => void;
  people: string[];
  togglePerson: (id: string) => void;
  priority: TaskPriorityValue | null;
  setPriority: (p: TaskPriorityValue | null) => void;
  groupBy: KanbanGroupBy;
  setGroupBy: (g: KanbanGroupBy) => void;
  sort: KanbanSort;
  setSort: (s: KanbanSort) => void;
  collapsed: string[];
  toggleCollapsed: (columnId: string) => void;
  setCollapsedAll: (columnIds: string[]) => void;
  wip: Record<string, number>;
  setWip: (columnId: string, limit: number | null) => void;
}

const Ctx = createContext<KanbanState | null>(null);

export function useKanbanState(): KanbanState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useKanbanState outside KanbanStateProvider");
  return v;
}

export function KanbanStateProvider({ meta, children }: { meta: KanbanMeta; children: ReactNode }) {
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [priority, setPriority] = useState<TaskPriorityValue | null>(null);
  const [groupBy, setGroupBy] = useState<KanbanGroupBy>("status");
  const [sort, setSort] = useState<KanbanSort>("manual");
  const [prefs, setPrefs] = useUiPref<KanbanPrefs>(`ui:kanban:${meta.boardId}`, { collapsed: [], wip: {} });

  const togglePerson = useCallback(
    (id: string) => setPeople((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])),
    [],
  );
  const toggleCollapsed = useCallback(
    (columnId: string) =>
      setPrefs({
        ...prefs,
        collapsed: prefs.collapsed.includes(columnId) ? prefs.collapsed.filter((c) => c !== columnId) : [...prefs.collapsed, columnId],
      }),
    [prefs, setPrefs],
  );
  const setCollapsedAll = useCallback((columnIds: string[]) => setPrefs({ ...prefs, collapsed: columnIds }), [prefs, setPrefs]);
  const setWip = useCallback(
    (columnId: string, limit: number | null) => {
      const rest = Object.fromEntries(Object.entries(prefs.wip).filter(([k]) => k !== columnId));
      setPrefs({ ...prefs, wip: limit && limit > 0 ? { ...rest, [columnId]: limit } : rest });
    },
    [prefs, setPrefs],
  );

  const value = useMemo<KanbanState>(
    () => ({
      ...meta, search, setSearch, people, togglePerson, priority, setPriority, groupBy, setGroupBy, sort, setSort,
      collapsed: prefs.collapsed, toggleCollapsed, setCollapsedAll, wip: prefs.wip, setWip,
    }),
    [meta, search, people, togglePerson, priority, groupBy, sort, prefs, toggleCollapsed, setCollapsedAll, setWip],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
