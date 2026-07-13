"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import {
  KeyRound,
  Plus,
  Search,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  ExternalLink,
  User as UserIcon,
  X,
} from "lucide-react";
import {
  createSecretAction,
  deleteSecretAction,
  revealSecretAction,
  type CreateSecretState,
} from "@/app/(app)/w/[workspaceId]/passwords/actions";

export interface SecretListItem {
  id: string;
  name: string;
  category: string | null;
  url: string | null;
  username: string | null;
  hasNotes: boolean;
  owner: { id: string; name: string | null; email: string };
  updatedAt: string;
}

export function SecretVault({
  workspaceId,
  items,
}: {
  workspaceId: string;
  items: SecretListItem[];
}) {
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const filtered = items.filter((it) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      it.name.toLowerCase().includes(q) ||
      (it.category?.toLowerCase().includes(q) ?? false) ||
      (it.url?.toLowerCase().includes(q) ?? false) ||
      (it.username?.toLowerCase().includes(q) ?? false)
    );
  });

  // Group by category (null = "Bez kategorii" gdy istnieją inne).
  const grouped = new Map<string, SecretListItem[]>();
  for (const it of filtered) {
    const key = it.category ?? "—";
    const arr = grouped.get(key) ?? [];
    arr.push(it);
    grouped.set(key, arr);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 py-6 md:py-10">
      <header className="flex flex-col gap-2">
        <span className="eyebrow flex items-center gap-2">
          <KeyRound size={12} /> Sejf zespołu
        </span>
        <h1 className="font-display text-[2rem] font-bold leading-tight tracking-[-0.025em] md:text-[2.4rem]">
          Manager haseł
        </h1>
        <p className="max-w-[62ch] text-[0.94rem] leading-[1.55] text-muted-foreground">
          Wspólny sejf workspace'u. Hasła szyfrowane AES-256-GCM at-rest.
          Widoczne po jawnym kliknięciu &quot;Pokaż&quot;.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-border bg-card/60 px-3 text-[0.88rem] backdrop-blur focus-within:border-primary/50">
          <Search size={14} className="shrink-0 text-muted-foreground" />
          <input
            type="search"
            placeholder="Szukaj (nazwa, kategoria, URL, login)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/60"
          />
        </label>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex h-10 items-center gap-2 self-start rounded-xl bg-brand-gradient px-4 font-sans text-[0.86rem] font-semibold text-white shadow-brand transition-transform hover:-translate-y-[1px]"
        >
          <Plus size={14} /> Nowy sekret
        </button>
      </div>

      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <KeyRound className="mx-auto mb-3 text-muted-foreground/60" size={32} />
          <p className="text-[0.96rem] font-semibold">Brak sekretów</p>
          <p className="mt-1 text-[0.86rem] text-muted-foreground">
            Utwórz pierwszy — hasło zostanie zaszyfrowane zanim opuści serwer.
          </p>
        </div>
      )}

      {filtered.length === 0 && items.length > 0 && (
        <p className="text-[0.86rem] text-muted-foreground">
          Nic nie pasuje do „{query}".
        </p>
      )}

      {[...grouped.entries()].map(([cat, list]) => (
        <section key={cat} className="flex flex-col gap-2">
          {items.some((i) => i.category !== null) && (
            <h2 className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {cat === "—" ? "Bez kategorii" : cat}
            </h2>
          )}
          <ul className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card/40">
            {list.map((it) => (
              <SecretRow key={it.id} item={it} />
            ))}
          </ul>
        </section>
      ))}

      {addOpen && (
        <CreateSecretDialog
          workspaceId={workspaceId}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

function SecretRow({ item }: { item: SecretListItem }) {
  const [revealed, setRevealed] = useState<{
    password: string;
    notes: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"password" | "username" | null>(null);

  const doReveal = async () => {
    if (revealed) {
      setRevealed(null);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await revealSecretAction({ id: item.id });
    setLoading(false);
    if (res.ok) setRevealed({ password: res.password, notes: res.notes });
    else setError(res.error);
  };

  const copy = async (what: "password" | "username", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* clipboard denied */
    }
  };

  const doDelete = () => {
    if (!confirm(`Usunąć „${item.name}"?`)) return;
    const fd = new FormData();
    fd.set("id", item.id);
    startTransition(() => {
      void deleteSecretAction(fd);
    });
  };

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-brand">
          <KeyRound size={14} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-[1rem] font-semibold">
              {item.name}
            </span>
            {item.url && (
              <a
                href={item.url.startsWith("http") ? item.url : `https://${item.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-primary"
                title="Otwórz URL"
              >
                <ExternalLink size={13} />
              </a>
            )}
          </div>
          {item.username && (
            <button
              type="button"
              onClick={() => copy("username", item.username!)}
              className="group flex w-fit items-center gap-1.5 font-mono text-[0.76rem] text-muted-foreground transition-colors hover:text-foreground"
              title="Kopiuj login"
            >
              <UserIcon size={11} /> {item.username}
              <Copy
                size={10}
                className={`opacity-0 transition-opacity group-hover:opacity-100 ${copied === "username" ? "opacity-100 text-emerald-500" : ""}`}
              />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={doReveal}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60"
            aria-label={revealed ? "Ukryj hasło" : "Pokaż hasło"}
          >
            {revealed ? <EyeOff size={11} /> : <Eye size={11} />}
            {loading ? "…" : revealed ? "Ukryj" : "Pokaż"}
          </button>
          <button
            type="button"
            onClick={doDelete}
            aria-label="Usuń sekret"
            title="Usuń"
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-1.5 font-mono text-[0.72rem] text-destructive">
          {error}
        </p>
      )}

      {revealed && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-background/60 p-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              Hasło
            </span>
            <code className="flex-1 truncate rounded bg-muted/40 px-2 py-1 font-mono text-[0.86rem]">
              {revealed.password}
            </code>
            <button
              type="button"
              onClick={() => copy("password", revealed.password)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] transition-colors hover:border-primary/50"
              aria-label="Kopiuj hasło"
            >
              <Copy size={10} />{" "}
              {copied === "password" ? "Skopiowano" : "Kopiuj"}
            </button>
          </div>
          {revealed.notes && (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                Notatka
              </span>
              <pre className="whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 font-mono text-[0.82rem]">
                {revealed.notes}
              </pre>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function CreateSecretDialog({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<CreateSecretState, FormData>(
    createSecretAction,
    null,
  );
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Nowy sekret"
        className="flex w-full max-w-[520px] flex-col gap-4 rounded-t-2xl border border-border bg-card p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[1.2rem] font-bold">Nowy sekret</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X size={16} />
          </button>
        </div>

        <form
          action={(fd) => startTransition(() => formAction(fd))}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="workspaceId" value={workspaceId} />

          <FieldRow label="Nazwa" error={!state?.ok ? state?.fieldErrors?.name : undefined}>
            <input
              name="name"
              required
              maxLength={120}
              placeholder="np. Gmail firmowy"
              autoFocus
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[0.9rem] outline-none focus:border-primary/60"
            />
          </FieldRow>

          <FieldRow label="Kategoria (opcjonalna)">
            <input
              name="category"
              maxLength={60}
              placeholder="email / vpn / wifi / …"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[0.9rem] outline-none focus:border-primary/60"
            />
          </FieldRow>

          <FieldRow label="URL (opcjonalny)">
            <input
              name="url"
              type="url"
              maxLength={500}
              placeholder="https://…"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[0.9rem] outline-none focus:border-primary/60"
            />
          </FieldRow>

          <FieldRow label="Login / e-mail">
            <input
              name="username"
              maxLength={200}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[0.9rem] outline-none focus:border-primary/60"
            />
          </FieldRow>

          <FieldRow
            label="Hasło"
            error={!state?.ok ? state?.fieldErrors?.password : undefined}
          >
            <div className="flex items-center gap-1">
              <input
                name="password"
                type={showPwd ? "text" : "password"}
                required
                maxLength={4000}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-[0.9rem] outline-none focus:border-primary/60"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Ukryj" : "Pokaż"}
                className="grid h-10 w-10 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
              >
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </FieldRow>

          <FieldRow label="Notatka (opcjonalna, szyfrowana)">
            <textarea
              name="notes"
              rows={3}
              maxLength={8000}
              placeholder="Recovery codes, seed phrase, kontekst…"
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-[0.82rem] outline-none focus:border-primary/60"
            />
          </FieldRow>

          {!state?.ok && state?.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-[0.82rem] text-destructive">
              {state.error}
            </p>
          )}

          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-lg px-4 font-sans text-[0.86rem] text-muted-foreground hover:text-foreground"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-10 items-center rounded-lg bg-brand-gradient px-4 font-sans text-[0.88rem] font-semibold text-white shadow-brand disabled:opacity-60"
            >
              {pending ? "Zapisuję…" : "Zapisz"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
      {error && (
        <span className="font-mono text-[0.72rem] text-destructive">{error}</span>
      )}
    </label>
  );
}
