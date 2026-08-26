"use client";

// Shared Lista state (filters / sort / group / search / column prefs) so the
// header toolbar (server-rendered slot) and the table (client) read the same
// source. Persists per-view config through the existing board actions.

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { saveTableColumnPrefsAction, saveTableFiltersAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import { PRIORITY_META, PRIORITY_VALUES } from "@/lib/task-priority";
import { parseFieldOptions } from "@/lib/table-fields";
import type { TableFilter, TableSort } from "@/lib/table-filters";
import { hueForColor } from "@/components/ui/status-hue";
import { PRIORITY_HUE } from "@/components/table/grouping";
import type { FilterColumn } from "@/components/table/filter-builder";
import type { ListConfig } from "@/components/table/list-config";

export type { ListConfig } from "@/components/table/list-config";
import { memberName, type BoardTableColumn, type CustomTableColumn, type ListMember } from "@/components/table/types";

export interface ListMeta {
  workspaceId: string;
  boardId: string;
  viewId?: string;
  canEdit: boolean;
  canManagePrefs: boolean;
  statusColumns: BoardTableColumn[];
  customColumns: CustomTableColumn[];
  members: ListMember[];
  allTags: { id: string; name: string; colorHex: string }[];
}

export interface ListState extends ListMeta {
  config: ListConfig;
  setFilters: (next: TableFilter[]) => void;
  setSort: (next: TableSort | null) => void;
  setGroupBy: (next: string | null) => void;
  setColumnPrefs: (patch: Partial<Pick<ListConfig, "columnOrder" | "hidden" | "pinned" | "widths">>) => void;
  search: string;
  setSearch: (q: string) => void;
  builderOpen: boolean;
  setBuilderOpen: (open: boolean) => void;
  columnsOpen: boolean;
  setColumnsOpen: (open: boolean) => void;
  filterColumns: FilterColumn[];
  live: string;
  announce: (msg: string) => void;
  // BoardTable registers its CSV export; the ⋯ toolbar menu calls it.
  exportFn: (() => void) | null;
  registerExport: (fn: (() => void) | null) => void;
}

const Ctx = createContext<ListState | null>(null);

export function useListState(): ListState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useListState outside ListStateProvider");
  return v;
}

export function ListStateProvider({ meta, initialConfig, children }: { meta: ListMeta; initialConfig: ListConfig; children: ReactNode }) {
  const [config, setConfig] = useState(initialConfig);
  const [search, setSearch] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [live, setLive] = useState("");
  const announce = useCallback((msg: string) => setLive(msg), []);
  const [exportFn, setExportFn] = useState<(() => void) | null>(null);
  const registerExport = useCallback((fn: (() => void) | null) => setExportFn(() => fn), []);
  const { workspaceId, boardId, canManagePrefs } = meta;

  const persistFilters = useCallback(
    (next: Pick<ListConfig, "filters" | "sort" | "groupBy">) => {
      if (!canManagePrefs) return;
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("boardId", boardId);
      fd.set("payload", JSON.stringify(next));
      startTransition(() => saveTableFiltersAction(fd));
    },
    [workspaceId, boardId, canManagePrefs],
  );
  const persistPrefs = useCallback(
    (patch: Partial<Pick<ListConfig, "columnOrder" | "hidden" | "pinned" | "widths">>) => {
      if (!canManagePrefs) return;
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("boardId", boardId);
      fd.set("config", JSON.stringify(patch));
      startTransition(() => saveTableColumnPrefsAction(fd));
    },
    [workspaceId, boardId, canManagePrefs],
  );

  // Widths change on every drag frame — debounce the write; flush on unmount.
  const widthsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWidths = useRef<Record<string, number> | null>(null);
  useEffect(() => () => {
    if (widthsTimer.current) clearTimeout(widthsTimer.current);
    if (pendingWidths.current) persistPrefs({ widths: pendingWidths.current });
  }, [persistPrefs]);

  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const setFilters = useCallback((filters: TableFilter[]) => {
    const next = { ...configRef.current, filters };
    setConfig(next);
    persistFilters({ filters, sort: next.sort, groupBy: next.groupBy });
  }, [persistFilters]);
  const setSort = useCallback((sort: TableSort | null) => {
    const next = { ...configRef.current, sort };
    setConfig(next);
    persistFilters({ filters: next.filters, sort, groupBy: next.groupBy });
  }, [persistFilters]);
  const setGroupBy = useCallback((groupBy: string | null) => {
    const next = { ...configRef.current, groupBy };
    setConfig(next);
    persistFilters({ filters: next.filters, sort: next.sort, groupBy });
  }, [persistFilters]);
  const setColumnPrefs = useCallback<ListState["setColumnPrefs"]>((patch) => {
    setConfig((c) => ({ ...c, ...patch }));
    const { widths, ...rest } = patch;
    if (Object.keys(rest).length > 0) persistPrefs(rest);
    if (widths) {
      pendingWidths.current = widths;
      if (widthsTimer.current) clearTimeout(widthsTimer.current);
      widthsTimer.current = setTimeout(() => {
        pendingWidths.current = null;
        persistPrefs({ widths });
      }, 800);
    }
  }, [persistPrefs]);

  const filterColumns = useMemo<FilterColumn[]>(() => [
    { id: "title", label: "Tytuł", kind: "BUILTIN_TITLE" },
    { id: "statusColumnId", label: "Status", kind: "BUILTIN_STATUS", options: meta.statusColumns.map((s) => ({ value: s.id, label: s.name, hue: hueForColor(s.colorHex) })) },
    { id: "priority", label: "Priorytet", kind: "SINGLE_SELECT", options: PRIORITY_VALUES.filter((p) => p !== "NONE").map((p) => ({ value: p, label: `${PRIORITY_META[p].shortCode} ${PRIORITY_META[p].label}`, hue: PRIORITY_HUE[p] })) },
    { id: "assignees", label: "Przypisany", kind: "MULTI_SELECT", options: meta.members.map((m) => ({ value: m.id, label: memberName(m), avatar: m.avatarUrl })) },
    { id: "tags", label: "Tag", kind: "MULTI_SELECT", options: meta.allTags.map((t) => ({ value: t.id, label: t.name, hue: hueForColor(t.colorHex) })) },
    { id: "startAt", label: "Start", kind: "BUILTIN_DATE" },
    { id: "stopAt", label: "Koniec", kind: "BUILTIN_DATE" },
    { id: "attachments", label: "Załączniki", kind: "ATTACHMENT" },
    { id: "milestone", label: "Milestone", kind: "TEXT" },
    ...meta.customColumns.map<FilterColumn>((c) => {
      const opts = parseFieldOptions(c.options).selectOptions;
      return {
        id: c.id,
        label: c.name,
        kind: c.type,
        options:
          c.type === "USER" ? meta.members.map((m) => ({ value: m.id, label: memberName(m), avatar: m.avatarUrl }))
          : opts && (c.type === "SINGLE_SELECT" || c.type === "MULTI_SELECT") ? opts.map((o) => ({ value: o.value, label: o.value, hue: hueForColor(o.color) }))
          : undefined,
      };
    }),
  ], [meta.statusColumns, meta.members, meta.allTags, meta.customColumns]);

  const value = useMemo<ListState>(() => ({
    ...meta, config, setFilters, setSort, setGroupBy, setColumnPrefs, search, setSearch,
    builderOpen, setBuilderOpen, columnsOpen, setColumnsOpen, filterColumns, live, announce, exportFn, registerExport,
  }), [meta, config, setFilters, setSort, setGroupBy, setColumnPrefs, search, builderOpen, columnsOpen, filterColumns, live, announce, exportFn, registerExport]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
