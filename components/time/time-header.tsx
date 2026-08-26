"use client";

// E2 — wspólny nagłówek „Czas pracy": tytuł, slot na nawigację tygodnia lub
// zakres dat, segmented Mój czas / Zespół / Raport i przycisk Eksport.

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { IconDownload } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/segmented";

export type TimeTab = "my" | "team" | "report";

const TABS: { value: TimeTab; label: string }[] = [
  { value: "my", label: "Mój czas" },
  { value: "team", label: "Zespół" },
  { value: "report", label: "Raport" },
];

export function TimeHeader({
  workspaceId,
  tab,
  weekKey,
  csvHref,
  csvName,
  children,
}: {
  workspaceId: string;
  tab: TimeTab;
  /** `YYYY-MM-DD` poniedziałku — trzymany przy przełączaniu Mój czas / Zespół. */
  weekKey?: string;
  csvHref: string;
  csvName: string;
  children?: ReactNode;
}) {
  const router = useRouter();

  const go = (next: TimeTab) => {
    if (next === tab) return;
    if (next === "report") {
      router.push(`/w/${workspaceId}/time/reports`);
      return;
    }
    const q = new URLSearchParams({ view: next });
    if (weekKey) q.set("week", weekKey);
    router.push(`/w/${workspaceId}/time?${q.toString()}`);
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 px-8 pt-4 pb-2.5 max-md:px-4">
      <h1 className="mr-1 text-xl font-semibold tracking-[-0.3px]">Czas pracy</h1>
      {children}
      <span className="flex-1" />
      <Segmented options={TABS} value={tab} onChange={go} aria-label="Widok czasu pracy" />
      <a
        href={csvHref}
        download={csvName}
        className={buttonVariants({ variant: "secondary", size: "md" })}
      >
        <IconDownload />
        Eksport
      </a>
    </div>
  );
}
