import type { ShapeKind } from "@/components/canvas/shape-node";
import type { CanvasEdgeEnd } from "@/lib/yjs/canvas-doc";

export type TemplateKey =
  | "mindmap"
  | "flowchart"
  | "userflow"
  | "wireframe"
  | "retro"
  | "eisenhower"
  | "lean-canvas"
  | "fishbone"
  | "customer-journey"
  | "kanban-swimlane"
  | "mvp-launch";

// `__assignedId` is set during apply; used by the editor to pair node↔edge indices.
export interface TemplateNodeSpec {
  shape: ShapeKind;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  colorHex: string;
  __assignedId?: string;
}

export interface TemplateEdgeSpec {
  fromIdx: number;
  toIdx: number;
  label?: string;
  style: "solid" | "dashed";
  endStyle: CanvasEdgeEnd;
}

export interface TemplateDef {
  key: TemplateKey;
  label: string;
  glyph: string;
  build: () => { nodes: TemplateNodeSpec[]; edges: TemplateEdgeSpec[] };
}

const rect = (label: string, x: number, y: number): TemplateNodeSpec => ({
  shape: "RECTANGLE",
  label,
  x,
  y,
  width: 180,
  height: 72,
  colorHex: "#FFFFFF",
});
const sticky = (label: string, x: number, y: number, color = "#FEF3C7"): TemplateNodeSpec => ({
  shape: "STICKY",
  label,
  x,
  y,
  width: 160,
  height: 160,
  colorHex: color,
});
const diamond = (label: string, x: number, y: number): TemplateNodeSpec => ({
  shape: "DIAMOND",
  label,
  x,
  y,
  width: 160,
  height: 80,
  colorHex: "#DBEAFE",
});
const circle = (label: string, x: number, y: number): TemplateNodeSpec => ({
  shape: "CIRCLE",
  label,
  x,
  y,
  width: 120,
  height: 120,
  colorHex: "#EDE9FE",
});
const frame = (label: string, x: number, y: number, w: number, h: number): TemplateNodeSpec => ({
  shape: "FRAME",
  label,
  x,
  y,
  width: w,
  height: h,
  colorHex: "#F1F5F9",
});

export const TEMPLATES: TemplateDef[] = [
  {
    key: "mindmap",
    label: "Mindmap",
    glyph: "◉",
    build: () => {
      const nodes: TemplateNodeSpec[] = [
        circle("Temat", 400, 260),
        rect("Obszar A", 100, 120),
        rect("Obszar B", 700, 120),
        rect("Obszar C", 700, 420),
        rect("Obszar D", 100, 420),
      ];
      const edges: TemplateEdgeSpec[] = [
        { fromIdx: 0, toIdx: 1, style: "solid", endStyle: "none" },
        { fromIdx: 0, toIdx: 2, style: "solid", endStyle: "none" },
        { fromIdx: 0, toIdx: 3, style: "solid", endStyle: "none" },
        { fromIdx: 0, toIdx: 4, style: "solid", endStyle: "none" },
      ];
      return { nodes, edges };
    },
  },
  {
    key: "flowchart",
    label: "Flowchart",
    glyph: "◇",
    build: () => {
      const nodes: TemplateNodeSpec[] = [
        circle("Start", 360, 40),
        rect("Krok 1", 340, 200),
        diamond("Decyzja?", 340, 340),
        rect("Krok 2a", 140, 480),
        rect("Krok 2b", 540, 480),
        circle("Koniec", 360, 640),
      ];
      const edges: TemplateEdgeSpec[] = [
        { fromIdx: 0, toIdx: 1, style: "solid", endStyle: "arrow" },
        { fromIdx: 1, toIdx: 2, style: "solid", endStyle: "arrow" },
        { fromIdx: 2, toIdx: 3, label: "nie", style: "solid", endStyle: "arrow" },
        { fromIdx: 2, toIdx: 4, label: "tak", style: "solid", endStyle: "arrow" },
        { fromIdx: 3, toIdx: 5, style: "solid", endStyle: "arrow" },
        { fromIdx: 4, toIdx: 5, style: "solid", endStyle: "arrow" },
      ];
      return { nodes, edges };
    },
  },
  {
    key: "userflow",
    label: "User flow",
    glyph: "→",
    build: () => {
      const nodes: TemplateNodeSpec[] = [
        rect("Landing", 40, 120),
        rect("Signup", 280, 120),
        rect("Onboarding", 520, 120),
        rect("Dashboard", 760, 120),
        sticky("Tutaj tracimy 40%", 260, 280, "#FEE2E2"),
      ];
      const edges: TemplateEdgeSpec[] = [
        { fromIdx: 0, toIdx: 1, style: "solid", endStyle: "arrow" },
        { fromIdx: 1, toIdx: 2, style: "solid", endStyle: "arrow" },
        { fromIdx: 2, toIdx: 3, style: "solid", endStyle: "arrow" },
        { fromIdx: 1, toIdx: 4, style: "dashed", endStyle: "none" },
      ];
      return { nodes, edges };
    },
  },
  {
    key: "wireframe",
    label: "Wireframe",
    glyph: "▣",
    build: () => {
      const nodes: TemplateNodeSpec[] = [
        frame("Header", 40, 40, 720, 90),
        frame("Hero", 40, 150, 720, 220),
        frame("Feature grid", 40, 390, 340, 260),
        frame("Sidebar", 420, 390, 340, 260),
        frame("Footer", 40, 670, 720, 90),
      ];
      return { nodes, edges: [] };
    },
  },
  {
    key: "retro",
    label: "Retro",
    glyph: "◈",
    build: () => {
      const nodes: TemplateNodeSpec[] = [
        frame("Co zadziałało", 40, 40, 300, 340),
        frame("Co nie zadziałało", 360, 40, 300, 340),
        frame("Action items", 680, 40, 300, 340),
        sticky("Przykład: ", 80, 110, "#DCFCE7"),
        sticky("Przykład: ", 400, 110, "#FEE2E2"),
        sticky("Przykład: ", 720, 110, "#DBEAFE"),
      ];
      return { nodes, edges: [] };
    },
  },
  {
    key: "eisenhower",
    label: "Macierz Eisenhowera",
    glyph: "▦",
    build: () => {
      const nodes: TemplateNodeSpec[] = [
        frame("Pilne · Ważne (zrób)", 40, 40, 360, 320),
        frame("Niepilne · Ważne (planuj)", 420, 40, 360, 320),
        frame("Pilne · Nieważne (deleguj)", 40, 380, 360, 320),
        frame("Niepilne · Nieważne (eliminuj)", 420, 380, 360, 320),
      ];
      return { nodes, edges: [] };
    },
  },
  {
    key: "lean-canvas",
    label: "Lean Canvas",
    glyph: "▥",
    build: () => {
      // Ash Maurya's 9-block layout.
      const nodes: TemplateNodeSpec[] = [
        frame("1. Problem", 40, 40, 200, 240),
        frame("2. Segmenty klientów", 880, 40, 200, 240),
        frame("3. Unikalna wartość", 460, 40, 220, 240),
        frame("4. Rozwiązanie", 240, 40, 220, 240),
        frame("5. Kanały", 680, 40, 200, 240),
        frame("6. Strumienie przychodu", 460, 280, 220, 240),
        frame("7. Struktura kosztów", 40, 280, 420, 240),
        frame("8. Kluczowe metryki", 240, 280, 220, 240),
        frame("9. Przewaga", 680, 280, 400, 240),
      ];
      return { nodes, edges: [] };
    },
  },
  {
    key: "fishbone",
    label: "Diagram Ishikawy",
    glyph: "🠷",
    build: () => {
      const nodes: TemplateNodeSpec[] = [
        rect("Problem / Skutek", 760, 240),
        rect("Ludzie", 60, 60),
        rect("Proces", 360, 60),
        rect("Materiały", 60, 440),
        rect("Maszyny", 360, 440),
      ];
      const edges: TemplateEdgeSpec[] = [
        { fromIdx: 1, toIdx: 0, style: "solid", endStyle: "arrow" },
        { fromIdx: 2, toIdx: 0, style: "solid", endStyle: "arrow" },
        { fromIdx: 3, toIdx: 0, style: "solid", endStyle: "arrow" },
        { fromIdx: 4, toIdx: 0, style: "solid", endStyle: "arrow" },
      ];
      return { nodes, edges };
    },
  },
  {
    key: "customer-journey",
    label: "Customer Journey",
    glyph: "↦",
    build: () => {
      const stages = ["Świadomość", "Rozważanie", "Decyzja", "Użycie", "Polecanie"];
      const colW = 200;
      const stageY = 40;
      const nodes: TemplateNodeSpec[] = [];
      stages.forEach((s, i) => {
        nodes.push(rect(s, 40 + i * colW, stageY));
        nodes.push(sticky("Akcja", 60 + i * colW, stageY + 110, "#DBEAFE"));
        nodes.push(sticky("Myśli", 60 + i * colW, stageY + 290, "#FEF3C7"));
        nodes.push(sticky("Emocja", 60 + i * colW, stageY + 470, "#FBCFE8"));
      });
      return { nodes, edges: [] };
    },
  },
  {
    key: "kanban-swimlane",
    label: "Kanban (3 kolumny)",
    glyph: "▰",
    build: () => {
      const nodes: TemplateNodeSpec[] = [
        frame("Do zrobienia", 40, 40, 280, 460),
        frame("W toku", 340, 40, 280, 460),
        frame("Gotowe", 640, 40, 280, 460),
        sticky("Zadanie A", 60, 110, "#FEF3C7"),
        sticky("Zadanie B", 60, 290, "#FEF3C7"),
        sticky("Zadanie C", 360, 110, "#BFDBFE"),
        sticky("Zadanie D", 660, 110, "#BBF7D0"),
      ];
      return { nodes, edges: [] };
    },
  },
  {
    key: "mvp-launch",
    label: "MVP Launch",
    glyph: "▶",
    build: () => {
      const nodes: TemplateNodeSpec[] = [
        circle("Pomysł", 40, 200),
        rect("Walidacja", 220, 200),
        rect("MVP", 440, 200),
        rect("Launch", 660, 200),
        circle("Mierz", 880, 200),
        sticky("Ryzyka", 220, 60, "#FEE2E2"),
        sticky("Hipotezy", 440, 60, "#FEF3C7"),
        sticky("Metryki", 880, 60, "#DBEAFE"),
      ];
      const edges: TemplateEdgeSpec[] = [
        { fromIdx: 0, toIdx: 1, style: "solid", endStyle: "arrow" },
        { fromIdx: 1, toIdx: 2, style: "solid", endStyle: "arrow" },
        { fromIdx: 2, toIdx: 3, style: "solid", endStyle: "arrow" },
        { fromIdx: 3, toIdx: 4, style: "solid", endStyle: "arrow" },
      ];
      return { nodes, edges };
    },
  },
];

// Caller assigns real ids, commits to Y.Doc, and updates React Flow in a single transaction.
export function applyCanvasTemplate(
  key: TemplateKey,
  commit: (nodes: TemplateNodeSpec[], edges: TemplateEdgeSpec[]) => void,
): void {
  const def = TEMPLATES.find((t) => t.key === key);
  if (!def) return;
  const { nodes, edges } = def.build();
  commit(nodes, edges);
}
