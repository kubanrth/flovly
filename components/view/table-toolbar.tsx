"use client";

// F1 bridge: header BoardToolbar ↔ BoardTable state via window events
// (`flovly:board-search`, `flovly:board-add-filter`). BoardTable listens.
// ponytail: F2 lifts filters/sort/group into shared state and deletes this file.

import { useState } from "react";
import { BoardToolbar, type ToolbarPerson } from "@/components/view/board-toolbar";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { IconLink } from "@/components/ui/icons";

const emit = (type: string, detail: Record<string, string>) =>
  window.dispatchEvent(new CustomEvent(type, { detail }));

export function TableToolbar({ people }: { people: ToolbarPerson[] }) {
  const [search, setSearch] = useState("");
  return (
    <BoardToolbar
      search={search}
      onSearch={(q) => {
        setSearch(q);
        emit("flovly:board-search", { query: q });
      }}
      people={people}
      filterButtons={[
        { label: "Status", onClick: () => emit("flovly:board-add-filter", { columnId: "statusColumnId" }) },
        // TableFilter has no priority/tag kinds yet → F2.
        { label: "Priorytet", disabled: true },
        { label: "Tag", disabled: true },
      ]}
      onAddFilter={() => emit("flovly:board-add-filter", { columnId: "title" })}
      more={
        <MenuItem icon={<IconLink />} onClick={() => void navigator.clipboard.writeText(window.location.href)}>
          Kopiuj link do widoku
        </MenuItem>
      }
    />
  );
}
