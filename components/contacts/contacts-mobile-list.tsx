"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ContactsTableRow } from "@/components/contacts/contacts-table";

/**
 * B6 CRM mobile · Kontakty list view
 *
 * Pojedyncza kolumna z 64px-wysokim row'em. Avatar 40×40 z brand gradient'em
 * (lub initials), name 15px / company-or-email 12px muted, chevron na końcu.
 * Tap = przejście do karty kontaktu (taki sam URL co desktop table).
 *
 * Search jest nad listą i renderuje się ze strony `contacts/page.tsx` (server
 * action form) — żeby uniknąć duplikacji wyszukiwarki.
 *
 * Świadomie BEZ swipe-action delete: na 4-row liście Polski user "swipe-to-
 * delete" myli z scrollem. Delete jest dostępny w karcie kontaktu — to też
 * jest pattern z spec'a (Apple Contacts / Linear nie mają swipe-delete na
 * liście, dopiero w edit mode).
 */
export function ContactsMobileList({
  workspaceId,
  rows,
}: {
  workspaceId: string;
  rows: ContactsTableRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-[0.88rem] text-muted-foreground md:hidden">
        Brak kontaktów. Dodaj pierwszy żeby zacząć.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1 overflow-hidden rounded-xl border border-border bg-card p-1 md:hidden">
      {rows.map((row) => {
        const person = [row.firstName, row.lastName].filter(Boolean).join(" ");
        const title = row.companyName || person || row.email || "—";
        const subtitle =
          row.companyName && person
            ? person
            : (row.email ?? row.phone ?? row.position ?? null);
        const initials = (row.companyName ?? person ?? row.email ?? "?")
          .replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ ]/g, "")
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((s) => s[0]?.toUpperCase() ?? "")
          .join("");
        return (
          <li key={row.id}>
            <Link
              href={`/w/${workspaceId}/contacts/${row.id}`}
              // Minimalna wysokość 64px (touch target spec). Padding 12px po
              // bokach żeby avatar + text + chevron mieściły się komfortowo.
              className="flex min-h-[64px] items-center gap-3 rounded-lg px-3 py-2 transition-colors active:bg-accent/40"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-gradient font-display text-[0.78rem] font-bold text-white"
                aria-hidden
              >
                {initials || "?"}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[0.94rem] font-semibold leading-tight">
                  {title}
                </span>
                {subtitle && (
                  <span className="truncate text-[0.78rem] text-muted-foreground">
                    {subtitle}
                  </span>
                )}
              </span>
              <ChevronRight
                size={16}
                className="shrink-0 text-muted-foreground/60"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
