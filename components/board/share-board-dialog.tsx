"use client";

// F12-K79: Dialog generowania + zarządzania public share linkami.
// Lista istniejących linków z poziomu admina + przycisk "+ Nowy link".
// Generowanie wciska randomBytes-token na serwerze i wraca URL do copy.

import { startTransition, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Share2,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createShareLinkAction,
  revokeShareLinkAction,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/share-actions";

export type ShareLinkRow = {
  id: string;
  token: string;
  name: string | null;
  url: string;
  createdAt: string;
  lastAccessedAt: string | null;
  accessCount: number;
  expiresAt: string | null;
};

export function ShareBoardDialog({
  workspaceId,
  boardId,
  initialLinks,
}: {
  workspaceId: string;
  boardId: string;
  initialLinks: ShareLinkRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ShareLinkRow[]>(initialLinks);
  const [newLinkName, setNewLinkName] = useState("");
  const [, startTrans] = useTransition();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleCreate = () => {
    setError(null);
    setCreating(true);
    startTrans(async () => {
      const res = await createShareLinkAction({
        workspaceId,
        boardId,
        name: newLinkName.trim() || undefined,
      });
      setCreating(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Optymistyczny update lokalnej listy + auto-copy.
      const fresh: ShareLinkRow = {
        id: `tmp-${res.token}`,
        token: res.token,
        url: res.url,
        name: newLinkName.trim() || null,
        createdAt: new Date().toISOString(),
        lastAccessedAt: null,
        accessCount: 0,
        expiresAt: null,
      };
      setLinks((prev) => [fresh, ...prev]);
      setNewLinkName("");
      // Auto-copy świeży link do clipboardu.
      void copyToClipboard(res.url, res.token);
      // Refresh strony żeby dostać prawdziwe ID (cuid) — działa w tle.
      router.refresh();
    });
  };

  const handleRevoke = (linkId: string) => {
    if (!confirm("Cofnąć dostęp do tego linku? Klienci stracą podgląd."))
      return;
    const snapshot = links;
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
    startTransition(async () => {
      const res = await revokeShareLinkAction({ linkId });
      if (!res.ok) {
        setLinks(snapshot);
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  };

  const copyToClipboard = async (url: string, token: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // ignore — np. safari w iframe
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Share2 size={13} />
        <span>Udostępnij</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-xl border-border bg-card sm:max-w-[560px]">
          <DialogHeader>
            <span className="eyebrow">Public share</span>
            <DialogTitle className="font-display text-[1.45rem] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
              Udostępnij <span className="text-brand-gradient">interesariuszowi</span>
            </DialogTitle>
            <DialogDescription className="text-[0.9rem] leading-[1.55] text-muted-foreground">
              Wygeneruj link, który otworzy klient bez konta. Widok&nbsp;read-only,
              możesz cofnąć dostęp w każdej chwili.
            </DialogDescription>
          </DialogHeader>

          {/* Generate new */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/50 p-4">
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Etykieta (opcjonalna)</span>
              <input
                value={newLinkName}
                onChange={(e) => setNewLinkName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !creating) handleCreate();
                }}
                placeholder="np. Klient ABC — prezentacja Q3"
                maxLength={80}
                className="h-10 border-b border-border bg-transparent pb-1 text-[0.95rem] outline-none focus:border-primary"
              />
            </label>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-brand-gradient px-5 font-sans text-[0.88rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px] disabled:opacity-60"
              >
                <Share2 size={14} />
                {creating ? "Generuję…" : "Wygeneruj link"}
              </button>
            </div>
            {error && (
              <p className="flex items-center gap-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-destructive">
                <AlertCircle size={11} />
                {error}
              </p>
            )}
          </div>

          {/* Existing links */}
          <div className="flex flex-col gap-2">
            <span className="eyebrow">
              Aktywne linki ({links.length})
            </span>
            {links.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[0.82rem] leading-[1.55] text-muted-foreground">
                Brak aktywnych linków. Wygeneruj pierwszy żeby zaprosić&nbsp;klienta.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {links.map((link) => (
                  <li
                    key={link.id}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-display text-[0.92rem] font-semibold text-foreground">
                          {link.name ?? "Bez nazwy"}
                        </span>
                        <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
                          {new Date(link.createdAt).toLocaleDateString("pl-PL", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {" · "}
                          {link.accessCount}{" "}
                          {link.accessCount === 1 ? "odsłonięcie" : "odsłonięć"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          title="Otwórz w nowej karcie"
                        >
                          <ExternalLink size={12} />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRevoke(link.id)}
                          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                          title="Cofnij dostęp"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5">
                      <code className="flex-1 overflow-hidden truncate font-mono text-[0.72rem] text-muted-foreground">
                        {link.url}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(link.url, link.token)}
                        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-card px-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-primary/10"
                      >
                        {copiedToken === link.token ? (
                          <>
                            <Check size={11} className="text-emerald-500" />
                            Skopiowano
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            Kopiuj
                          </>
                        )}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
