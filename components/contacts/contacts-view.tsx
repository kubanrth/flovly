"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { DataTable, DataTd, DataTh, DataThead, DataTr } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { InputGroup } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/dropdown-menu";
import {
  IconChevronDown,
  IconContacts,
  IconMore,
  IconPen,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUndo,
  IconUpload,
} from "@/components/ui/icons";
import { plPlural } from "@/lib/pluralize";
import {
  deleteContactAction,
  restoreContactAction,
} from "@/app/(app)/w/[workspaceId]/contacts/actions";
import {
  contactKind,
  contactName,
  contactsCountLabel,
  contactSubtitle,
  EMPTY_FILTER,
  filterContacts,
  formatLastContact,
  KIND_HUE,
  KIND_LABEL,
  KIND_ORDER,
  type ContactFilter,
  type ContactKind,
  type ContactRow,
} from "./contact-model";
import { ContactCardPanel, type ContactBoardRef, type ContactHistoryEntry } from "./contact-card-panel";
import { ContactsMobileList } from "./contacts-mobile-list";
import { ImportContactsDialog } from "./import-contacts-dialog";
import { InitialsTile } from "./initials-tile";

const contactPl = (n: number) => plPlural(n, "kontakt", "kontakty", "kontaktów");

export interface ContactsViewProps {
  workspaceId: string;
  rows: ContactRow[];
  members: { id: string; name: string | null; email: string; avatarUrl: string | null }[];
  boardsByContact: Record<string, ContactBoardRef[]>;
  historyByContact: Record<string, ContactHistoryEntry[]>;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Trash mode: `rows` are soft-deleted contacts and the only action is „Przywróć”. */
  trash: boolean;
  trashCount: number;
}

export function ContactsView({
  workspaceId,
  rows,
  members,
  boardsByContact,
  historyByContact,
  canCreate,
  canEdit,
  canDelete,
  trash,
  trashCount,
}: ContactsViewProps) {
  const [filter, setFilter] = useState<ContactFilter>(EMPTY_FILTER);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const shown = filterContacts(rows, filter);
  const selected = shown.find((r) => r.id === selectedId) ?? null;
  const ownerLabel =
    filter.ownerId === "all"
      ? null
      : filter.ownerId === "none"
        ? "bez opiekuna"
        : (members.find((m) => m.id === filter.ownerId)?.name ?? "—");

  const people = selected
    ? rows.filter(
        (r) =>
          r.id !== selected.id &&
          contactKind(r) === "person" &&
          !!r.companyName &&
          r.companyName === (selected.companyName ?? contactName(selected)),
      )
    : [];

  const remove = (row: ContactRow) => {
    if (!confirm(`Usunąć ${contactName(row)}? Kontakt trafi do kosza.`)) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("contactId", row.id);
    if (selectedId === row.id) setSelectedId(null);
    startTransition(() => void deleteContactAction(fd));
  };

  const restore = (row: ContactRow) => {
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("contactId", row.id);
    startTransition(() => void restoreContactAction(fd));
  };

  return (
    <div data-ui="contacts" className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2.5 px-8 pt-4 max-md:px-4">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Kontakty</h1>
        <span className="mt-1.5 text-xs text-muted-foreground">{contactsCountLabel(rows.length)}</span>
        {trash && <Chip hue="orange" size="lg">Kosz</Chip>}
        <span className="flex-1" />
        {trash ? (
          <Button variant="secondary" render={<Link href={`/w/${workspaceId}/contacts`} />}>
            Wróć do listy
          </Button>
        ) : (
          <>
            {canCreate && (
              <Button variant="secondary" onClick={() => setImporting(true)}>
                <IconUpload width={13} height={13} />
                Import CSV
              </Button>
            )}
            {canCreate && (
              <Button render={<Link href={`/w/${workspaceId}/contacts/new`} />}>
                <IconPlus />
                Nowy kontakt
              </Button>
            )}
          </>
        )}
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-8 pt-3 pb-2.5 max-md:px-4">
        <InputGroup
          size="sm"
          type="search"
          aria-label="Szukaj kontaktu"
          placeholder="Szukaj kontaktu…"
          value={filter.q}
          onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
          leading={<IconSearch />}
          className="w-[220px] text-xs max-md:w-full"
        />

        <FilterMenu
          label="Typ"
          value={filter.kind === "all" ? null : KIND_LABEL[filter.kind]}
          options={[
            { id: "all", label: "Wszystkie" },
            ...KIND_ORDER.map((k) => ({ id: k, label: KIND_LABEL[k] })),
          ]}
          onSelect={(id) => setFilter((f) => ({ ...f, kind: id as ContactKind | "all" }))}
        />

        <FilterMenu
          label="Opiekun"
          value={ownerLabel}
          options={[
            { id: "all", label: "Wszyscy" },
            { id: "none", label: "Bez opiekuna" },
            ...members.map((m) => ({ id: m.id, label: m.name ?? m.email })),
          ]}
          onSelect={(id) => setFilter((f) => ({ ...f, ownerId: id }))}
        />

        <span className="flex-1" />
        <span className="font-mono text-2xs text-fg-3 max-md:hidden">sort: ostatni kontakt ↓</span>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-y-auto md:hidden">
          <ContactsMobileList workspaceId={workspaceId} rows={shown} />
        </div>

        <DataTable
          className="table-fixed"
          wrapperClassName="flex min-h-0 flex-1 flex-col rounded-none border-0 max-md:hidden [&>div]:min-h-0 [&>div]:flex-1"
          style={{ "--row-h": "44px" } as React.CSSProperties}
        >
          <DataThead>
            <tr>
              <DataTh width={312}>Nazwa</DataTh>
              <DataTh width={120}>Typ</DataTh>
              <DataTh width={220}>E-mail</DataTh>
              <DataTh width={140}>Telefon</DataTh>
              <DataTh width={120}>Opiekun</DataTh>
              <DataTh>Ostatni kontakt</DataTh>
            </tr>
          </DataThead>
          <tbody>
            {shown.map((row) => {
              const kind = contactKind(row);
              const name = contactName(row);
              const subtitle = contactSubtitle(row);
              return (
                <DataTr
                  key={row.id}
                  className="group cursor-pointer"
                  selected={row.id === selectedId}
                  onClick={() => setSelectedId((id) => (id === row.id ? null : row.id))}
                >
                  <DataTd>
                    <span className="flex items-center gap-2.5">
                      <InitialsTile label={name} kind={kind} />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId((id) => (id === row.id ? null : row.id));
                        }}
                        className="flex min-h-6 min-w-0 flex-col justify-center rounded-[2px] text-left outline-none"
                      >
                        <span className="block truncate text-sm font-medium">{name}</span>
                        {subtitle && <span className="block truncate text-2xs text-fg-3">{subtitle}</span>}
                      </button>
                    </span>
                  </DataTd>
                  <DataTd>
                    <Chip hue={KIND_HUE[kind]} size="sm">{KIND_LABEL[kind]}</Chip>
                  </DataTd>
                  <DataTd className="truncate text-xs text-n-700">{row.email ?? "—"}</DataTd>
                  <DataTd className="font-mono text-xs whitespace-nowrap text-n-700">{row.phone ?? "—"}</DataTd>
                  <DataTd>
                    {row.owner ? (
                      <span className="flex items-center gap-1.5">
                        <Avatar name={row.owner.name ?? row.owner.email} src={row.owner.avatarUrl} size={20} />
                        <span className="truncate text-xs">{row.owner.name ?? row.owner.email.split("@")[0] ?? row.owner.email}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-fg-3">—</span>
                    )}
                  </DataTd>
                  <DataTd>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="truncate">
                        {formatLastContact(row.lastContactAt)}
                        {row.lastContactNote ? ` · ${row.lastContactNote}` : ""}
                      </span>
                      <span className="ml-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                        <RowMenu
                          workspaceId={workspaceId}
                          row={row}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          trash={trash}
                          onDelete={() => remove(row)}
                          onRestore={() => restore(row)}
                        />
                      </span>
                    </span>
                  </DataTd>
                </DataTr>
              );
            })}
          </tbody>
        </DataTable>

        {shown.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-12 px-8 max-md:hidden">
            <EmptyState
              icon={<IconContacts />}
              title={trash ? "Kosz jest pusty" : "Brak kontaktów"}
              description={
                rows.length === 0
                  ? "Dodaj pierwszy kontakt, żeby zacząć budować bazę firm i osób."
                  : "Żaden kontakt nie pasuje do filtrów."
              }
            />
          </div>
        )}

        {selected && (
          <ContactCardPanel
            workspaceId={workspaceId}
            contact={selected}
            boards={boardsByContact[selected.id] ?? []}
            people={people}
            history={historyByContact[selected.id] ?? []}
            canEdit={canEdit}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      <footer className="flex h-8 shrink-0 items-center gap-3 border-t border-border bg-canvas px-8 font-mono text-2xs text-muted-foreground max-md:px-4">
        <span className="truncate">
          {rows.length} {contactPl(rows.length)} · {shown.length} pokazanych
          {selected ? ` · karta: ${contactName(selected)}` : ""}
        </span>
        {!trash && canDelete && (
          <Link
            href={`/w/${workspaceId}/contacts?kosz=1`}
            className="ml-auto shrink-0 rounded-[2px] text-fg-3 no-underline outline-none hover:text-orange-800 hover:underline active:text-orange-900"
          >
            kosz: {trashCount}
          </Link>
        )}
      </footer>

      {importing && (
        <ImportContactsDialog workspaceId={workspaceId} onClose={() => setImporting(false)} />
      )}
    </div>
  );
}

function FilterMenu({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string | null;
  options: { id: string; label: string }[];
  onSelect: (id: string) => void;
}) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button variant="secondary" size="sm" className={value ? "border-orange-300 bg-orange-50" : undefined} />
        }
      >
        {value ? `${label}: ${value}` : label}
        <IconChevronDown width={11} height={11} />
      </MenuTrigger>
      <MenuContent>
        {options.map((o) => (
          <MenuItem key={o.id} onClick={() => onSelect(o.id)}>
            {o.label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

function RowMenu({
  workspaceId,
  row,
  canEdit,
  canDelete,
  trash,
  onDelete,
  onRestore,
}: {
  workspaceId: string;
  row: ContactRow;
  canEdit: boolean;
  canDelete: boolean;
  trash: boolean;
  onDelete: () => void;
  onRestore: () => void;
}) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="secondary"
            size="sm"
            iconOnly
            aria-label={`Akcje: ${contactName(row)}`}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
          />
        }
      >
        <IconMore width={13} height={13} />
      </MenuTrigger>
      <MenuContent align="end">
        {trash ? (
          <MenuItem icon={<IconUndo />} onClick={onRestore}>
            Przywróć
          </MenuItem>
        ) : (
          <>
            <MenuItem icon={<IconPen />} render={<Link href={`/w/${workspaceId}/contacts/${row.id}`} />}>
              {canEdit ? "Edytuj kontakt" : "Otwórz kartę"}
            </MenuItem>
            {canDelete && (
              <>
                <MenuSeparator />
                <MenuItem icon={<IconTrash />} destructive onClick={onDelete}>
                  Usuń
                </MenuItem>
              </>
            )}
          </>
        )}
      </MenuContent>
    </Menu>
  );
}
