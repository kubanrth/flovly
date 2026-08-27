"use client";

// Lista whiteboardów przestrzeni (D5 — brak makiety, przemalowane prymitywami).
// Tworzenie / zmiana nazwy / usunięcie wołają istniejące akcje z `/c/actions`.

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createCanvasAction,
  deleteCanvasAction,
  renameCanvasAction,
  type CreateCanvasState,
} from "@/app/(app)/w/[workspaceId]/c/actions";
import { Button } from "@/components/ui/button";
import { EditableTitle } from "@/components/ui/editable-title";
import { EmptyState } from "@/components/ui/empty-state";
import { IconPlus, IconTrash, IconWhiteboard } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { plPlural } from "@/lib/pluralize";

export interface CanvasRow {
  id: string;
  name: string;
  authorName: string;
  nodeCount: number;
  edgeCount: number;
}

export function CanvasesList({
  workspaceId,
  canvases,
  canCreate,
  canEdit,
  canDelete,
}: {
  workspaceId: string;
  canvases: CanvasRow[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();

  const rename = (id: string, name: string) => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("name", name);
    startTransition(async () => {
      await renameCanvasAction(fd);
      router.refresh();
    });
  };

  const remove = (id: string, name: string) => {
    if (!confirm(`Usunąć whiteboard „${name}”? Węzły i krawędzie znikną.`)) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await deleteCanvasAction(fd);
    });
  };

  return (
    <div
      data-ui="canvases"
      className="flex min-w-0 flex-1 flex-col"
      style={{ minHeight: "calc(100dvh - var(--topbar))" }}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2.5 px-8 pt-4 max-md:px-4">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Whiteboardy</h1>
        <span className="text-xs text-muted-foreground">diagramy procesów i mapy myśli</span>
        <span className="flex-1" />
        {canCreate && <NewCanvasPopover workspaceId={workspaceId} />}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-4 max-md:px-4">
        {canvases.length === 0 ? (
          <EmptyState
            icon={IconWhiteboard}
            title="Brak whiteboardów"
            description={
              canCreate
                ? "Utwórz pierwszy, żeby zacząć rysować."
                : "Gdy ktoś utworzy whiteboard, pojawi się tutaj."
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {canvases.map((c) => (
              <li key={c.id}>
                <article className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3.5">
                  <div className="flex items-start gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-n-100 text-muted-foreground" aria-hidden>
                      <IconWhiteboard width={14} height={14} />
                    </span>
                    <EditableTitle
                      value={c.name}
                      canEdit={canEdit}
                      maxLength={200}
                      ariaLabel={`Nazwa whiteboardu ${c.name}`}
                      onCommit={(next) => rename(c.id, next)}
                      className="min-w-0 flex-1 text-base font-semibold leading-[19px]"
                    />
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        aria-label={`Usuń whiteboard ${c.name}`}
                        onClick={() => remove(c.id, c.name)}
                        className="shrink-0 hover:text-danger-text"
                      >
                        <IconTrash width={14} height={14} />
                      </Button>
                    )}
                  </div>
                  <p className="font-mono text-2xs text-fg-3">
                    {c.nodeCount} {plPlural(c.nodeCount, "węzeł", "węzły", "węzłów")} ·{" "}
                    {c.edgeCount} {plPlural(c.edgeCount, "krawędź", "krawędzie", "krawędzi")} · {c.authorName}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-1 self-start"
                    render={<Link href={`/w/${workspaceId}/c/${c.id}`} />}
                  >
                    Otwórz
                  </Button>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer
        data-ui="canvases-footer"
        className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-8 font-mono text-2xs text-fg-2 max-md:px-4"
      >
        {canvases.length} {plPlural(canvases.length, "whiteboard", "whiteboardy", "whiteboardów")}
      </footer>
    </div>
  );
}

function NewCanvasPopover({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [state, setState] = useState<CreateCanvasState>(null);
  const [pending, setPending] = useState(false);

  // Po utworzeniu wchodzimy od razu w kanwę.
  const createdId = state?.ok ? state.canvasId : null;
  useEffect(() => {
    if (createdId) router.push(`/w/${workspaceId}/c/${createdId}`);
  }, [createdId, router, workspaceId]);

  const submit = () => {
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("name", name.trim());
    setPending(true);
    startTransition(async () => {
      setState(await createCanvasAction(null, fd));
      setPending(false);
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button />}>
        <IconPlus width={14} height={14} />
        Nowy whiteboard
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] p-3">
        <p className="eyebrow mb-1.5">Nowy whiteboard</p>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          maxLength={200}
          placeholder="np. Onboarding klienta"
          aria-label="Nazwa whiteboardu"
          error={state && !state.ok ? (state.fieldErrors?.name ?? state.error) : undefined}
        />
        <div className="mt-2.5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Anuluj
          </Button>
          <Button size="sm" onClick={submit} disabled={!name.trim() || pending} loading={pending}>
            Utwórz
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
