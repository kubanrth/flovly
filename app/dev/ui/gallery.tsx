"use client";

import { useState, type ReactNode } from "react";
import {
  Avatar, AvatarStack, Badge, Breadcrumb, Button, CHIP_HUE, CheckMark, Checkbox, Chip, Combobox, DataFooter, DataTable, DataTd, DataTh, DataThead, DataTr,
  DateTimePicker, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, EmptyState, FilterChip,
  IconBoards, IconCheckCircle, IconChevronDown, IconColumns, IconCopy, IconEdit, IconFilter, IconList, IconMore, IconPlus, IconSearch, IconShare, IconStar,
  IconTimeline, IconTrash, IconWarning, Input, InputGroup, Kbd, Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem,
  MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger, POPUP_CLASS, POPUP_ITEM_CLASS, PRIORITY_LABEL, PersonPicker, Popover, PopoverContent,
  PopoverTrigger, PriorityIcon, Radio, RadioGroup, Segmented, Select, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, Skeleton, StatusChip, Switch,
  Tab, Tabs, TabsList, TagChip, Textarea, ToastCard, ToastProvider, Toaster, Tooltip, useToast, type ChipHue, type PriorityLevel,
} from "@/components/ui";

const HUES: [ChipHue, string][] = [["gray", "szary"], ["green", "zielony"], ["teal", "morski"], ["blue", "niebieski"], ["indigo", "indygo"], ["purple", "fiolet"], ["pink", "róż"], ["red", "czerwony"], ["orange", "pomarańcz"], ["yellow", "żółty"], ["brown", "brąz"], ["black", "czarny"]];
const STATUSES: [string, ChipHue][] = [["Do zrobienia", "gray"], ["W toku", "blue"], ["Do poprawy", "yellow"], ["Gotowe", "green"]];
const PEOPLE = [{ id: "d", name: "Daniel", hue: "blue" as ChipHue }, { id: "k", name: "Kuba", hue: "green" as ChipHue }, { id: "g", name: "Gabryś", hue: "purple" as ChipHue }, { id: "m", name: "Marta", hue: "pink" as ChipHue }, { id: "a", name: "Ania" }, { id: "p", name: "Piotr" }, { id: "t", name: "Tomek" }];

function Section({ title, span = 4, children }: { title: string; span?: number; children: ReactNode }) {
  return (
    <section className="surface p-5" style={{ gridColumn: `span ${span}` }}>
      <div className="eyebrow mb-3.5">{title}</div>
      {children}
    </section>
  );
}
const Sub = ({ children, className = "" }: { children: ReactNode; className?: string }) => <div className={`mb-1.5 text-xs font-medium text-n-700 ${className}`}>{children}</div>;
const Mono = ({ children, className = "" }: { children: ReactNode; className?: string }) => <div className={`font-mono text-[10px] text-fg-3 ${className}`}>{children}</div>;

export function Gallery() {
  return (
    <ToastProvider timeout={5000}>
      <div className="min-h-screen bg-canvas px-8 pt-7 pb-14">
        <div className="mb-6 flex items-center gap-3">
          <span className="text-lg font-extrabold tracking-[-0.6px] text-ink">FLOVLY</span>
          <span className="h-5 w-px bg-border" />
          <span className="text-sm text-muted-foreground">components/ui · podgląd A1 · dev</span>
        </div>
        <div className="grid grid-cols-12 gap-4">
          <Chips />
          <Statuses />
          <Buttons />
          <Controls />
          <Fields />
          <Navigation />
          <DropdownTooltip />
          <DialogToast />
          <States />
          <Cells />
          <Density />
          <Live />
        </div>
      </div>
      <Toaster />
    </ToastProvider>
  );
}

function Chips() {
  return (
    <Section title="Chipy — 12 odcieni, pastel + ciemny tekst">
      <div className="flex flex-wrap gap-2">{HUES.map(([h, l]) => <Chip key={h} hue={h}>{l}</Chip>)}</div>
      <Sub className="mt-4 mb-2">Chip usuwalny + chip dodawania</Sub>
      <div className="flex items-center gap-2">
        <TagChip label="frontend" hue="indigo" size="lg" onRemove={() => {}} />
        <TagChip label="bug" hue="red" size="lg" onRemove={() => {}} />
        <span className="inline-flex h-[22px] items-center gap-1 rounded-sm border border-dashed border-n-400 px-2 text-xs font-medium text-muted-foreground"><IconPlus width={12} height={12} />Tag</span>
        <FilterChip label="Status: W toku" onRemove={() => {}} />
      </div>
      <Sub className="mt-4 mb-2">Badge</Sub>
      <div className="flex items-center gap-2.5"><Badge tone="red">5</Badge><Badge tone="gray">12</Badge><Badge tone="orange">NOWE</Badge></div>
    </Section>
  );
}

function Statuses() {
  return (
    <Section title="Statusy i priorytety">
      <div className="mb-4 flex flex-col items-start gap-2">{STATUSES.map(([l, h]) => <StatusChip key={l} label={l} hue={h} size="lg" />)}</div>
      <div className="flex flex-col gap-2">
        {([0, 1, 2, 3] as PriorityLevel[]).map((p) => (
          <div key={p} className="flex items-center gap-2"><PriorityIcon level={p} /><span className="text-sm">P{p} {PRIORITY_LABEL[p]}</span></div>
        ))}
      </div>
      <Sub className="mt-4 mb-2">Rozmiary chipów sm 18 · md 20 · lg 24</Sub>
      <div className="flex items-center gap-2"><StatusChip label="W toku" hue="blue" size="sm" /><StatusChip label="W toku" hue="blue" size="md" /><StatusChip label="W toku" hue="blue" size="lg" /></div>
    </Section>
  );
}

function Buttons() {
  const cols = ["default", "hover", "active", "z ikoną", "loading", "disabled"];
  return (
    <Section title="Przyciski" span={8}>
      <div className="grid grid-cols-[72px_repeat(6,1fr)] items-center gap-2.5">
        <div />
        {cols.map((c) => <Mono key={c} className="uppercase">{c}</Mono>)}
        <Sub className="mb-0">Primary</Sub>
        <div><Button>Utwórz</Button></div><div><Button className="bg-orange-600">Utwórz</Button></div><div><Button className="bg-orange-700">Utwórz</Button></div>
        <div><Button><IconPlus strokeWidth={1.8} />Utwórz</Button></div><div><Button loading>Zapisywanie</Button></div><div><Button disabled>Utwórz</Button></div>
        <Sub className="mb-0">Secondary</Sub>
        <div><Button variant="secondary">Udostępnij</Button></div><div><Button variant="secondary" className="bg-n-100">Udostępnij</Button></div><div><Button variant="secondary" className="border-n-300 bg-n-200">Udostępnij</Button></div>
        <div><Button variant="secondary"><IconShare />Udostępnij</Button></div><div><Button variant="secondary" loading className="text-muted-foreground">Wczytuję</Button></div><div><Button variant="secondary" disabled>Udostępnij</Button></div>
        <Sub className="mb-0">Ghost</Sub>
        <div><Button variant="ghost">Filtry</Button></div><div><Button variant="ghost" className="bg-n-100 text-foreground">Filtry</Button></div><div><Button variant="ghost" className="bg-n-200 text-foreground">Filtry</Button></div>
        <div><Button variant="ghost"><IconFilter />Filtry</Button></div><div><Button variant="ghost" loading className="text-muted-foreground">Filtry</Button></div><div><Button variant="ghost" disabled>Filtry</Button></div>
        <Sub className="mb-0">Danger</Sub>
        <div><Button variant="danger">Usuń</Button></div><div><Button variant="danger" className="bg-danger-text">Usuń</Button></div><div><Button variant="danger" className="bg-danger-text">Usuń</Button></div>
        <div><Button variant="danger"><IconTrash />Usuń</Button></div><div><Button variant="danger" loading>Usuwanie</Button></div><div><Button variant="danger" disabled>Usuń</Button></div>
        <Sub className="mb-0">Link</Sub>
        <div><Button variant="link">Pokaż więcej</Button></div><div><Button variant="link" className="text-orange-800 underline">Pokaż więcej</Button></div><div><Button variant="link" className="text-orange-900 underline">Pokaż więcej</Button></div>
        <div><Button variant="link" className="gap-1">Pokaż więcej<IconChevronDown className="-rotate-90" width={12} height={12} /></Button></div><div><span className="text-sm font-medium text-muted-foreground">Wczytuję…</span></div><div><Button variant="link" disabled>Pokaż więcej</Button></div>
      </div>
      <div className="mt-4 flex items-end gap-4 border-t border-n-100 pt-4">
        <div className="flex flex-col items-start gap-1"><Button size="sm">Zapisz</Button><Mono>sm 28</Mono></div>
        <div className="flex flex-col items-start gap-1"><Button size="md">Zapisz</Button><Mono>md 32</Mono></div>
        <div className="flex flex-col items-start gap-1"><Button size="lg">Zapisz</Button><Mono>lg 36</Mono></div>
        <div className="flex flex-col items-start gap-1"><Button variant="secondary" iconOnly aria-label="Więcej"><IconMore /></Button><Mono>ikonowy 32</Mono></div>
        <div className="flex flex-col items-start gap-1"><Button variant="ghost" iconOnly aria-label="Więcej"><IconMore /></Button><Mono>ghost ikonowy</Mono></div>
        <div className="flex flex-col items-start gap-1"><Button variant="ghost" iconOnly size="sm" aria-label="Edytuj"><IconEdit /></Button><Mono>ikonowy 28</Mono></div>
        <div className="ml-auto max-w-[300px] text-2xs text-fg-3">Primary maks. 1× na widok. Reszta akcji: secondary / ghost.</div>
      </div>
    </Section>
  );
}

function Controls() {
  const [sw, setSw] = useState(true);
  return (
    <Section title="Checkbox · Radio · Switch">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm"><Checkbox checked={false} ariaLabel="Pusty" />Pusty</label>
          <label className="inline-flex items-center gap-2 text-sm"><Checkbox checked ariaLabel="Zaznaczony" />Zaznaczony</label>
          <label className="inline-flex items-center gap-2 text-sm"><Checkbox checked={false} indeterminate ariaLabel="Częściowy" />Częściowy</label>
        </div>
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-n-400"><Checkbox checked={false} disabled ariaLabel="Disabled" />Disabled</label>
          <label className="inline-flex items-center gap-2 text-sm"><Checkbox checked={false} ariaLabel="Focus" className="shadow-[var(--focus)]" />Focus</label>
          <label className="inline-flex items-center gap-2 text-sm"><Checkbox checked size="sm" ariaLabel="sm" />sm 14</label>
        </div>
        <div className="flex items-center gap-4 border-t border-n-100 pt-2">
          <RadioGroup defaultValue="b" className="flex-row gap-4"><Radio value="a" label="Radio" /><Radio value="b" label="Wybrany" /><Radio value="c" label="Duży" size="lg" /></RadioGroup>
        </div>
        <div className="flex items-center gap-4 border-t border-n-100 pt-2">
          <label className="inline-flex items-center gap-2 text-sm"><Switch checked={false} onCheckedChange={() => {}} />Wył.</label>
          <label className="inline-flex items-center gap-2 text-sm"><Switch checked={sw} onCheckedChange={setSw} />Wł.</label>
          <label className="inline-flex items-center gap-2 text-sm"><Switch size="sm" defaultChecked />sm</label>
          <label className="inline-flex items-center gap-2 text-sm"><Switch disabled defaultChecked />disabled</label>
        </div>
        <div className="text-2xs text-fg-3">Zaznaczenia w atramencie — pomarańcz zarezerwowany dla nawigacji i CTA.</div>
      </div>
      <div className="eyebrow mt-4 mb-2.5">Awatary</div>
      <div className="flex items-center gap-3.5">
        <Avatar name="Daniel" size={20} hue="blue" /><Avatar name="Kuba" size={24} hue="green" /><Avatar name="Gabryś" size={28} hue="purple" /><Avatar name="Marta" size={32} hue="pink" /><Avatar name="Ania" size={44} />
        <AvatarStack people={PEOPLE} max={4} className="ml-1.5" />
      </div>
      <div className="mt-2 text-2xs text-fg-3">20 / 24 / 28 px · inicjały 600 · stos z nakładką −7px</div>
    </Section>
  );
}

function Fields() {
  const [sel, setSel] = useState<string | null>("2");
  const [combo, setCombo] = useState<string | string[] | null>(["k"]);
  const [ppl, setPpl] = useState(["d", "m"]);
  return (
    <Section title="Pola formularza" span={8}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
        <div><Sub>Default</Sub><Input placeholder="Nazwa zadania…" /></div>
        <div><Sub>Focus</Sub><Input defaultValue="Moduł kompresji zdjęć" className="border-orange-500 shadow-[var(--focus)]" /></div>
        <div><Sub>Error</Sub><Input defaultValue="daniel@nazwa" error="Podaj poprawny adres e-mail." /></div>
        <div><Sub>Disabled</Sub><Input disabled placeholder="Pole zablokowane" /></div>
        <div><Sub>Select</Sub><Select value={sel} onValueChange={setSel} items={([0, 1, 2, 3] as PriorityLevel[]).map((p) => ({ value: String(p), label: `P${p} ${PRIORITY_LABEL[p]}`, icon: <PriorityIcon level={p} size={13} /> }))} /></div>
        <div className="row-span-2">
          <Sub>Combobox — otwarty</Sub>
          <div className="flex items-center justify-between rounded-sm border border-orange-500 bg-card px-2.5 text-sm shadow-[var(--focus)]" style={{ height: 32 }}><span>ku<span className="ml-px inline-block h-3.5 w-px bg-foreground align-[-2px]" /></span><IconChevronDown width={12} height={12} className="text-muted-foreground" /></div>
          <div className={`${POPUP_CLASS} mt-1.5 w-[240px] p-1`}>
            <div className={`${POPUP_ITEM_CLASS} bg-n-100`}><Avatar name="Kuba" size={20} hue="green" /><span><b className="font-semibold">Ku</b>ba</span><IconCheckCircle className="ml-auto text-success" width={14} height={14} /></div>
            <div className={`${POPUP_ITEM_CLASS} text-muted-foreground`}><Avatar name="Daniel" size={20} hue="blue" />Daniel</div>
            <div className={`${POPUP_ITEM_CLASS} text-muted-foreground`}><Avatar name="Gabryś" size={20} hue="purple" />Gabryś</div>
          </div>
        </div>
        <div><Sub>Textarea</Sub><Textarea defaultValue={"Po kliknięciu „Załóż konto” formularz wysyłki zwraca błąd 500. Do sprawdzenia walidacja NIP."} autoGrow /></div>
        <div><Sub>InputGroup — szukaj + kbd</Sub><InputGroup leading={<IconSearch />} kbd="⌘K" placeholder="Szukaj zadań, tablic, osób…" /></div>
        <div><Sub>Combobox multi (live)</Sub><Combobox multi options={PEOPLE.map((p) => ({ value: p.id, label: p.name, hue: p.hue }))} value={combo} onValueChange={setCombo} placeholder="Dodaj osobę…" /></div>
        <div><Sub>PersonPicker (live) · Termin</Sub><div className="flex items-center gap-3"><PersonPicker people={PEOPLE} value={ppl} onValueChange={setPpl} /><div className="w-44"><DateTimePicker name="due" defaultValue={null} placeholder="Wybierz datę" dateOnly /></div></div></div>
        <div><Sub>Input sm 28 · lg 44</Sub><div className="flex items-center gap-2"><Input size="sm" placeholder="sm" /><Input size="lg" placeholder="lg (mobile)" /></div></div>
      </div>
    </Section>
  );
}

function Navigation() {
  const [seg, setSeg] = useState("w");
  return (
    <Section title="Nawigacja">
      <Sub>Tabsy podkreślane — 40px</Sub>
      <Tabs defaultValue="lista" className="mb-4">
        <TabsList>
          <Tab value="lista" icon={<IconList />}>Lista</Tab>
          <Tab value="tablica" icon={<IconBoards />}>Tablica</Tab>
          <Tab value="os" icon={<IconTimeline />}>Oś czasu</Tab>
          <Tab value="wiecej">Więcej 2<IconChevronDown width={12} height={12} /></Tab>
        </TabsList>
      </Tabs>
      <Sub>Segmented control</Sub>
      <Segmented className="mb-4" value={seg} onChange={setSeg} options={[{ value: "d", label: "Dzisiaj" }, { value: "w", label: "Tygodnie" }, { value: "m", label: "Miesiące" }, { value: "q", label: "Kwartały" }]} />
      <Sub>Breadcrumb</Sub>
      <Breadcrumb className="mb-4" items={[{ label: "Projekty AI", href: "#" }, { label: "P&R Kickback", href: "#" }, { label: <span className="font-mono text-xs">#250</span> }]} />
      <Sub>Kbd — skróty</Sub>
      <div className="flex items-center gap-1.5">{["⌘K", "C", "/", "J", "K", "Enter", "Esc"].map((k) => <Kbd key={k}>{k}</Kbd>)}</div>
      <Sub className="mt-4">Tab z licznikiem · segmented md/lg</Sub>
      <div className="flex flex-wrap items-center gap-3">
        <Tabs defaultValue="a"><TabsList className="border-b-0"><Tab value="a" count={12}>Nieprzeczytane</Tab><Tab value="b">Wzmianki</Tab></TabsList></Tabs>
        <Segmented size="md" value="a" onChange={() => {}} options={[{ value: "a", label: "Paski" }, { value: "b", label: "Markery" }]} />
        <Segmented size="lg" value="a" onChange={() => {}} options={[{ value: "a", label: "Mój czas" }, { value: "b", label: "Zespół" }]} />
      </div>
    </Section>
  );
}

function DropdownTooltip() {
  const [cols, setCols] = useState({ status: true, prio: true, att: false });
  return (
    <Section title="Dropdown · Tooltip">
      <div className="h-[230px]">
        <Menu open modal={false}>
          <MenuTrigger render={<Button variant="secondary" size="sm" />}>Menu (otwarte)<IconChevronDown width={11} height={11} /></MenuTrigger>
          <MenuContent className="w-[216px]">
            <MenuItem icon={<IconEdit />}>Zmień nazwę</MenuItem>
            <MenuItem icon={<IconCopy />} shortcut="⌘D" className="bg-n-100">Duplikuj</MenuItem>
            <MenuItem icon={<IconStar />}>Przypnij</MenuItem>
            <MenuSub>
              <MenuSubTrigger icon={<IconColumns />}>Typ pola</MenuSubTrigger>
              <MenuSubContent><MenuItem>Tekst</MenuItem><MenuItem>Liczba</MenuItem></MenuSubContent>
            </MenuSub>
            <MenuSeparator />
            <MenuItem icon={<IconTrash />} destructive>Usuń</MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <div className="flex items-center gap-2.5">
        <Tooltip open content={<>Udostępnij<kbd>S</kbd></>}><Button variant="secondary" size="sm"><IconShare />Udostępnij</Button></Tooltip>
        <Mono className="ml-10">tooltip · 11px · n-900</Mono>
      </div>
      <Sub className="mt-8">Popover — kolumny</Sub>
      <div className="popover-surface w-[216px] p-2.5 shadow-e2">
        {([["status", "Status"], ["prio", "Priorytet"], ["att", "Załączniki"]] as const).map(([k, l]) => (
          <label key={k} className={`flex h-7 items-center gap-2 text-sm ${cols[k] ? "" : "text-muted-foreground"}`}><Checkbox checked={cols[k]} onCheckedChange={(v) => setCols({ ...cols, [k]: v })} ariaLabel={l} />{l}</label>
        ))}
      </div>
      <Sub className="mt-4">Menu z checkbox/radio (live)</Sub>
      <Menu>
        <MenuTrigger render={<Button variant="secondary" size="sm" />}>Gęstość<IconChevronDown width={11} height={11} /></MenuTrigger>
        <MenuContent>
          <MenuLabel>Gęstość wiersza</MenuLabel>
          <MenuRadioGroup defaultValue="36"><MenuRadioItem value="28">Kompaktowa · 28</MenuRadioItem><MenuRadioItem value="36">Wygodna · 36</MenuRadioItem><MenuRadioItem value="44">Przestronna · 44</MenuRadioItem></MenuRadioGroup>
          <MenuSeparator />
          <MenuCheckboxItem defaultChecked>Pokaż zakończone</MenuCheckboxItem>
        </MenuContent>
      </Menu>
      <Popover>
        <PopoverTrigger render={<Button variant="ghost" size="sm" className="ml-2" />}>Popover (live)</PopoverTrigger>
        <PopoverContent className="w-[216px]"><div className="text-sm font-semibold">Popover</div><div className="text-xs text-muted-foreground">Treść popovera 8px radius, cień e2.</div></PopoverContent>
      </Popover>
    </Section>
  );
}

function DialogToast() {
  return (
    <Section title="Dialog · Toast">
      <div className="dialog-surface w-[300px] overflow-hidden">
        <DialogHeader><div className="text-md font-semibold">{"Usunąć tablicę „Sklep Legia”?"}</div></DialogHeader>
        <DialogBody className="text-sm text-muted-foreground">Usuniesz 34 zadania i 2 widoki. Tej operacji nie można cofnąć.</DialogBody>
        <DialogFooter><Button variant="secondary">Anuluj</Button><Button variant="danger">Usuń</Button></DialogFooter>
      </div>
      <Mono className="mt-1.5 mb-4">dialog · promień 12 · cień e2 · header 52 / footer 14</Mono>
      <ToastCard title="Zapisano zmiany" description={<>Zadanie <span className="font-mono text-2xs">#250</span> zaktualizowane · <a href="#">Cofnij</a></>} onClose={() => {}} />
      <Mono className="mt-1.5">toast · prawy-dolny róg · auto 5s</Mono>
    </Section>
  );
}

function States() {
  return (
    <Section title="Stany">
      <EmptyState className="mb-3" icon={<IconSearch />} title="Brak wyników" description="Żadne zadanie nie pasuje do filtrów." action={<Button variant="secondary" size="sm">Wyczyść filtry</Button>} />
      <div className="surface mb-3 flex items-start gap-2.5 p-3.5">
        <IconWarning className="mt-px shrink-0 text-danger" />
        <div className="flex-1"><div className="text-sm font-semibold">Nie udało się wczytać listy</div><div className="mb-2 text-xs text-muted-foreground">Sprawdź połączenie i spróbuj ponownie.</div><Button variant="secondary" size="sm">Spróbuj ponownie</Button></div>
      </div>
      <div className="rounded-lg border border-n-100 p-3">
        {[48, 72, 56].map((w, i) => (
          <div key={i} className={`flex items-center gap-2.5 ${i < 2 ? "mb-2.5" : ""}`}><Skeleton className="size-6 rounded-full" /><Skeleton className="h-2.5 flex-1 rounded-[5px]" /><Skeleton className="h-2.5 rounded-[5px]" style={{ width: w }} /></div>
        ))}
      </div>
      <Mono className="mt-1.5">skeleton · puls 1.4s · bez shimmerów</Mono>
    </Section>
  );
}

function Cells() {
  const rows: [string, string, string][] = [["default", "", ""], ["hover", "bg-row-hover", ""], ["selected", "", ""], ["editing", "", ""], ["focus", "", ""]];
  return (
    <Section title="Komórka tabeli — stany" span={6}>
      <div className="flex flex-col gap-2">
        {rows.map(([state, cls]) => (
          <div key={state} className="flex items-center gap-3">
            <div className={`flex h-9 flex-1 items-center gap-2.5 border border-border bg-card px-2.5 text-sm ${cls} ${state === "selected" ? "bg-selected shadow-[inset_2px_0_0_var(--orange-500)]" : ""} ${state === "editing" ? "border-2 border-orange-500 shadow-e1" : ""} ${state === "focus" ? "shadow-[inset_0_0_0_2px_var(--orange-500)]" : ""}`}>
              {state !== "editing" && <Checkbox size="sm" checked={state === "selected"} ariaLabel={state} />}
              {state === "editing" ? <>Moduł kompresji zdjęć i wideo<span className="h-4 w-px bg-foreground" /></> : "Moduł kompresji zdjęć"}
            </div>
            <Mono className="w-16">{state}</Mono>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Density() {
  const D: [string, string][] = [["compact", "compact 28"], ["comfortable", "comfortable 36 — domyślna"], ["spacious", "spacious 44 — mobile touch"]];
  return (
    <Section title="Gęstość wiersza — 28 · 36 · 44" span={12}>
      <div className="grid grid-cols-3 gap-4">
        {D.map(([d, label]) => (
          <div key={d} data-density={d}>
            <Mono className="mb-1.5">{label}</Mono>
            <DataTable footer={<DataFooter>2 zadania</DataFooter>}>
              <DataThead><tr><DataTh icon={<IconList />}>Tytuł</DataTh><DataTh align="right" width={96}>Status</DataTh></tr></DataThead>
              <tbody>
                <DataTr><DataTd><span className="flex items-center gap-2"><Checkbox size={d === "spacious" ? "md" : "sm"} checked={false} ariaLabel="Zaznacz" /><span className="truncate">Zmienić słowo Klub na Club</span></span></DataTd><DataTd align="right"><StatusChip label="Gotowe" hue="green" size={d === "spacious" ? "lg" : d === "compact" ? "sm" : "md"} /></DataTd></DataTr>
                <DataTr selected={d === "comfortable"}><DataTd><span className="flex items-center gap-2"><Checkbox size={d === "spacious" ? "md" : "sm"} checked={d === "comfortable"} ariaLabel="Zaznacz" /><span className="truncate">Moduł kompresji zdjęć</span></span></DataTd><DataTd align="right"><StatusChip label="W toku" hue="blue" size={d === "spacious" ? "lg" : d === "compact" ? "sm" : "md"} /></DataTd></DataTr>
              </tbody>
            </DataTable>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Live() {
  const toast = useToast();
  return (
    <Section title="Live — dialog · sheet · toast" span={12}>
      <div className="flex items-center gap-2">
        <Dialog>
          <DialogTrigger render={<Button variant="secondary" />}>Otwórz dialog</DialogTrigger>
          <DialogContent size="sm">
            <DialogHeader><DialogTitle>Nowe zadanie</DialogTitle><DialogDescription>Dialog 440 · header 52 · footer 14/20</DialogDescription></DialogHeader>
            <DialogBody className="flex flex-col gap-3"><div><Sub>Tytuł</Sub><Input placeholder="Nazwa zadania…" /></div><div><Sub>Opis</Sub><Textarea placeholder="Opis…" /></div></DialogBody>
            <DialogFooter><Button variant="secondary">Anuluj</Button><Button>Utwórz zadanie</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <Sheet>
          <SheetTrigger render={<Button variant="secondary" />}>Otwórz panel 600</SheetTrigger>
          <SheetContent><SheetHeader><SheetTitle>Panel zadania</SheetTitle></SheetHeader><div className="p-4 text-sm text-muted-foreground">Prawy panel 600px, cień e2.</div></SheetContent>
        </Sheet>
        <Sheet>
          <SheetTrigger render={<Button variant="secondary" />}>Bottom sheet</SheetTrigger>
          <SheetContent side="bottom" showCloseButton={false}><div className="sheet-drag-handle" /><SheetHeader className="border-b-0"><SheetTitle>Arkusz mobilny</SheetTitle></SheetHeader><div className="px-4 pb-6 text-sm text-muted-foreground">sheet-mobile-surface + uchwyt.</div></SheetContent>
        </Sheet>
        <Button variant="secondary" onClick={() => toast.add({ title: "Zapisano zmiany", description: "Zadanie #250 zaktualizowane" })}>Pokaż toast</Button>
        <span className="ml-auto text-2xs text-fg-3">Hue awatara z hasha: {PEOPLE.slice(4).map((p) => `${p.name}→${CHIP_HUE[p.hue ?? "gray"].split(" ")[0]}`).join(" · ")}</span>
        <CheckMark className="text-success" />
      </div>
    </Section>
  );
}
