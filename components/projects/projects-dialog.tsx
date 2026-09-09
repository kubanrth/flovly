"use client";

// Projekty przestrzeni i dostępy — wspólne dla Subskrypcji i Zapotrzebowania.
// Projekt grupuje wiersze, a zaznaczone osoby je widzą; zarządza workspace ADMIN.

import { startTransition, useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { IconFolder, IconPlus, IconTrash, IconUsers } from "@/components/ui/icons";
import {
  createWorkspaceProjectAction,
  deleteWorkspaceProjectAction,
  toggleWorkspaceProjectMemberAction,
} from "@/app/(app)/w/[workspaceId]/project-actions";

export interface WorkspaceProjectItem { id: string; name: string; memberIds: string[] }
export interface ProjectMemberItem { id: string; name: string }

export function ProjectsDialog({
  open,
  onOpenChange,
  workspaceId,
  projects,
  members,
  co,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projects: WorkspaceProjectItem[];
  members: ProjectMemberItem[];
  /** Czego dotyczy dostęp: 'subskrypcje' albo 'zgłoszenia zakupowe'. */
  co: string;
}) {
  const [newName, setNewName] = useState("");

  const addProject = () => {
    const name = newName.trim();
    if (!name) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("name", name);
    startTransition(() => void createWorkspaceProjectAction(fd));
    setNewName("");
  };

  const toggleMember = (projectId: string, userId: string) => {
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("userId", userId);
    startTransition(() => void toggleWorkspaceProjectMemberAction(fd));
  };

  const removeProject = (projectId: string, name: string) => {
    if (!confirm(`Usunąć projekt „${name}”? Subskrypcje i zgłoszenia wrócą do puli wspólnej (nie znikną).`)) return;
    const fd = new FormData();
    fd.set("projectId", projectId);
    startTransition(() => void deleteWorkspaceProjectAction(fd));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Projekty i dostępy</DialogTitle>
          <DialogDescription>
            {`Zaznaczone osoby widzą ${co} przypisane do projektu. Administratorzy widzą wszystko.`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addProject();
                }
              }}
              placeholder="Nazwa projektu, np. Kickback…"
              maxLength={120}
              aria-label="Nazwa nowego projektu"
            />
            <Button type="button" onClick={addProject} disabled={!newName.trim()}>
              <IconPlus width={14} height={14} />
              Dodaj
            </Button>
          </div>

          {projects.length === 0 ? (
            <EmptyState
              icon={<IconFolder />}
              title="Brak projektów"
              description="Dodaj pierwszy powyżej — potem przypniesz do niego subskrypcje i zgłoszenia."
            />
          ) : (
            projects.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <IconFolder width={14} height={14} className="shrink-0 text-fg-3" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                  <span className="flex shrink-0 items-center gap-1 font-mono text-2xs text-fg-3">
                    <IconUsers width={11} height={11} />
                    {p.memberIds.length}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label={`Usuń projekt ${p.name}`}
                    onClick={() => removeProject(p.id, p.name)}
                  >
                    <IconTrash />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => {
                    const on = p.memberIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleMember(p.id, m.id)}
                        className={cn(
                          "inline-flex h-6 items-center gap-1.5 rounded-sm border border-border bg-card pr-2 pl-1 text-2xs font-medium text-muted-foreground outline-none",
                          "hover:border-input-border-hover hover:text-foreground focus-visible:shadow-[var(--focus)] active:bg-n-100",
                          "aria-pressed:border-orange-300 aria-pressed:bg-orange-50 aria-pressed:text-orange-800",
                        )}
                      >
                        <Avatar name={m.name} size={20} />
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Zamknij
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
