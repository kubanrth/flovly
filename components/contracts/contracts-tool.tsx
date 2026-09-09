"use client";

// F13 „Umowy" — lista kart. Kazda karta pokazuje od razu „Szczegoly umowy":
// pola, ktore uzytkownik sam zdefiniowal przy wpisywaniu (etykieta → wartosc).
// Tworzenie i edycja w jednym dialogu z dynamiczna lista pol.

import { startTransition, useActionState, useEffect, useState } from "react";
import { plPlural } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, InputGroup } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconClose, IconDoc, IconEdit, IconPlus, IconSearch, IconTrash } from "@/components/ui/icons";
import { MAX_DETAILS, type ContractDetail } from "@/components/contracts/contracts-model";
import { ContractFiles, type ContractFileItem } from "@/components/contracts/contract-files";
import { deleteContractAction, saveContractAction, type SaveContractState } from "@/app/(app)/w/[workspaceId]/contracts/actions";

export interface ContractItem {
  id: string; title: string; details: ContractDetail[]; createdAt: string; updatedAt: string;
  creator: { id: string; name: string | null; email: string };
  files: ContractFileItem[];
}

const kto = (u: ContractItem["creator"]) => u.name?.trim() || u.email.split("@")[0]!;
const kiedy = (iso: string) => new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });

export function ContractsTool({ workspaceId, canManage, contracts }: { workspaceId: string; canManage: boolean; contracts: ContractItem[] }) {
  const [query, setQuery] = useState("");
  // `null` = zamkniety, `"new"` = nowa, obiekt = edycja. Klucz dialogu zmienia
  // sie z celem, wiec formularz startuje od czystego stanu bez recznego resetu.
  const [dialog, setDialog] = useState<null | "new" | ContractItem>(null);

  const q = query.trim().toLowerCase();
  const visible = contracts.filter((c) =>
    !q || c.title.toLowerCase().includes(q) || c.files.some((f) => f.filename.toLowerCase().includes(q)) ||
    c.details.some((d) => d.label.toLowerCase().includes(q) || d.value.toLowerCase().includes(q)),
  );

  return (
    <div data-ui="contracts" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2.5 px-8 pt-4 max-md:px-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-[-0.3px]">Umowy</h1>
          <p className="font-mono text-2xs text-fg-3">{contracts.length} {plPlural(contracts.length, "umowa", "umowy", "umów")}</p>
        </div>
        {canManage && (
          <Button className="shrink-0" onClick={() => setDialog("new")}>
            <IconPlus width={14} height={14} />
            Nowa umowa
          </Button>
        )}
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-border px-8 pt-3 pb-2.5 max-md:px-4">
        <InputGroup size="sm" type="search" className="w-[260px] max-md:w-full" leading={<IconSearch />} placeholder="Szukaj w umowach i ich polach…" aria-label="Szukaj umowy" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-4 max-md:px-4">
        {visible.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <EmptyState
              icon={<IconDoc />}
              title={q ? "Brak dopasowań" : "Brak umów"}
              description={q ? "Spróbuj innej frazy." : canManage ? "Dodaj umowę i opisz ją własnymi polami — czas trwania, rabat, okres wypowiedzenia…" : "Nikt jeszcze nie dodał umowy."}
              action={canManage && !q ? <Button size="sm" onClick={() => setDialog("new")}><IconPlus width={14} height={14} /> Nowa umowa</Button> : undefined}
            />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((c) => <ContractCard key={c.id} contract={c} canManage={canManage} onEdit={() => setDialog(c)} />)}
          </div>
        )}
      </div>

      {dialog !== null && (
        <ContractDialog key={dialog === "new" ? "new" : dialog.id} workspaceId={workspaceId} initial={dialog === "new" ? undefined : dialog} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function ContractCard({ contract, canManage, onEdit }: { contract: ContractItem; canManage: boolean; onEdit: () => void }) {
  const remove = () => {
    if (!confirm(`Usunąć umowę „${contract.title}”?`)) return;
    const fd = new FormData(); fd.set("id", contract.id);
    startTransition(() => deleteContractAction(fd));
  };
  return (
    <article data-ui="contract-card" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <header className="flex items-start gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-n-100 text-fg-2"><IconDoc width={16} height={16} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold" title={contract.title}>{contract.title}</h2>
          <p className="text-2xs text-fg-3">{kto(contract.creator)} · <span className="font-mono">{kiedy(contract.updatedAt)}</span></p>
        </div>
        {canManage && (
          <span className="flex shrink-0 items-center gap-0.5">
            <Button variant="ghost" size="sm" iconOnly aria-label={`Edytuj umowę ${contract.title}`} onClick={onEdit}><IconEdit /></Button>
            <Button variant="ghost" size="sm" iconOnly aria-label={`Usuń umowę ${contract.title}`} onClick={remove} className="text-fg-3 hover:text-danger-text"><IconTrash /></Button>
          </span>
        )}
      </header>
      <div>
        <div className="eyebrow mb-1.5">Szczegóły umowy</div>
        {contract.details.length === 0 ? (
          <p className="text-xs text-fg-3">Brak pól — {canManage ? "dodaj je w edycji." : "nikt ich jeszcze nie uzupełnił."}</p>
        ) : (
          <dl className="grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
            {contract.details.map((d, i) => (
              <div key={i} className="contents">
                <dt className="truncate text-fg-2">{d.label}</dt>
                <dd className={cn("min-w-0 break-words font-medium", !d.value && "font-normal text-fg-3")}>{d.value || "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <ContractFiles contractId={contract.id} contractTitle={contract.title} files={contract.files} canManage={canManage} />
    </article>
  );
}

function ContractDialog({ workspaceId, initial, onClose }: { workspaceId: string; initial?: ContractItem; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<SaveContractState, FormData>(saveContractAction, null);
  // Wiersze pol trzymane lokalnie tylko po to, zeby dalo sie je dodawac i
  // usuwac; do akcji ida przez FormData jako rownolegle listy label/value.
  const [rows, setRows] = useState<ContractDetail[]>(initial?.details.length ? initial.details : [{ label: "", value: "" }]);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);

  const setRow = (i: number, patch: Partial<ContractDetail>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const addRow = () => setRows((r) => (r.length < MAX_DETAILS ? [...r, { label: "", value: "" }] : r));
  const removeRow = (i: number) => setRows((r) => (r.length === 1 ? [{ label: "", value: "" }] : r.filter((_, j) => j !== i)));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg" data-ui="contract-dialog">
        <DialogHeader><DialogTitle>{initial ? "Edytuj umowę" : "Nowa umowa"}</DialogTitle></DialogHeader>
        <form action={(fd) => startTransition(() => formAction(fd))} autoComplete="off" className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          {initial && <input type="hidden" name="id" value={initial.id} />}
          <DialogBody className="flex flex-col gap-4">
            <div>
              <Label htmlFor="contract-title" className="mb-[5px]">Tytuł umowy</Label>
              <Input id="contract-title" name="title" required maxLength={200} autoFocus defaultValue={initial?.title ?? ""} placeholder="np. Umowa dystrybucyjna — Hurtownia XYZ" error={state && !state.ok ? state.fieldErrors?.title : undefined} />
            </div>
            <div>
              <div className="eyebrow mb-1.5">Szczegóły umowy</div>
              <p className="mb-2 text-xs text-fg-3">{"Własne pola widoczne od razu na liście — np. „Czas trwania umowy: 2 lata”, „Stały rabat hurtowy: 6%”."}</p>
              <div className="flex flex-col gap-1.5" data-ui="contract-fields">
                {rows.map((row, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-1.5">
                    <Input name="label" value={row.label} maxLength={80} placeholder="Nazwa pola, np. Czas trwania umowy" aria-label={`Nazwa pola ${i + 1}`} onChange={(e) => setRow(i, { label: e.target.value })} />
                    <Input
                      name="value" value={row.value} maxLength={500} placeholder="Wartość, np. 2 lata" aria-label={`Wartość pola ${i + 1}`}
                      onChange={(e) => setRow(i, { value: e.target.value })}
                      // Enter w ostatniej wartosci = kolejne pole, zamiast wysylki formularza.
                      onKeyDown={(e) => { if (e.key === "Enter" && i === rows.length - 1) { e.preventDefault(); addRow(); } }}
                    />
                    <Button type="button" variant="ghost" size="sm" iconOnly aria-label={`Usuń pole ${i + 1}`} onClick={() => removeRow(i)}><IconClose /></Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={addRow} disabled={rows.length >= MAX_DETAILS}>
                <IconPlus width={12} height={12} /> Dodaj pole
              </Button>
            </div>
            {state && !state.ok && state.error && <p className="text-xs text-danger-text">{state.error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>Anuluj</Button>
            <Button type="submit" loading={pending}>{initial ? "Zapisz zmiany" : "Utwórz umowę"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
