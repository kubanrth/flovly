"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconUpload } from "@/components/ui/icons";
import { plPlural } from "@/lib/pluralize";
import { parseContactsCsv, type ImportedContact } from "./csv";
import { importContactsAction } from "./import-contacts-action";

const rowPl = (n: number) => plPlural(n, "wiersz", "wiersze", "wierszy");

export function ImportContactsDialog({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{ rows: ImportedContact[]; skipped: number; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const { rows, skipped } = parseContactsCsv(await file.text());
    if (rows.length === 0) {
      setParsed(null);
      setError("Nie znalazłem żadnego wiersza z nazwą firmy, imieniem, nazwiskiem albo e-mailem.");
      return;
    }
    setParsed({ rows, skipped, name: file.name });
  };

  const submit = () => {
    if (!parsed) return;
    start(async () => {
      const res = await importContactsAction(workspaceId, parsed.rows);
      if (res.ok) onClose();
      else setError(res.error);
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md" data-ui="import-contacts-dialog">
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Pierwszy wiersz to nagłówki. Rozpoznaję kolumny: Firma, Imię, Nazwisko, Stanowisko, E-mail,
            Telefon, NIP, REGON, VAT, WWW, Ulica, Kod, Miasto, Kraj. Separator: przecinek albo średnik.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            aria-label="Plik CSV z kontaktami"
            className="hidden"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
          <Button variant="secondary" size="lg" onClick={() => fileRef.current?.click()}>
            <IconUpload />
            {parsed ? parsed.name : "Wybierz plik CSV"}
          </Button>
          {parsed && (
            <p className="text-xs text-muted-foreground">
              Do zaimportowania: <strong className="font-semibold text-foreground">{parsed.rows.length}</strong>{" "}
              {rowPl(parsed.rows.length)}
              {parsed.skipped > 0 && ` · pominięte (brak nazwy i e-maila): ${parsed.skipped}`}
            </p>
          )}
          {error && (
            <p className="rounded-sm border border-danger bg-chip-red-bg px-2.5 py-2 text-xs text-danger-text">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Anuluj</Button>
          <Button disabled={!parsed} loading={pending} onClick={submit}>
            {pending ? "Importuję…" : "Importuj"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
