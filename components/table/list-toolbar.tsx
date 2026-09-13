"use client";

// BoardToolbar wired to the Lista state (search · person filter · quick filters ·
// „+ Filtr” builder · chips · Grupuj · Sortuj · Kolumny · ⋯).

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { saveTaskCategoriesAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/category-actions";
import { GROUP_PRESETS } from "@/lib/group-presets";
import { PRIORITY_META, PRIORITY_VALUES } from "@/lib/task-priority";
import { parseFieldOptions } from "@/lib/table-fields";
import type { TableFilter } from "@/lib/table-filters";
import { BoardToolbar } from "@/components/view/board-toolbar";
import { MenuCheckboxItem, MenuGroup, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconCopy, IconDownload, IconUpload } from "@/components/ui/icons";
import { PriorityIcon } from "@/components/ui/priority-icon";
import { useToast } from "@/components/ui/toast";
import { useListState } from "@/components/table/list-state";
import { BUILTIN_COLUMNS, customColId } from "@/components/table/columns";
import { ColumnSettingsPanel } from "@/components/table/column-settings";
import { FilterBuilder, describeFilter, isActiveFilter, newFilter } from "@/components/table/filter-builder";
import { CategoriesEditor, type CategoryDraft } from "@/components/table/categories-editor";
import { PRIORITY_LEVEL } from "@/components/table/priority-picker-cell";
import { hueForColor } from "@/components/ui/status-hue";
import { memberName } from "@/components/table/types";

const GROUPABLE = [
  { id: "statusColumnId", label: "Status" },
  { id: "priority", label: "Priorytet" },
  { id: "title", label: "Tytuł" },
  { id: "startAt", label: "Start" },
  { id: "stopAt", label: "Koniec" },
  { id: "category", label: "Kategoria" },
  { id: "milestone", label: "Milestone" },
];


function parseMulti(value: string): string[] {
  try {
    const j = JSON.parse(value);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

export function ListToolbar() {
  const s = useListState();
  const toast = useToast();
  const router = useRouter();
  const { config, filterColumns, customColumns } = s;
  const filters = config.filters;

  // ── Kategorie ─────────────────────────────────────────────────────────────
  // Panel pod przyciskiem „Kategorie": podział listy na kategorie + lista
  // kategorii tablicy w jednym miejscu (F15; zastąpiło „Sekcje" z pola wyboru).
  const kategorieAktywne = config.groupBy === "category";
  const kategorieWidoczne = s.categories.length > 0 || s.canManagePrefs;
  const [kategorieOpen, setKategorieOpen] = useState(false);
  // Szkic na czas edycji — dane z serwera w trakcie pisania są jeszcze stare.
  const [szkic, setSzkic] = useState<CategoryDraft[] | null>(null);
  const kategorie: CategoryDraft[] = szkic ?? s.categories;
  const zapiszKategorie = (next: CategoryDraft[]) => {
    setSzkic(next);
    if (next.some((c) => !c.name.trim())) return; // pusta nazwa w trakcie pisania — zapis po uzupełnieniu
    const fd = new FormData();
    fd.set("boardId", s.boardId);
    fd.set("categories", JSON.stringify(next.map((c) => ({ id: c.id, name: c.name.trim(), colorHex: c.colorHex }))));
    startTransition(async () => {
      const res = await saveTaskCategoriesAction(fd);
      if (!res.ok) { toast.add({ title: "Nie zapisano kategorii", description: res.error, type: "error" }); return; }
      // Nowe wiersze dostają id z serwera — bez tego kolejna edycja założyłaby je drugi raz.
      setSzkic((cur) => (cur && cur.length === res.categories.length ? res.categories.map((c, i) => ({ ...c, name: cur[i]?.name ?? c.name })) : res.categories));
    });
  };

  const kategoriePanel = (
    <div className="flex w-[300px] flex-col gap-2.5">
      <p className="text-xs font-semibold">Kategorie</p>
      <p className="text-xs text-fg-2">{"Własne nagłówki na liście, osobno od milestone'ów. Kategorię wybierzesz już przy tworzeniu zadania."}</p>
      <Button
        variant={kategorieAktywne ? "secondary" : "primary"}
        size="sm"
        disabled={kategorie.length === 0 && !kategorieAktywne}
        onClick={() => s.setGroupBy(kategorieAktywne ? null : "category")}
      >
        {kategorieAktywne ? "Wyłącz podział na kategorie" : "Pokaż listę w kategoriach"}
      </Button>
      {s.canManagePrefs ? (
        <>
          <span className="eyebrow">Lista kategorii</span>
          <CategoriesEditor value={kategorie} onChange={zapiszKategorie} />
        </>
      ) : (
        <p className="text-2xs text-fg-3">Kategorie ustawia osoba zarządzająca tablicą.</p>
      )}
    </div>
  );


  // Quick filters are single `hasAny`/`equals` rows keyed by column — toggled from menus.
  const multiIds = (columnId: string) => {
    const f = filters.find((x) => x.columnId === columnId && x.op === "hasAny");
    return f ? parseMulti(f.value) : [];
  };
  const setMulti = (columnId: string, ids: string[]) => {
    const rest = filters.filter((x) => !(x.columnId === columnId && x.op === "hasAny"));
    s.setFilters(ids.length ? [...rest, { columnId, kind: "MULTI_SELECT", op: "hasAny", value: JSON.stringify(ids) }] : rest);
  };
  const toggleMulti = (columnId: string, id: string) => {
    const ids = multiIds(columnId);
    setMulti(columnId, ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  };
  const priorityFilter = filters.find((x) => x.columnId === "priority" && x.op === "equals");
  const setPriority = (value: string) => {
    const rest = filters.filter((x) => !(x.columnId === "priority" && x.op === "equals"));
    s.setFilters(value ? [...rest, { columnId: "priority", kind: "SINGLE_SELECT", op: "equals", value }] : rest);
  };

  const statusIds = multiIds("statusColumnId");
  const tagIds = multiIds("tags");
  const people = multiIds("assignees");

  const chips = filters
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => isActiveFilter(f))
    .map(({ f, i }) => ({ id: String(i), label: describeFilter(f, filterColumns), onRemove: () => s.setFilters(filters.filter((_, j) => j !== i)) }));

  const groupLabel = config.groupBy
    ? GROUPABLE.find((g) => g.id === config.groupBy)?.label ?? GROUP_PRESETS.find((p) => p.id === config.groupBy)?.label ?? customColumns.find((c) => c.id === config.groupBy)?.name ?? "?"
    : null;
  const sortable = [
    ...BUILTIN_COLUMNS.map((c) => ({ id: c.id, label: c.label, kind: c.kind })),
    ...customColumns.map((c) => ({ id: c.id, label: c.name, kind: c.type as TableFilter["kind"] })),
  ];
  const sortLabel = config.sort ? sortable.find((c) => c.id === config.sort!.columnId)?.label ?? "?" : null;

  const importCsv = () => {
    // The import dialog (B7) lives in the header actions; trigger its button.
    const btn = [...document.querySelectorAll<HTMLButtonElement>('[data-ui="board-header"] button')].find((b) => /import/i.test(b.textContent ?? ""));
    if (btn) btn.click();
    else toast.add({ title: "Import niedostępny", description: "Włącz flagę import_csv_xls w panelu admina.", type: "error" });
  };

  return (
    <BoardToolbar
      search={s.search}
      onSearch={s.setSearch}
      people={s.members.map((m) => ({ id: m.id, name: memberName(m), avatarUrl: m.avatarUrl }))}
      activePeople={people}
      onTogglePerson={(id) => toggleMulti("assignees", id)}
      filterButtons={[
        {
          label: "Status",
          active: statusIds.length > 0,
          menu: (
            <>
              {s.statusColumns.map((st) => (
                <MenuCheckboxItem key={st.id} checked={statusIds.includes(st.id)} closeOnClick={false} onCheckedChange={() => toggleMulti("statusColumnId", st.id)}>
                  <Chip hue={hueForColor(st.colorHex)} dot size="md">{st.name}</Chip>
                </MenuCheckboxItem>
              ))}
              {statusIds.length > 0 && (
                <>
                  <MenuSeparator />
                  <MenuItem onClick={() => setMulti("statusColumnId", [])}>Wyczyść</MenuItem>
                </>
              )}
            </>
          ),
        },
        {
          label: "Priorytet",
          active: Boolean(priorityFilter),
          menu: (
            <MenuRadioGroup value={priorityFilter?.value ?? ""} onValueChange={(v) => setPriority(String(v))}>
              <MenuRadioItem value="" closeOnClick>Dowolny</MenuRadioItem>
              {PRIORITY_VALUES.filter((p) => p !== "NONE").map((p) => (
                <MenuRadioItem key={p} value={p} closeOnClick>
                  <PriorityIcon level={PRIORITY_LEVEL[p]!} size={14} />
                  {PRIORITY_META[p].shortCode} {PRIORITY_META[p].label}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          ),
        },
        {
          label: "Tag",
          active: tagIds.length > 0,
          menu: (
            <>
              {s.allTags.length === 0 && <MenuItem disabled>Brak tagów</MenuItem>}
              {s.allTags.map((t) => (
                <MenuCheckboxItem key={t.id} checked={tagIds.includes(t.id)} closeOnClick={false} onCheckedChange={() => toggleMulti("tags", t.id)}>
                  <Chip hue={hueForColor(t.colorHex)} size="sm">{t.name}</Chip>
                </MenuCheckboxItem>
              ))}
              {tagIds.length > 0 && (
                <>
                  <MenuSeparator />
                  <MenuItem onClick={() => setMulti("tags", [])}>Wyczyść</MenuItem>
                </>
              )}
            </>
          ),
        },
      ]}
      addFilter={{
        open: s.builderOpen,
        onOpenChange: (o) => {
          s.setBuilderOpen(o);
          // Opening an empty builder starts with one row so the user can type right away.
          if (o && filters.length === 0 && filterColumns[0]) s.setFilters([newFilter(filterColumns[0])]);
        },
        content: <FilterBuilder filters={filters} columns={filterColumns} onChange={s.setFilters} />,
      }}
      sections={
        kategorieWidoczne
          ? {
              open: kategorieOpen,
              onOpenChange: (o) => {
                setKategorieOpen(o);
                // Po zamknięciu wracamy do danych z serwera i odświeżamy listę,
                // żeby nagłówki i komórki złapały nowe nazwy i kolejność.
                if (!o && szkic) { setSzkic(null); router.refresh(); }
              },
              content: kategoriePanel,
            }
          : undefined
      }
      sectionsLabel={kategorieAktywne ? `Kategorie: ${kategorie.length || "brak"}` : "Kategorie"}
      sectionsActive={kategorieAktywne}
      chips={chips}
      onClearChips={() => s.setFilters([])}
      groupLabel={groupLabel ? `Grupuj: ${groupLabel}` : undefined}
      groupActive={Boolean(config.groupBy)}
      groupMenu={
        <MenuRadioGroup value={config.groupBy ?? ""} onValueChange={(v) => s.setGroupBy(v ? String(v) : null)}>
          <MenuRadioItem value="" closeOnClick>Brak</MenuRadioItem>
          <MenuSeparator />
          {GROUPABLE.map((g) => <MenuRadioItem key={g.id} value={g.id} closeOnClick>{g.label}</MenuRadioItem>)}
          <MenuGroup>
            <MenuLabel>Presety</MenuLabel>
            {GROUP_PRESETS.map((p) => <MenuRadioItem key={p.id} value={p.id} closeOnClick>{p.label}</MenuRadioItem>)}
          </MenuGroup>
          {customColumns.length > 0 && (
            <MenuGroup>
              <MenuLabel>Pola</MenuLabel>
              {customColumns.map((c) => <MenuRadioItem key={c.id} value={c.id} closeOnClick>{c.name}</MenuRadioItem>)}
            </MenuGroup>
          )}
        </MenuRadioGroup>
      }
      sortLabel={sortLabel ? `Sortuj: ${sortLabel} ${config.sort!.dir === "asc" ? "↑" : "↓"}` : undefined}
      sortActive={Boolean(config.sort)}
      sortMenu={
        <MenuRadioGroup
          value={config.sort ? `${config.sort.columnId}:${config.sort.dir}` : ""}
          onValueChange={(v) => {
            const [columnId, dir] = String(v).split(":");
            const col = sortable.find((c) => c.id === columnId);
            s.setSort(col && (dir === "asc" || dir === "desc") ? { columnId: col.id, kind: col.kind, dir } : null);
          }}
        >
          <MenuRadioItem value="" closeOnClick>Brak</MenuRadioItem>
          <MenuSeparator />
          {sortable.map((c) => (
            <span key={c.id} className="contents">
              <MenuRadioItem value={`${c.id}:asc`} closeOnClick>{c.label} <span className="text-fg-3">· rosnąco</span></MenuRadioItem>
              <MenuRadioItem value={`${c.id}:desc`} closeOnClick>{c.label} <span className="text-fg-3">· malejąco</span></MenuRadioItem>
            </span>
          ))}
        </MenuRadioGroup>
      }
      columns={{
        open: s.columnsOpen,
        onOpenChange: s.setColumnsOpen,
        content: (
          <ColumnSettingsPanel
            workspaceId={s.workspaceId}
            boardId={s.boardId}
            canManage={s.canManagePrefs}
            columns={[
              ...BUILTIN_COLUMNS.map((c) => ({ id: c.id, label: c.label, frozen: c.id === "displayId" || c.id === "title" })),
              ...customColumns.map((c) => ({ id: customColId(c.id), label: c.name, custom: true, fieldType: c.type, fieldOptions: parseFieldOptions(c.options) })),
            ]}
            columnOrder={config.columnOrder.length ? config.columnOrder : [...BUILTIN_COLUMNS.map((c) => c.id), ...customColumns.map((c) => customColId(c.id))]}
            hidden={config.hidden}
            onChange={(next) => s.setColumnPrefs({ columnOrder: next.order, hidden: next.hidden })}
          />
        ),
      }}
      more={
        <>
          <MenuItem icon={<IconUpload />} onClick={importCsv}>Import CSV/XLSX</MenuItem>
          <MenuItem icon={<IconDownload />} onClick={() => s.exportFn?.()} disabled={!s.exportFn}>Eksport CSV</MenuItem>
          <MenuSeparator />
          <MenuItem
            icon={<IconCopy />}
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href);
              toast.add({ title: "Skopiowano link do widoku" });
            }}
          >
            Kopiuj link do widoku
          </MenuItem>
        </>
      }
    />
  );
}
