import {
  CheckCircle2,
  Edit3,
  Plus,
  Trash2,
  UserPlus,
  UserMinus,
  Tag as TagIcon,
  MessageSquare,
  MessageSquarePlus,
  MessageSquareX,
  type LucideIcon,
} from "lucide-react";
import { plPlural } from "@/lib/pluralize";

export interface ActivityEntry {
  id: string;
  action: string;
  actor: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
  diff: Record<string, unknown> | null;
  createdAt: string;
}

export function ActivityLog({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <span className="eyebrow">Historia aktywności</span>
        <p className="text-[0.88rem] text-muted-foreground">Brak wpisów.</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <span className="eyebrow">Historia aktywności</span>
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
          {entries.length}
        </span>
      </div>
      {/* Timeline rail — 1px vertical brand-faint line linking icons. The
          rail lives inside <ol> via a pseudo-element on each row's icon
          column (`::before`) so it scales perfectly with content height
          without absolute-positioned overlays. Last row trims the rail. */}
      <ol className="flex flex-col">
        {entries.map((e, i) => (
          <li key={e.id}>
            <Row entry={e} isLast={i === entries.length - 1} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Row({ entry, isLast }: { entry: ActivityEntry; isLast: boolean }) {
  const { icon: Icon, tone } = iconFor(entry.action);
  const actorName =
    entry.actor?.name ?? entry.actor?.email.split("@")[0] ?? "System";
  const summary = summarize(entry.action, entry.diff);

  return (
    <div className="group relative flex items-start gap-3 rounded-md px-3 py-2 pb-3 transition-colors hover:bg-accent/40">
      {/* Icon column: 7x7 circle on top, then 1px rail beneath. */}
      <span className="relative flex shrink-0 flex-col items-center self-stretch">
        <span
          className={`grid h-7 w-7 place-items-center rounded-full ${tone}`}
          aria-hidden
        >
          <Icon size={12} />
        </span>
        {!isLast && (
          // Brand-faint vertical connector — 1px line, sits centered under
          // the 7x7 avatar. The 8x8 dot is layered on the rail to mark the
          // entry anchor point (spec).
          <span
            aria-hidden
            className="mt-1 w-px flex-1 bg-[color-mix(in_oklch,var(--accent-brand)_22%,transparent)]"
          />
        )}
        {!isLast && (
          <span
            aria-hidden
            className="absolute left-1/2 top-[calc(1.75rem+0.25rem)] h-2 w-2 -translate-x-1/2 rounded-full bg-[color-mix(in_oklch,var(--accent-brand)_55%,transparent)] ring-2 ring-background"
          />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-[0.88rem] leading-tight">
          <span className="font-semibold text-foreground">{actorName}</span>{" "}
          <span className="text-muted-foreground">{summary}</span>
        </p>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/80">
          {formatAbsolute(entry.createdAt)}
        </span>
      </div>
    </div>
  );
}

function iconFor(action: string): { icon: LucideIcon; tone: string } {
  const tones = {
    positive: "bg-[color-mix(in_oklch,var(--accent-brand)_18%,transparent)] text-primary",
    negative: "bg-destructive/10 text-destructive",
    neutral: "bg-muted text-muted-foreground",
  };
  if (action === "task.created") return { icon: Plus, tone: tones.positive };
  if (action === "task.deleted") return { icon: Trash2, tone: tones.negative };
  if (action === "task.updated" || action === "task.patched") {
    return { icon: Edit3, tone: tones.neutral };
  }
  if (action === "task.assigneeAdded") return { icon: UserPlus, tone: tones.positive };
  if (action === "task.assigneeRemoved") return { icon: UserMinus, tone: tones.negative };
  if (action === "task.tagAdded" || action === "task.tagRemoved") {
    return { icon: TagIcon, tone: tones.neutral };
  }
  if (action === "comment.created") return { icon: MessageSquarePlus, tone: tones.positive };
  if (action === "comment.updated") return { icon: MessageSquare, tone: tones.neutral };
  if (action === "comment.deleted") return { icon: MessageSquareX, tone: tones.negative };
  return { icon: CheckCircle2, tone: tones.neutral };
}

function summarize(action: string, diff: Record<string, unknown> | null): string {
  switch (action) {
    case "task.created":
      return "utworzył(a) zadanie.";
    case "task.deleted":
      return "usunął(-ęła) zadanie.";
    case "task.updated":
      return "zaktualizował(a) zadanie.";
    case "task.patched": {
      const keys = diff ? Object.keys(diff) : [];
      if (keys.length === 0) return "zmodyfikował(a) zadanie.";
      return `zmienił(a) ${keys.map((k) => FIELD_LABELS[k] ?? k).join(", ")}.`;
    }
    case "task.assigneeAdded":
      return "przypisał(a) osobę do zadania.";
    case "task.assigneeRemoved":
      return "odpiął(-ęła) osobę od zadania.";
    case "task.tagAdded":
      return "dodał(a) tag.";
    case "task.tagRemoved":
      return "usunął(-ęła) tag.";
    case "comment.created": {
      const mentions = (diff?.mentions as string[] | undefined) ?? [];
      return mentions.length > 0
        ? `dodał(a) komentarz i oznaczył(a) ${mentions.length} ${plPlural(mentions.length, "osobę", "osoby", "osób")}.`
        : "dodał(a) komentarz.";
    }
    case "comment.updated": {
      const added = (diff?.mentionsAdded as string[] | undefined) ?? [];
      const removed = (diff?.mentionsRemoved as string[] | undefined) ?? [];
      if (added.length + removed.length === 0) return "edytował(a) komentarz.";
      return `edytował(a) komentarz (mentions: +${added.length}/-${removed.length}).`;
    }
    case "comment.deleted":
      return "usunął(-ęła) komentarz.";
    default:
      return action;
  }
}

const FIELD_LABELS: Record<string, string> = {
  title: "tytuł",
  statusColumnId: "status",
  startAt: "datę startu",
  stopAt: "datę końca",
  rowOrder: "kolejność",
};

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
