"use client";

// BoardToolbar wired to the Lista state (search · person filter · quick filters ·
// „+ Filtr” builder · chips · Grupuj · Sortuj · Kolumny · ⋯).

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { configureColumnAction, createTableColumnAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
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
import { SelectOptionsEditor } from "@/components/table/field-config";
import { PRIORITY_LEVEL } from "@/components/table/priority-picker-cell";
import { hueForColor } from "@/components/ui/status-hue";
import { memberName } from "@/components/table/types";

const GROUPABLE = [
  { id: "statusColumnId", label: "Status" },
  { id: "priority", label: "Priorytet" },
  { id: "title", label: "Tytuł" },
  { id: "startAt", label: "Start" },
  { id: "stopAt", label: "Koniec" },
  { id: "milestone", label: "Milestone" },
];

/**
 * „Sekcje" to zwykle pole wyboru o tej nazwie — nagłówki na liscie robi juz
 * grupowanie, wiec nie ma po co dokladac osobnego bytu w bazie. Nazwa jest
 * jednoczesnie kluczem: po niej odnajdujemy kolumne po utworzeniu.
 */
const SEKCJE = "Sekcje";

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

  // ── Sekcje ────────────────────────────────────────────────────────────────
  const sekcje = customColumns.find((c) => c.type === "SINGLE_SELECT" && c.name === SEKCJE);
  const [tworzeSekcje, setTworzeSekcje] = useState(false);
  // Akcja tworzaca kolumne nie zwraca id, wiec po odswiezeniu odnajdujemy ja po
  // nazwie i dopiero wtedy wlaczamy grupowanie.
  useEffect(() => {
    if (!tworzeSekcje || !sekcje) return;
    // Kolumna pojawia sie dopiero po odswiezeniu z serwera — to jedyny moment,
    // w ktorym znamy jej id, wiec grupowanie wlaczamy wlasnie tutaj.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTworzeSekcje(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    s.setGroupBy(sekcje.id);
  }, [tworzeSekcje, sekcje, s]);

  const wlaczSekcje = () => {
    if (sekcje) {
      s.setGroupBy(config.groupBy === sekcje.id ? null : sekcje.id);
      return;
    }
    if (!s.canManagePrefs || tworzeSekcje) return;
    const fd = new FormData();
    fd.set("workspaceId", s.workspaceId);
    fd.set("boardId", s.boardId);
    fd.set("name", SEKCJE);
    fd.set("type", "SINGLE_SELECT");
    fd.set("options", JSON.stringify({ selectOptions: [] }));
    setTworzeSekcje(true);
    startTransition(async () => {
      await createTableColumnAction(fd);
      router.refresh();
      toast.add({ title: "Dodano pole Sekcje", description: "Nazwy sekcji dopiszesz w menu nagłówka kolumny." });
    });
  };

  const sekcjeAktywne = Boolean(sekcje) && config.groupBy === sekcje?.id;
  const sekcjeWidoczne = Boolean(sekcje) || s.canManagePrefs;
  const [sekcjeOpen, setSekcjeOpen] = useState(false);
  // Szkic listy sekcji na czas edycji. Bez niego kazda zmiana szla z danych
  // serwera, ktore w trakcie pisania sa jeszcze stare — druga dopisana sekcja
  // kasowala pierwsza.
  const [szkicSekcji, setSzkicSekcji] = useState<{ value: string; color: string }[] | null>(null);
  const nazwySekcji = szkicSekcji ?? (sekcje ? parseFieldOptions(sekcje.options).selectOptions ?? [] : []);

  const zapiszSekcje = (opcje: { value: string; color: string }[]) => {
    if (!sekcje) return;
    setSzkicSekcji(opcje);
    const fd = new FormData();
    fd.set("id", sekcje.id);
    fd.set("name", sekcje.name);
    fd.set("type", "SINGLE_SELECT");
    fd.set("options", JSON.stringify({ ...parseFieldOptions(sekcje.options), selectOptions: opcje }));
    startTransition(() => { configureColumnAction(fd); });
  };

  // Panel pod przyciskiem „Sekcje": wlacz/wylacz nagłówki na liscie + nazwy
  // sekcji w jednym miejscu. Bez tego nazwy trzeba bylo dopisywac w Kolumny →
  // kolumna → zebatka, czyli dwa poziomy glebiej.
  const sekcjePanel = (
    <div className="flex w-[300px] flex-col gap-2.5">
      <p className="text-xs font-semibold">Sekcje</p>
      {sekcje ? (
        <>
          <Button
            variant={sekcjeAktywne ? "secondary" : "primary"}
            size="sm"
            onClick={() => s.setGroupBy(sekcjeAktywne ? null : sekcje.id)}
          >
            {sekcjeAktywne ? "Wyłącz podział na sekcje" : "Pokaż listę w sekcjach"}
          </Button>
          <span className="eyebrow">Nazwy sekcji</span>
          <SelectOptionsEditor value={nazwySekcji} onChange={zapiszSekcje} />
          <p className="text-2xs text-fg-3">{"Zadanie przypiszesz do sekcji w kolumnie „Sekcje”."}</p>
        </>
      ) : (
        <>
          <p className="text-xs text-fg-2">Sekcje to własne nagłówki na liście — jak grupowanie po milestonach, tylko z Twoimi nazwami.</p>
          <Button size="sm" loading={tworzeSekcje} onClick={wlaczSekcje}>Utwórz sekcje</Button>
        </>
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
        sekcjeWidoczne
          ? {
              open: sekcjeOpen,
              onOpenChange: (o) => {
                setSekcjeOpen(o);
                // Po zamknieciu wracamy do danych z serwera i odswiezamy liste,
                // zeby nagłówki zlapaly nowe nazwy i kolejnosc.
                if (!o && szkicSekcji) { setSzkicSekcji(null); router.refresh(); }
              },
              content: sekcjePanel,
            }
          : undefined
      }
      sectionsLabel={sekcjeAktywne ? `Sekcje: ${nazwySekcji.length || "brak"}` : "Sekcje"}
      sectionsActive={sekcjeAktywne}
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
