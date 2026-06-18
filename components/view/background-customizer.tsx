"use client";

import { useState, useTransition } from "react";
import { Paintbrush, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateBackgroundAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import type { BackgroundConfig } from "@/lib/schemas/background";
import { backgroundToCss } from "@/lib/schemas/background";

type Kind = "none" | "color" | "gradient" | "image";

const PRESET_COLORS = [
  "#F8FAFC",
  "#FEF3C7",
  "#E0F2FE",
  "#E0E7FF",
  "#F3E8FF",
  "#FCE7F3",
  "#D1FAE5",
  "#FEE2E2",
];

const PRESET_GRADIENTS: { from: string; to: string; angle: number }[] = [
  { from: "#7C5CFF", to: "#D247B5", angle: 135 }, // brand
  { from: "#60A5FA", to: "#C084FC", angle: 135 },
  { from: "#34D399", to: "#0EA5E9", angle: 135 },
  { from: "#FCD34D", to: "#FB923C", angle: 135 },
  { from: "#F472B6", to: "#FB923C", angle: 135 },
  { from: "#1E293B", to: "#475569", angle: 135 },
];

export function BackgroundCustomizer({
  workspaceId,
  boardId,
  viewType,
  initial,
}: {
  workspaceId: string;
  boardId: string;
  viewType: "TABLE" | "KANBAN" | "ROADMAP" | "GANTT" | "WHITEBOARD";
  initial: BackgroundConfig | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [kind, setKind] = useState<Kind>((initial?.kind ?? "none") as Kind);
  const [color, setColor] = useState(
    initial?.kind === "color" ? initial.value : PRESET_COLORS[0],
  );
  const [gradient, setGradient] = useState(
    initial?.kind === "gradient"
      ? { from: initial.from, to: initial.to, angle: initial.angle }
      : PRESET_GRADIENTS[0],
  );
  const [imageUrl, setImageUrl] = useState(
    initial?.kind === "image" ? initial.url : "",
  );

  const preview: BackgroundConfig = (() => {
    if (kind === "none") return { kind: "none" };
    if (kind === "color") return { kind: "color", value: color };
    if (kind === "gradient")
      return { kind: "gradient", from: gradient.from, to: gradient.to, angle: gradient.angle };
    return { kind: "image", url: imageUrl };
  })();

  const save = () => {
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("viewType", viewType);
    fd.set("payload", JSON.stringify(preview));
    startTransition(async () => {
      await updateBackgroundAction(fd);
      setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
        aria-label="Personalizuj tło widoku"
      >
        <Paintbrush size={13} /> Tło
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl border-border bg-card shadow-aura sm:max-w-[600px]">
          <DialogHeader>
            <span className="eyebrow">Wygląd widoku</span>
            <DialogTitle className="font-display text-[1.5rem] font-bold leading-[1.15] tracking-[-0.02em]">
              Ustaw <span className="text-brand-gradient">tło</span> tabeli
            </DialogTitle>
            <DialogDescription className="text-[0.92rem] leading-[1.55] text-muted-foreground">
              Każdy widok (Tabela / Kanban / Roadmap) ma własne tło. Zmiana
              dotyczy tylko Ciebie… <em>na razie wspólna dla workspace'u</em>.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex flex-col gap-5">
            <KindTabs kind={kind} onChange={setKind} />

            {kind === "color" && (
              <ColorPresets selected={color} onChange={setColor} />
            )}

            {kind === "gradient" && (
              <GradientPresets
                selected={gradient}
                onChange={setGradient}
              />
            )}

            {kind === "image" && (
              <label className="flex flex-col gap-2">
                <span className="eyebrow">URL obrazu</span>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…"
                  className="h-10 rounded-lg border border-border bg-transparent px-3 text-[0.95rem] outline-none focus:border-primary"
                />
                <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
                  upload obrazków z dysku — w kolejnej wersji
                </span>
              </label>
            )}

            {/* Preview */}
            <div className="flex flex-col gap-2">
              <span className="eyebrow">Podgląd</span>
              <div
                className="h-32 rounded-xl border border-border"
                style={{
                  background: backgroundToCss(preview) ?? "var(--muted)",
                }}
              />
            </div>

            <div className="mt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
              >
                {pending ? "Zapisuję…" : "Zapisz tło"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function KindTabs({ kind, onChange }: { kind: Kind; onChange: (k: Kind) => void }) {
  const tabs: { key: Kind; label: string }[] = [
    { key: "none", label: "Brak" },
    { key: "color", label: "Kolor" },
    { key: "gradient", label: "Gradient" },
    { key: "image", label: "Obraz" },
  ];
  return (
    <div className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          data-active={kind === t.key ? "true" : "false"}
          className="flex-1 rounded-md px-3 py-1.5 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors data-[active=true]:bg-card data-[active=true]:text-foreground data-[active=true]:shadow-sm"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ColorPresets({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow">Kolory</span>
      <div className="grid grid-cols-8 gap-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className="h-10 rounded-lg border border-border transition-transform hover:scale-105 focus-visible:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            style={{
              background: c,
              boxShadow:
                selected === c
                  ? "0 0 0 2px var(--primary), 0 0 0 4px var(--background) inset"
                  : undefined,
            }}
            aria-label={`kolor ${c}`}
          />
        ))}
      </div>
      <input
        type="color"
        value={selected}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-10 w-full cursor-pointer rounded-lg border border-border"
      />
    </div>
  );
}

function GradientPresets({
  selected,
  onChange,
}: {
  selected: { from: string; to: string; angle: number };
  onChange: (g: { from: string; to: string; angle: number }) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow">Gradient</span>
      <div className="grid grid-cols-6 gap-2">
        {PRESET_GRADIENTS.map((g, i) => {
          const match =
            selected.from === g.from && selected.to === g.to && selected.angle === g.angle;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(g)}
              className="h-12 rounded-lg border border-border transition-transform hover:scale-105"
              style={{
                backgroundImage: `linear-gradient(${g.angle}deg, ${g.from} 0%, ${g.to} 100%)`,
                boxShadow: match
                  ? "0 0 0 2px var(--primary), 0 0 0 4px var(--background) inset"
                  : undefined,
              }}
              aria-label={`gradient preset ${i}`}
            />
          );
        })}
      </div>
    </div>
  );
}
