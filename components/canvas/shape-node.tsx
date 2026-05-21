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
  // F12-K37: image upload do whiteboard. data.imagePath wskazuje storage
  // key w Supabase bucket'cie attachments.
  | "IMAGE";

export interface ShapeNodeData {
  shape: ShapeKind;
  label: string | null;
  colorHex: string;
  width: number;
  height: number;
  linkedTasks?: NodeTaskChip[];
  workspaceId?: string;
  // F10-W2: emoji reaction counts. Keyed by emoji char, value = count.
  reactions?: Record<string, number>;
  // F10-W3: when true, the node is locked (no drag/resize/delete in UI).
  locked?: boolean;
  // F12-K37: in-place label edit. Gdy true, node renderuje contentEditable
  // input zamiast labela (autofocus, blur/Enter zapisuje). Klient: prompt
  // dwukrotnym kliknięciem był 'dziwny', chce wpisywać 'od razu tam'.
  editing?: boolean;
  // F12-K37: dla shape="IMAGE" — storage key w Supabase. Renderowane
  // jako `/api/canvas-image/<key>` (route handler robi signed redirect).
  imagePath?: string;
  // F12-K37c: opcjonalny override koloru tekstu. Gdy null/undef,
  // tekst jest auto-contrast (czarny na jasnym fillu, biały na ciemnym).
  // Klient może wybrać explicit kolor (czerwony tytuł na białym fillu itp).
  textColorHex?: string | null;
  // F12-K63: opcjonalny override rozmiaru fontu w labelu shape'a.
  // Gdy null/undef:
  //  - dla RECT/DIAMOND/CIRCLE/STICKY: domyślne text-[0.94rem] (~15px)
  //  - dla TEXT shape'a: auto-calc Math.max(14, Math.min(48, height*0.36))
  // Klient zgłosił że nie ma jak zmienić wielkości fontu tekstu w
  // kształcie — F12-K63 wystawia 5 presetów (12/14/18/24/32 px) +
  // "auto" reset, sterowane przez toolbar w canvas-editor.tsx.
  fontSize?: number | null;
  [key: string]: unknown;
}

// F12-K37: 4 connection handles — wszystkie SOURCE; w połączeniu z
// `connectionMode={ConnectionMode.Loose}` w canvas-editor każdy handle
// jest też targetem. Klient: 'mogę połączyć tylko do kropki górnej, chcę
// żeby do każdej'. Każdy handle ma stabilne id, żeby React Flow nie miał
// problemu z DnD trafianiem.
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

// F12-K37: NodeResizer — pozwala drag-em zmieniać szerokość/wysokość.
// onResize aktualizuje data.width/data.height (nasze shape'y używają
// tych pól zamiast RF's measured size, więc musimy je zsync'ować).
// Resizer renderuje się tylko gdy node jest selected.
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

// F12-K37: inline-edit hook — gdy data.editing=true, node renderuje
// contentEditable. Enter / blur zapisuje label, Escape anuluje. Po zapisie
// czyścimy flagę editing w store'rze RF.
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

  // Reset draft when editing mode opens.
  useEffect(() => {
    if (isEditing) {
      setDraft(initialLabel);
      // Autofocus + select-all w mikrotasku, żeby contentEditable był już
      // zamontowany.
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
    // F12-K37: notify canvas-editor żeby zsync'ował z Yjs (RF onNodesChange
    // nie emituje data-delta'ów, więc bez tego label nie persistowałby).
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

// F9-17 / F12-K37: shapes z solid fill (vibrant palette wymaga prostszego
// rendering'u — gradient z white-mix wybielał fill). Każdy kształt ma
// teraz: solid background = data.colorHex, automatic-contrast text color,
// darker accent border. Plus NodeResizer + inline edit.
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
        // F12-K64: TEXT shape teraz spójny z innymi shape'ami — colorHex
        // to TŁO, textColorHex (z auto-contrast fallback'iem) to kolor
        // tekstu. Wcześniej colorHex był text-color → klient nie miał
        // jak ustawić tła. Dwa picker'y w toolbarze (PALETTE → tło,
        // TextColorPicker → tekst) działają teraz na obu wymiarach.
        bgColorHex={d.colorHex}
        textColorHex={d.textColorHex ?? null}
        label={label}
        editing={!!d.editing}
        selected={!!selected}
        locked={!!d.locked}
        // F12-K63: override fontSize; null = fallback do auto-calc po height.
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

  // F12-K37c: text color = user-override (data.textColorHex) albo
  // auto-contrast od fillu (textColorFor).
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

// F12-K37: contentEditable label dla wszystkich shape'ów (poza TEXT/FRAME
// które mają własne renderery). Klucz: gdy data.editing=true, focus +
// select-all natychmiast — user może wpisywać od razu po utworzeniu node'a.
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
  // F12-K63: gdy null → fallback do domyślnego text-[0.94rem] (~15px);
  // gdy liczba → override przez inline style. Tailwind text-* nie da się
  // dynamic'znie computować z runtime'a, więc fontSize idzie przez style.
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
  // Tailwind class jest baseline (~15px); inline fontSize go nadpisuje.
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
        // F12-K37: solid fill (zamiast gradient white-mix → colorHex).
        // Vibrant brand palette potrzebuje czystego koloru żeby nie wyglądał
        // "spłowiale". Klient: 'kolor wybranego kółka/kwadratu wygląda mega źle'.
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
  // F12-K37b: prawdziwy romb przez SVG polygon zamiast rotate(45deg).
  // Klient: 'napraw ten kształt żeby to był romb' — rotacja całego diva
  // dawała przekrzywiony rectangle (bounds wystawały poza shape, label
  // był rotowany razem z fillem co dawało dziwny efekt rounded
  // corner'ów). Polygon idealnie się dopasowuje do width/height.
  const inset = 2; // marginesik na stroke żeby nie był przycinany krawędziami
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
  // Sticky: paper feel via subtle gradient (here we keep light mix because
  // sticky-note backgrounds są tradycyjnie pastelowe — tu colorHex z
  // canvas-editor PALETTE jest już jasny, OK).
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
  // F12-K64: bgColorHex = tło shape'a (white default, dowolny vibrant kolor
  // z PALETTE). textColorHex = explicit kolor tekstu, null = auto-contrast
  // od tła.
  bgColorHex: string;
  textColorHex: string | null;
  label: string;
  editing: boolean;
  selected: boolean;
  locked: boolean;
  // F12-K63: gdy null/undef, używamy auto-calc (height*0.36 clamped 14..48).
  // Gdy ustawiony, klient wybrał konkretny rozmiar z toolbara.
  fontSize: number | null;
}) {
  const { ref, commit, cancel } = useInlineEdit({
    nodeId,
    initialLabel: label,
    isEditing: editing,
  });
  // F12-K64: tekst = explicit override albo auto-contrast od tła. Pale bg
  // → ciemny tekst, dark bg → biały tekst. Mirror logiki z innych shape'ów.
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
          // F12-K64: tło. Pusty/transparent = brak fillu (text-only overlay).
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

// F12-K37: image node. data.imagePath = storage key w bucket'cie
// attachments. Render via `/api/canvas-image/<key>` (signed redirect).
// Resizable jak inne shape'y; brak label'a / colorHex.
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
          // F12-K44 P8: loading="lazy" + decoding="async" — Next.js Image
          // niemożliwy bo /api/canvas-image robi signed redirect (Image
          // optimization wymaga static URL). Browser-native lazy + async
          // decode redukuje main-thread blocking przy dużych canvasach
          // z wieloma obrazami.
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
