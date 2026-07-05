"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  ConnectionMode,
  MarkerType,
  MiniMap,
  addEdge,
  getNodesBounds,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeTypes,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type EdgeChange,
} from "@xyflow/react";
import {
  Circle as CircleIcon,
  Copy,
  Diamond as DiamondIcon,
  Download,
  Frame as FrameIcon,
  Image as ImageIcon,
  LayoutTemplate,
  Link2,
  Lock,
  Maximize2,
  Minus as MinusIcon,
  MousePointer2,
  MoveRight as ArrowIcon,
  Plus as PlusIcon,
  Pencil,
  Save,
  Square as SquareIcon,
  StickyNote,
  Timer as TimerIcon,
  Info,
  Minimize2,
  Trash2,
  Type as TypeIcon,
  Unlink2,
  Workflow,
  X,
} from "lucide-react";
import { toPng } from "html-to-image";
import {
  requestCanvasImageUploadAction,
  saveCanvasSnapshotAction,
  setFlowMarkAction,
} from "@/app/(app)/w/[workspaceId]/c/actions";
import {
  createAndLinkTaskFromNodeAction,
  linkTaskToNodeAction,
  unlinkTaskFromNodeAction,
} from "@/app/(app)/w/[workspaceId]/c/node-task-actions";
import {
  ShapeNode,
  type NodeTaskChip,
  type ShapeKind,
  type ShapeNodeData,
} from "@/components/canvas/shape-node";
import { useRouter } from "next/navigation";
import {
  createCanvasYDoc,
  deleteStroke,
  readCanvasSnapshot,
  seedCanvasDoc,
  setEdgeValue,
  setNodeValue,
  setStrokeValue,
  LOCAL_ORIGIN,
  SEED_ORIGIN,
  type CanvasEdgeEnd,
  type CanvasStrokeValue,
  type CanvasYRefs,
} from "@/lib/yjs/canvas-doc";
import {
  createCanvasRealtimeProvider,
  type CanvasPresenceState,
  type CanvasProviderHandle,
} from "@/lib/yjs/canvas-realtime-provider";
import { applyCanvasTemplate, TEMPLATES, type TemplateKey } from "@/components/canvas/templates";

export interface EditorInitialNode {
  id: string;
  shape: ShapeKind;
  label: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  colorHex: string;
  linkedTasks: NodeTaskChip[];
  reactions?: Record<string, number>;
  // When true, node is locked (no drag/resize/delete).
  locked?: boolean;
  // Shape="IMAGE" stores Supabase Storage key here.
  imagePath?: string | null;
  // Explicit text color override (default = auto contrast).
  textColorHex?: string | null;
  fontSize?: number | null;
  // F12-K73 TASK_REF-only.
  taskId?: string | null;
  taskTitle?: string | null;
  statusName?: string | null;
  statusColor?: string | null;
  flowMark?: "start" | "end" | null;
}

export interface WorkspaceTaskOption {
  id: string;
  title: string;
}

export interface EditorInitialEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label: string | null;
  style: "solid" | "dashed";
  endStyle?: CanvasEdgeEnd;
}

type RFEdgeData = { style: "solid" | "dashed"; endStyle: CanvasEdgeEnd };
type RFNode = Node<ShapeNodeData>;
type RFEdge = Edge<RFEdgeData>;

const PALETTE = [
  "#FFFFFF", // white (transparent baseline)
  "#000000", // black
  "#EF4444", // red 500
  "#F97316", // orange 500
  "#FACC15", // yellow 500
  "#84CC16", // lime 500
  "#22C55E", // green 500
  "#14B8A6", // teal 500
  "#06B6D4", // cyan 500
  "#3B82F6", // blue 500
  "#6366F1", // indigo 500
  "#8B5CF6", // violet 500
  "#EC4899", // pink 500
];

const SHAPE_DEFAULTS: Record<ShapeKind, { width: number; height: number; color: string }> = {
  RECTANGLE: { width: 160, height: 80, color: "#FFFFFF" },
  DIAMOND: { width: 160, height: 80, color: "#FFFFFF" },
  CIRCLE: { width: 120, height: 120, color: "#FFFFFF" },
  STICKY: { width: 150, height: 150, color: "#FEF3C7" },
  FRAME: { width: 520, height: 320, color: "#F1F5F9" },
  // Fallback only — real size set in handleImageUpload after the PUT.
  IMAGE: { width: 280, height: 200, color: "#FFFFFF" },
  // TEXT uses colorHex as background + separate textColorHex for text color.
  TEXT: { width: 220, height: 60, color: "#FFFFFF" },
  // F12-K73 TASK_REF — task card sizing. Renderowany tylko w view 'taskline',
  // przez external drop z TaskLineSidebar.
  TASK_REF: { width: 240, height: 90, color: "#FFFFFF" },
};

const STICKY_COLORS = [
  "#FEF3C7", // yellow
  "#FBCFE8", // pink
  "#FED7AA", // orange
  "#BBF7D0", // green
  "#BFDBFE", // blue
  "#DDD6FE", // purple
  "#FECACA", // red
  "#E5E7EB", // gray
];

// Kept parallel to STICKY_COLORS count so toolbar layout doesn't reflow when switching tools.
const PEN_COLORS = [
  "#1F2937", // ink
  "#EF4444", // red
  "#F59E0B", // amber
  "#10B981", // emerald
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#64748B", // slate
];

const PEN_SIZES = [2, 4, 8] as const;
type PenSize = (typeof PEN_SIZES)[number];

// Snap grid step — same as the visual Background gap.
const SNAP_STEP = 8;

type ToolMode = "select" | "pen" | "eraser";

export interface EditorInitialStroke {
  id: string;
  colorHex: string;
  size: number;
  // Flat: [x0, y0, x1, y1, ...]
  points: number[];
}

// Module-level constant — stable reference prevents React Flow internal state resets on parent re-render.
const REACT_FLOW_NODE_TYPES: NodeTypes = { shape: ShapeNode };

function cuidish(): string {
  // Server re-accepts the same id on save so we keep RF ↔ DB identity.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `n_${Date.now().toString(36)}${rand}`;
}

// React Flow ships only Arrow/ArrowClosed natively; diamond/circle markers are registered in <defs>.
function markerForEnd(end: CanvasEdgeEnd): Edge["markerEnd"] {
  if (end === "arrow") return { type: MarkerType.ArrowClosed, width: 16, height: 16 };
  if (end === "diamond") return "url(#canvas-marker-diamond)";
  if (end === "circle") return "url(#canvas-marker-circle)";
  return undefined; // "none"
}

function toRFNode(n: EditorInitialNode, workspaceId: string): RFNode {
  return {
    id: n.id,
    type: "shape",
    position: { x: n.x, y: n.y },
    data: {
      shape: n.shape,
      label: n.label,
      colorHex: n.colorHex,
      width: n.width,
      height: n.height,
      linkedTasks: n.linkedTasks,
      workspaceId,
      reactions: n.reactions,
      locked: n.locked,
      imagePath: n.imagePath ?? undefined,
      textColorHex: n.textColorHex ?? undefined,
      fontSize:
        typeof (n as { fontSize?: number | null }).fontSize === "number"
          ? (n as { fontSize: number }).fontSize
          : undefined,
      // F12-K73 TASK_REF — przekazuje snapshot do shape-node renderera +
      // flowMark do ring/badge logiki.
      taskId: n.taskId ?? null,
      taskTitle: n.taskTitle ?? null,
      statusName: n.statusName ?? null,
      statusColor: n.statusColor ?? null,
      flowMark: n.flowMark ?? null,
    },
    width: n.width,
    height: n.height,
    // FRAME sits behind other nodes as a backdrop (negative zIndex per-node).
    zIndex: n.shape === "FRAME" ? -10 : 0,
    draggable: !n.locked,
    selectable: true,
  };
}

function toRFEdge(e: EditorInitialEdge): RFEdge {
  const endStyle: CanvasEdgeEnd = e.endStyle ?? "arrow";
  return {
    id: e.id,
    source: e.fromNodeId,
    target: e.toNodeId,
    label: e.label ?? undefined,
    style: e.style === "dashed" ? { strokeDasharray: "6 4" } : undefined,
    markerEnd: markerForEnd(endStyle),
    data: { style: e.style, endStyle },
  };
}

export function CanvasEditor(props: {
  workspaceId: string;
  canvasId: string;
  initialNodes: EditorInitialNode[];
  initialEdges: EditorInitialEdge[];
  initialStrokes?: EditorInitialStroke[];
  canEdit: boolean;
  canCreateTask: boolean;
  workspaceTasks: WorkspaceTaskOption[];
  defaultBoardId: string | null;
  // F12-K73 Task Line: mapa task'ów dostępnych do drag'a z sidebar'a
  // (key = taskId). Włącza drop handler na flowWrapper'ze + addTaskRefNode.
  boardTasks?: Map<string, BoardTaskMeta>;
}) {
  return (
    <ReactFlowProvider>
      <CanvasEditorInner {...props} />
    </ReactFlowProvider>
  );
}

// F12-K73: meta wystarczająca do utworzenia TASK_REF node'a bez DB hit'a.
// Snapshot odświeżany przy server fetchu page'u (gdy task się zmieni).
export interface BoardTaskMeta {
  id: string;
  title: string;
  statusName: string | null;
  statusColor: string | null;
  displayId: number | null;
}

function CanvasEditorInner({
  workspaceId,
  canvasId,
  initialNodes,
  initialEdges,
  initialStrokes,
  canEdit,
  canCreateTask,
  workspaceTasks,
  defaultBoardId,
  boardTasks,
}: {
  workspaceId: string;
  canvasId: string;
  initialNodes: EditorInitialNode[];
  initialEdges: EditorInitialEdge[];
  initialStrokes?: EditorInitialStroke[];
  canEdit: boolean;
  canCreateTask: boolean;
  workspaceTasks: WorkspaceTaskOption[];
  defaultBoardId: string | null;
  boardTasks?: Map<string, BoardTaskMeta>;
}) {
  const router = useRouter();
  const reactFlow = useReactFlow();
  const nodeTypes = REACT_FLOW_NODE_TYPES;
  const flowWrapperRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [nodes, setNodes, rfOnNodesChange] = useNodesState<RFNode>(
    initialNodes.map((n) => toRFNode(n, workspaceId)),
  );
  const [edges, setEdges, rfOnEdgesChange] = useEdgesState<RFEdge>(
    initialEdges.map(toRFEdge),
  );
  const [strokes, setStrokes] = useState<CanvasStrokeValue[]>(initialStrokes ?? []);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [isConnected, setIsConnected] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0]);
  const [penSize, setPenSize] = useState<PenSize>(PEN_SIZES[1]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [guides, setGuides] = useState<{ vx: number[]; hy: number[] }>({ vx: [], hy: [] });
  const [remoteCursors, setRemoteCursors] = useState<Map<string, CanvasPresenceState>>(
    () => new Map(),
  );
  const providerRef = useRef<CanvasProviderHandle | null>(null);
  // Lazy init keeps Math.random() out of render path (React Compiler flags impure calls during render).
  const [myCursorIdentity] = useState(() => {
    const palette = ["#7C5CFF", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899"];
    const idx = Math.floor(Math.random() * palette.length);
    return {
      color: palette[idx],
      name: `Gość ${Math.floor(Math.random() * 999)}`,
    };
  });

  // Y.Doc is the shared source of truth between concurrent editors; React Flow hooks above are a view on top.
  const yRefsRef = useRef<CanvasYRefs | null>(null);
  if (yRefsRef.current === null) {
    const refs = createCanvasYDoc();
    seedCanvasDoc(
      refs,
      initialNodes,
      initialEdges.map((e) => ({
        id: e.id,
        fromNodeId: e.fromNodeId,
        toNodeId: e.toNodeId,
        label: e.label,
        style: e.style,
        endStyle: e.endStyle ?? "arrow",
      })),
      initialStrokes ?? [],
    );
    yRefsRef.current = refs;
  }
  const yRefs = yRefsRef.current;

  useEffect(() => {
    const refs = yRefs;
    const handler = (_events: unknown, transaction: { origin?: unknown }) => {
      if (transaction.origin === LOCAL_ORIGIN) return;
      if (transaction.origin === SEED_ORIGIN) return;
      const snapshot = readCanvasSnapshot(refs);

      setNodes((prev) => {
        const prevLinks = new Map(prev.map((n) => [n.id, n.data.linkedTasks ?? []]));
        return snapshot.nodes.map((n) => ({
          id: n.id,
          type: "shape",
          position: { x: n.x, y: n.y },
          data: {
            shape: n.shape,
            label: n.label,
            colorHex: n.colorHex,
            width: n.width,
            height: n.height,
            linkedTasks: prevLinks.get(n.id) ?? [],
            workspaceId,
            reactions: n.reactions,
            locked: n.locked,
            imagePath: n.imagePath ?? undefined,
            textColorHex: n.textColorHex ?? undefined,
            fontSize:
              typeof (n as { fontSize?: number | null }).fontSize === "number"
                ? (n as { fontSize: number }).fontSize
                : undefined,
          },
          width: n.width,
          height: n.height,
          zIndex: n.shape === "FRAME" ? -10 : 0,
          draggable: !n.locked,
        }));
      });
      setEdges(() =>
        snapshot.edges.map((e) => ({
          id: e.id,
          source: e.fromNodeId,
          target: e.toNodeId,
          label: e.label ?? undefined,
          style: e.style === "dashed" ? { strokeDasharray: "6 4" } : undefined,
          markerEnd: markerForEnd(e.endStyle),
          data: { style: e.style, endStyle: e.endStyle },
        })),
      );
      setStrokes(snapshot.strokes);
    };
    refs.nodes.observeDeep(handler);
    refs.edges.observeDeep(handler);
    refs.strokes.observeDeep(handler);

    const provider = createCanvasRealtimeProvider(refs, canvasId);
    providerRef.current = provider;
    const offPresence = provider.onPresence((states) => setRemoteCursors(states));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsConnected(true);
    return () => {
      refs.nodes.unobserveDeep(handler);
      refs.edges.unobserveDeep(handler);
      refs.strokes.unobserveDeep(handler);
      offPresence();
      provider.disconnect();
      providerRef.current = null;
      setIsConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, workspaceId]);

  // Listening on flowWrapperRef captures mousemove anywhere over canvas without conflicting with React Flow's pointer handlers.
  useEffect(() => {
    if (!canEdit) return;
    const wrap = flowWrapperRef.current;
    if (!wrap) return;
    let last = 0;
    const onMove = (e: MouseEvent) => {
      const now = performance.now();
      if (now - last < 33) return; // ~30 fps cap
      last = now;
      const provider = providerRef.current;
      if (!provider) return;
      const world = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      provider.broadcastPresence({
        x: world.x,
        y: world.y,
        color: myCursorIdentity.color,
        name: myCursorIdentity.name,
      });
    };
    wrap.addEventListener("mousemove", onMove);
    return () => wrap.removeEventListener("mousemove", onMove);
  }, [canEdit, reactFlow, myCursorIdentity]);

  // RF doesn't emit data-deltas via onNodesChange; ShapeNode dispatches 'canvas-node:commit' to force Yjs sync.
  useEffect(() => {
    if (!canEdit) return;
    const onCommit = (e: Event) => {
      const ce = e as CustomEvent<{ nodeId: string }>;
      const id = ce.detail?.nodeId;
      if (!id) return;
      // Functional setNodes — closure read could be stale.
      setNodes((ns) => {
        const target = ns.find((n) => n.id === id);
        if (target) commitNodeToY(target);
        return ns;
      });
    };
    window.addEventListener("canvas-node:commit", onCommit);
    return () => window.removeEventListener("canvas-node:commit", onCommit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  const commitNodeToY = useCallback(
    (node: RFNode) => {
      yRefs.ydoc.transact(() => {
        setNodeValue(yRefs.nodes, {
          id: node.id,
          shape: node.data.shape,
          label: node.data.label ?? null,
          x: node.position.x,
          y: node.position.y,
          width: node.data.width,
          height: node.data.height,
          colorHex: node.data.colorHex,
          imagePath: node.data.imagePath ?? null,
          textColorHex: node.data.textColorHex ?? null,
          fontSize:
            typeof node.data.fontSize === "number" ? node.data.fontSize : null,
          reactions: node.data.reactions,
          locked: node.data.locked,
        });
      }, LOCAL_ORIGIN);
    },
    [yRefs],
  );
  const commitEdgeToY = useCallback(
    (edge: RFEdge) => {
      const d = edge.data;
      yRefs.ydoc.transact(() => {
        setEdgeValue(yRefs.edges, {
          id: edge.id,
          fromNodeId: edge.source,
          toNodeId: edge.target,
          label: typeof edge.label === "string" ? edge.label : null,
          style: d?.style ?? "solid",
          endStyle: d?.endStyle ?? "arrow",
        });
      }, LOCAL_ORIGIN);
    },
    [yRefs],
  );
  const deleteNodeFromY = useCallback(
    (nodeId: string) => {
      yRefs.ydoc.transact(() => {
        yRefs.nodes.delete(nodeId);
        yRefs.edges.forEach((value, id) => {
          const from = value.get("fromNodeId");
          const to = value.get("toNodeId");
          if (from === nodeId || to === nodeId) yRefs.edges.delete(id);
        });
      }, LOCAL_ORIGIN);
    },
    [yRefs],
  );
  const deleteEdgeFromY = useCallback(
    (edgeId: string) => {
      yRefs.ydoc.transact(() => {
        yRefs.edges.delete(edgeId);
      }, LOCAL_ORIGIN);
    },
    [yRefs],
  );
  const commitStrokeToY = useCallback(
    (stroke: CanvasStrokeValue) => {
      yRefs.ydoc.transact(() => {
        setStrokeValue(yRefs.strokes, stroke);
      }, LOCAL_ORIGIN);
    },
    [yRefs],
  );
  const clearAllStrokes = useCallback(() => {
    if (strokes.length === 0) return;
    if (!confirm(`Usunąć ${strokes.length} rysunki?`)) return;
    setStrokes([]);
    yRefs.ydoc.transact(() => {
      yRefs.strokes.forEach((_v, id) => deleteStroke(yRefs.strokes, id));
    }, LOCAL_ORIGIN);
  }, [strokes.length, yRefs]);

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      const id = `e_${cuidish()}`;
      const newEdge: RFEdge = {
        ...params,
        id,
        source: params.source ?? "",
        target: params.target ?? "",
        data: { style: "solid", endStyle: "arrow" },
        markerEnd: markerForEnd("arrow"),
      };
      setEdges((eds) => addEdge(newEdge, eds));
      if (params.source && params.target) commitEdgeToY(newEdge);
    },
    [setEdges, commitEdgeToY],
  );

  const addShape = useCallback(
    (shape: ShapeKind) => {
      const defaults = SHAPE_DEFAULTS[shape];
      const id = cuidish();
      const x = 120 + Math.random() * 180;
      const y = 120 + Math.random() * 140;
      const rfNode: RFNode = {
        id,
        type: "shape",
        position: { x, y },
        data: {
          shape,
          label: shape === "FRAME" ? "Sekcja" : null,
          colorHex: defaults.color,
          width: defaults.width,
          height: defaults.height,
          linkedTasks: [],
          workspaceId,
          // Start in edit mode so user can type immediately without double-click.
          editing: true,
        },
        width: defaults.width,
        height: defaults.height,
        zIndex: shape === "FRAME" ? -10 : 0,
        selected: true,
      };
      setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), rfNode]);
      commitNodeToY(rfNode);
    },
    [setNodes, workspaceId, commitNodeToY],
  );

  // F12-K73 Task Line: tworzy TASK_REF node z metadat'ami task'a w
  // sprecyzowanej pozycji canvas world coordinates. Wywoływane przez
  // drop handler na flowWrapper'ze. Zapobiega duplikatom — gdyby user
  // przeciągnął ten sam task drugi raz na ten canvas, nie tworzymy
  // duplikatu (zamiast tego select + center existing).
  const addTaskRefNode = useCallback(
    (taskId: string, worldX: number, worldY: number) => {
      if (!boardTasks) return;
      const task = boardTasks.get(taskId);
      if (!task) return;

      // Dedup — jeden TASK_REF na task w tym canvasie. Reuse existing.
      const existing = nodes.find(
        (n) => n.data.shape === "TASK_REF" && n.data.taskId === taskId,
      );
      if (existing) {
        setNodes((ns) =>
          ns.map((n) => ({ ...n, selected: n.id === existing.id })),
        );
        reactFlow.fitView({
          nodes: [{ id: existing.id }],
          padding: 0.5,
          duration: 300,
        });
        return;
      }

      const defaults = SHAPE_DEFAULTS.TASK_REF;
      const id = cuidish();
      // Center na world position drop'u
      const x = worldX - defaults.width / 2;
      const y = worldY - defaults.height / 2;
      const rfNode: RFNode = {
        id,
        type: "shape",
        position: { x, y },
        data: {
          shape: "TASK_REF",
          label: null,
          colorHex: defaults.color,
          width: defaults.width,
          height: defaults.height,
          linkedTasks: [],
          workspaceId,
          taskId: task.id,
          taskTitle: task.title,
          statusName: task.statusName,
          statusColor: task.statusColor,
          flowMark: null,
        },
        width: defaults.width,
        height: defaults.height,
        zIndex: 0,
        selected: true,
      };
      setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), rfNode]);
      commitNodeToY(rfNode);
    },
    [boardTasks, nodes, setNodes, workspaceId, commitNodeToY, reactFlow],
  );

  // 3-step upload: requestUpload (signed URL) → PUT → create IMAGE node with imagePath = storageKey.
  const handleImageUpload = useCallback(
    async (file: File) => {
      const req = await requestCanvasImageUploadAction(
        canvasId,
        file.name,
        file.type || "application/octet-stream",
        file.size,
      );
      if (!req.ok) {
        alert(req.error);
        return;
      }
      try {
        const put = await fetch(req.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "x-upsert": "false",
          },
          body: file,
        });
        if (!put.ok) {
          alert(`Upload nie powiódł się (${put.status}).`);
          return;
        }
      } catch (e) {
        console.warn("[canvas-image] upload error", e);
        alert("Upload nie powiódł się — sprawdź połączenie.");
        return;
      }

      const id = cuidish();
      const x = 120 + Math.random() * 180;
      const y = 120 + Math.random() * 140;
      const rfNode: RFNode = {
        id,
        type: "shape",
        position: { x, y },
        data: {
          shape: "IMAGE",
          label: null,
          colorHex: "#FFFFFF",
          width: 280,
          height: 200,
          linkedTasks: [],
          workspaceId,
          imagePath: req.storageKey,
        },
        width: 280,
        height: 200,
        zIndex: 0,
        selected: true,
      };
      setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), rfNode]);
      commitNodeToY(rfNode);
    },
    [canvasId, setNodes, workspaceId, commitNodeToY],
  );

  const deleteSelected = useCallback(() => {
    // Locked nodes are immune to delete; edges attached to a locked node stay too (avoid visual orphans).
    const removedNodeIds = new Set(
      nodes.filter((n) => n.selected && !n.data.locked).map((n) => n.id),
    );
    const removedEdgeIds = new Set(
      edges
        .filter((e) => e.selected || removedNodeIds.has(e.source) || removedNodeIds.has(e.target))
        .map((e) => e.id),
    );
    setNodes((ns) => ns.filter((n) => !removedNodeIds.has(n.id)));
    setEdges((es) => es.filter((e) => !removedEdgeIds.has(e.id)));
    for (const id of removedNodeIds) deleteNodeFromY(id);
    for (const id of removedEdgeIds) deleteEdgeFromY(id);
  }, [nodes, edges, setNodes, setEdges, deleteNodeFromY, deleteEdgeFromY]);

  // Edges only clone when *both* endpoints are duplicated — single-end clones would orphan edges.
  const duplicateSelected = useCallback(() => {
    const selected = nodes.filter((n) => n.selected);
    if (selected.length === 0) return;
    const idMap = new Map<string, string>();
    const newNodes: RFNode[] = selected.map((n) => {
      const newId = cuidish();
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + 24, y: n.position.y + 24 },
        selected: true,
      };
    });
    const newEdges: RFEdge[] = edges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e) => ({
        ...e,
        id: `e_${cuidish()}`,
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
        selected: false,
      }));
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), ...newNodes]);
    setEdges((es) => [...es, ...newEdges]);
    for (const n of newNodes) commitNodeToY(n);
    for (const e of newEdges) commitEdgeToY(e);
  }, [nodes, edges, setNodes, setEdges, commitNodeToY, commitEdgeToY]);

  const bringSelectedToFront = useCallback(() => {
    const maxZ = nodes.reduce((m, n) => Math.max(m, n.zIndex ?? 0), 0);
    setNodes((ns) =>
      ns.map((n) => (n.selected ? { ...n, zIndex: maxZ + 1 } : n)),
    );
  }, [nodes, setNodes]);

  const toggleReaction = useCallback(
    (emoji: string) => {
      const touched: RFNode[] = [];
      setNodes((ns) =>
        ns.map((n) => {
          if (!n.selected) return n;
          const cur = { ...(n.data.reactions ?? {}) };
          const had = (cur[emoji] ?? 0) > 0;
          if (had) {
            const nextCount = (cur[emoji] ?? 0) - 1;
            if (nextCount <= 0) delete cur[emoji];
            else cur[emoji] = nextCount;
          } else {
            cur[emoji] = (cur[emoji] ?? 0) + 1;
          }
          const next: RFNode = {
            ...n,
            data: { ...n.data, reactions: cur },
          };
          touched.push(next);
          return next;
        }),
      );
      for (const n of touched) commitNodeToY(n);
    },
    [setNodes, commitNodeToY],
  );

  const toggleLockSelected = useCallback(() => {
    const touched: RFNode[] = [];
    setNodes((ns) =>
      ns.map((n) => {
        if (!n.selected) return n;
        const nextLocked = !n.data.locked;
        const next: RFNode = {
          ...n,
          data: { ...n.data, locked: nextLocked },
          draggable: !nextLocked,
        };
        touched.push(next);
        return next;
      }),
    );
    for (const n of touched) commitNodeToY(n);
  }, [setNodes, commitNodeToY]);

  // F12-K73: toggle flow mark na single TASK_REF node'zie + sync z serverem
  // (audit log + persist w dataJson). Yjs lokalnie aktualizujemy od razu;
  // server action jest "fire-and-forget" — gdy padnie, next save snapshot
  // i tak doprowadzi DB do zgodności.
  const setFlowMarkOnSelected = useCallback(
    (mark: "start" | "end" | null) => {
      const target = nodes.find(
        (n) => n.selected && n.data.shape === "TASK_REF",
      );
      if (!target) return;
      const next: RFNode = {
        ...target,
        data: { ...target.data, flowMark: mark },
      };
      setNodes((ns) => ns.map((n) => (n.id === target.id ? next : n)));
      commitNodeToY(next);
      void setFlowMarkAction({
        canvasId,
        nodeId: target.id,
        mark,
      });
    },
    [nodes, setNodes, commitNodeToY, canvasId],
  );

  const renameSelected = useCallback(() => {
    const target = nodes.find((n) => n.selected);
    if (!target) return;
    setNodes((ns) =>
      ns.map((n) =>
        n.id === target.id
          ? { ...n, data: { ...n.data, editing: true } }
          : n,
      ),
    );
  }, [nodes, setNodes]);

  const recolorSelected = useCallback(
    (hex: string) => {
      const touched: RFNode[] = [];
      setNodes((ns) =>
        ns.map((n) => {
          if (!n.selected) return n;
          const next = { ...n, data: { ...n.data, colorHex: hex } };
          touched.push(next);
          return next;
        }),
      );
      for (const n of touched) commitNodeToY(n);
    },
    [setNodes, commitNodeToY],
  );

  // `hex = null` resets to auto-contrast (textColorFor of fill).
  const recolorTextSelected = useCallback(
    (hex: string | null) => {
      const touched: RFNode[] = [];
      setNodes((ns) =>
        ns.map((n) => {
          if (!n.selected) return n;
          const next = {
            ...n,
            data: { ...n.data, textColorHex: hex },
          };
          touched.push(next);
          return next;
        }),
      );
      for (const n of touched) commitNodeToY(n);
    },
    [setNodes, commitNodeToY],
  );

  // `size = null` resets to baseline; number sets explicit override.
  const resizeFontSelected = useCallback(
    (size: number | null) => {
      const touched: RFNode[] = [];
      setNodes((ns) =>
        ns.map((n) => {
          if (!n.selected) return n;
          const next = {
            ...n,
            data: { ...n.data, fontSize: size },
          };
          touched.push(next);
          return next;
        }),
      );
      for (const n of touched) commitNodeToY(n);
    },
    [setNodes, commitNodeToY],
  );

  const setEdgeEndStyle = useCallback(
    (endStyle: CanvasEdgeEnd) => {
      const touched: RFEdge[] = [];
      setEdges((es) =>
        es.map((e) => {
          if (!e.selected) return e;
          const next: RFEdge = {
            ...e,
            data: {
              style: e.data?.style ?? "solid",
              endStyle,
            },
            markerEnd: markerForEnd(endStyle),
          };
          touched.push(next);
          return next;
        }),
      );
      for (const e of touched) commitEdgeToY(e);
    },
    [setEdges, commitEdgeToY],
  );

  const onNodesChange: OnNodesChange<RFNode> = useCallback(
    (changes: NodeChange<RFNode>[]) => {
      rfOnNodesChange(changes);
      for (const change of changes) {
        if (change.type === "remove") {
          deleteNodeFromY(change.id);
        } else if (change.type === "position" && change.dragging === false && change.position) {
          const existing = nodes.find((n) => n.id === change.id);
          if (existing) {
            commitNodeToY({ ...existing, position: change.position });
          }
        }
      }
    },
    [rfOnNodesChange, nodes, commitNodeToY, deleteNodeFromY],
  );

  const onEdgesChange: OnEdgesChange<RFEdge> = useCallback(
    (changes: EdgeChange<RFEdge>[]) => {
      rfOnEdgesChange(changes);
      for (const change of changes) {
        if (change.type === "remove") {
          deleteEdgeFromY(change.id);
        }
      }
    },
    [rfOnEdgesChange, deleteEdgeFromY],
  );

  const save = useCallback(() => {
    setSaveState("saving");
    setSaveError(null);
    startTransition(async () => {
      const res = await saveCanvasSnapshotAction({
        id: canvasId,
        nodes: nodes.map((n) => ({
          id: n.id,
          shape: n.data.shape,
          label: n.data.label ?? null,
          x: n.position.x,
          y: n.position.y,
          width: n.data.width,
          height: n.data.height,
          colorHex: n.data.colorHex,
          reactions: n.data.reactions,
          locked: n.data.locked,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          fromNodeId: e.source,
          toNodeId: e.target,
          label: typeof e.label === "string" ? e.label : null,
          style: e.data?.style ?? "solid",
          endStyle: e.data?.endStyle ?? "arrow",
        })),
        strokes: strokes.map((s) => ({
          id: s.id,
          colorHex: s.colorHex,
          size: s.size,
          points: s.points,
        })),
      });
      if (res.ok) {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1600);
      } else {
        setSaveState("error");
        setSaveError(res.error);
      }
    });
  }, [canvasId, nodes, edges, strokes]);

  // Single Yjs transaction = one undo step + one broadcast.
  const applyTemplate = useCallback(
    (key: TemplateKey) => {
      const offset = nodes.length > 0 ? getNodesBounds(nodes) : null;
      const dx = offset ? offset.x + offset.width + 80 : 120;
      const dy = offset ? offset.y : 120;

      const newRfNodes: RFNode[] = [];
      const newRfEdges: RFEdge[] = [];
      applyCanvasTemplate(key, (n, e) => {
        for (const spec of n) {
          const id = cuidish();
          const node: RFNode = {
            id,
            type: "shape",
            position: { x: dx + spec.x, y: dy + spec.y },
            data: {
              shape: spec.shape,
              label: spec.label,
              colorHex: spec.colorHex,
              width: spec.width,
              height: spec.height,
              linkedTasks: [],
              workspaceId,
            },
            width: spec.width,
            height: spec.height,
            zIndex: spec.shape === "FRAME" ? -10 : 0,
          };
          newRfNodes.push(node);
          spec.__assignedId = id;
        }
        for (const spec of e) {
          const from = n[spec.fromIdx].__assignedId;
          const to = n[spec.toIdx].__assignedId;
          if (!from || !to) continue;
          const id = `e_${cuidish()}`;
          newRfEdges.push({
            id,
            source: from,
            target: to,
            label: spec.label,
            markerEnd: markerForEnd(spec.endStyle),
            data: { style: spec.style, endStyle: spec.endStyle },
          });
        }
      });

      setNodes((ns) => [...ns, ...newRfNodes]);
      setEdges((es) => [...es, ...newRfEdges]);
      yRefs.ydoc.transact(() => {
        for (const n of newRfNodes) {
          setNodeValue(yRefs.nodes, {
            id: n.id,
            shape: n.data.shape,
            label: n.data.label ?? null,
            x: n.position.x,
            y: n.position.y,
            width: n.data.width,
            height: n.data.height,
            colorHex: n.data.colorHex,
          });
        }
        for (const e of newRfEdges) {
          setEdgeValue(yRefs.edges, {
            id: e.id,
            fromNodeId: e.source,
            toNodeId: e.target,
            label: typeof e.label === "string" ? e.label : null,
            style: e.data?.style ?? "solid",
            endStyle: e.data?.endStyle ?? "arrow",
          });
        }
      }, LOCAL_ORIGIN);

      setTimeout(() => reactFlow.fitView({ padding: 0.2, duration: 400 }), 50);
    },
    [nodes, setNodes, setEdges, yRefs, workspaceId, reactFlow],
  );

  // Grab .react-flow__viewport — contains nodes+edges in transformed space, so html-to-image captures what user sees.
  const exportPng = useCallback(async () => {
    const root = flowWrapperRef.current;
    if (!root) return;
    const pane = root.querySelector<HTMLElement>(".react-flow__viewport");
    if (!pane) return;
    const bounds = getNodesBounds(nodes);
    const pad = 64;
    try {
      const dataUrl = await toPng(pane, {
        backgroundColor: "#ffffff",
        width: Math.max(bounds.width + pad * 2, 800),
        height: Math.max(bounds.height + pad * 2, 600),
        pixelRatio: 2,
        style: {
          transform: `translate(${-bounds.x + pad}px, ${-bounds.y + pad}px)`,
          width: `${bounds.width + pad * 2}px`,
          height: `${bounds.height + pad * 2}px`,
        },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `whiteboard-${canvasId.slice(-8)}.png`;
      a.click();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Export nie powiódł się.");
      setSaveState("error");
    }
  }, [nodes, canvasId]);

  const selectedCount = nodes.filter((n) => n.selected).length + edges.filter((e) => e.selected).length;
  const selectedNodes = nodes.filter((n) => n.selected);
  const selectedEdges = edges.filter((e) => e.selected);
  const singleSelectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const hasEdgeSelection = selectedEdges.length > 0;

  const patchNodeData = useCallback(
    (nodeId: string, patch: (chips: NodeTaskChip[]) => NodeTaskChip[]) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  linkedTasks: patch(n.data.linkedTasks ?? []),
                },
              }
            : n,
        ),
      );
    },
    [setNodes],
  );

  const [linkError, setLinkError] = useState<string | null>(null);

  // Deliberate manual memos — React Compiler can't preserve memoization when singleSelectedNode is a derived filter.
  /* eslint-disable react-hooks/preserve-manual-memoization */
  const handleLinkTask = useCallback(
    async (taskId: string) => {
      if (!singleSelectedNode) return;
      const nodeId = singleSelectedNode.id;
      const task = workspaceTasks.find((t) => t.id === taskId);
      if (!task) return;
      setLinkError(null);
      const res = await linkTaskToNodeAction({ nodeId, taskId });
      if (!res.ok) {
        setLinkError(res.error);
        return;
      }
      patchNodeData(nodeId, (chips) =>
        chips.some((c) => c.taskId === taskId)
          ? chips
          : [...chips, { taskId: task.id, title: task.title }],
      );
    },
    [singleSelectedNode, workspaceTasks, patchNodeData],
  );

  const handleUnlinkTask = useCallback(
    async (taskId: string) => {
      if (!singleSelectedNode) return;
      const nodeId = singleSelectedNode.id;
      setLinkError(null);
      const res = await unlinkTaskFromNodeAction({ nodeId, taskId });
      if (!res.ok) {
        setLinkError(res.error);
        return;
      }
      patchNodeData(nodeId, (chips) => chips.filter((c) => c.taskId !== taskId));
    },
    [singleSelectedNode, patchNodeData],
  );

  const handleCreateAndLink = useCallback(async () => {
    if (!singleSelectedNode || !defaultBoardId) return;
    const nodeId = singleSelectedNode.id;
    const defaultTitle = singleSelectedNode.data.label ?? "";
    const title = window.prompt("Tytuł nowego zadania", defaultTitle);
    if (!title || title.trim().length === 0) return;
    setLinkError(null);
    const res = await createAndLinkTaskFromNodeAction({
      nodeId,
      boardId: defaultBoardId,
      title: title.trim(),
    });
    if (!res.ok) {
      setLinkError(res.error);
      return;
    }
    patchNodeData(nodeId, (chips) => [
      ...chips,
      { taskId: res.taskId, title: title.trim() },
    ]);
    router.push(`/w/${workspaceId}/t/${res.taskId}`);
  }, [singleSelectedNode, defaultBoardId, patchNodeData, router, workspaceId]);
  /* eslint-enable react-hooks/preserve-manual-memoization */

  return (
    <div
      className="relative h-full w-full"
      ref={flowWrapperRef}
      // F12-K73 Task Line drop handler — zewnętrzne taski dropowane z
      // TaskLineSidebar. dataTransfer key dedykowany (nie kolizja z text/plain).
      onDragOver={(e) => {
        if (!boardTasks) return;
        if (e.dataTransfer.types.includes("application/x-flovly-task-id")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        if (!boardTasks) return;
        const id = e.dataTransfer.getData("application/x-flovly-task-id");
        if (!id) return;
        e.preventDefault();
        const world = reactFlow.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        addTaskRefNode(id, world.x, world.y);
      }}
    >
      {/* F12-K72 v3: Mural-style mobile UI — pionowy floating toolbar po
          lewej + fullscreen button bottom-right. Klient: dostał screenshot
          Mural mobile i chce 1:1 — toolbar po lewej z kluczowymi narzędziami,
          fullscreen toggle żeby edycja była komfortowa. v2 (dismissible info
          chip) tylko informowała "użyj desktop'a", nie dawała narzędzi.
          Renderowane tylko gdy canEdit + mobile (max-md). */}
      {canEdit && (
        <MobileCanvasToolbar
          toolMode={toolMode}
          setToolMode={setToolMode}
          addShape={addShape}
          imageInputRef={imageInputRef}
          penColor={penColor}
          setPenColor={setPenColor}
          penSize={penSize}
          setPenSize={setPenSize}
          strokesCount={strokes.length}
          clearAllStrokes={clearAllStrokes}
          selectedCount={selectedCount}
          deleteSelected={deleteSelected}
          exportPng={exportPng}
          save={save}
          saveState={saveState}
          onPickTemplate={(k) => applyTemplate(k)}
        />
      )}
      {/* F12-K130: MobileFullscreenToggle removed — funkcjonalność
          fullscreen przeniesiona do CanvasZoomControls (button "Pełny
          ekran" obok Powiększ/Pomniejsz). Klient: "są 2 guziki, prawy w
          bez sensu miejscu — usuń, dodaj funkcjonalność temu lewemu". */}

      {/* Custom markers for connector endings React Flow doesn't ship. */}
      <svg className="absolute h-0 w-0" aria-hidden>
        <defs>
          <marker
            id="canvas-marker-diamond"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="10"
            markerHeight="10"
            orient="auto-start-reverse"
          >
            <path d="M0 5 L5 0 L10 5 L5 10 Z" fill="currentColor" />
          </marker>
          <marker
            id="canvas-marker-circle"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
          >
            <circle cx="5" cy="5" r="4" fill="currentColor" />
          </marker>
        </defs>
      </svg>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={canEdit && toolMode === "select" ? onConnect : undefined}
        nodeTypes={nodeTypes}
        onNodeDoubleClick={canEdit ? (_e, n) => {
          setNodes((ns) => ns.map((x) => ({ ...x, selected: x.id === n.id })));
          setTimeout(() => renameSelected(), 0);
        } : undefined}
        deleteKeyCode={canEdit && toolMode === "select" ? ["Delete", "Backspace"] : null}
        minZoom={0.2}
        maxZoom={2}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "smoothstep" }}
        // Loose allows dropping arrow onto any handle (target or source) — default forces target-only.
        connectionMode={ConnectionMode.Loose}
        selectionOnDrag={canEdit && toolMode === "select"}
        panOnDrag={toolMode === "select" ? [1, 2] : false}
        // Default RF12 scroll = zoom; we flip so scroll pans (trackpad-friendly).
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        snapToGrid={canEdit && toolMode === "select"}
        snapGrid={[SNAP_STEP, SNAP_STEP]}
        onPaneContextMenu={(e) => {
          if (!canEdit) return;
          e.preventDefault();
          setNodes((ns) => ns.map((n) => ({ ...n, selected: false })));
          setEdges((es) => es.map((ed) => ({ ...ed, selected: false })));
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
        onNodeContextMenu={(e, n) => {
          if (!canEdit) return;
          e.preventDefault();
          setNodes((ns) =>
            ns.map((x) => ({ ...x, selected: x.id === n.id ? true : x.selected })),
          );
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
        onNodeDrag={(_e, _n, draggedNodes) => {
          if (!canEdit || toolMode !== "select") return;
          const dragged = draggedNodes.map((d) => d.id);
          const draggedSet = new Set(dragged);
          const others = nodes.filter((n) => !draggedSet.has(n.id));
          const vx = new Set<number>();
          const hy = new Set<number>();
          for (const dragNode of draggedNodes) {
            const dx0 = dragNode.position.x;
            const dy0 = dragNode.position.y;
            const dxC = dx0 + (dragNode.measured?.width ?? dragNode.width ?? 0) / 2;
            const dyC = dy0 + (dragNode.measured?.height ?? dragNode.height ?? 0) / 2;
            for (const o of others) {
              const ow = o.measured?.width ?? o.width ?? 0;
              const oh = o.measured?.height ?? o.height ?? 0;
              const ox0 = o.position.x;
              const oy0 = o.position.y;
              const oxC = ox0 + ow / 2;
              const oyC = oy0 + oh / 2;
              const ox1 = ox0 + ow;
              const oy1 = oy0 + oh;
              if (Math.abs(dxC - oxC) < 6) vx.add(oxC);
              if (Math.abs(dx0 - ox0) < 6) vx.add(ox0);
              if (Math.abs(dx0 - ox1) < 6) vx.add(ox1);
              if (Math.abs(dyC - oyC) < 6) hy.add(oyC);
              if (Math.abs(dy0 - oy0) < 6) hy.add(oy0);
              if (Math.abs(dy0 - oy1) < 6) hy.add(oy1);
            }
          }
          setGuides({ vx: Array.from(vx), hy: Array.from(hy) });
        }}
        onNodeDragStop={() => setGuides({ vx: [], hy: [] })}
        onPaneClick={() => setContextMenu(null)}
      >
        <Background gap={24} size={1} />
        {/* Custom controls — native <Controls/> has no dark-mode parity. */}
        <CanvasZoomControls wrapperRef={flowWrapperRef} />
        <MiniMap pannable zoomable className="!bg-card" />
        <StrokeViewportLayer strokes={strokes} />
        <AlignmentGuides vx={guides.vx} hy={guides.hy} />
        <RemoteCursorsLayer cursors={remoteCursors} />
      </ReactFlow>

      {canEdit && toolMode === "pen" && (
        <PenOverlay
          color={penColor}
          size={penSize}
          onCommit={(stroke) => {
            setStrokes((prev) => [...prev, stroke]);
            commitStrokeToY(stroke);
          }}
        />
      )}

      {contextMenu && canEdit && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          hasSelection={selectedCount > 0}
          isLocked={singleSelectedNode?.data.locked === true}
          onClose={() => setContextMenu(null)}
          onDelete={deleteSelected}
          onDuplicate={duplicateSelected}
          onBringFront={bringSelectedToFront}
          onReact={toggleReaction}
          onToggleLock={toggleLockSelected}
          // F12-K73: flow mark opcje pojawiają się TYLKO gdy single TASK_REF
          // wybrany — inaczej cała sekcja zostaje schowana (onSetFlowMark
          // undefined w ContextMenu → null branch).
          taskRefFlowMark={
            singleSelectedNode?.data.shape === "TASK_REF"
              ? ((singleSelectedNode.data.flowMark as "start" | "end" | null | undefined) ?? null)
              : undefined
          }
          onSetFlowMark={
            singleSelectedNode?.data.shape === "TASK_REF"
              ? setFlowMarkOnSelected
              : undefined
          }
        />
      )}

      {/* Top toolbar tylko na desktop (md:flex) — na mobile używamy vertical
          left toolbar'a (Mural-style) renderowanego poniżej.
          F12-K91 fix: z-10 żeby toolbar był NAD PenOverlay (z-4). Bez tego
          klik na color swatch trafiał w PenOverlay (które ma onPointerDown
          na cały canvas) zamiast w przycisk — kolor się nie zmieniał i każdy
          klik spawnowal nowy drawing state (memory + render kaskada). */}
      {canEdit && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex">
          <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-lg backdrop-blur">
            <ToolButton
              label="Wskaźnik (V)"
              active={toolMode === "select"}
              onClick={() => setToolMode("select")}
            >
              <MousePointer2 size={14} />
            </ToolButton>
            <ToolButton
              label="Pisak (P)"
              active={toolMode === "pen"}
              onClick={() => setToolMode("pen")}
            >
              <Pencil size={14} />
            </ToolButton>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />

            <ToolButton label="Prostokąt" onClick={() => addShape("RECTANGLE")}>
              <SquareIcon size={14} />
            </ToolButton>
            <ToolButton label="Romb" onClick={() => addShape("DIAMOND")}>
              <DiamondIcon size={14} />
            </ToolButton>
            <ToolButton label="Koło" onClick={() => addShape("CIRCLE")}>
              <CircleIcon size={14} />
            </ToolButton>
            <ToolButton label="Sticky note" onClick={() => addShape("STICKY")}>
              <StickyNote size={14} />
            </ToolButton>
            <ToolButton label="Tekst" onClick={() => addShape("TEXT")}>
              <TypeIcon size={14} />
            </ToolButton>
            <ToolButton label="Ramka" onClick={() => addShape("FRAME")}>
              <FrameIcon size={14} />
            </ToolButton>
            <ToolButton
              label="Obraz"
              onClick={() => imageInputRef.current?.click()}
            >
              <ImageIcon size={14} />
            </ToolButton>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImageUpload(f);
                e.target.value = "";
              }}
            />
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            {toolMode === "pen" ? (
              <div className="flex items-center gap-1 px-1">
                {PEN_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPenColor(c)}
                    aria-label={`Kolor pisaka ${c}`}
                    title={`Kolor pisaka ${c}`}
                    className="h-5 w-5 rounded-full border border-border transition-transform hover:scale-110"
                    style={{
                      background: c,
                      outline: penColor === c ? "2px solid var(--foreground)" : "none",
                      outlineOffset: penColor === c ? 2 : 0,
                    }}
                  />
                ))}
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                {PEN_SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPenSize(s)}
                    aria-label={`Grubość ${s}px`}
                    title={`Grubość ${s}px`}
                    className={`grid h-7 w-7 place-items-center rounded-md transition-colors ${
                      penSize === s
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <span
                      className="block rounded-full"
                      style={{
                        background: penColor,
                        width: s + 2,
                        height: s + 2,
                      }}
                    />
                  </button>
                ))}
                {strokes.length > 0 && (
                  <ToolButton
                    label={`Wyczyść rysunki (${strokes.length})`}
                    onClick={clearAllStrokes}
                  >
                    <Trash2 size={13} />
                  </ToolButton>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 px-1">
                {/* TASK_REF dostaje też pastelową paletę (STICKY_COLORS) —
                    biały task card + delikatne tła ładnie się komponują.
                    Klient: "dodaj opcje zmieniania kolorow tez tych zadan". */}
                {(selectedNodes.some(
                  (n) => n.data.shape === "STICKY" || n.data.shape === "TASK_REF",
                )
                  ? STICKY_COLORS
                  : PALETTE
                ).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => recolorSelected(c)}
                    disabled={selectedNodes.length === 0}
                    // mobile h-7 w-7 (28px) zamiast h-5 w-5 (20px) — bliżej
                    // iOS HIG min hit-area (44px) bez rozsadzania toolbar'a.
                    className="h-7 w-7 rounded-full border border-border transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40 md:h-5 md:w-5"
                    style={{ background: c }}
                    aria-label={`Tło ${c}`}
                    title={`Tło ${c}`}
                  />
                ))}
                <TextColorPicker
                  selectedNodes={selectedNodes}
                  onPick={recolorTextSelected}
                />
                <FontSizePicker
                  selectedNodes={selectedNodes}
                  onPick={resizeFontSelected}
                />
              </div>
            )}

            {hasEdgeSelection && (
              <>
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                <ToolButton
                  label="Końcówka: strzałka"
                  onClick={() => setEdgeEndStyle("arrow")}
                >
                  <ArrowIcon size={14} />
                </ToolButton>
                <ToolButton
                  label="Końcówka: brak"
                  onClick={() => setEdgeEndStyle("none")}
                >
                  <MinusIcon size={14} />
                </ToolButton>
                <ToolButton
                  label="Końcówka: romb"
                  onClick={() => setEdgeEndStyle("diamond")}
                >
                  <DiamondIcon size={12} />
                </ToolButton>
                <ToolButton
                  label="Końcówka: koło"
                  onClick={() => setEdgeEndStyle("circle")}
                >
                  <CircleIcon size={12} />
                </ToolButton>
              </>
            )}

            <span className="mx-1 h-5 w-px bg-border" aria-hidden />

            <TemplatesDropdown
              open={templateOpen}
              setOpen={setTemplateOpen}
              onPick={(k) => {
                applyTemplate(k);
                setTemplateOpen(false);
              }}
            />

            <TimerWidget />

            <ToolButton label="Eksport PNG" onClick={exportPng}>
              <Download size={14} />
            </ToolButton>

            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <ToolButton label="Usuń" onClick={deleteSelected} disabled={selectedCount === 0}>
              <Trash2 size={14} />
            </ToolButton>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <button
              type="button"
              onClick={save}
              disabled={saveState === "saving"}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-gradient px-3 font-sans text-[0.82rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[0.5px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:opacity-60"
            >
              <Save size={13} />
              {saveState === "saving"
                ? "Zapisuję…"
                : saveState === "saved"
                  ? "Zapisano"
                  : "Zapisz"}
            </button>
          </div>
          {saveState === "error" && saveError && (
            <span className="pointer-events-auto rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-destructive">
              {saveError}
            </span>
          )}
        </div>
      )}

      {/* z-[30] === Z.dropdown — connection badge nad canvas, ale pod MobileFullscreenToggle (z-50/fab) */}
      <div className="pointer-events-none absolute bottom-3 right-3 z-[30] flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-2 py-1 shadow-sm backdrop-blur">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            isConnected ? "bg-primary" : "bg-muted-foreground/50"
          }`}
          aria-hidden
        />
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">
          {isConnected ? "live" : "offline"}
        </span>
      </div>

      {canEdit && singleSelectedNode && (
        // key={nodeId} remounts panel (fresh collapsed=false) when selection changes.
        <TaskLinksPanel
          key={singleSelectedNode.id}
          nodeLabel={singleSelectedNode.data.label}
          linkedTasks={singleSelectedNode.data.linkedTasks ?? []}
          workspaceTasks={workspaceTasks}
          canCreateTask={canCreateTask}
          canCreateWithNoBoard={defaultBoardId !== null}
          onLink={handleLinkTask}
          onUnlink={handleUnlinkTask}
          onCreate={handleCreateAndLink}
          error={linkError}
        />
      )}
    </div>
  );
}

function TemplatesDropdown({
  open,
  setOpen,
  onPick,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onPick: (k: TemplateKey) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Szablony"
        title="Szablony"
        className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <LayoutTemplate size={14} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-20 w-44 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-[0_8px_20px_-8px_rgba(10,10,40,0.25)]">
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onPick(t.key)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[0.82rem] transition-colors hover:bg-accent"
            >
              <span className="text-primary" aria-hidden>
                {t.glyph}
              </span>
              <span className="flex-1 truncate">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskLinksPanel({
  nodeLabel,
  linkedTasks,
  workspaceTasks,
  canCreateTask,
  canCreateWithNoBoard,
  onLink,
  onUnlink,
  onCreate,
  error,
}: {
  nodeLabel: string | null;
  linkedTasks: NodeTaskChip[];
  workspaceTasks: WorkspaceTaskOption[];
  canCreateTask: boolean;
  canCreateWithNoBoard: boolean;
  onLink: (taskId: string) => void;
  onUnlink: (taskId: string) => void;
  onCreate: () => void;
  error: string | null;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const linkedIds = useMemo(() => new Set(linkedTasks.map((t) => t.taskId)), [linkedTasks]);
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      workspaceTasks
        .filter((t) => !linkedIds.has(t.id))
        .filter((t) => !q || t.title.toLowerCase().includes(q))
        .slice(0, 20),
    [workspaceTasks, linkedIds, q],
  );

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="Rozwiń panel zadań na węźle"
        aria-label="Rozwiń panel zadań na węźle"
        className="pointer-events-auto absolute right-3 top-14 z-10 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-1.5 shadow-lg backdrop-blur transition-colors hover:border-primary/60"
      >
        <Link2 size={12} className="text-primary" />
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
          Zadania
        </span>
        <span className="font-mono text-[0.7rem] font-semibold tabular-nums text-foreground">
          {linkedTasks.length}
        </span>
      </button>
    );
  }

  return (
    <div className="pointer-events-auto absolute right-3 top-14 z-10 flex w-[300px] flex-col gap-2 rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow text-primary">Zadania na węźle</span>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground">
            {linkedTasks.length}
          </span>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Zminimalizuj panel"
            title="Zminimalizuj (panel chowa się do małego chipa)"
            className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <span className="truncate text-[0.8rem] text-muted-foreground">
        {nodeLabel ? `„${nodeLabel}”` : "bez etykiety"}
      </span>

      {linkedTasks.length > 0 && (
        <ul className="flex flex-col gap-1">
          {linkedTasks.map((t) => (
            <li
              key={t.taskId}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
            >
              <span className="truncate flex-1 text-[0.82rem]" title={t.title}>
                {t.title}
              </span>
              <button
                type="button"
                onClick={() => onUnlink(t.taskId)}
                aria-label="Odepnij"
                title="Odepnij"
                className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <Link2 size={12} className="text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="szukaj zadania…"
            className="h-7 flex-1 rounded-md border border-border bg-background px-2 text-[0.8rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        </div>
        {filtered.length > 0 && (
          <ul className="flex max-h-[180px] flex-col gap-0.5 overflow-y-auto rounded-md border border-border bg-background">
            {filtered.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onLink(t.id)}
                  className="flex w-full items-center gap-1.5 truncate px-2 py-1 text-left text-[0.8rem] transition-colors hover:bg-accent"
                  title={t.title}
                >
                  <Link2 size={10} className="text-muted-foreground" />
                  <span className="truncate">{t.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {q && filtered.length === 0 && (
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
            Brak dopasowań.
          </span>
        )}
      </div>

      {canCreateTask && (
        <button
          type="button"
          onClick={onCreate}
          disabled={!canCreateWithNoBoard}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 font-sans text-[0.8rem] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          title={canCreateWithNoBoard ? undefined : "Brak tablicy w tej przestrzeni"}
        >
          <Unlink2 size={12} /> Utwórz zadanie z węzła
        </button>
      )}

      {error && (
        <span className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 font-mono text-[0.64rem] uppercase tracking-[0.12em] text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

function ToolButton({
  children,
  label,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`grid h-8 w-8 place-items-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// Inner <g> mirrors React Flow's pan/zoom transform so stroke points stay in world coordinates.
function StrokeViewportLayer({ strokes }: { strokes: CanvasStrokeValue[] }) {
  const { x, y, zoom } = useViewport();
  return (
    <svg
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <g transform={`translate(${x} ${y}) scale(${zoom})`}>
        {strokes.map((s) => {
          if (s.points.length < 4) return null;
          let d = `M ${s.points[0]} ${s.points[1]}`;
          for (let i = 2; i < s.points.length; i += 2) {
            d += ` L ${s.points[i]} ${s.points[i + 1]}`;
          }
          return (
            <path
              key={s.id}
              d={d}
              fill="none"
              stroke={s.colorHex}
              strokeWidth={s.size}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </g>
    </svg>
  );
}

// Pure visual feedback — actual snapping happens via React Flow's snapToGrid.
function AlignmentGuides({ vx, hy }: { vx: number[]; hy: number[] }) {
  const { x, y, zoom } = useViewport();
  if (vx.length === 0 && hy.length === 0) return null;
  return (
    <svg
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <g transform={`translate(${x} ${y}) scale(${zoom})`}>
        {vx.map((vxi, i) => (
          <line
            key={`v-${i}`}
            x1={vxi}
            y1={-100000}
            x2={vxi}
            y2={100000}
            stroke="#7C5CFF"
            strokeWidth={1 / zoom}
            strokeDasharray={`${4 / zoom} ${3 / zoom}`}
          />
        ))}
        {hy.map((hyi, i) => (
          <line
            key={`h-${i}`}
            x1={-100000}
            y1={hyi}
            x2={100000}
            y2={hyi}
            stroke="#7C5CFF"
            strokeWidth={1 / zoom}
            strokeDasharray={`${4 / zoom} ${3 / zoom}`}
          />
        ))}
      </g>
    </svg>
  );
}

// Sits above React Flow when toolMode='pen'; commits stroke to Yjs on pointerup.
function PenOverlay({
  color,
  size,
  onCommit,
}: {
  color: string;
  size: number;
  onCommit: (stroke: CanvasStrokeValue) => void;
}) {
  const reactFlow = useReactFlow();
  const [drawing, setDrawing] = useState<{ id: string; points: number[] } | null>(null);

  const ptr = (e: React.PointerEvent) => {
    return reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 4,
        cursor: "crosshair",
        // Block React Flow from receiving pointer events while drawing.
        background: "transparent",
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return; // left click only
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const p = ptr(e);
        const id = `s_${Date.now().toString(36)}_${Math.floor(Math.random() * 0xffff).toString(16)}`;
        setDrawing({ id, points: [p.x, p.y] });
      }}
      onPointerMove={(e) => {
        if (!drawing) return;
        const p = ptr(e);
        // Skip points within 1.5px — keeps stroke smooth without bloat.
        const last = drawing.points;
        const lx = last[last.length - 2];
        const ly = last[last.length - 1];
        if (Math.hypot(p.x - lx, p.y - ly) < 1.5) return;
        setDrawing({ ...drawing, points: [...drawing.points, p.x, p.y] });
      }}
      onPointerUp={() => {
        if (!drawing) return;
        if (drawing.points.length >= 4) {
          onCommit({
            id: drawing.id,
            colorHex: color,
            size,
            points: drawing.points,
          });
        }
        setDrawing(null);
      }}
      onPointerCancel={() => setDrawing(null)}
    >
      {/* In-progress stroke — drawn outside Yjs until pointerup commits. */}
      {drawing && drawing.points.length >= 4 && (
        <DrawingPreview points={drawing.points} color={color} size={size} />
      )}
    </div>
  );
}

function DrawingPreview({
  points,
  color,
  size,
}: {
  points: number[];
  color: string;
  size: number;
}) {
  const { x, y, zoom } = useViewport();
  let d = `M ${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length; i += 2) {
    d += ` L ${points[i]} ${points[i + 1]}`;
  }
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <g transform={`translate(${x} ${y}) scale(${zoom})`}>
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={size}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

const REACTION_EMOJIS = ["👍", "❤️", "🎉", "🔥", "💯", "🤔", "👀", "✨"];

function ContextMenu({
  x,
  y,
  hasSelection,
  isLocked,
  onClose,
  onDelete,
  onDuplicate,
  onBringFront,
  onReact,
  onToggleLock,
  // F12-K73 Task Line: gdy single TASK_REF selected, kontekst pokazuje
  // 3 opcje flow mark (początek/koniec/wyczyść). undefined = nie pokazuj.
  taskRefFlowMark,
  onSetFlowMark,
}: {
  x: number;
  y: number;
  hasSelection: boolean;
  isLocked: boolean;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onBringFront: () => void;
  onReact: (emoji: string) => void;
  onToggleLock: () => void;
  taskRefFlowMark?: "start" | "end" | null;
  onSetFlowMark?: (mark: "start" | "end" | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // F12-K73 fix: menu clip'owało się przy dolnej krawędzi viewport'u gdy
  // user kliknął prawym przy nisko siedzącym node'zie. Po pierwszym render
  // mierzymy menu i flippujemy do góry / w lewo gdy by wychodziło poza.
  const [adjusted, setAdjusted] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const PAD = 8;
    let nextTop = y;
    let nextLeft = x;
    if (y + rect.height + PAD > window.innerHeight) {
      // Flip do góry: ustaw bottom = y, czyli top = y - height.
      nextTop = Math.max(PAD, y - rect.height);
    }
    if (x + rect.width + PAD > window.innerWidth) {
      nextLeft = Math.max(PAD, x - rect.width);
    }
    if (nextTop !== y || nextLeft !== x) {
      setAdjusted({ top: nextTop, left: nextLeft });
    }
  }, [x, y]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      // `Node` is shadowed by @xyflow's Node type — use globalThis.Node for the DOM check.
      if (!ref.current?.contains(e.target as globalThis.Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const pos = adjusted ?? { top: y, left: x };
  return (
    <div
      ref={ref}
      // zIndex 200 === Z.popoverInModal (F12-K104) — ContextMenu nad selected node.
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 200 }}
      className="w-52 rounded-lg border border-border bg-popover p-1 shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]"
    >
      {hasSelection && (
        <>
          <div className="px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground/80">
            Reakcja
          </div>
          <div className="grid grid-cols-8 gap-0.5 px-1.5 pb-1.5">
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onReact(e);
                  onClose();
                }}
                aria-label={`Reaguj ${e}`}
                className="grid h-6 w-6 place-items-center rounded text-[0.92rem] transition-colors hover:bg-accent"
              >
                {e}
              </button>
            ))}
          </div>
          <div className="my-1 h-px bg-border" />
        </>
      )}
      <CtxItem
        icon={<Copy size={11} />}
        label="Duplikuj"
        disabled={!hasSelection}
        onClick={() => {
          onDuplicate();
          onClose();
        }}
      />
      <CtxItem
        icon={<TypeIcon size={11} />}
        label="Na wierzch"
        disabled={!hasSelection}
        onClick={() => {
          onBringFront();
          onClose();
        }}
      />
      <CtxItem
        icon={<Lock size={11} />}
        label={isLocked ? "Odblokuj" : "Zablokuj"}
        disabled={!hasSelection}
        onClick={() => {
          onToggleLock();
          onClose();
        }}
      />
      {/* F12-K73: Task Line flow mark section. Renderowane tylko gdy
          selected single TASK_REF (taskRefFlowMark prop ustawiony). */}
      {onSetFlowMark && (
        <>
          <div className="my-1 h-px bg-border" />
          <div className="px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground/80">
            Flow
          </div>
          <CtxItem
            icon={<Workflow size={11} />}
            label="Oznacz jako początkowe"
            disabled={taskRefFlowMark === "start"}
            onClick={() => {
              onSetFlowMark("start");
              onClose();
            }}
          />
          <CtxItem
            icon={<Workflow size={11} />}
            label="Oznacz jako końcowe"
            disabled={taskRefFlowMark === "end"}
            onClick={() => {
              onSetFlowMark("end");
              onClose();
            }}
          />
          {taskRefFlowMark && (
            <CtxItem
              icon={<X size={11} />}
              label="Wyczyść oznaczenie"
              onClick={() => {
                onSetFlowMark(null);
                onClose();
              }}
            />
          )}
        </>
      )}
      <div className="my-1 h-px bg-border" />
      <CtxItem
        icon={<Trash2 size={11} />}
        label="Usuń"
        destructive
        disabled={!hasSelection}
        onClick={() => {
          onDelete();
          onClose();
        }}
      />
    </div>
  );
}

// State lives only in this client (not synced) — it's a workshop nudge, not data.
function TimerWidget() {
  const [open, setOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5 * 60);
  const [running, setRunning] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          try {
            const ctx = new (window.AudioContext ||
              (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g);
            g.connect(ctx.destination);
            o.frequency.value = 660;
            g.gain.value = 0.08;
            o.start();
            o.stop(ctx.currentTime + 0.4);
          } catch {
            /* swallow — audio not critical */
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as globalThis.Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const PRESETS = [60, 180, 300, 600];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Timer"
        title="Timer"
        className={`grid h-8 min-w-[2.5rem] place-items-center rounded-md px-1.5 transition-colors ${
          running
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
      >
        {running || secondsLeft !== 5 * 60 ? (
          <span className="font-mono text-[0.74rem] tabular-nums">
            {mm}:{ss}
          </span>
        ) : (
          <TimerIcon size={14} />
        )}
      </button>
      {open && (
        // z-[200] === Z.popoverInModal (F12-K104) — TimerPopover, musi być nad modale.
        <div className="absolute right-0 top-[calc(100%+4px)] z-[200] w-44 rounded-lg border border-border bg-popover p-2 shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]">
          <div className="mb-2 grid place-items-center font-mono text-[1.25rem] tabular-nums text-foreground">
            {mm}:{ss}
          </div>
          <div className="mb-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setRunning((r) => !r)}
              className="flex-1 rounded-md bg-primary py-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-primary-foreground"
            >
              {running ? "Pauza" : "Start"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRunning(false);
                setSecondsLeft(5 * 60);
              }}
              className="rounded-md border border-border px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Reset
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSecondsLeft(s);
                  setRunning(true);
                }}
                className="rounded-md border border-border py-1 text-center font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
              >
                {s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RemoteCursorsLayer({
  cursors,
}: {
  cursors: Map<string, CanvasPresenceState>;
}) {
  const { x, y, zoom } = useViewport();
  if (cursors.size === 0) return null;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 6,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${x}px, ${y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {Array.from(cursors.values()).map((c) => (
          <div
            key={c.clientId}
            style={{
              position: "absolute",
              left: c.x,
              top: c.y,
              transform: `translate(-2px, -2px) scale(${1 / zoom})`,
              transformOrigin: "0 0",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              style={{ display: "block", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))" }}
            >
              <path
                d="M2 2 L2 16 L6 12 L9 17 L11 16 L8 11 L14 11 Z"
                fill={c.color}
                stroke="white"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="absolute left-3.5 top-3.5 inline-block whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-white shadow-sm"
              style={{ background: c.color }}
            >
              {c.name ?? c.clientId.slice(0, 4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CtxItem({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.82rem] transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-accent"
      }`}
    >
      <span className="grid h-4 w-4 place-items-center">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}

// Native <Controls/> from react-flow has no dark-mode parity; we use semantic vars instead.
// F12-K130: dodany fullscreen button — icon Maximize2 wcześniej myląco
// wyglądał jak "pełny ekran" ale wywoływał fitView. Teraz Fullscreen API
// (browser native) — wrapper rozszerza się do całego viewport'u.
function CanvasZoomControls({
  wrapperRef,
}: {
  wrapperRef: React.RefObject<HTMLDivElement | null>;
}) {
  const rf = useReactFlow();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [wrapperRef]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await wrapperRef.current?.requestFullscreen();
      }
    } catch {
      /* user denied / browser nie wspiera — silent fail */
    }
  };

  return (
    <div
      className="absolute bottom-4 left-4 z-[5] flex flex-col gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-lg backdrop-blur"
      data-canvas-controls=""
    >
      <ControlButton label="Powiększ" onClick={() => rf.zoomIn()}>
        <PlusIcon size={14} />
      </ControlButton>
      <ControlButton label="Pomniejsz" onClick={() => rf.zoomOut()}>
        <MinusIcon size={14} />
      </ControlButton>
      <ControlButton
        label={isFullscreen ? "Wyjdź z pełnego ekranu" : "Pełny ekran"}
        onClick={toggleFullscreen}
      >
        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </ControlButton>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

function TextColorPicker({
  selectedNodes,
  onPick,
}: {
  selectedNodes: RFNode[];
  onPick: (hex: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  // F12-K103: portal-rendered popover. Trigger siedzi w toolbar wrapperze
  // który ma z-10 (stacking context), więc lokalne z-[60] NIE wyjdzie nad
  // task-modal (z-85) / onboarding (z-80). createPortal(document.body) +
  // fixed positioning rozwiązuje to + omija ewentualne overflow-hidden
  // na canvas container. Wzorzec z components/ui/portal-dropdown.tsx.
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    const recompute = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      if (r.bottom < 0 || r.top > window.innerHeight) {
        setOpen(false);
        return;
      }
      const POP_W = 200;
      const left = Math.min(
        Math.max(8, r.left),
        window.innerWidth - POP_W - 8,
      );
      setCoords({ top: r.bottom + 6, left });
    };
    recompute();
    const onScroll = () => recompute();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as unknown as globalThis.Node;
      if (triggerRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Returns null when selection has mixed text colors.
  const currentColor = (() => {
    if (selectedNodes.length === 0) return null;
    const first = selectedNodes[0]?.data.textColorHex ?? null;
    const allSame = selectedNodes.every(
      (n) => (n.data.textColorHex ?? null) === first,
    );
    return allSame ? first : null;
  })();

  const disabled = selectedNodes.length === 0;
  const TEXT_PALETTE = [
    ...PALETTE,
    "#000000",
    "#FFFFFF",
  ];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        title="Kolor tekstu"
        aria-label="Kolor tekstu"
        className="inline-flex h-7 items-center gap-0.5 rounded-md border border-border bg-background px-1.5 transition-colors hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="font-display text-[0.78rem] font-bold leading-none">A</span>
        <span
          className="block h-1 w-3 rounded-sm"
          style={{
            background: currentColor ?? "linear-gradient(90deg, #FF3B30, #0A84FF)",
            border: currentColor
              ? "none"
              : "1px solid var(--border)",
          }}
          aria-hidden
        />
      </button>
      {open &&
        !disabled &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: 200,
              // zIndex 200 === Z.popoverInModal (F12-K104) — TextColorPicker.
              zIndex: 200,
            }}
            className="flex flex-col gap-1.5 rounded-lg border border-border bg-popover p-2 shadow-[0_12px_32px_-12px_rgba(10,10,40,0.25)]"
          >
            <div className="flex flex-wrap gap-1.5">
              {TEXT_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    onPick(c);
                    setOpen(false);
                  }}
                  className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${
                    currentColor === c
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border"
                  }`}
                  style={{ background: c }}
                  aria-label={`Kolor tekstu ${c}`}
                  title={c}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                onPick(null);
                setOpen(false);
              }}
              className={`mt-1 inline-flex h-7 items-center justify-center rounded-md border border-border bg-background px-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] transition-colors hover:border-primary/60 ${
                currentColor === null ? "border-primary text-primary" : "text-muted-foreground"
              }`}
            >
              Auto (kontrast)
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

function FontSizePicker({
  selectedNodes,
  onPick,
}: {
  selectedNodes: RFNode[];
  onPick: (size: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  // F12-K103: portal-rendered popover, takie samo uzasadnienie jak
  // TextColorPicker — trigger w toolbarze z-10, popover musi wyjść
  // ponad task-modal (z-85) i onboarding (z-80).
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  // null = mixed selection or Auto (no override set).
  const currentSize = (() => {
    if (selectedNodes.length === 0) return null;
    const first = (selectedNodes[0]?.data.fontSize as number | null | undefined) ?? null;
    const allSame = selectedNodes.every(
      (n) => ((n.data.fontSize as number | null | undefined) ?? null) === first,
    );
    return allSame ? first : null;
  })();

  // Local draft separates typing from commit (Enter / blur).
  const [draft, setDraft] = useState<string>(() =>
    currentSize !== null ? String(currentSize) : "",
  );

  useEffect(() => {
    setDraft(currentSize !== null ? String(currentSize) : "");
  }, [currentSize, selectedNodes.length]);

  useEffect(() => {
    if (!open) return;
    const recompute = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      if (r.bottom < 0 || r.top > window.innerHeight) {
        setOpen(false);
        return;
      }
      const POP_W = 220;
      const left = Math.min(
        Math.max(8, r.left),
        window.innerWidth - POP_W - 8,
      );
      setCoords({ top: r.bottom + 6, left });
    };
    recompute();
    const onScroll = () => recompute();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as unknown as globalThis.Node;
      if (triggerRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const disabled = selectedNodes.length === 0;
  const MIN_PX = 6;
  const MAX_PX = 200;

  const PRESETS = [12, 14, 18, 24, 36, 48];

  const baselineForStepper = currentSize ?? 15;

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) {
      onPick(null);
      return;
    }
    const clamped = Math.max(MIN_PX, Math.min(MAX_PX, n));
    onPick(clamped);
  };

  const step = (delta: number) => {
    const next = Math.max(MIN_PX, Math.min(MAX_PX, baselineForStepper + delta));
    onPick(next);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        title="Rozmiar fontu"
        aria-label="Rozmiar fontu"
        className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 transition-colors hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className="font-display text-[0.62rem] font-bold leading-none">A</span>
        <span className="font-display text-[0.92rem] font-bold leading-none">A</span>
        {currentSize !== null && (
          <span className="font-mono text-[0.6rem] text-muted-foreground">
            {currentSize}
          </span>
        )}
      </button>
      {open &&
        !disabled &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: 220,
              // zIndex 200 === Z.popoverInModal (F12-K104) — FontSizePicker.
              zIndex: 200,
            }}
            className="flex flex-col gap-2 rounded-lg border border-border bg-popover p-2 shadow-[0_12px_32px_-12px_rgba(10,10,40,0.25)]"
          >
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Zmniejsz"
              title="Zmniejsz o 1px"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-background font-display text-[1rem] leading-none text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
            >
              −
            </button>
            <input
              type="number"
              min={MIN_PX}
              max={MAX_PX}
              step={1}
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commit(draft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit(draft);
                  setOpen(false);
                }
              }}
              placeholder="Auto"
              aria-label="Rozmiar fontu w px"
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-center font-mono text-[0.86rem] outline-none placeholder:text-muted-foreground/60 focus:border-primary"
            />
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Powiększ"
              title="Powiększ o 1px"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-background font-display text-[1rem] leading-none text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
            >
              +
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  onPick(p);
                  setOpen(false);
                }}
                className={`inline-flex h-7 min-w-[36px] items-center justify-center rounded-md border px-2 font-mono text-[0.72rem] transition-colors hover:border-primary/60 ${
                  currentSize === p
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
                title={`${p} px`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onPick(null);
              setOpen(false);
            }}
            className={`inline-flex h-7 items-center justify-center rounded-md border bg-background px-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] transition-colors hover:border-primary/60 ${
              currentSize === null
                ? "border-primary text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            Auto (domyślny)
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

// F12-K72 v4: Mural-style mobile vertical toolbar — KOMPLET narzędzi z
// desktop'a, pogrupowane mądrze. Klient: "zeby wszystkie opcje z desktopowej
// apki sie znalazly. tylko pogrupuj jakos madrze".
//
// Grupy (top → bottom):
//   1. MODE (Wskaźnik / Pisak) — zawsze widoczne
//   2. SHAPES expander → Prostokąt / Romb / Koło (popover right)
//   3. CONTENT (Sticky / Tekst / Ramka) — zawsze widoczne (najczęstsze)
//   4. MEDIA (Obraz)
//   5. TEMPLATES expander → grid template'ów (popover right)
//   6. ACTIONS (Eksport PNG / Usuń [context] / Zapisz)
//
// Context-aware bottom-bar:
//   - Pen mode → kolory + grubości + clear strokes
//
// Cały toolbar overflow-y-auto żeby na małych viewportach (np. iPhone SE
// 568px height) działał scroll wewnętrzny.
function MobileCanvasToolbar({
  toolMode,
  setToolMode,
  addShape,
  imageInputRef,
  penColor,
  setPenColor,
  penSize,
  setPenSize,
  strokesCount,
  clearAllStrokes,
  selectedCount,
  deleteSelected,
  exportPng,
  save,
  saveState,
  onPickTemplate,
}: {
  toolMode: ToolMode;
  setToolMode: (m: ToolMode) => void;
  addShape: (k: ShapeKind) => void;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  penColor: string;
  setPenColor: (c: string) => void;
  penSize: PenSize;
  setPenSize: (s: PenSize) => void;
  strokesCount: number;
  clearAllStrokes: () => void;
  selectedCount: number;
  deleteSelected: () => void;
  exportPng: () => void | Promise<void>;
  save: () => void | Promise<void>;
  saveState: "idle" | "saving" | "saved" | "error";
  onPickTemplate: (k: TemplateKey) => void;
}) {
  const [shapesOpen, setShapesOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  return (
    <>
      <div className="pointer-events-auto absolute left-2 top-1/2 z-20 flex max-h-[calc(100dvh-48px)] -translate-y-1/2 flex-col gap-1 overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900/95 p-1.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden">
        {/* MODE */}
        <MobileToolButton
          active={toolMode === "select"}
          onClick={() => setToolMode("select")}
          label="Wskaźnik"
        >
          <MousePointer2 size={15} />
        </MobileToolButton>
        <MobileToolButton
          active={toolMode === "pen"}
          onClick={() => setToolMode("pen")}
          label="Pisak"
        >
          <Pencil size={15} />
        </MobileToolButton>

        <span className="mx-1 h-px bg-white/10" aria-hidden />

        {/* SHAPES — expand on tap → popover po prawej */}
        <div className="relative">
          <MobileToolButton
            active={shapesOpen}
            onClick={() => setShapesOpen((v) => !v)}
            label="Kształty"
          >
            <SquareIcon size={15} />
          </MobileToolButton>
          {shapesOpen && (
            <div className="absolute left-[calc(100%+8px)] top-0 flex gap-1 rounded-xl border border-white/10 bg-neutral-900/95 p-1.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] backdrop-blur">
              <MobileToolButton
                onClick={() => {
                  addShape("RECTANGLE");
                  setShapesOpen(false);
                }}
                label="Prostokąt"
              >
                <SquareIcon size={15} />
              </MobileToolButton>
              <MobileToolButton
                onClick={() => {
                  addShape("DIAMOND");
                  setShapesOpen(false);
                }}
                label="Romb"
              >
                <DiamondIcon size={15} />
              </MobileToolButton>
              <MobileToolButton
                onClick={() => {
                  addShape("CIRCLE");
                  setShapesOpen(false);
                }}
                label="Koło"
              >
                <CircleIcon size={15} />
              </MobileToolButton>
            </div>
          )}
        </div>

        {/* CONTENT */}
        <MobileToolButton onClick={() => addShape("STICKY")} label="Sticky note">
          <StickyNote size={15} />
        </MobileToolButton>
        <MobileToolButton onClick={() => addShape("TEXT")} label="Tekst">
          <TypeIcon size={15} />
        </MobileToolButton>
        <MobileToolButton onClick={() => addShape("FRAME")} label="Ramka">
          <FrameIcon size={15} />
        </MobileToolButton>

        {/* MEDIA */}
        <MobileToolButton
          onClick={() => imageInputRef.current?.click()}
          label="Obraz"
        >
          <ImageIcon size={15} />
        </MobileToolButton>

        <span className="mx-1 h-px bg-white/10" aria-hidden />

        {/* TEMPLATES — expand on tap → popover po prawej */}
        <div className="relative">
          <MobileToolButton
            active={templatesOpen}
            onClick={() => setTemplatesOpen((v) => !v)}
            label="Szablony"
          >
            <LayoutTemplate size={15} />
          </MobileToolButton>
          {templatesOpen && (
            <div className="absolute left-[calc(100%+8px)] top-0 flex max-h-[60dvh] w-[200px] flex-col gap-1 overflow-y-auto rounded-xl border border-white/10 bg-neutral-900/95 p-2 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] backdrop-blur">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    onPickTemplate(t.key);
                    setTemplatesOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-[0.82rem] text-white/90 transition-colors hover:bg-white/10 active:scale-[0.98]"
                >
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="mx-1 h-px bg-white/10" aria-hidden />

        {/* ACTIONS */}
        <MobileToolButton
          onClick={() => void exportPng()}
          label="Eksport PNG"
        >
          <Download size={15} />
        </MobileToolButton>
        {selectedCount > 0 && (
          <MobileToolButton
            onClick={deleteSelected}
            label={`Usuń (${selectedCount})`}
            tone="destructive"
          >
            <Trash2 size={15} />
          </MobileToolButton>
        )}
        <MobileToolButton
          onClick={() => void save()}
          label={
            saveState === "saving"
              ? "Zapisuję…"
              : saveState === "saved"
                ? "Zapisano"
                : "Zapisz"
          }
          tone="primary"
        >
          <Save size={15} />
        </MobileToolButton>
      </div>

      {/* Context-aware pen panel — pokazuje się TYLKO gdy pen mode, na dole
          ekranu nad fullscreen button'em. Mirror desktop'owej pen options
          row, ale w kompaktowej formie horizontal. */}
      {toolMode === "pen" && (
        <div className="pointer-events-auto absolute bottom-3 left-1/2 z-20 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-neutral-900/95 px-2 py-1.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden">
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setPenColor(c)}
              aria-label={`Kolor ${c}`}
              className="h-7 w-7 shrink-0 rounded-full border border-white/20 transition-transform active:scale-90"
              style={{
                background: c,
                outline: penColor === c ? "2px solid #fff" : "none",
                outlineOffset: 2,
              }}
            />
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-white/10" aria-hidden />
          {PEN_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPenSize(s)}
              aria-label={`Grubość ${s}px`}
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors active:scale-90 ${
                penSize === s ? "bg-white/15" : "hover:bg-white/10"
              }`}
            >
              <span
                className="block rounded-full"
                style={{ background: penColor, width: s + 3, height: s + 3 }}
              />
            </button>
          ))}
          {strokesCount > 0 && (
            <>
              <span className="mx-1 h-5 w-px shrink-0 bg-white/10" aria-hidden />
              <button
                type="button"
                onClick={clearAllStrokes}
                aria-label={`Wyczyść rysunki (${strokesCount})`}
                title={`Wyczyść rysunki (${strokesCount})`}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/80 transition-colors hover:bg-white/10 active:scale-90"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

function MobileToolButton({
  active,
  onClick,
  label,
  children,
  tone = "default",
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  // tone primary = brand gradient (Zapisz), destructive = czerwony (Usuń),
  // default = white/85 z hover bg-white/10. active flag = aktualny tool.
  tone?: "default" | "primary" | "destructive";
}) {
  const toneClass = active
    ? "bg-primary text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
    : tone === "primary"
      ? "bg-brand-gradient text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
      : tone === "destructive"
        ? "bg-red-500/20 text-red-200 hover:bg-red-500/30"
        : "text-white/85 hover:bg-white/10";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 place-items-center rounded-xl transition-[transform,background-color] active:scale-95 ${toneClass}`}
    >
      {children}
    </button>
  );
}

// F12-K130: MobileFullscreenToggle usunięty — fullscreen przeniesiony do
// CanvasZoomControls (button "Pełny ekran" obok +/- zoom). Klient uważał
// że osobny button bottom-right jest bez sensu, wystarczy jeden button
// w istniejącym zoom control pasku po lewej.
