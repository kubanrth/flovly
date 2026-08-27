"use client";

import { useState } from "react";
import { Tabs, TabsList, Tab, TabsPanel } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { CommentRow, type CommentItem } from "@/components/task/comments-section";
import { ActivityRow, type ActivityEntry } from "@/components/task/activity-log";
import type { MentionMember } from "@/components/task/mention-list";
import type { TaskMeta } from "@/components/task/task-detail-reads";
import { formatDuration, formatWhen } from "@/components/task/format";

type TimeEntry = TaskMeta["timeEntries"][number];
type FeedItem = { at: string; node: React.ReactNode; key: string };

// Activity block (B2): tabs Wszystko / Komentarze / Historia / Czas pracy (32px, 40px mobile).
export function TaskActivity({ comments, activity, timeEntries, members, canModerateComments, mobile }: {
  comments: CommentItem[];
  activity: ActivityEntry[];
  timeEntries: TimeEntry[];
  members: MentionMember[];
  canModerateComments: boolean;
  mobile?: boolean;
}) {
  const [tab, setTab] = useState("all");
  const commentNodes = comments.map((c) => ({ at: c.createdAt, key: `c-${c.id}`, node: <CommentRow comment={c} canDelete={c.isAuthor || canModerateComments} canEdit={c.isAuthor} members={members} /> }));
  const historyNodes = activity.map((e) => ({ at: e.createdAt, key: `a-${e.id}`, node: <ActivityRow entry={e} /> }));
  const timeNodes = timeEntries.map((t) => ({ at: t.startedAt, key: `t-${t.id}`, node: <TimeEntryRow entry={t} /> }));
  const all = [...commentNodes, ...historyNodes, ...timeNodes].sort((a, b) => (a.at < b.at ? 1 : -1));
  const tabCls = mobile ? "h-10 px-2.5 text-sm" : "h-8 px-2 text-xs";
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(String(v))} data-ui="task-activity" className="mt-4">
      <TabsList className={cn("mb-2.5", mobile && "mb-2.5")}>
        <Tab value="all" className={tabCls}>Wszystko</Tab>
        <Tab value="comments" className={tabCls}>Komentarze</Tab>
        <Tab value="history" className={tabCls}>Historia</Tab>
        <Tab value="time" className={tabCls}>Czas pracy</Tab>
      </TabsList>
      <TabsPanel value="all"><Feed items={all} empty="Brak aktywności." /></TabsPanel>
      <TabsPanel value="comments"><Feed items={commentNodes.sort((a, b) => (a.at < b.at ? 1 : -1))} empty="Brak komentarzy." /></TabsPanel>
      <TabsPanel value="history"><Feed items={historyNodes} empty="Brak wpisów." /></TabsPanel>
      <TabsPanel value="time"><Feed items={timeNodes} empty="Brak wpisów czasu." /></TabsPanel>
    </Tabs>
  );
}

function Feed({ items, empty }: { items: FeedItem[]; empty: string }) {
  if (items.length === 0) return <p className="py-1 text-xs text-fg-3">{empty}</p>;
  return <ol className="flex flex-col gap-3">{items.map((i) => <li key={i.key}>{i.node}</li>)}</ol>;
}

function TimeEntryRow({ entry }: { entry: TimeEntry }) {
  return (
    <div className="flex gap-2">
      <Avatar name={entry.userName} size={24} />
      <p className="min-w-0 flex-1 text-xs leading-[19px] text-n-600">
        <span className="font-semibold text-foreground">{entry.userName}</span> dodał(a) wpis czasu{" "}
        <span className="font-mono text-2xs text-n-700">{formatDuration(entry.durationSeconds)}</span>
        {entry.note ? <span> — {entry.note}</span> : null}{" "}
        <span className="font-mono text-[10px] text-fg-3">· {formatWhen(entry.startedAt)}</span>
      </p>
    </div>
  );
}
