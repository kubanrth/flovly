import { z } from "zod";

export const NODE_SHAPES = [
  "RECTANGLE",
  "DIAMOND",
  "CIRCLE",
  "STICKY",
  "FRAME",
  "TEXT",
  "IMAGE",
] as const;
export type NodeShape = (typeof NODE_SHAPES)[number];

// Connector end markers. Keep in sync with CanvasEdgeEnd in
// lib/yjs/canvas-doc.ts and the ProcessEdge.endStyle string column.
export const EDGE_ENDS = ["arrow", "none", "diamond", "circle"] as const;
export type EdgeEnd = (typeof EDGE_ENDS)[number];

export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export const createCanvasSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1, "Nazwa wymagana.").max(200),
});

export const renameCanvasSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Nazwa wymagana.").max(200),
});

export const deleteCanvasSchema = z.object({
  id: z.string().min(1),
});

// Client-sent node + edge snapshots for a full canvas save.
const nodeSnapshotSchema = z.object({
  // React Flow node id (matches ProcessNode.id). Client assigns
  // cuid-looking id dla nowych nodów; server normalises.
  id: z.string().min(1).max(64),
  shape: z.enum(NODE_SHAPES),
  label: z.string().max(400).nullable().optional(),
  iconName: z.string().max(64).nullable().optional(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive().max(5000).default(160),
  height: z.number().finite().positive().max(5000).default(80),
  colorHex: z.string().regex(HEX_RE, "Kolor musi być #RRGGBB.").default("#FFFFFF"),
  // Per-node metadata persisted to ProcessNode.dataJson.
  reactions: z.record(z.string().max(8), z.number().int().min(0).max(9999)).optional(),
  locked: z.boolean().optional(),
  // shape="IMAGE" only — Supabase Storage key relative to attachments bucket.
  imagePath: z.string().max(500).nullable().optional(),
  // Explicit text color override (null = auto from background).
  textColorHex: z.string().regex(HEX_RE).nullable().optional(),
});

const edgeSnapshotSchema = z.object({
  id: z.string().min(1).max(64),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  label: z.string().max(200).nullable().optional(),
  style: z.enum(["solid", "dashed"]).default("solid"),
  endStyle: z.enum(EDGE_ENDS).default("arrow"),
});

// Pen-tool stroke. Points are flat [x0,y0,x1,y1,…] — ~30% smaller
// JSON than {x,y} array for typical strokes.
const strokeSnapshotSchema = z.object({
  id: z.string().min(1).max(64),
  colorHex: z.string().regex(HEX_RE, "Kolor musi być #RRGGBB.").default("#1F2937"),
  size: z.number().int().min(1).max(20).default(2),
  points: z.array(z.number().finite()).min(4).max(4000),
});

export const saveCanvasSnapshotSchema = z.object({
  id: z.string().min(1),
  nodes: z.array(nodeSnapshotSchema).max(500, "Max 500 węzłów."),
  edges: z.array(edgeSnapshotSchema).max(1000, "Max 1000 krawędzi."),
  strokes: z.array(strokeSnapshotSchema).max(500, "Max 500 strokes.").optional(),
});

export type NodeSnapshotInput = z.infer<typeof nodeSnapshotSchema>;
export type EdgeSnapshotInput = z.infer<typeof edgeSnapshotSchema>;
export type StrokeSnapshotInput = z.infer<typeof strokeSnapshotSchema>;
export type SaveCanvasSnapshotInput = z.infer<typeof saveCanvasSnapshotSchema>;
