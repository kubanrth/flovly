"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
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
  | "IMAGE";

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
  // null/undef = baseline (text-[0.94rem]); for TEXT shapes auto-calc from height.
  fontSize?: number | null;
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
        colorHex={d.colorHex}
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

  const textColor = d.textColorHex || textColorFor(d.colorHex);
  const accent = accentFor(d.colorHex);
  const selectedRing = selected
    ? "0 0 0 2px color-mix(in oklch, var(--primary) 40%, transparent)"
    : "none";

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
          selected={!!selected}
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
              className="inline-flex max-w-[160px] items-center gap-1 truncate rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground shadow-sm transition-colors hover:border-primary/60 hover:text-foreground nodrag"
              title={c.title}
            >
              # {c.title}
            </a>
          ))}
          {chips.length > 3 && (
            <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground">
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
                className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background px-1.5 py-0.5 text-[0.66rem] font-medium shadow-sm"
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
          className="pointer-events-none absolute -top-2 -right-2 grid h-5 w-5 place-items-center rounded-full bg-muted-foreground/90 text-background shadow"
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

  const fontFamily = isSticky
    ? "ui-serif, Georgia, 'Times New Roman', serif"
    : undefined;
  const fontSizeClass = fontSize ? "" : "text-[0.94rem]";

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
        className={`nodrag select-text px-3 text-center font-display ${fontSizeClass} font-semibold tracking-[-0.01em] leading-tight outline-none`}
        style={{ color: textColor, fontFamily, fontSize: fontSize ?? undefined }}
      >
        {label}
      </div>
    );
  }

  return (
    <span
      className={`pointer-events-none select-none px-3 text-center font-display ${fontSizeClass} font-semibold tracking-[-0.01em] leading-tight`}
      data-label=""
      style={{ color: textColor, fontFamily, fontSize: fontSize ?? undefined }}
    >
      {label || <span className="opacity-50">dwuklik aby nazwać</span>}
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
        borderRadius: 12,
        border: `1.5px solid ${selected ? "var(--primary)" : accent}`,
        boxShadow: `${ringShadow === "none" ? "" : ringShadow + ", "}0 1px 2px rgba(10,10,40,0.04), 0 8px 20px -10px rgba(10,10,40,0.15)`,
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
          filter: "drop-shadow(0 8px 20px rgba(10,10,40,0.2))",
        }}
        preserveAspectRatio="none"
      >
        <polygon
          points={points}
          fill={colorHex}
          stroke={accent}
          strokeWidth={2}
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
        border: `2px solid ${accent}`,
        boxShadow: `${ringShadow === "none" ? "" : ringShadow + ", "}0 10px 24px -12px ${accent}40, 0 2px 4px rgba(10,10,40,0.08)`,
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
  selected: _selected,
  children,
}: {
  width: number;
  height: number;
  colorHex: string;
  ringShadow: string;
  selected: boolean;
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
        borderRadius: 6,
        transform: `rotate(${tilt}deg)`,
        boxShadow: `${ringShadow === "none" ? "" : ringShadow + ", "}
          0 1px 2px rgba(0,0,0,0.06),
          0 6px 14px -8px rgba(0,0,0,0.18),
          0 20px 30px -18px rgba(0,0,0,0.22),
          inset 0 -2px 4px rgba(0,0,0,0.04)`,
        color: text,
        position: "relative",
      }}
      className="grid place-items-center"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-3 w-3"
        style={{
          background: `linear-gradient(225deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 60%)`,
          borderTopRightRadius: 6,
        }}
      />
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
  const ink = textColorHex ?? (isPaleHex(bgColorHex) ? "#1F2937" : "#FFFFFF");
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
          boxShadow: selected
            ? "0 0 0 2px color-mix(in oklch, var(--primary) 40%, transparent)"
            : "none",
          borderRadius: 6,
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
  colorHex,
  label,
  editing,
  selected,
  locked,
}: {
  nodeId: string;
  width: number;
  height: number;
  colorHex: string;
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
  const accent = selected
    ? "var(--primary)"
    : "color-mix(in oklch, currentColor 40%, var(--border))";
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
          background: `
            linear-gradient(135deg, color-mix(in oklch, ${colorHex} 60%, transparent) 0%, color-mix(in oklch, ${colorHex} 20%, transparent) 100%)
          `,
          border: `2px dashed ${accent}`,
          borderRadius: 14,
          position: "relative",
          boxShadow: selected
            ? "0 0 0 2px color-mix(in oklch, var(--primary) 40%, transparent)"
            : "none",
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
            className="nodrag absolute -top-3 left-3 select-text rounded-md bg-card px-2 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] outline-none"
            style={{
              color: accent,
              border: `1px solid ${accent}`,
            }}
          >
            {label}
          </div>
        ) : (
          <div
            className="absolute -top-3 left-3 rounded-md bg-card px-2 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em]"
            style={{
              color: accent,
              border: `1px solid ${accent}`,
            }}
          >
            {label || "frame"}
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
            ? "0 0 0 2px color-mix(in oklch, var(--primary) 40%, transparent), 0 8px 20px -10px rgba(10,10,40,0.2)"
            : "0 1px 2px rgba(10,10,40,0.05), 0 8px 20px -10px rgba(10,10,40,0.15)",
          background: imagePath ? "transparent" : "var(--muted)",
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
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return "var(--primary)";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (y > 0.92) return "#7B68EE";
  const darken = (n: number) => Math.max(0, Math.round(n * 0.75));
  const hx = (n: number) => darken(n).toString(16).padStart(2, "0");
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

function textColorFor(hex: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return "#0F172A";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return y > 0.6 ? "#0F172A" : "#FFFFFF";
}
