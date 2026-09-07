"use client";

// F13 „Zapotrzebowanie" — tablica zgloszen zakupowych: Projekt · Link · Koszt ·
// Zglaszajacy (+ data). Ten sam prymityw tabeli co Subskrypcje, koszt w PLN
// tym samym parserem/formaterem. Dodawanie i edycja w jednym dialogu.

import { startTransition, useActionState, useEffect, useState } from "react";
import { plPlural } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DataTable, DataTd, DataTh, DataThead, DataTr } from "@/components/ui/data-table";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, InputGroup } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconCart, IconEdit, IconExternal, IconPlus, IconSearch, IconTrash } from "@/components/ui/icons";
import { formatPln } from "@/components/subscriptions/money";
import { linkHost } from "@/components/purchases/purchases-model";
import { deletePurchaseAction, savePurchaseAction, type SavePurchaseState } from "@/app/(app)/w/[workspaceId]/purchases/actions";

export interface PurchaseItem {
  id: string; project: string; link: string | null; costCents: number | null; createdAt: string;
  requester: { id: string; name: string | null; email: string; avatarUrl: string | null };
}

const kto = (u: PurchaseItem["requester"]) => u.name?.trim() || u.email.split("@")[0]!;
const kiedy = (iso: string) => new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });
/** Do pola formularza: „129,99" bez jednostki (formatPln daje „129,99 zł"). */
const doPola = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2).replace(".", ","));

export function PurchasesTool({ workspaceId, currentUserId, canManage, items }: {
  workspaceId: string; currentUserId: string; canManage: boolean; items: PurchaseItem[];
}) {
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<null | "new" | PurchaseItem>(null);

  const q = query.trim().toLowerCase();
  const visible = items.filter((i) => !q || i.project.toLowerCase().includes(q) || (i.link ?? "").toLowerCase().includes(q) || kto(i.requester).toLowerCase().includes(q));
  const suma = visible.reduce((acc, i) => acc + (i.costCents ?? 0), 0);

  return (
    <div data-ui="purchases" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2.5 px-8 pt-4 max-md:px-4">
        {/* Licznik pod tytulem, nie obok: na telefonie „3 zgłoszenia" lamalo sie
            na dwie linie i wypychalo przycisk poza ekran. */}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-[-0.3px]">Zapotrzebowanie</h1>
          <p className="font-mono text-2xs text-fg-3">{items.length} {plPlural(items.length, "zgłoszenie", "zgłoszenia", "zgłoszeń")}</p>
        </div>
        {canManage && (
          <Button className="shrink-0" onClick={() => setDialog("new")}>
            <IconPlus width={14} height={14} />
            Nowe zgłoszenie
          </Button>
        )}
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-border px-8 pt-3 pb-2.5 max-md:px-4">
        <InputGroup size="sm" type="search" className="w-[260px] max-md:w-full" leading={<IconSearch />} placeholder="Szukaj projektu, linku, osoby…" aria-label="Szukaj zgłoszenia" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            icon={<IconCart />}
            title={q ? "Brak dopasowań" : "Brak zgłoszeń"}
            description={q ? "Spróbuj innej frazy." : canManage ? "Zgłoś, co trzeba kupić: projekt, link do produktu i koszt." : "Nikt jeszcze niczego nie zgłosił."}
            action={canManage && !q ? <Button size="sm" onClick={() => setDialog("new")}><IconPlus width={14} height={14} /> Nowe zgłoszenie</Button> : undefined}
          />
        </div>
      ) : (
        <DataTable
          wrapperClassName="min-h-0 flex-1"
          footer={<span>{visible.length} {plPlural(visible.length, "zgłoszenie", "zgłoszenia", "zgłoszeń")} · razem <span className="font-semibold text-foreground">{formatPln(suma)}</span></span>}
        >
          <DataThead>
            <tr>
              <DataTh>Projekt</DataTh>
              <DataTh>Link</DataTh>
              <DataTh align="right" width={130}>Koszt</DataTh>
              <DataTh width={200}>Zgłaszający</DataTh>
              <DataTh width={110}>Data</DataTh>
              {canManage && <DataTh width={72} aria-label="Akcje" />}
            </tr>
          </DataThead>
          <tbody>
            {visible.map((i) => (
              <DataTr key={i.id} data-ui="purchase-row" className="h-11">
                <DataTd className="font-medium">{i.project}</DataTd>
                <DataTd>
                  {i.link ? (
                    <a href={i.link} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-link no-underline hover:underline">
                      <span className="truncate">{linkHost(i.link)}</span>
                      <IconExternal width={11} height={11} className="shrink-0 text-fg-3" />
                    </a>
                  ) : <span className="text-fg-3">—</span>}
                </DataTd>
                <DataTd align="right" className={cn("whitespace-nowrap font-mono", i.costCents === null && "text-fg-3")}>{i.costCents === null ? "—" : formatPln(i.costCents)}</DataTd>
                <DataTd>
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar name={kto(i.requester)} src={i.requester.avatarUrl} size={20} />
                    <span className="truncate">{kto(i.requester)}{i.requester.id === currentUserId ? " (ja)" : ""}</span>
                  </span>
                </DataTd>
                <DataTd className="font-mono text-2xs text-fg-3">{kiedy(i.createdAt)}</DataTd>
                {canManage && (
                  <DataTd>
                    <span className="flex items-center gap-0.5">
                      <Button variant="ghost" size="sm" iconOnly aria-label={`Edytuj zgłoszenie ${i.project}`} onClick={() => setDialog(i)}><IconEdit /></Button>
                      <Button variant="ghost" size="sm" iconOnly aria-label={`Usuń zgłoszenie ${i.project}`} className="text-fg-3 hover:text-danger-text" onClick={() => {
                        if (!confirm(`Usunąć zgłoszenie „${i.project}”?`)) return;
                        const fd = new FormData(); fd.set("id", i.id);
                        startTransition(() => deletePurchaseAction(fd));
                      }}><IconTrash /></Button>
                    </span>
                  </DataTd>
                )}
              </DataTr>
            ))}
          </tbody>
        </DataTable>
      )}

      {dialog !== null && (
        <PurchaseDialog key={dialog === "new" ? "new" : dialog.id} workspaceId={workspaceId} initial={dialog === "new" ? undefined : dialog} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function PurchaseDialog({ workspaceId, initial, onClose }: { workspaceId: string; initial?: PurchaseItem; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<SavePurchaseState, FormData>(savePurchaseAction, null);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  const err = (k: "project" | "link" | "cost") => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" data-ui="purchase-dialog">
        <DialogHeader><DialogTitle>{initial ? "Edytuj zgłoszenie" : "Nowe zgłoszenie"}</DialogTitle></DialogHeader>
        <form action={(fd) => startTransition(() => formAction(fd))} autoComplete="off" className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          {initial && <input type="hidden" name="id" value={initial.id} />}
          <DialogBody className="flex flex-col gap-3">
            <div>
              <Label htmlFor="pr-project" className="mb-[5px]">Projekt</Label>
              <Input id="pr-project" name="project" required maxLength={200} autoFocus defaultValue={initial?.project ?? ""} placeholder="np. Sesja zdjęciowa — jesień" error={err("project")} />
            </div>
            <div>
              <Label htmlFor="pr-link" className="mb-[5px]">Link</Label>
              <Input id="pr-link" name="link" inputMode="url" maxLength={2000} defaultValue={initial?.link ?? ""} placeholder="https://… (opcjonalnie)" error={err("link")} />
            </div>
            <div>
              <Label htmlFor="pr-cost" className="mb-[5px]">Koszt</Label>
              <Input id="pr-cost" name="cost" inputMode="decimal" maxLength={40} defaultValue={doPola(initial?.costCents ?? null)} placeholder="np. 129,99 (PLN, opcjonalnie)" className="font-mono" error={err("cost")} />
            </div>
            {state && !state.ok && state.error && <p className="text-xs text-danger-text">{state.error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>Anuluj</Button>
            <Button type="submit" loading={pending}>{initial ? "Zapisz zmiany" : "Zgłoś"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
