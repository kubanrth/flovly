"use client";

import { useUiPref } from "@/hooks/use-ui-pref";
import { toggleSaved, type SavedItem } from "./overview-model";

export const STARRED_PREF = "ui:starred";

// `useUiPref` only re-reads on the window `storage` event (other tabs), so a
// star clicked here would not reach the sidebar until a reload. Re-dispatching
// a StorageEvent for the same key syncs every subscriber in this tab too.
export function useStarred(): [SavedItem[], (item: SavedItem) => void] {
  const [starred, setStarred] = useUiPref<SavedItem[]>(STARRED_PREF, []);
  const toggle = (item: SavedItem) => {
    const next = toggleSaved(starred, item);
    setStarred(next);
    window.dispatchEvent(
      new StorageEvent("storage", { key: STARRED_PREF, newValue: JSON.stringify(next), storageArea: window.localStorage }),
    );
  };
  return [starred, toggle];
}
