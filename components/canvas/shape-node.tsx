"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { BORDER_ON_WHITE, DEFAULT_NODE_FILL, INK_DEFAULT, INK_ON_DARK, INK_ON_PALE, V5_ACCENT } from "./palettes";
import { Lock } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { IconExternal } from "@/components/ui/icons";
import { hueForColor } from "@/components/ui/status-hue";
import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  type NodeProps,
} from "@xyflow/react";

export interface NodeTaskChip {
  taskId: string;
  title: string;
}

export type ShapeKind =
  | "RECTANGLE"
  | "DIAMOND"
  | "CIRCLE"
  | "STICKY"
  | "FRAME"
  | "TEXT"
  // data.imagePath points to storage key in Supabase `attachments` bucket.
  | "IMAGE"
  // F12-K73: Task Line node. data trzyma { taskId, taskTitle, statusName,
  // statusColor, flowMark }. Renderuje się jako task card z opcjonalnym
  // start/end ring'iem.
  | "TASK_REF";

export interface ShapeNodeData {
  shape: ShapeKind;
  label: string | null;
  colorHex: string;
  width: number;
  height: number;
  linkedTasks?: NodeTaskChip[];
  workspaceId?: string;
  // Emoji reaction counts keyed by emoji char.
  reactions?: Record<string, number>;
  // Locked nodes have no drag/resize/delete in UI.
  locked?: boolean;
  // In-place label edit — contentEditable replaces label; blur/Enter saves.
  editing?: boolean;
  // Storage key in Supabase for IMAGE shapes — served via /api/canvas-image/<key> signed redirect.
  imagePath?: string;
  // null/undef = auto-contrast text color from fill.
  textColorHex?: string | null;
  // null/undef = baseline; for TEXT shapes auto-calc from height.
  fontSize?: number | null;
  // TASK_REF: numer zadania w tablicy (#ID) — rehydratowany z listy zadań.
  displayId?: number | null;
  [key: string]: unknown;
}

// All SOURCE handles — ConnectionMode.Loose in canvas-editor makes each handle a target too.
function ShapeHandles() {
  return (
    <>
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
    </>
  );
}

// Syncs data.width/data.height alongside RF's measured size — our shapes read from data.* directly.
function ShapeResizer({
  nodeId,
  visible,
  minWidth = 80,
  minHeight = 40,
  keepAspectRatio = false,
}: {
  nodeId: string;
  visible: boolean;
  minWidth?: number;
  minHeight?: number;
  keepAspectRatio?: boolean;
}) {
  const rf = useReactFlow();
  const onResize = useCallback(
    (_e: unknown, params: { width: number; height: number }) => {
      rf.setNodes((ns) =>
        ns.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  width: params.width,
                  height: params.height,
                },
                width: params.width,
                height: params.height,
              }
            : n,
        ),
      );
    },
    [nodeId, rf],
  );
  const onResizeEnd = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("canvas-node:commit", { detail: { nodeId } }),
      );
    }
  }, [nodeId]);
  return (
    <NodeResizer
      isVisible={visible}
      minWidth={minWidth}
      minHeight={minHeight}
      keepAspectRatio={keepAspectRatio}
      onResize={onResize}
      onResizeEnd={onResizeEnd}
      lineClassName="!border-primary/40"
      handleClassName="!bg-primary !border-primary !w-2 !h-2"
    />
  );
}

// Enter/blur saves and clears editing flag; Escape cancels.
function useInlineEdit({
  nodeId,
  initialLabel,
  isEditing,
}: {
  nodeId: string;
  initialLabel: string;
  isEditing: boolean;
}): {
  draft: string;
  setDraft: (v: string) => void;
  ref: React.RefObject<HTMLDivElement | null>;
  commit: () => void;
  cancel: () => void;
} {
  const rf = useReactFlow();
  const [draft, setDraft] = useState(initialLabel);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isEditing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(initialLabel);
      // Autofocus + select-all in next frame — contentEditable must be mounted first.
      requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const commit = useCallback(() => {
    const next = (ref.current?.textContent ?? draft).trim();
    rf.setNodes((ns) =>
      ns.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, label: next || null, editing: false } }
          : n,
      ),
    );
    // RF onNodesChange doesn't emit data-deltas — fire custom event so canvas-editor can sync to Yjs.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("canvas-node:commit", { detail: { nodeId } }),
      );
    }
  }, [nodeId, rf, draft]);

  const cancel = useCallback(() => {
    rf.setNodes((ns) =>
      ns.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, editing: false } } : n,
      ),
    );
  }, [nodeId, rf]);

  return { draft, setDraft, ref, commit, cancel };
}

export const ShapeNode = memo(function ShapeNode({
  id,
  data,
  selected,
}: NodeProps) {
  const d = data as ShapeNodeData;
  const label = d.label ?? "";

  if (d.shape === "FRAME") {
    return (
      <FrameShape
        nodeId={id}
        width={d.width}
        height={d.height}
        label={label}
        editing={!!d.editing}
        selected={!!selected}
        locked={!!d.locked}
      />
    );
  }

  if (d.shape === "TEXT") {
    return (
      <TextShape
        nodeId={id}
        width={d.width}
        height={d.height}
        bgColorHex={d.colorHex}
        textColorHex={d.textColorHex ?? null}
        label={label}
        editing={!!d.editing}
        selected={!!selected}
        locked={!!d.locked}
        fontSize={d.fontSize ?? null}
      />
    );
  }

  if (d.shape === "IMAGE") {
    return (
      <ImageShape
        nodeId={id}
        width={d.width}
        height={d.height}
        imagePath={d.imagePath ?? null}
        selected={!!selected}
        locked={!!d.locked}
      />
    );
  }

  // F12-K73: Task Line reference node — task card z opcjonalnym start/end
  // ring'iem + badge.
  if (d.shape === "TASK_REF") {
    return (
      <TaskRefShape
        nodeId={id}
        width={d.width}
        height={d.height}
        colorHex={d.colorHex}
        taskId={(d.taskId as string | null) ?? null}
        taskTitle={(d.taskTitle as string | null) ?? null}
        displayId={typeof d.displayId === "number" ? d.displayId : null}
        statusName={(d.statusName as string | null) ?? null}
        statusColor={(d.statusColor as string | null) ?? null}
        flowMark={(d.flowMark as "start" | "end" | null | undefined) ?? null}
        workspaceId={(d.workspaceId as string | undefined) ?? null}
        selected={!!selected}
      />
    );
  }

  const textColor = d.textColorHex || textColorFor(d.colorHex);
  const accent = accentFor(d.colorHex);
  const selectedRing = selected ? "0 0 0 2px var(--orange-500)" : "none";

  const inline = (
    <ShapeLabel
      nodeId={id}
      label={label}
      editing={!!d.editing}
      textColor={textColor}
      isSticky={d.shape === "STICKY"}
      fontSize={d.fontSize ?? null}
    />
  );

  const chips = d.linkedTasks ?? [];

  return (
    <>
      <ShapeResizer
        nodeId={id}
        visible={!!selected && !d.locked}
        minWidth={d.shape === "CIRCLE" ? 80 : 80}
        minHeight={d.shape === "CIRCLE" ? 80 : 40}
        keepAspectRatio={d.shape === "CIRCLE" || d.shape === "DIAMOND"}
      />
      <ShapeHandles />

      {d.shape === "DIAMOND" ? (
        <DiamondShape
          width={d.width}
          height={d.height}
          colorHex={d.colorHex}
          accent={accent}
          textColor={textColor}
          ringShadow={selectedRing}
        >
          {inline}
        </DiamondShape>
      ) : d.shape === "CIRCLE" ? (
        <CircleShape
          width={d.width}
          height={d.height}
          colorHex={d.colorHex}
          accent={accent}
          textColor={textColor}
          ringShadow={selectedRing}
        >
          {inline}
        </CircleShape>
      ) : d.shape === "STICKY" ? (
        <StickyShape
          width={d.width}
          height={d.height}
          colorHex={d.colorHex}
          ringShadow={selectedRing}
        >
          {inline}
        </StickyShape>
      ) : (
        <RectangleShape
          width={d.width}
          height={d.height}
          colorHex={d.colorHex}
          accent={accent}
          ringShadow={selectedRing}
          selected={!!selected}
        >
          {inline}
        </RectangleShape>
      )}

      {chips.length > 0 && d.workspaceId && (
        <div
          className="pointer-events-auto absolute -bottom-3 left-1/2 flex max-w-[calc(100%+40px)] -translate-x-1/2 flex-wrap justify-center gap-1"
          data-chips=""
        >
          {chips.slice(0, 3).map((c) => (
            <a
              key={c.taskId}
              href={`/w/${d.workspaceId}/t/${c.taskId}`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="nodrag inline-flex max-w-[160px] items-center gap-1 truncate rounded-sm border border-border bg-card px-1.5 py-0.5 text-2xs font-medium text-fg-2 shadow-sm transition-colors duration-150 ease-out hover:bg-n-50 hover:text-foreground focus-visible:shadow-[var(--focus)] focus-visible:outline-none"
              title={c.title}
            >
              # {c.title}
            </a>
          ))}
          {chips.length > 3 && (
            <span className="inline-flex items-center rounded-sm border border-border bg-card px-1.5 py-0.5 text-2xs font-medium text-fg-2">
              +{chips.length - 3}
            </span>
          )}
        </div>
      )}

      {d.reactions && Object.keys(d.reactions).length > 0 && (
        <div
          className="pointer-events-auto absolute -top-3 left-1/2 flex max-w-[calc(100%+60px)] -translate-x-1/2 flex-wrap justify-center gap-1"
          data-reactions=""
        >
          {Object.entries(d.reactions)
            .filter(([, c]) => c > 0)
            .slice(0, 6)
            .map(([emoji, count]) => (
              <span
                key={emoji}
                className="inline-flex items-center gap-0.5 rounded-sm border border-border bg-card px-1.5 py-0.5 text-2xs font-medium shadow-sm"
              >
                <span>{emoji}</span>
                {count > 1 && <span className="text-muted-foreground">{count}</span>}
              </span>
            ))}
        </div>
      )}

      {d.locked && (
        <span
          aria-label="Zablokowany"
          title="Zablokowany"
          className="pointer-events-none absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-n-600 text-n-0 shadow-sm"
        >
          <Lock size={9} />
        </span>
      )}
    </>
  );
});

// ContentEditable label for all shapes (TEXT/FRAME use their own renderers).
function ShapeLabel({
  nodeId,
  label,
  editing,
  textColor,
  isSticky,
  fontSize,
}: {
  nodeId: string;
  label: string;
  editing: boolean;
  textColor: string;
  isSticky: boolean;
  // null = Tailwind baseline class; number = inline style override (Tailwind text-* can't be runtime-computed).
  fontSize: number | null;
}) {
  const { ref, commit, cancel } = useInlineEdit({
    nodeId,
    initialLabel: label,
    isEditing: editing,
  });

  // B9: karteczka = 13/19 od lewej; pozostałe kształty 12/500 na środku.
  const fontSizeClass = fontSize ? "" : isSticky ? "text-sm" : "text-xs";
  const align = isSticky ? "w-full text-left leading-[19px]" : "text-center leading-tight";

  if (editing) {
    return (
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
          e.stopPropagation();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={`nodrag select-text ${isSticky ? "" : "px-3"} ${align} ${fontSizeClass} font-medium outline-none`}
        style={{ color: textColor, fontSize: fontSize ?? undefined }}
      >
        {label}
      </div>
    );
  }

  return (
    <span
      className={`pointer-events-none select-none ${isSticky ? "" : "px-3"} ${align} ${fontSizeClass} font-medium`}
      data-label=""
      style={{ color: textColor, fontSize: fontSize ?? undefined }}
    >
      {label || <span className="text-fg-3">dwuklik aby nazwać</span>}
    </span>
  );
}

// --- Per-shape renderers ---

function RectangleShape({
  width,
  height,
  colorHex,
  accent,
  ringShadow,
  selected,
  children,
}: {
  width: number;
  height: number;
  colorHex: string;
  accent: string;
  ringShadow: string;
  selected: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width,
        height,
        background: colorHex,
        borderRadius: 6,
        border: `1px solid ${selected ? "var(--orange-500)" : accent}`,
        boxShadow: ringShadow === "none" ? "var(--shadow-sm)" : ringShadow,
        position: "relative",
      }}
      className="grid place-items-center overflow-hidden"
    >
      {children}
    </div>
  );
}

function DiamondShape({
  width,
  height,
  colorHex,
  accent,
  textColor,
  ringShadow,
  children,
}: {
  width: number;
  height: number;
  colorHex: string;
  accent: string;
  textColor: string;
  ringShadow: string;
  children: React.ReactNode;
}) {
  // SVG polygon instead of rotate(45deg) — proper diamond bounds (no rotated-rectangle overflow).
  const inset = 2;
  const points = `${width / 2},${inset} ${width - inset},${height / 2} ${width / 2},${height - inset} ${inset},${height / 2}`;
  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        boxShadow: ringShadow === "none" ? undefined : ringShadow,
        color: textColor,
      }}
      className="grid place-items-center"
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          position: "absolute",
          inset: 0,
          filter: "drop-shadow(0 1px 2px rgba(20,17,13,.06))",
        }}
        preserveAspectRatio="none"
      >
        <polygon
          points={points}
          fill={colorHex}
          stroke={accent}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </svg>
      <div className="pointer-events-none relative z-[1] grid place-items-center px-3 text-center">
        {children}
      </div>
    </div>
  );
}

function CircleShape({
  width,
  height,
  colorHex,
  accent,
  textColor,
  ringShadow,
  children,
}: {
  width: number;
  height: number;
  colorHex: string;
  accent: string;
  textColor: string;
  ringShadow: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width,
        height,
        background: colorHex,
        borderRadius: "50%",
        border: `1.5px solid ${accent}`,
        boxShadow: ringShadow === "none" ? "var(--shadow-sm)" : ringShadow,
        color: textColor,
      }}
      className="grid place-items-center"
    >
      {children}
    </div>
  );
}

function StickyShape({
  width,
  height,
  colorHex,
  ringShadow,
  children,
}: {
  width: number;
  height: number;
  colorHex: string;
  ringShadow: string;
  children: React.ReactNode;
}) {
  const tilt = ((Math.abs(hashFromString(colorHex)) % 5) - 2) * 0.6;
  const text = textColorFor(colorHex);
  return (
    <div
      style={{
        width,
        height,
        background: colorHex,
        borderRadius: 4,
        border: `1px solid ${accentFor(colorHex)}`,
        transform: `rotate(${tilt}deg)`,
        boxShadow:
          ringShadow === "none"
            ? "var(--shadow-e1)"
            : `${ringShadow}, var(--shadow-e1)`,
        color: text,
        position: "relative",
      }}
      className="grid items-start justify-items-start p-3"
    >
      {children}
    </div>
  );
}

function TextShape({
  nodeId,
  width,
  height,
  bgColorHex,
  textColorHex,
  label,
  editing,
  selected,
  locked,
  fontSize: fontSizeOverride,
}: {
  nodeId: string;
  width: number;
  height: number;
  // textColorHex null = auto-contrast from bg.
  bgColorHex: string;
  textColorHex: string | null;
  label: string;
  editing: boolean;
  selected: boolean;
  locked: boolean;
  // null = auto-calc from height (clamped 14..48).
  fontSize: number | null;
}) {
  const { ref, commit, cancel } = useInlineEdit({
    nodeId,
    initialLabel: label,
    isEditing: editing,
  });
  const ink = textColorHex ?? (isPaleHex(bgColorHex) ? INK_ON_PALE : INK_ON_DARK);
  const fontSize = fontSizeOverride ?? Math.max(14, Math.min(48, height * 0.36));
  return (
    <>
      <ShapeResizer nodeId={nodeId} visible={selected && !locked} minWidth={80} minHeight={40} />
      <ShapeHandles />
      <div
        style={{
          width,
          height,
          // Empty/transparent bg = text-only overlay.
          background:
            bgColorHex && bgColorHex !== "transparent" ? bgColorHex : "transparent",
          boxShadow: selected ? "0 0 0 2px var(--orange-500)" : "none",
          borderRadius: 4,
        }}
        className="grid place-items-center px-2"
      >
        {editing ? (
          <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
              e.stopPropagation();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="nodrag select-text text-center font-display tracking-[-0.01em] outline-none"
            style={{
              color: ink,
              fontSize,
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            {label}
          </div>
        ) : (
          <span
            className="pointer-events-none select-none text-center font-display tracking-[-0.01em]"
            style={{
              color: ink,
              fontSize,
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            {label || (
              <span style={{ color: ink, opacity: 0.4, fontWeight: 500 }}>
                dwuklik aby pisać
              </span>
            )}
          </span>
        )}
      </div>
    </>
  );
}

function FrameShape({
  nodeId,
  width,
  height,
  label,
  editing,
  selected,
  locked,
}: {
  nodeId: string;
  width: number;
  height: number;
  label: string;
  editing: boolean;
  selected: boolean;
  locked: boolean;
}) {
  const { ref, commit, cancel } = useInlineEdit({
    nodeId,
    initialLabel: label,
    isEditing: editing,
  });
  const accent = selected ? "var(--orange-500)" : "var(--n-400)";
  return (
    <>
      <ShapeResizer
        nodeId={nodeId}
        visible={selected && !locked}
        minWidth={200}
        minHeight={140}
      />
      <ShapeHandles />
      <div
        style={{
          width,
          height,
          background: "rgba(255,255,255,.6)",
          border: `1.5px solid ${accent}`,
          borderRadius: 8,
          position: "relative",
          boxShadow: "none",
        }}
      >
        {editing ? (
          <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
              e.stopPropagation();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="nodrag absolute -top-[11px] left-3 select-text bg-canvas px-1.5 text-2xs font-semibold uppercase tracking-[.06em] leading-[16px] outline-none"
            style={{ color: selected ? "var(--orange-700)" : "var(--fg-2)" }}
          >
            {label}
          </div>
        ) : (
          <div
            className="absolute -top-[11px] left-3 bg-canvas px-1.5 text-2xs font-semibold uppercase tracking-[.06em] leading-[16px]"
            style={{ color: selected ? "var(--orange-700)" : "var(--fg-2)" }}
          >
            {label || "Ramka"}
          </div>
        )}
      </div>
    </>
  );
}

// Rendered via /api/canvas-image/<key> (signed redirect); no label/colorHex.
function ImageShape({
  nodeId,
  width,
  height,
  imagePath,
  selected,
  locked,
}: {
  nodeId: string;
  width: number;
  height: number;
  imagePath: string | null;
  selected: boolean;
  locked: boolean;
}) {
  return (
    <>
      <ShapeResizer
        nodeId={nodeId}
        visible={selected && !locked}
        minWidth={60}
        minHeight={60}
        keepAspectRatio={false}
      />
      <ShapeHandles />
      <div
        style={{
          width,
          height,
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: selected
            ? "0 0 0 2px var(--orange-500), var(--shadow-e1)"
            : "var(--shadow-e1)",
          background: imagePath ? "transparent" : "var(--n-100)",
        }}
        className="grid place-items-center"
      >
        {imagePath ? (
          // Next.js Image won't work — signed redirect breaks its static-URL requirement.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/canvas-image/${encodeURI(imagePath)}`}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              userSelect: "none",
            }}
          />
        ) : (
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
            ładowanie obrazu…
          </span>
        )}
      </div>
    </>
  );
}

// Stable per-string hash → tiny float, used for deterministic sticky tilt.
function hashFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

function isPaleHex(hex: string): boolean {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return true;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.85;
}

// --- Color helpers ---

function accentFor(hex: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return "var(--orange-500)";
  const v5 = V5_ACCENT[hex.toUpperCase()];
  if (v5) return v5;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (y > 0.92) return BORDER_ON_WHITE;
  const darken = (n: number) => Math.max(0, Math.round(n * 0.75));
  const hx = (n: number) => darken(n).toString(16).padStart(2, "0");
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

function textColorFor(hex: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return INK_DEFAULT;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return y > 0.6 ? INK_DEFAULT : INK_ON_DARK;
}

// Karta zadania na kanwie (B9): nagłówek #ID + chip statusu + „otwórz",
// tytuł 13/500. Podwójny klik otwiera zadanie. flowMark z Linii zadań
// pokazujemy jako mały chip, żeby oznaczenie nie znikało z widoku.
function TaskRefShape({
  nodeId,
  width,
  height,
  colorHex,
  taskId,
  taskTitle,
  displayId,
  statusName,
  statusColor,
  flowMark,
  workspaceId,
  selected,
}: {
  nodeId: string;
  width: number;
  height: number;
  // Color picker recoloruje TASK_REF tak samo jak STICKY (klient: „dodaj
  // opcje zmieniania kolorow tez tych zadan"). Domyślnie biel.
  colorHex: string;
  taskId: string | null;
  taskTitle: string | null;
  displayId: number | null;
  statusName: string | null;
  statusColor: string | null;
  flowMark: "start" | "end" | null | undefined;
  workspaceId: string | null;
  selected: boolean;
}) {
  const hue = hueForColor(statusColor);
  return (
    <>
      <ShapeResizer nodeId={nodeId} visible={selected} minWidth={200} minHeight={90} />
      <ShapeHandles />
      <div
        style={{
          width,
          height,
          background: colorHex || DEFAULT_NODE_FILL,
          boxShadow: selected
            ? "0 0 0 2px var(--orange-500), var(--shadow-e1)"
            : "var(--shadow-e1)",
          cursor: workspaceId && taskId ? "pointer" : "default",
        }}
        className="flex flex-col overflow-hidden rounded-lg border border-border"
        onDoubleClick={() => {
          if (workspaceId && taskId && typeof window !== "undefined") {
            window.open(`/w/${workspaceId}/t/${taskId}`, "_self");
          }
        }}
      >
        <div className="flex items-center gap-1.5 border-b border-n-100 px-2.5 py-2">
          {displayId !== null && (
            <span className="font-mono text-2xs text-fg-2">#{displayId}</span>
          )}
          {statusName && (
            <Chip hue={hue} size="sm" dot>
              {statusName}
            </Chip>
          )}
          {flowMark && (
            <Chip hue={flowMark === "start" ? "green" : "red"} size="sm">
              {flowMark === "start" ? "Start" : "Koniec"}
            </Chip>
          )}
          {workspaceId && taskId && (
            <span className="ml-auto text-fg-3">
              <IconExternal width={12} height={12} />
            </span>
          )}
        </div>
        <div className="line-clamp-3 px-2.5 py-2.5 text-sm font-medium leading-[18px] text-foreground">
          {taskTitle ?? "(zadanie usunięte)"}
        </div>
      </div>
    </>
  );
}
