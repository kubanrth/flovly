"use client";

// E6 „Hasła" — sejf zespołu. Tabela Usługa / Login / Hasło / Dostęp / Zmienione
// na wspólnym prymitywie DataTable, wiersz 44 px, odsłonięty wiersz na
// `--selected-bg` z licznikiem „odsłonięte 0:NN".
//
// Bezpieczeństwo (nie luzować bez przeglądu):
//   • plaintext NIGDY nie jedzie z SSR — page.tsx nie czyta `passwordEnc`;
//     odszyfrowanie robi `revealSecretAction` dopiero po kliknięciu „Pokaż",
//     a serwer przy każdym wywołaniu sprawdza członkostwo w przestrzeni;
//   • odsłonięte hasło żyje wyłącznie w stanie Reacta — nie trafia do
//     `data-*`, atrybutów, URL-a, localStorage ani do console;
//   • okno odsłonięcia to `REVEAL_MS` (30 s) i jest twarde — po nim stan
//     jest czyszczony, także gdy karta była w tle;
//   • „Kopiuj hasło" pobiera plaintext, wkłada do schowka i od razu go
//     porzuca — nie renderuje go i nie zapala trybu odsłonięcia.

import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DataTable, DataTd, DataTh, DataThead, DataTr } from "@/components/ui/data-table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, InputGroup, Textarea } from "@/components/ui/input";
import {
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconExternal,
  IconEye,
  IconEyeOff,
  IconMore,
  IconNotes,
  IconPasswords,
  IconPlus,
  IconSearch,
  IconShieldCheck,
  IconTrash,
} from "@/components/ui/icons";
import { plPlural } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import {
  createSecretAction,
  deleteSecretAction,
  revealSecretAction,
  type CreateSecretState,
} from "@/app/(app)/w/[workspaceId]/passwords/actions";
import { REVEAL_MS, revealState } from "./vault-model";

export interface SecretListItem {
  id: string;
  name: string;
  category: string | null;
  url: string | null;
  username: string | null;
  hasNotes: boolean;
  owner: { id: string; name: string | null; email: string };
  /** Preformatowane na serwerze („3 mies. temu") — bez rozjazdu SSR/hydracja. */
  changedLabel: string;
}

export interface VaultMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

type AccessFilter = "all" | "mine" | "others";

const ACCESS_LABEL: Record<AccessFilter, string> = {
  all: "Wszystkie",
  mine: "Moje wpisy",
  others: "Pozostałe",
};

const personName = (p: { name: string | null; email: string }) =>
  p.name ?? p.email.split("@")[0] ?? p.email;

/**
 * URL wpisu jest treścią od użytkownika, więc przepuszczamy tylko http(s).
 * Brak schematu = doklejamy https://; `javascript:`, `data:` i „//host"
 * odpadają, zamiast trafić do `href`.
 */
function safeUrl(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/+/, "")}`;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function SecretVault({
  workspaceId,
  currentUserId,
  items,
  members,
}: {
  workspaceId: string;
  currentUserId: string;
  items: SecretListItem[];
  members: VaultMember[];
}) {
  const [query, setQuery] = useState("");
  const [access, setAccess] = useState<AccessFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [revealedIds, setRevealedIds] = useState<string[]>([]);

  const setRevealed = useCallback((id: string, on: boolean) => {
    setRevealedIds((prev) => (on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = items.filter((it) => {
    if (access === "mine" && it.owner.id !== currentUserId) return false;
    if (access === "others" && it.owner.id === currentUserId) return false;
    if (!q) return true;
    return (
      it.name.toLowerCase().includes(q) ||
      (it.category?.toLowerCase().includes(q) ?? false) ||
      (it.url?.toLowerCase().includes(q) ?? false) ||
      (it.username?.toLowerCase().includes(q) ?? false)
    );
  });

  const people = members.map((m) => ({ name: personName(m), src: m.avatarUrl }));
  const revealedCount = revealedIds.filter((id) => filtered.some((it) => it.id === id)).length;

  return (
    <div data-ui="vault" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2.5 px-8 pt-4 max-md:px-4">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Hasła</h1>
        {/* Makieta pisze „Szyfrowane E2E", ale lib/vault-crypto.ts szyfruje
            w bazie i sam mówi, że to NIE jest end-to-end — serwer widzi hasło
            w momencie szyfrowania i odszyfrowania. Nie obiecujemy czegoś,
            czego kod nie robi. */}
        <Chip hue="green" size="lg" className="mt-1 gap-1.5" title="Hasła są szyfrowane w bazie (AES-256-GCM). Serwer odszyfrowuje je na żądanie, więc nie jest to szyfrowanie end-to-end.">
          <IconShieldCheck width={11} height={11} />
          Szyfrowane w bazie
        </Chip>
        <span className="flex-1" />
        <Button onClick={() => setAddOpen(true)}>
          <IconPlus width={14} height={14} />
          Nowy wpis
        </Button>
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-border px-8 pt-3 pb-2.5 max-md:px-4">
        <InputGroup
          size="sm"
          type="search"
          className="w-[220px] max-md:w-full"
          leading={<IconSearch />}
          placeholder="Szukaj wpisu…"
          aria-label="Szukaj wpisu"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Menu>
          <MenuTrigger
            render={
              <Button variant="secondary" size="sm" className="border-border font-medium">
                Dostęp
                <IconChevronDown width={11} height={11} strokeWidth={1.8} />
              </Button>
            }
          />
          <MenuContent className="min-w-[180px]">
            <MenuRadioGroup value={access} onValueChange={(v) => setAccess(v as AccessFilter)}>
              {(Object.keys(ACCESS_LABEL) as AccessFilter[]).map((v) => (
                <MenuRadioItem key={v} value={v}>
                  {ACCESS_LABEL[v]}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuContent>
        </Menu>
        <span className="flex-1" />
        <span className="font-mono text-2xs text-muted-foreground max-md:hidden">
          sejf odblokowany · auto-ukrycie 30 s
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-8 pt-3 pb-5 max-md:px-4">
        {filtered.length === 0 ? (
          <div>
            <EmptyState
              icon={<IconPasswords />}
              title={items.length === 0 ? "Sejf jest pusty" : "Nic nie pasuje"}
              description={
                items.length === 0
                  ? "Dodaj pierwszy wpis — hasło jest szyfrowane, zanim trafi do bazy."
                  : "Zmień frazę albo filtr dostępu."
              }
            />
          </div>
        ) : (
          <DataTable wrapperClassName="min-h-0 flex-1" className="min-w-[900px]">
            <DataThead>
              <tr>
                <DataTh width={280}>Usługa</DataTh>
                <DataTh width={220}>Login</DataTh>
                <DataTh width={220}>Hasło</DataTh>
                <DataTh width={160}>Dostęp</DataTh>
                <DataTh>Zmienione</DataTh>
              </tr>
            </DataThead>
            <tbody>
              {filtered.map((item) => (
                <SecretRow
                  key={item.id}
                  item={item}
                  people={people}
                  revealed={revealedIds.includes(item.id)}
                  onRevealChange={setRevealed}
                />
              ))}
            </tbody>
          </DataTable>
        )}
      </div>

      <footer className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-8 font-mono text-2xs text-muted-foreground max-md:px-4">
        {items.length} {plPlural(items.length, "wpis", "wpisy", "wpisów")} · odsłonięte: {revealedCount}
      </footer>

      <CreateSecretDialog workspaceId={workspaceId} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function SecretRow({
  item,
  people,
  revealed,
  onRevealChange,
}: {
  item: SecretListItem;
  people: { name: string; src?: string | null }[];
  revealed: boolean;
  onRevealChange: (id: string, on: boolean) => void;
}) {
  // Plaintext wyłącznie tutaj i tylko gdy `revealed`.
  const [password, setPassword] = useState<string | null>(null);
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState<"login" | "password" | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    setPassword(null);
    setCountdownLabel(null);
    onRevealChange(item.id, false);
  }, [item.id, onRevealChange]);

  // Twarde okno 30 s. `revealedAt` trzymamy lokalnie w efekcie, żeby licznik
  // startował dokładnie z chwilą pokazania hasła.
  useEffect(() => {
    if (password === null) return;
    const revealedAt = Date.now();
    const tick = () => {
      const s = revealState(revealedAt, Date.now());
      if (s.expired) {
        hide();
        return;
      }
      setCountdownLabel(s.label);
    };
    tick();
    const iv = setInterval(tick, 500);
    const hard = setTimeout(hide, REVEAL_MS);
    return () => {
      clearInterval(iv);
      clearTimeout(hard);
    };
  }, [password, hide]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  // Wiersz zniknięty z filtra gubi swój plaintext razem ze stanem — zdejmij
  // też podświetlenie w rodzicu, inaczej po powrocie wiersz udaje odsłonięty.
  useEffect(() => () => onRevealChange(item.id, false), [item.id, onRevealChange]);

  const flashCopied = (what: "login" | "password") => {
    setCopied(what);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1400);
  };

  const copy = async (what: "login" | "password", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      flashCopied(what);
    } catch {
      setError("Przeglądarka nie dała dostępu do schowka.");
    }
  };

  const toggleReveal = async () => {
    if (password !== null) {
      hide();
      return;
    }
    setBusy(true);
    setError(null);
    const res = await revealSecretAction({ id: item.id });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPassword(res.password);
    onRevealChange(item.id, true);
  };

  // Kopiowanie bez odsłaniania: plaintext idzie prosto do schowka i wychodzi
  // z zakresu funkcji — nigdy nie ląduje w stanie ani w DOM.
  const copyPassword = async () => {
    if (password !== null) {
      void copy("password", password);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await revealSecretAction({ id: item.id });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await copy("password", res.password);
  };

  const showNote = async () => {
    setBusy(true);
    setError(null);
    const res = await revealSecretAction({ id: item.id });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNote(res.notes ?? "Ten wpis nie ma notatki.");
  };

  const remove = () => {
    if (!confirm(`Usunąć wpis „${item.name}"?`)) return;
    const fd = new FormData();
    fd.set("id", item.id);
    startTransition(() => void deleteSecretAction(fd));
  };

  const href = safeUrl(item.url);

  return (
    <>
      <DataTr selected={revealed} className="h-11">
        <DataTd className="px-3">
          <span className="flex items-center gap-2.5">
            <Avatar name={item.name} size={26} className="rounded-md" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm leading-4 font-medium">{item.name}</span>
              <span className="truncate text-2xs text-fg-3">{item.url ?? item.category ?? "—"}</span>
            </span>
          </span>
        </DataTd>

        <DataTd>
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-xs text-n-700">{item.username ?? "—"}</span>
            {item.username && (
              <IconButton
                label={copied === "login" ? "Skopiowano login" : "Kopiuj login"}
                active={copied === "login"}
                onClick={() => void copy("login", item.username!)}
              >
                {copied === "login" ? <IconCheck width={12} height={12} /> : <IconCopy width={11} height={11} />}
              </IconButton>
            )}
          </span>
        </DataTd>

        <DataTd>
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "min-w-0 flex-1 truncate font-mono text-xs",
                password === null ? "tracking-[2px] text-n-700" : "text-foreground",
              )}
            >
              {password ?? "••••••••••••"}
            </span>
            <IconButton
              label={password === null ? "Pokaż hasło" : "Ukryj hasło"}
              pressed={password !== null}
              disabled={busy}
              onClick={() => void toggleReveal()}
            >
              {password === null ? <IconEye width={12} height={12} /> : <IconEyeOff width={12} height={12} />}
            </IconButton>
            <IconButton
              label={copied === "password" ? "Skopiowano hasło" : "Kopiuj hasło"}
              active={copied === "password"}
              disabled={busy}
              onClick={() => void copyPassword()}
            >
              {copied === "password" ? <IconCheck width={12} height={12} /> : <IconCopy width={11} height={11} />}
            </IconButton>
          </span>
        </DataTd>

        <DataTd>
          <AvatarStack people={people} max={3} size={20} className="align-middle" />
        </DataTd>

        <DataTd>
          <span className="flex items-center gap-1.5 text-xs text-fg-2">
            <span className="truncate">
              {item.changedLabel} · {personName(item.owner)}
            </span>
            {countdownLabel && (
              <span className="ml-auto shrink-0 font-mono text-2xs text-fg-3">{countdownLabel}</span>
            )}
            <Menu>
              <MenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={`Więcej dla ${item.name}`}
                    className={cn(
                      "inline-flex size-6 shrink-0 items-center justify-center rounded-sm border border-border text-muted-foreground outline-none",
                      "hover:bg-n-100 hover:text-foreground active:bg-n-200",
                      countdownLabel ? "ml-1.5" : "ml-auto",
                    )}
                  />
                }
              >
                <IconMore width={13} height={13} />
              </MenuTrigger>
              <MenuContent align="end" className="min-w-[200px]">
                {item.username && (
                  <MenuItem icon={<IconCopy />} onClick={() => void copy("login", item.username!)}>
                    Kopiuj login
                  </MenuItem>
                )}
                <MenuItem icon={<IconCopy />} onClick={() => void copyPassword()}>
                  Kopiuj hasło
                </MenuItem>
                {href && (
                  <MenuItem
                    icon={<IconExternal />}
                    render={<a href={href} target="_blank" rel="noopener noreferrer" />}
                  >
                    Otwórz stronę
                  </MenuItem>
                )}
                {item.hasNotes && (
                  <MenuItem icon={<IconNotes />} onClick={() => void showNote()}>
                    Pokaż notatkę
                  </MenuItem>
                )}
                <MenuSeparator />
                <MenuItem icon={<IconTrash />} destructive onClick={remove}>
                  Usuń wpis
                </MenuItem>
              </MenuContent>
            </Menu>
            <NoteDialog name={item.name} note={note} onClose={() => setNote(null)} />
          </span>
        </DataTd>
      </DataTr>

      {error && (
        <tr>
          <td colSpan={5} className="border-b border-n-100 px-3 py-1.5 text-xs text-danger-text">
            {error}
          </td>
        </tr>
      )}
    </>
  );
}

/** Notatka to też sekret — znika po tym samym oknie co hasło. */
function NoteDialog({
  name,
  note,
  onClose,
}: {
  name: string;
  note: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (note === null) return;
    const t = setTimeout(onClose, REVEAL_MS);
    return () => clearTimeout(t);
  }, [note, onClose]);

  return (
    <Dialog open={note !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Notatka — {name}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <pre className="rounded-md bg-n-100 px-3 py-2 font-mono text-xs leading-5 whitespace-pre-wrap">
            {note}
          </pre>
          <p className="mt-2 text-2xs text-fg-3">Okno zamknie się samo po 30 sekundach.</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Zamknij</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IconButton({
  label,
  active,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-sm border outline-none disabled:opacity-50",
        active
          ? "border-success bg-chip-green-bg text-chip-green-fg"
          : "border-border text-muted-foreground hover:bg-n-100 hover:text-foreground active:bg-n-200",
        pressed && !active && "border-input-border bg-n-100 text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function CreateSecretDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState<CreateSecretState, FormData>(createSecretAction, null);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    if (state?.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setShowPwd(false);
        onOpenChange(next);
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Nowy wpis</DialogTitle>
        </DialogHeader>
        <form
          action={(fd) => startTransition(() => formAction(fd))}
          autoComplete="off"
          className="flex min-h-0 flex-1 flex-col"
        >
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <DialogBody className="flex flex-col gap-3">
            <Field label="Nazwa">
              <Input
                name="name"
                required
                maxLength={120}
                autoFocus
                placeholder="np. Panel sklepu — admin"
                error={state && !state.ok ? state.fieldErrors?.name : undefined}
              />
            </Field>
            <Field label="Kategoria">
              <Input name="category" maxLength={60} placeholder="e-mail / vpn / api…" />
            </Field>
            <Field label="URL">
              <Input name="url" maxLength={500} placeholder="https://…" inputMode="url" />
            </Field>
            <Field label="Login">
              <Input name="username" maxLength={200} placeholder="dev@nazwa.pl" autoComplete="off" />
            </Field>
            <Field label="Hasło">
              <div className="flex items-center gap-1.5">
                <Input
                  name="password"
                  type={showPwd ? "text" : "password"}
                  required
                  maxLength={4000}
                  autoComplete="new-password"
                  spellCheck={false}
                  className="font-mono"
                  error={state && !state.ok ? state.fieldErrors?.password : undefined}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  iconOnly
                  aria-label={showPwd ? "Ukryj hasło" : "Pokaż hasło"}
                  aria-pressed={showPwd}
                  onClick={() => setShowPwd((v) => !v)}
                >
                  {showPwd ? <IconEyeOff /> : <IconEye />}
                </Button>
              </div>
            </Field>
            <Field label="Notatki">
              <Textarea
                name="notes"
                rows={3}
                maxLength={8000}
                spellCheck={false}
                placeholder="Kody odzyskiwania, kontekst, kto zakładał konto…"
                className="font-mono text-xs"
              />
            </Field>
            {state && !state.ok && state.error && (
              <p className="rounded-sm bg-chip-red-bg px-3 py-2 text-xs text-danger-text">{state.error}</p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" loading={pending} disabled={pending}>
              Zapisz wpis
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  );
}
