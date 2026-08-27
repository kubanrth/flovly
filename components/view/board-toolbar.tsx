"use client";

// Redesign v5 (A2/B1): shared board toolbar — pure UI driven by callbacks.
// Density is the one piece of state it owns (localStorage `ui:density` →
// <html data-density>). Buttons can carry a menu/popover body so the caller
// (list-toolbar, later kanban/timeline) plugs its own state in.

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DENSITY_PX, useUiPref, type Density } from "@/hooks/use-ui-pref";
import { Button } from "@/components/ui/button";
import { InputGroup } from "@/components/ui/input";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { FilterChip } from "@/components/ui/chip";
import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconChevronDown, IconColumns, IconDensity, IconMore, IconPlus, IconSearch } from "@/components/ui/icons";

export interface ToolbarPerson {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface ToolbarPopover {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: ReactNode;
}

export interface BoardToolbarProps {
  search?: string;
  onSearch?: (query: string) => void;
  people?: ToolbarPerson[];
  activePeople?: string[];
  onTogglePerson?: (id: string) => void;
  // `menu` = <MenuContent> children; when present the button opens it instead of calling onClick.
  filterButtons?: { label: string; active?: boolean; disabled?: boolean; onClick?: () => void; menu?: ReactNode }[];
  onAddFilter?: () => void;
  // Popover body for „+ Filtr” (filter builder). Wins over onAddFilter.
  addFilter?: ToolbarPopover;
  chips?: { id: string; label: string; onRemove: () => void }[];
  onClearChips?: () => void;
  groupLabel?: string;
  groupActive?: boolean;
  onGroup?: () => void;
  groupMenu?: ReactNode;
  sortLabel?: string;
  sortActive?: boolean;
  onSort?: () => void;
  sortMenu?: ReactNode;
  onColumns?: () => void;
  columns?: ToolbarPopover;
  density?: Density;
  onDensity?: (d: Density) => void;
  // Menu items for the trailing ⋯ (rendered inside <MenuContent>).
  more?: ReactNode;
  /**
   * Ukrywa kontrolki, których dany widok nie obsługuje (Grupuj / Sortuj /
   * Kolumny / Gęstość / „+ Filtr"). Wyszarzony przycisk, który nic nie robi,
   * to szum — Oś czasu nie ma kolumn ani gęstości wierszy.
   */
  hideListControls?: boolean;
}

const DENSITY_LABEL: Record<Density, string> = { compact: "Kompaktowa", comfortable: "Wygodna", spacious: "Przestronna" };

const BTN =
  "inline-flex h-7 shrink-0 items-center gap-[5px] whitespace-nowrap rounded-md px-2 text-xs font-medium text-n-700 outline-none hover:bg-n-100 active:bg-n-200 disabled:pointer-events-none disabled:text-n-400 data-popup-open:bg-n-100 data-active:bg-selected data-active:text-foreground [&_svg]:shrink-0";
const BORDERED = cn(BTN, "border border-border px-2.5 data-active:border-orange-500");

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
  const chevron = <IconChevronDown width={12} height={12} className="text-fg-3" />;

  const menuButton = (label: ReactNode, menu: ReactNode | undefined, opts: { className: string; active?: boolean; disabled?: boolean; onClick?: () => void; ariaLabel?: string; icon?: ReactNode }) =>
    menu ? (
      <Menu>
        <MenuTrigger disabled={opts.disabled} aria-label={opts.ariaLabel} data-active={opts.active ? "" : undefined} className={opts.className}>
          {opts.icon}
          {label}
          {chevron}
        </MenuTrigger>
        <MenuContent align="start" className="max-h-[70vh] overflow-y-auto">{menu}</MenuContent>
      </Menu>
    ) : (
      <button type="button" disabled={opts.disabled} aria-label={opts.ariaLabel} onClick={opts.onClick} data-active={opts.active ? "" : undefined} className={opts.className}>
        {opts.icon}
        {label}
        {chevron}
      </button>
    );

  const popoverButton = (label: ReactNode, pop: ToolbarPopover | undefined, opts: { className: string; onClick?: () => void; disabled?: boolean; icon?: ReactNode; active?: boolean; align?: "start" | "end" }) =>
    pop ? (
      <Popover open={pop.open} onOpenChange={pop.onOpenChange}>
        <PopoverTrigger data-active={opts.active ? "" : undefined} className={opts.className}>
          {opts.icon}
          {label}
        </PopoverTrigger>
        <PopoverContent align={opts.align ?? "start"} className="p-3">{pop.content}</PopoverContent>
      </Popover>
    ) : (
      <button type="button" onClick={opts.onClick} disabled={opts.disabled} data-active={opts.active ? "" : undefined} className={opts.className}>
        {opts.icon}
        {label}
      </button>
    );

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
        data-ui="board-search"
        value={p.search ?? ""}
        onChange={(e) => p.onSearch?.(e.target.value)}
        className="w-[200px] shrink-0 text-xs max-md:w-40"
      />

      {p.people && p.people.length > 0 && (
        p.onTogglePerson ? (
          <span role="group" aria-label="Filtruj po osobie" className="mx-0.5 inline-flex shrink-0">
            {p.people.slice(0, 3).map((m) => {
              const on = p.activePeople?.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  title={m.name}
                  onClick={() => p.onTogglePerson?.(m.id)}
                  className={cn(
                    // AK190: bez nakładki — nachodzące awatary zostawiały 17px
                    // odsłoniętego celu, a WCAG 2.5.8 wymaga 24×24. Nienaciskalny
                    // „+N" niżej nadal nachodzi, bo nie jest celem.
                    "rounded-full outline-none hover:shadow-[0_0_0_2px_var(--n-300)] active:shadow-[0_0_0_2px_var(--n-400)]",
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
        <span key={b.label} className="contents">
          {menuButton(b.label, b.menu, { className: BORDERED, active: b.active, disabled: b.disabled, onClick: b.onClick })}
        </span>
      ))}
      {!p.hideListControls &&
        popoverButton("Filtr", p.addFilter, {
          className: cn(BORDERED, "border-dashed border-n-400 text-muted-foreground"),
          onClick: p.onAddFilter,
          disabled: !p.onAddFilter && !p.addFilter,
          icon: <IconPlus width={12} height={12} />,
        })}

      {p.chips?.map((c) => <FilterChip key={c.id} label={c.label} onRemove={c.onRemove} className="text-xs" />)}
      {p.chips && p.chips.length > 0 && (
        <Button variant="link" size="sm" onClick={p.onClearChips}>Wyczyść</Button>
      )}

      <span className="flex-1 max-md:hidden" />

      {!p.hideListControls && menuButton(p.groupLabel ?? "Grupuj", p.groupMenu, { className: BTN, active: p.groupActive, onClick: p.onGroup, disabled: !p.onGroup && !p.groupMenu })}
      {!p.hideListControls && menuButton(p.sortLabel ?? "Sortuj", p.sortMenu, { className: BTN, active: p.sortActive, onClick: p.onSort, disabled: !p.onSort && !p.sortMenu })}
      {!p.hideListControls && popoverButton("Kolumny", p.columns, { className: BTN, onClick: p.onColumns, disabled: !p.onColumns && !p.columns, icon: <IconColumns width={14} height={14} />, align: "end" })}

      {!p.hideListControls && (
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
                <span className="ml-1.5 font-mono text-[10px] text-fg-3">{DENSITY_PX[d]}px</span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuContent>
      </Menu>
      )}

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
