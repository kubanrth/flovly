"use client";

// E9 — prawa kolumna skrzynki: nagłówek zgłoszenia, wątek, „Kontekst"
// i pasek akcji nad stopką.
//
// W miejscu kompozytora z makiety („Odpowiedź do klienta" / „Notatka
// wewnętrzna" / „Wyślij") stoi pasek akcji zgłoszenia. Powód w
// docs/redesign/OMITTED.md: schemat nie ma modelu wiadomości ani
// widoczności, więc „notatka wewnętrzna" obiecywałaby poufność, której
// backend nie zapewnia — każdy członek przestrzeni widzi cały ticket.

import { startTransition, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DateTimePicker } from "@/components/ui/date-time-picker";
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
import { Input, Textarea } from "@/components/ui/input";
import {
  IconAttachment,
  IconCheckCircle,
  IconChevronDown,
  IconChevronLeft,
  IconExternal,
  IconMore,
  IconPen,
  IconPlus,
  IconTrash,
  IconUpload,
  IconUser,
  IconWarning,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { createTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import {
  confirmSupportAttachmentUploadAction,
  deleteSupportAttachmentAction,
  deleteSupportTicketAction,
  requestSupportAttachmentUploadAction,
  updateSupportTicketAction,
} from "@/app/(app)/w/[workspaceId]/support/actions";
import {
  ATTACHMENT_ACCEPT,
  PRIORITIES,
  PRIORITY_META,
  STATUSES,
  STATUS_META,
  formatFileSize,
  inferContentType,
  personLabel,
  ticketCode,
  type SupportMember,
  type SupportPriority,
  type SupportStatus,
  type SupportTicketRow,
} from "./support-model";

export interface SupportBoard {
  id: string;
  name: string;
}

const patch = (id: string, entries: Record<string, string>) => {
  const fd = new FormData();
  fd.set("id", id);
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  startTransition(() => void updateSupportTicketAction(fd));
};

export function TicketDetail({
  ticket,
  members,
  boards,
  workspaceId,
  currentUserId,
  canManage,
  canCreateTask,
  onBack,
}: {
  ticket: SupportTicketRow;
  members: SupportMember[];
  boards: SupportBoard[];
  workspaceId: string;
  currentUserId: string;
  canManage: boolean;
  canCreateTask: boolean;
  /** Mobile: powrót do listy zgłoszeń. */
  onBack: () => void;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const status = STATUS_META[ticket.status];
  const isReporter = ticket.reporter.id === currentUserId;
  const canEditContent = canManage || (isReporter && ticket.status === "OPEN" && !ticket.assignee);
  const isClosed = ticket.status === "RESOLVED" || ticket.status === "CLOSED";
  const code = ticketCode(ticket.id);

  const makeTask = (boardId: string) => {
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("title", ticket.title);
    startTransition(async () => {
      const res = await createTaskAction(null, fd);
      if (res?.ok) router.push(`/w/${workspaceId}/t/${res.taskId}?mode=modal`);
    });
  };

  return (
    <div data-ui="support-detail" className="flex min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-3 max-md:px-3">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Wróć do listy zgłoszeń"
          className="md:hidden"
          onClick={onBack}
        >
          <IconChevronLeft />
        </Button>
        <span className="shrink-0 font-mono text-xs text-fg-2">{code}</span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{ticket.title}</span>

        {canManage ? (
          <Menu>
            <MenuTrigger
              render={
                <button
                  type="button"
                  aria-label={`Status: ${status.label}`}
                  className="inline-flex h-6 shrink-0 items-center gap-1 rounded-sm outline-none hover:opacity-85 active:opacity-70"
                />
              }
            >
              <Chip hue={status.hue} dot size="lg" className="pointer-events-none">
                {status.label}
              </Chip>
              <IconChevronDown width={11} height={11} strokeWidth={1.8} className="text-fg-2" />
            </MenuTrigger>
            <MenuContent align="end" className="min-w-[200px]">
              <MenuRadioGroup
                value={ticket.status}
                onValueChange={(v) => patch(ticket.id, { status: v as SupportStatus })}
              >
                {STATUSES.map((s) => (
                  <MenuRadioItem key={s} value={s}>
                    <Chip hue={STATUS_META[s].hue} dot size="md">
                      {STATUS_META[s].label}
                    </Chip>
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuContent>
          </Menu>
        ) : (
          <Chip hue={status.hue} dot size="lg">
            {status.label}
          </Chip>
        )}

        {canManage && (
          <Menu>
            <MenuTrigger render={<Button variant="secondary" size="sm" className="max-md:hidden" />}>
              <IconUser width={12} height={12} />
              {ticket.assignee ? personLabel(ticket.assignee) : "Przypisz"}
            </MenuTrigger>
            <MenuContent align="end" className="min-w-[240px]">
              <MenuRadioGroup
                value={ticket.assignee?.id ?? ""}
                onValueChange={(v) => patch(ticket.id, { assigneeId: String(v) })}
              >
                <MenuRadioItem value="">Bez przypisania</MenuRadioItem>
                {members.map((m) => (
                  <MenuRadioItem key={m.id} value={m.id}>
                    <Avatar name={personLabel(m)} src={m.avatarUrl} size={20} />
                    {personLabel(m)}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuContent>
          </Menu>
        )}

        {canCreateTask && boards.length > 0 && (
          <Menu>
            <MenuTrigger render={<Button size="sm" className="max-md:hidden" />}>
              <IconPlus width={12} height={12} />
              Zrób zadanie
            </MenuTrigger>
            <MenuContent align="end" className="min-w-[240px]">
              {boards.map((b) => (
                <MenuItem key={b.id} onClick={() => makeTask(b.id)}>
                  {b.name}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        )}

        <Menu>
          <MenuTrigger render={<Button variant="ghost" size="sm" iconOnly aria-label="Więcej opcji" />}>
            <IconMore width={15} height={15} />
          </MenuTrigger>
          <MenuContent align="end">
            {canEditContent && (
              <MenuItem icon={<IconPen />} onClick={() => setEditOpen(true)}>
                Edytuj treść
              </MenuItem>
            )}
            {canManage && (
              <>
                <MenuSeparator />
                <MenuItem
                  icon={<IconTrash />}
                  destructive
                  onClick={() => {
                    if (!confirm(`Usunąć zgłoszenie „${ticket.title}"? Tego nie da się cofnąć.`)) return;
                    const fd = new FormData();
                    fd.set("id", ticket.id);
                    startTransition(() => void deleteSupportTicketAction(fd));
                    onBack();
                  }}
                >
                  Usuń zgłoszenie
                </MenuItem>
              </>
            )}
          </MenuContent>
        </Menu>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 max-md:px-3">
        <article className="flex gap-2.5">
          <Avatar name={personLabel(ticket.reporter)} src={ticket.reporter.avatarUrl} size={28} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold">{personLabel(ticket.reporter)}</span>
              <span className="font-mono text-2xs text-fg-3">
                {ticket.reporter.email} · {ticket.createdLabel}
              </span>
            </div>
            <div className="mt-1 rounded-lg border border-border px-3 py-2.5 text-sm leading-5 whitespace-pre-wrap">
              {ticket.description}
            </div>
            <Attachments
              ticketId={ticket.id}
              attachments={ticket.attachments}
              currentUserId={currentUserId}
              canManage={canManage}
            />
          </div>
        </article>

        <div className="mt-4 mb-2.5 flex items-center gap-2">
          <span className="eyebrow">Kontekst</span>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>
        <div className="flex flex-wrap gap-2">
          <ContextChip>
            <IconUser width={12} height={12} className="text-fg-3" />
            Zgłasza: {personLabel(ticket.reporter)}
          </ContextChip>
          <ContextChip>
            <span className="font-mono text-2xs text-fg-2">{code}</span>
            utworzone {ticket.createdLabel}
          </ContextChip>
          <ContextChip>
            Priorytet
            <Chip hue={PRIORITY_META[ticket.priority].hue} size="sm">
              {PRIORITY_META[ticket.priority].label}
            </Chip>
          </ContextChip>
          {ticket.isUrgent ? (
            <ContextChip>
              <IconWarning width={12} height={12} className="text-danger" />
              NATYCHMIAST
            </ContextChip>
          ) : ticket.dueLabel ? (
            <ContextChip>Termin: {ticket.dueLabel}</ContextChip>
          ) : null}
          <ContextChip>
            {ticket.assignee ? (
              <>
                <Avatar name={personLabel(ticket.assignee)} src={ticket.assignee.avatarUrl} size={20} />
                Obsługuje: {personLabel(ticket.assignee)}
              </>
            ) : (
              "Nikt jeszcze nie obsługuje"
            )}
          </ContextChip>
          {ticket.resolvedIn && <ContextChip>Zamknięte w {ticket.resolvedIn}</ContextChip>}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-5 py-2.5 max-md:px-3">
        {canManage ? (
          <Menu>
            <MenuTrigger render={<Button variant="secondary" size="sm" />}>
              Priorytet: {PRIORITY_META[ticket.priority].label}
              <IconChevronDown width={10} height={10} strokeWidth={1.8} />
            </MenuTrigger>
            <MenuContent className="min-w-[180px]">
              <MenuRadioGroup
                value={ticket.priority}
                onValueChange={(v) => patch(ticket.id, { priority: v as SupportPriority })}
              >
                {PRIORITIES.map((p) => (
                  <MenuRadioItem key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuContent>
          </Menu>
        ) : (
          <Chip hue={PRIORITY_META[ticket.priority].hue} size="lg">
            Priorytet: {PRIORITY_META[ticket.priority].label}
          </Chip>
        )}

        {canEditContent &&
          (ticket.isUrgent ? (
            <Button
              variant="secondary"
              size="sm"
              className="border-danger text-danger-text"
              onClick={() => patch(ticket.id, { isUrgent: "false" })}
            >
              <IconWarning width={12} height={12} />
              NATYCHMIAST — wyłącz
            </Button>
          ) : (
            <>
              <div className="w-[220px] max-md:w-full">
                <DateTimePicker
                  name="dueAt"
                  defaultValue={ticket.dueAt}
                  variant="cell"
                  placeholder="Brak terminu"
                  onChange={(iso) => patch(ticket.id, { dueAt: iso })}
                />
              </div>
              <Button variant="secondary" size="sm" onClick={() => patch(ticket.id, { isUrgent: "true" })}>
                <IconWarning width={12} height={12} />
                NATYCHMIAST
              </Button>
            </>
          ))}

        <span className="flex-1" />

        {canEditContent && (
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            <IconPen width={12} height={12} />
            Edytuj treść
          </Button>
        )}
        {canManage && (
          <Button
            size="sm"
            variant={isClosed ? "secondary" : "primary"}
            onClick={() => patch(ticket.id, { status: isClosed ? "IN_PROGRESS" : "RESOLVED" })}
          >
            <IconCheckCircle width={12} height={12} />
            {isClosed ? "Otwórz ponownie" : "Rozwiąż"}
          </Button>
        )}
      </div>

      <footer className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-5 font-mono text-2xs text-muted-foreground max-md:px-3">
        {code} · utworzone {ticket.createdLabel} · zgłasza {personLabel(ticket.reporter)}
      </footer>

      <EditTicketDialog
        ticket={ticket}
        open={editOpen}
        onOpenChange={setEditOpen}
        canEdit={canEditContent}
      />
    </div>
  );
}

function ContextChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-foreground">
      {children}
    </span>
  );
}

function EditTicketDialog({
  ticket,
  open,
  onOpenChange,
  canEdit,
}: {
  ticket: SupportTicketRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}) {
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description);
  const [saving, setSaving] = useState(false);

  const submit = () => {
    const fd = new FormData();
    fd.set("id", ticket.id);
    if (title.trim() !== ticket.title) fd.set("title", title.trim());
    if (description.trim() !== ticket.description) fd.set("description", description.trim());
    setSaving(true);
    startTransition(async () => {
      await updateSupportTicketAction(fd);
      setSaving(false);
      onOpenChange(false);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setTitle(ticket.title);
          setDescription(ticket.description);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Edytuj zgłoszenie</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Temat</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              disabled={!canEdit}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Opis</span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={7}
              maxLength={5000}
              disabled={!canEdit}
            />
          </label>
          {!canEdit && (
            <p className="text-xs text-fg-2">
              Zgłoszenie jest przypisane albo zamknięte — treść może zmienić tylko admin przestrzeni.
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {canEdit ? "Anuluj" : "Zamknij"}
          </Button>
          {canEdit && (
            <Button
              type="button"
              onClick={submit}
              loading={saving}
              disabled={saving || !title.trim() || !description.trim()}
            >
              Zapisz zmiany
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Linki idą przez /api/support-attachment/[...path], który sprawdza dostęp
// i dopiero wtedy przekierowuje na podpisany URL.
function Attachments({
  ticketId,
  attachments,
  currentUserId,
  canManage,
}: {
  ticketId: string;
  attachments: SupportTicketRow["attachments"];
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPick = async (file: File) => {
    setError(null);
    setUploading(true);
    const contentType = inferContentType(file);
    try {
      const req = await requestSupportAttachmentUploadAction(ticketId, file.name, contentType, file.size);
      if (!req.ok) {
        setError(req.error);
        return;
      }
      const put = await fetch(req.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
      if (!put.ok) {
        setError(`Upload nie powiódł się (HTTP ${put.status}).`);
        return;
      }
      const confirmed = await confirmSupportAttachmentUploadAction({
        ticketId,
        storageKey: req.storageKey,
        filename: file.name,
        contentType,
        sizeBytes: file.size,
      });
      if (!confirmed.ok) {
        setError(confirmed.error ?? "Nie udało się zapisać pliku.");
        return;
      }
      router.refresh();
    } catch {
      setError("Upload nie powiódł się — sprawdź połączenie.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      {attachments.map((a) => {
        const canDelete = a.uploaderId === currentUserId || canManage;
        return (
          <span key={a.id} className="flex items-center gap-1.5">
            <IconAttachment width={11} height={11} className="shrink-0 text-fg-3" />
            <a
              href={`/api/support-attachment/${a.storageKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-6 min-w-0 items-center truncate text-2xs text-fg-2 no-underline hover:text-orange-800 hover:underline"
            >
              {a.filename} · {formatFileSize(a.sizeBytes)}
            </a>
            <a
              href={`/api/support-attachment/${a.storageKey}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Otwórz ${a.filename} w nowej karcie`}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
            >
              <IconExternal width={11} height={11} />
            </a>
            {canDelete && (
              <button
                type="button"
                aria-label={`Usuń załącznik ${a.filename}`}
                onClick={() => {
                  if (!confirm("Usunąć ten załącznik?")) return;
                  const fd = new FormData();
                  fd.set("id", a.id);
                  startTransition(async () => {
                    await deleteSupportAttachmentAction(fd);
                    router.refresh();
                  });
                }}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-n-100 hover:text-danger-text active:bg-n-200"
              >
                <IconTrash width={11} height={11} />
              </button>
            )}
          </span>
        );
      })}

      <div className={cn("flex items-center gap-2", attachments.length > 0 && "mt-0.5")}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          loading={uploading}
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <IconUpload width={11} height={11} />
          Dodaj plik
        </Button>
        {error && <span className="text-2xs text-danger-text">{error}</span>}
      </div>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept={ATTACHMENT_ACCEPT}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onPick(f);
        }}
      />
    </div>
  );
}
