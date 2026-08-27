"use client";

// „Dodaj pomysł" — picker 11 szablonów (ClickUp Design Brief Templates) plus
// nazwa. Po utworzeniu `createBriefAction` przekierowuje do edytora.

import { startTransition, useState, type ReactElement } from "react";
import { createBriefAction } from "@/app/(app)/w/[workspaceId]/briefs/actions";
import { BRIEF_TEMPLATES } from "@/lib/brief-templates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IconCheck, IconPlus } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function NewBriefForm({
  workspaceId,
  trigger,
}: {
  workspaceId: string;
  /** Własny element wyzwalający; domyślnie pomarańczowe „Dodaj pomysł". */
  trigger?: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(BRIEF_TEMPLATES[0]!.id);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);

  const submit = () => {
    if (!title.trim()) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("title", title.trim());
    fd.set("templateId", templateId);
    setPending(true);
    // Akcja kończy się redirectem do nowego briefu — dialog znika z nawigacją.
    startTransition(async () => {
      await createBriefAction(fd);
      setPending(false);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setTitle("");
          setTemplateId(BRIEF_TEMPLATES[0]!.id);
        }
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button>
              <IconPlus width={14} height={14} />
              Dodaj pomysł
            </Button>
          )
        }
      />
      <DialogContent size="xl" className="sm:max-w-[860px]">
        <DialogHeader>
          <DialogTitle>Wybierz szablon</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Każdy szablon to gotowy szkielet z sekcjami i tabelami — zaczynasz od struktury,
            nie od pustej kartki.
          </p>
        </DialogHeader>
        <DialogBody>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {BRIEF_TEMPLATES.map((t) => {
              const active = t.id === templateId;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTemplateId(t.id)}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-lg border p-3 text-left outline-none",
                    active
                      ? "border-orange-500 bg-selected shadow-[inset_0_0_0_1px_var(--orange-500)]"
                      : "border-border bg-card hover:bg-n-100 active:bg-n-200",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-n-100 text-base" aria-hidden>
                      {t.emoji}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.name}</span>
                    {active && <IconCheck width={13} height={13} className="shrink-0 text-orange-700" />}
                  </span>
                  <span className="text-xs leading-[18px] text-muted-foreground">{t.description}</span>
                </button>
              );
            })}
          </div>
        </DialogBody>
        <DialogFooter className="justify-between gap-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim()) {
                e.preventDefault();
                submit();
              }
            }}
            autoFocus
            maxLength={200}
            placeholder="Nazwa pomysłu, np. Kod rabatowy za zapis do newslettera"
            aria-label="Nazwa pomysłu"
            className="min-w-0 flex-1"
          />
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Anuluj
          </Button>
          <Button onClick={submit} disabled={!title.trim() || pending} loading={pending}>
            Utwórz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
