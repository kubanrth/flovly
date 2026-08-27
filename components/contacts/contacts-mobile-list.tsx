"use client";

import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { IconChevronRight } from "@/components/ui/icons";
import {
  contactKind,
  contactName,
  contactSubtitle,
  KIND_HUE,
  KIND_LABEL,
  type ContactRow,
} from "./contact-model";
import { InitialsTile } from "./initials-tile";

/**
 * Kontakty on phones: one 56px row per contact, tap opens the full card page
 * (the 380px side panel is desktop-only). Search and filters live above, in
 * `ContactsView`.
 */
export function ContactsMobileList({
  workspaceId,
  rows,
}: {
  workspaceId: string;
  rows: ContactRow[];
}) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-xs text-muted-foreground">
        Brak kontaktów. Dodaj pierwszy, żeby zacząć.
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {rows.map((row) => {
        const kind = contactKind(row);
        const name = contactName(row);
        const subtitle = contactSubtitle(row);
        return (
          <li key={row.id} className="border-b border-table-grid last:border-b-0">
            <Link
              href={`/w/${workspaceId}/contacts/${row.id}`}
              className="flex min-h-14 items-center gap-2.5 px-4 no-underline outline-none active:bg-selected"
            >
              <InitialsTile label={name} kind={kind} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{name}</span>
                {subtitle && <span className="truncate text-2xs text-fg-3">{subtitle}</span>}
              </span>
              <Chip hue={KIND_HUE[kind]} size="sm">{KIND_LABEL[kind]}</Chip>
              <IconChevronRight width={14} height={14} className="shrink-0 text-n-400" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
