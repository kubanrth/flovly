"use client";

// Redesign v5 (A2/B1): shared board toolbar — pure UI driven by callbacks.
// Density is the one piece of state it owns (localStorage `ui:density` →
// <html data-density>), everything else comes from the caller (F2 wires
// filters/sort/group of the list; see docs/redesign/OMITTED.md).

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DENSITY_PX, useUiPref, type Density } from "@/hooks/use-ui-pref";
import { Button } from "@/components/ui/button";
import { InputGroup } from "@/components/ui/input";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { FilterChip } from "@/components/ui/chip";
import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/dropdown-menu";
import { IconChevronDown, IconColumns, IconDensity, IconMore, IconPlus, IconSearch } from "@/components/ui/icons";

export interface ToolbarPerson {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface BoardToolbarProps {
  search?: string;
  onSearch?: (query: string) => void;
  people?: ToolbarPerson[];
  activePeople?: string[];
  onTogglePerson?: (id: string) => void;
  filterButtons?: { label: string; active?: boolean; disabled?: boolean; onClick?: () => void }[];
  onAddFilter?: () => void;
  chips?: { id: string; label: string; onRemove: () => void }[];
  onClearChips?: () => void;
  groupLabel?: string;
  onGroup?: () => void;
  sortLabel?: string;
  onSort?: () => void;
  onColumns?: () => void;
  density?: Density;
  onDensity?: (d: Density) => void;
  // Menu items for the trailing ⋯ (rendered inside <MenuContent>).
  more?: ReactNode;
}

const DENSITY_LABEL: Record<Density, string> = { compact: "Kompaktowa", comfortable: "Wygodna", spacious: "Przestronna" };

const BTN =
  "inline-flex h-7 shrink-0 items-center gap-[5px] whitespace-nowrap rounded-md px-2 text-xs font-medium text-n-700 outline-none hover:bg-n-100 active:bg-n-200 disabled:pointer-events-none disabled:text-n-400 [&_svg]:shrink-0";
const BORDERED = cn(BTN, "border border-border px-2.5");

export function BoardToolbar(p: BoardToolbarProps) {
  const [stored, setStored] = useUiPref<Density>("ui:density", "comfortable");
  const density = p.density ?? stored;
  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);
  const setDensity = (d: Density) => {
    setStored(d);
    p.onDensity?.(d);
  };
  const chevron = <IconChevronDown width={12} height={12} className="text-n-500" />;

  return (
    <div
      data-ui="board-toolbar"
      className="no-scrollbar flex items-center gap-2 border-b border-border bg-card px-6 py-2 max-md:overflow-x-auto max-md:px-4"
    >
      <InputGroup
        size="sm"
        leading={<IconSearch />}
        placeholder="Szukaj w tablicy"
        aria-label="Szukaj w tablicy"
        value={p.search ?? ""}
        onChange={(e) => p.onSearch?.(e.target.value)}
        className="w-[200px] shrink-0 text-xs max-md:w-40"
      />

      {p.people && p.people.length > 0 && (
        p.onTogglePerson ? (
          <span role="group" aria-label="Filtruj po osobie" className="mx-0.5 inline-flex shrink-0">
            {p.people.slice(0, 3).map((m, i) => {
              const on = p.activePeople?.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  title={m.name}
                  onClick={() => p.onTogglePerson?.(m.id)}
                  className={cn(
                    "rounded-full outline-none hover:shadow-[0_0_0_2px_var(--n-300)] active:shadow-[0_0_0_2px_var(--n-400)]",
                    i > 0 && "-ml-[7px]",
                    on && "shadow-[0_0_0_2px_var(--orange-500)] hover:shadow-[0_0_0_2px_var(--orange-600)]",
                  )}
                >
                  <Avatar name={m.name} src={m.avatarUrl} size={24} className="border-2 border-card" />
                </button>
              );
            })}
            {p.people.length > 3 && (
              <span className="-ml-[7px] inline-flex size-6 items-center justify-center rounded-full border-2 border-card bg-n-100 text-[10px] font-semibold text-muted-foreground">
                +{p.people.length - 3}
              </span>
            )}
          </span>
        ) : (
          <AvatarStack people={p.people.map((m) => ({ name: m.name, src: m.avatarUrl }))} size={24} className="mx-0.5 shrink-0" />
        )
      )}

      {p.filterButtons?.map((b) => (
        <button
          key={b.label}
          type="button"
          disabled={b.disabled}
          title={b.disabled ? "Dostępne wkrótce" : undefined}
          onClick={b.onClick}
          data-active={b.active ? "" : undefined}
          className={cn(BORDERED, "data-active:border-orange-500 data-active:bg-selected")}
        >
          {b.label}
          {chevron}
        </button>
      ))}
      <button
        type="button"
        onClick={p.onAddFilter}
        disabled={!p.onAddFilter}
        className={cn(BORDERED, "border-dashed border-n-400 text-muted-foreground")}
      >
        <IconPlus width={12} height={12} />
        Filtr
      </button>

      {p.chips?.map((c) => <FilterChip key={c.id} label={c.label} onRemove={c.onRemove} className="text-xs" />)}
      {p.chips && p.chips.length > 0 && (
        <Button variant="link" size="sm" onClick={p.onClearChips}>Wyczyść</Button>
      )}

      <span className="flex-1 max-md:hidden" />

      <button type="button" onClick={p.onGroup} disabled={!p.onGroup} className={BTN}>
        {p.groupLabel ?? "Grupuj"}
        {chevron}
      </button>
      <button type="button" onClick={p.onSort} disabled={!p.onSort} className={BTN}>
        {p.sortLabel ?? "Sortuj"}
        {chevron}
      </button>
      <button type="button" onClick={p.onColumns} disabled={!p.onColumns} className={BTN}>
        <IconColumns width={14} height={14} />
        Kolumny
      </button>

      <Menu>
        <MenuTrigger data-ui="density-menu" aria-label={`Gęstość: ${DENSITY_LABEL[density]}`} className={BTN}>
          <IconDensity width={14} height={14} />
          Gęstość
          {chevron}
        </MenuTrigger>
        <MenuContent align="end" className="min-w-[180px]">
          <MenuRadioGroup value={density} onValueChange={(v) => setDensity(v as Density)}>
            {(Object.keys(DENSITY_LABEL) as Density[]).map((d) => (
              <MenuRadioItem key={d} value={d}>
                {DENSITY_LABEL[d]}
                <span className="ml-1.5 font-mono text-[10px] text-n-500">{DENSITY_PX[d]}px</span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuContent>
      </Menu>

      <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />

      {p.more ? (
        <Menu>
          <MenuTrigger aria-label="Więcej" className={cn(BTN, "w-7 px-0 text-muted-foreground")}>
            <IconMore />
          </MenuTrigger>
          <MenuContent align="end">{p.more}</MenuContent>
        </Menu>
      ) : (
        <button type="button" aria-label="Więcej" disabled className={cn(BTN, "w-7 px-0")}>
          <IconMore />
        </button>
      )}
    </div>
  );
}
