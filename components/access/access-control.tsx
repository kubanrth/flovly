"use client";

// F14: „kto to widzi" — jeden przycisk i jeden dialog dla wszystkich modułów
// (Hasła, Kontakty, Whiteboardy, Subskrypcje, zadania, widoki tablic).
// Reguła widoczności: lib/resource-access.ts; zapis: setResourceAccessAction.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setResourceAccessAction } from "@/app/(app)/w/[workspaceId]/access-actions";
import { ACCESS_MODE, accessLabel, type ResourceKind } from "@/lib/resource-access";
import { cn } from "@/lib/utils";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { IconLock, IconUsers } from "@/components/ui/icons";

export interface AccessMember { id: string; name: string; avatarUrl?: string | null }

export function AccessControl({
  kind,
  resourceId,
  resourceName,
  members,
  value,
  canManage,
  variant = "button",
  className,
}: {
  kind: ResourceKind;
  resourceId: string;
  /** Do nagłówka dialogu i etykiet — bez tego przyciski w tabeli są nie do odróżnienia. */
  resourceName: string;
  members: AccessMember[];
  /** Id osób, którym już udostępniono. */
  value: string[];
  canManage: boolean;
  variant?: "button" | "compact";
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(value);
  const [saved, setSaved] = useState<string[]>(value);
  const [pending, startTransition] = useTransition();
  // Wartość z serwera wygrywa, gdy przyjdzie świeższa (revalidate po zapisie).
  const [seen, setSeen] = useState(value);
  if (value !== seen && value.join() !== seen.join()) {
    setSeen(value);
    setSaved(value);
    if (!open) setPicked(value);
  }

  const shown = members.filter((m) => saved.includes(m.id));
  const prywatne = ACCESS_MODE[kind] === "private";

  const save = () => {
    startTransition(async () => {
      const res = await setResourceAccessAction({ kind, resourceId, userIds: picked });
      if (!res.ok) {
        toast.add({ title: "Nie zapisano dostępu", description: res.error, type: "error" });
        return;
      }
      setSaved(picked);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setPicked(saved); setOpen(true); }}
        disabled={!canManage && saved.length === 0}
        title={canManage ? `Kto widzi: ${resourceName}` : accessLabel(kind, saved.length)}
        aria-label={`Dostęp do „${resourceName}”`}
        data-ui="access-control"
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-md text-2xs text-fg-2 outline-none",
          canManage ? "hover:bg-n-100 hover:text-foreground" : "cursor-default",
          variant === "button" ? "h-7 px-1.5" : "h-6 px-1",
          className,
        )}
      >
        {shown.length > 0 ? (
          <>
            <AvatarStack people={shown.map((m) => ({ name: m.name, src: m.avatarUrl ?? null }))} size={20} max={3} />
            {variant === "button" && <span className="truncate">{shown.length}</span>}
          </>
        ) : (
          <>
            {prywatne ? <IconLock width={12} height={12} /> : <IconUsers width={12} height={12} />}
            <span className="truncate">{prywatne ? "Tylko Ty" : "Wszyscy"}</span>
          </>
        )}
      </button>

      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent size="md" data-ui="access-dialog">
            <DialogHeader>
              <DialogTitle>Dostęp — {resourceName}</DialogTitle>
              <DialogDescription>
                {prywatne
                  ? "Bez wskazania osób widzisz to tylko Ty i administratorzy. Zaznaczone osoby zobaczą ten wpis."
                  : "Bez wskazania osób widzą to wszyscy uprawnieni. Zaznaczenie kogokolwiek zawęża krąg do wskazanych osób (i administratorów)."}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
              {members.length === 0 ? (
                <p className="text-sm text-fg-3">W tej przestrzeni nie ma innych osób.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => {
                    const on = picked.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={on}
                        disabled={!canManage}
                        onClick={() => setPicked((prev) => (on ? prev.filter((x) => x !== m.id) : [...prev, m.id]))}
                        className={cn(
                          "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card pr-2.5 pl-1 text-xs font-medium text-muted-foreground outline-none",
                          "hover:border-input-border-hover hover:text-foreground focus-visible:shadow-[var(--focus)] active:bg-n-100",
                          "aria-pressed:border-orange-300 aria-pressed:bg-orange-50 aria-pressed:text-orange-800",
                          !canManage && "cursor-default opacity-80",
                        )}
                      >
                        <Avatar name={m.name} src={m.avatarUrl ?? null} size={22} />
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="mt-1 text-2xs text-fg-3">{accessLabel(kind, picked.length)} · administratorzy widzą wszystko.</p>
            </DialogBody>
            <DialogFooter>
              {canManage && picked.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setPicked([])} className="mr-auto">
                  Wyczyść
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Anuluj</Button>
              {canManage && <Button type="button" loading={pending} onClick={save}>Zapisz dostęp</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
