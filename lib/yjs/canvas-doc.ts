// Yjs data model for a whiteboard canvas.
//
// Two root Y.Maps: one for nodes, one for edges. Each entry is itself a
// Y.Map so field-level changes (e.g. `x` drag) can merge independently —
// if two peers edit the same node, Yjs CRDT resolves field-by-field.
//
// Local UI (React Flow) reads derived plain objects on every Yjs
// update; writes happen via mutator helpers below so we don't scatter
// Y.Map.set() calls across the editor.

import * as Y from "yjs";

export const SHAPES = [
  "RECTANGLE",
  "DIAMOND",
  "CIRCLE",
  "STICKY",
  "FRAME",
  "TEXT",
  "IMAGE",
] as const;
export type CanvasShape = (typeof SHAPES)[number];
export const EDGE_ENDS = ["arrow", "none", "diamond", "circle"] as const;
export type CanvasEdgeEnd = (typeof EDGE_ENDS)[number];

export interface CanvasNodeValue {
  id: string;
  shape: CanvasShape;
  label: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  colorHex: string;
  // Emoji → count. Plain Record (nie Y.Map) — reactions są rzadkie,
  // full overwrite tańszy niż per-node Y.Map.
  reactions?: Record<string, number>;
  // Locked node = nie da się move/resize/delete via React Flow.
  locked?: boolean;
  // shape="IMAGE" only — Supabase Storage key relatywny do attachments.
  imagePath?: string | null;
  // null/undef = auto-contrast od colorHex.
  textColorHex?: string | null;
  // null/undef = bazowy rozmiar (15px albo auto-calc po height dla TEXT).
  fontSize?: number | null;
}

export interface CanvasEdgeValue {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label: string | null;
  style: "solid" | "dashed";
  endStyle: CanvasEdgeEnd;
}

export type InitialNode = CanvasNodeValue;
export type InitialEdge = CanvasEdgeValue;

// Pen-tool strokes. Y.Map keyed by stroke id so concurrent erases merge
// cleanly. Points flat [x0,y0,x1,y1…] — avoids JSON parse/stringify per stroke.
export interface CanvasStrokeValue {
  id: string;
  colorHex: string;
  size: number;
  points: number[]; // flat: [x0, y0, x1, y1, …]
}

export interface CanvasYRefs {
  ydoc: Y.Doc;
  nodes: Y.Map<Y.Map<unknown>>;
  edges: Y.Map<Y.Map<unknown>>;
  strokes: Y.Map<Y.Map<unknown>>;
}

export const LOCAL_ORIGIN = Symbol("canvas:local");
export const REMOTE_ORIGIN = Symbol("canvas:remote");
export const SEED_ORIGIN = Symbol("canvas:seed");

export function createCanvasYDoc(): CanvasYRefs {
  const ydoc = new Y.Doc();
  const nodes = ydoc.getMap<Y.Map<unknown>>("nodes");
  const edges = ydoc.getMap<Y.Map<unknown>>("edges");
  const strokes = ydoc.getMap<Y.Map<unknown>>("strokes");
  return { ydoc, nodes, edges, strokes };
}

// Bulk-seed on open. Uses SEED_ORIGIN so the editor can skip any
// spurious "new doc just mutated" observer call on mount.
export function seedCanvasDoc(
  refs: CanvasYRefs,
  initialNodes: InitialNode[],
  initialEdges: InitialEdge[],
  initialStrokes: CanvasStrokeValue[] = [],
): void {
  refs.ydoc.transact(() => {
    for (const n of initialNodes) setNodeValue(refs.nodes, n);
    for (const e of initialEdges) setEdgeValue(refs.edges, e);
    for (const s of initialStrokes) setStrokeValue(refs.strokes, s);
  }, SEED_ORIGIN);
}

function toNodeYMap(node: CanvasNodeValue): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  m.set("shape", node.shape);
  m.set("label", node.label);
  m.set("x", node.x);
  m.set("y", node.y);
  m.set("width", node.width);
  m.set("height", node.height);
  m.set("colorHex", node.colorHex);
  if (node.reactions) m.set("reactions", node.reactions);
  if (node.locked) m.set("locked", true);
  if (node.imagePath) m.set("imagePath", node.imagePath);
  if (node.textColorHex) m.set("textColorHex", node.textColorHex);
  if (typeof node.fontSize === "number") m.set("fontSize", node.fontSize);
  return m;
}

function toEdgeYMap(edge: CanvasEdgeValue): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  m.set("fromNodeId", edge.fromNodeId);
  m.set("toNodeId", edge.toNodeId);
  m.set("label", edge.label);
  m.set("style", edge.style);
  m.set("endStyle", edge.endStyle);
  return m;
}

export function setNodeValue(
  nodesMap: Y.Map<Y.Map<unknown>>,
  node: CanvasNodeValue,
): void {
  const existing = nodesMap.get(node.id);
  if (existing) {
    // Field-level writes — Yjs is per-key on Y.Map, peers editing unrelated
    // fields merge cleanly.
    if (existing.get("shape") !== node.shape) existing.set("shape", node.shape);
    if (existing.get("label") !== node.label) existing.set("label", node.label);
    if (existing.get("x") !== node.x) existing.set("x", node.x);
    if (existing.get("y") !== node.y) existing.set("y", node.y);
    if (existing.get("width") !== node.width) existing.set("width", node.width);
    if (existing.get("height") !== node.height) existing.set("height", node.height);
    if (existing.get("colorHex") !== node.colorHex) existing.set("colorHex", node.colorHex);
    // Object compare via JSON to avoid spurious writes.
    const prevReactions = existing.get("reactions");
    const nextReactions = node.reactions ?? {};
    if (JSON.stringify(prevReactions ?? {}) !== JSON.stringify(nextReactions)) {
      existing.set("reactions", nextReactions);
    }
    if ((existing.get("locked") ?? false) !== Boolean(node.locked)) {
      existing.set("locked", Boolean(node.locked));
    }
    const prevImagePath = existing.get("imagePath") ?? null;
    const nextImagePath = node.imagePath ?? null;
    if (prevImagePath !== nextImagePath) {
      existing.set("imagePath", nextImagePath);
    }
    const prevTextColor = existing.get("textColorHex") ?? null;
    const nextTextColor = node.textColorHex ?? null;
    if (prevTextColor !== nextTextColor) {
      existing.set("textColorHex", nextTextColor);
    }
    const prevFontSize =
      typeof existing.get("fontSize") === "number"
        ? (existing.get("fontSize") as number)
        : null;
    const nextFontSize = typeof node.fontSize === "number" ? node.fontSize : null;
    if (prevFontSize !== nextFontSize) {
      if (nextFontSize === null) existing.delete("fontSize");
      else existing.set("fontSize", nextFontSize);
    }
  } else {
    nodesMap.set(node.id, toNodeYMap(node));
  }
}

export function setEdgeValue(
  edgesMap: Y.Map<Y.Map<unknown>>,
  edge: CanvasEdgeValue,
): void {
  const existing = edgesMap.get(edge.id);
  if (existing) {
    if (existing.get("fromNodeId") !== edge.fromNodeId) existing.set("fromNodeId", edge.fromNodeId);
    if (existing.get("toNodeId") !== edge.toNodeId) existing.set("toNodeId", edge.toNodeId);
    if (existing.get("label") !== edge.label) existing.set("label", edge.label);
    if (existing.get("style") !== edge.style) existing.set("style", edge.style);
    if (existing.get("endStyle") !== edge.endStyle) existing.set("endStyle", edge.endStyle);
  } else {
    edgesMap.set(edge.id, toEdgeYMap(edge));
  }
}

// Strokes are immutable post-finalize (pen drags are atomic — no
// point-by-point CRDT merge), so we always overwrite.
function toStrokeYMap(stroke: CanvasStrokeValue): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  m.set("colorHex", stroke.colorHex);
  m.set("size", stroke.size);
  m.set("points", stroke.points);
  return m;
}

export function setStrokeValue(
  strokesMap: Y.Map<Y.Map<unknown>>,
  stroke: CanvasStrokeValue,
): void {
  strokesMap.set(stroke.id, toStrokeYMap(stroke));
}

export function deleteStroke(
  strokesMap: Y.Map<Y.Map<unknown>>,
  id: string,
): void {
  strokesMap.delete(id);
}

// Deterministic plain-object snapshot. Consumed by the observer
// (React Flow state derive) and save actions (DB row writes).
export function readCanvasSnapshot(refs: CanvasYRefs): {
  nodes: CanvasNodeValue[];
  edges: CanvasEdgeValue[];
  strokes: CanvasStrokeValue[];
} {
  const nodes: CanvasNodeValue[] = [];
  refs.nodes.forEach((value, id) => {
    const shape = value.get("shape");
    if (!isCanvasShape(shape)) return;
    const rawReactions = value.get("reactions");
    const reactions = asReactions(rawReactions);
    nodes.push({
      id,
      shape,
      label: asNullString(value.get("label")),
      x: asNumber(value.get("x"), 0),
      y: asNumber(value.get("y"), 0),
      width: asNumber(value.get("width"), 160),
      height: asNumber(value.get("height"), 80),
      colorHex: asString(value.get("colorHex"), "#FFFFFF"),
      imagePath: asNullString(value.get("imagePath")) ?? undefined,
      textColorHex: asNullString(value.get("textColorHex")) ?? undefined,
      fontSize:
        typeof value.get("fontSize") === "number"
          ? (value.get("fontSize") as number)
          : undefined,
      reactions: Object.keys(reactions).length > 0 ? reactions : undefined,
      locked: value.get("locked") === true ? true : undefined,
    });
  });
  const edges: CanvasEdgeValue[] = [];
  refs.edges.forEach((value, id) => {
    const from = value.get("fromNodeId");
    const to = value.get("toNodeId");
    if (typeof from !== "string" || typeof to !== "string") return;
    const style = value.get("style");
    edges.push({
      id,
      fromNodeId: from,
      toNodeId: to,
      label: asNullString(value.get("label")),
      style: style === "dashed" ? "dashed" : "solid",
      endStyle: asEdgeEnd(value.get("endStyle")),
    });
  });
  const strokes: CanvasStrokeValue[] = [];
  refs.strokes.forEach((value, id) => {
    const points = value.get("points");
    if (!Array.isArray(points)) return;
    const flat: number[] = [];
    for (const p of points) {
      if (typeof p === "number" && Number.isFinite(p)) flat.push(p);
    }
    if (flat.length < 4) return;
    strokes.push({
      id,
      colorHex: asString(value.get("colorHex"), "#1F2937"),
      size: asNumber(value.get("size"), 2),
      points: flat,
    });
  });
  return { nodes, edges, strokes };
}

function isCanvasShape(v: unknown): v is CanvasShape {
  return (
    v === "RECTANGLE" ||
    v === "DIAMOND" ||
    v === "CIRCLE" ||
    v === "STICKY" ||
    v === "FRAME" ||
    v === "TEXT"
  );
}

function asEdgeEnd(v: unknown): CanvasEdgeEnd {
  if (v === "none" || v === "diamond" || v === "circle") return v;
  return "arrow";
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function asString(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}
function asNullString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asReactions(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "number" && Number.isFinite(val) && val > 0) {
      out[k] = Math.floor(val);
    }
  }
  return out;
}

// Byte-level update helpers — Realtime provider uses these to move
// state between peers.
export function encodeUpdate(ydoc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(ydoc);
}

export function applyRemoteUpdate(ydoc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(ydoc, update, REMOTE_ORIGIN);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return typeof btoa !== "undefined" ? btoa(s) : Buffer.from(s, "binary").toString("base64");
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = typeof atob !== "undefined" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
