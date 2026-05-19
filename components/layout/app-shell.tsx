import type { ReactNode } from "react";

// Shared outer shell for every sidebar-driven page that isn't a board
// view (Inbox, My Tasks, TO DO, Calendar, Workspaces, Wiki, Workspace
// overview). Guarantees identical viewport width + padding so content
// doesn't shift when the user jumps between them.
//
// Board-view pages use `<BoardShell>` instead, which is wider
// (max-w-[1400px]) to fit Kanban + Gantt.
export function AppShell({ children }: { children: ReactNode }) {
  // F12-K57: mobile padding zmniejszony z px-8 py-12 → px-4 py-6 (32→16
  // horizontal, 48→24 vertical). Top-padding pod hamburger'a załatwia
  // global spacer w app/(app)/layout.tsx, więc tu już nie powtarzamy.
  return (
    <main className="flex-1 px-4 py-6 md:px-14 md:py-16">
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </main>
  );
}
