"use client";

import { startTransition, useState } from "react";
import { Link2, Plus } from "lucide-react";
import {
  SearchableDropdown,
  type SearchableDropdownOption,
} from "@/components/ui/searchable-dropdown";
import { patchTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";

// "Powiąż zadanie" w karcie kontaktu — picker workspace-task'ów które nie
// mają jeszcze contactId. Wybór → patchTaskAction z contactId=this. Po
// revalidate pojawia się w liście "Zadania powiązane" powyżej.
//
// Klient: ContactField wcześniej był w karcie zadania (każdy task pokazywał
// dropdown). User chciał ograniczyć linking tylko do kontekstu kontaktów
// i deali — więc picker żyje teraz TYLKO tutaj.
export function ContactTaskLinker({
  contactId,
  candidates,
}: {
  contactId: string;
  // Lista task'ów workspace'u które NIE mają jeszcze contactId — z page.tsx.
  candidates: { id: string; label: string; sublabel?: string | null }[];
}) {
  const [picked, setPicked] = useState<string | null>(null);

  const submit = (taskId: string) => {
    if (!taskId) return;
    const fd = new FormData();
    fd.set("id", taskId);
    fd.set("contactId", contactId);
    startTransition(() => {
      void patchTaskAction(fd);
    });
    setPicked(null);
  };

  if (candidates.length === 0) {
    return null;
  }

  const options: SearchableDropdownOption[] = candidates.map((c) => ({
    id: c.id,
    label: c.label,
    sublabel: c.sublabel ?? null,
    searchText: `${c.label} ${c.sublabel ?? ""}`,
    leading: (
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <Plus size={10} />
      </span>
    ),
  }));

  return (
    <div className="flex items-center gap-2">
      <Link2 size={12} className="shrink-0 text-fuchsia-600 dark:text-fuchsia-400" />
      <div className="min-w-0 flex-1">
        <SearchableDropdown
          name="link-task"
          value={picked}
          onChange={(v) => {
            if (v) submit(v);
          }}
          options={options}
          placeholder="+ Powiąż istniejące zadanie"
          searchPlaceholder="Szukaj po tytule albo #ID…"
          ariaLabel="Powiąż istniejące zadanie z kontaktem"
        />
      </div>
    </div>
  );
}
