"use client";

// F12-K83: onboarding tour — 4-step modal carousel pokazywany przy pierwszym
// loginie. (app) layout decyduje czy mount'ować ten komponent (czyta
// User.onboardingCompletedAt). Po "Zaczynamy" lub "Pomiń" wywołuje
// completeOnboardingAction() która ustawia flagę → revalidatePath → unmount.

import { useState, useTransition } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Compass, LayoutDashboard, Sparkles, Wand2 } from "lucide-react";

import { completeOnboardingAction } from "@/app/(app)/onboarding/actions";
import { cn } from "@/lib/utils";

interface Step {
  num: number;
  title: string;
  desc: string;
  cta: string;
  icon: React.ReactNode;
  illBg: string;
  aura: string;
}

const STEPS: Step[] = [
  {
    num: 1,
    title: "Witaj w Flovly",
    desc: "Twoje miejsce do zarządzania projektami, zespołem i pomysłami — wszystko w jednej przestrzeni.",
    cta: "Dalej",
    icon: <Sparkles size={28} strokeWidth={1.8} />,
    illBg: "linear-gradient(140deg, rgba(124,92,255,0.25), rgba(225,49,143,0.18))",
    aura: "rgba(124,92,255,0.45)",
  },
  {
    num: 2,
    title: "Workspace'y",
    desc: "Organizuj pracę w przestrzeniach — osobne dla klientów, projektów lub zespołów. Zapraszaj kolegów i nadawaj role.",
    cta: "Dalej",
    icon: <Compass size={28} strokeWidth={1.8} />,
    illBg: "linear-gradient(140deg, rgba(52,190,248,0.25), rgba(124,92,255,0.18))",
    aura: "rgba(52,190,248,0.4)",
  },
  {
    num: 3,
    title: "Tablice i widoki",
    desc: "Kanban, Tabela, Roadmapa, Whiteboard — wybierz widok pasujący do etapu projektu. Wszystko synchronizowane na żywo.",
    cta: "Dalej",
    icon: <LayoutDashboard size={28} strokeWidth={1.8} />,
    illBg: "linear-gradient(140deg, rgba(245,158,11,0.22), rgba(225,49,143,0.18))",
    aura: "rgba(245,158,11,0.4)",
  },
  {
    num: 4,
    title: "Ateron AI",
    desc: "Wbudowany asystent rozumie kontekst twoich tablic — zadawaj pytania, generuj brief'y, twórz zadania głosem.",
    cta: "Zaczynamy",
    icon: <Wand2 size={28} strokeWidth={1.8} />,
    illBg: "linear-gradient(140deg, rgba(124,92,255,0.3), rgba(225,49,143,0.25))",
    aura: "rgba(225,49,143,0.45)",
  },
];

export function OnboardingTour() {
  // Local open state — modal startuje otwarty i closeuje się po complete/skip.
  // (app) layout mount'uje ten komponent tylko gdy onboardingCompletedAt === null,
  // więc nie ma potrzeby gateować dodatkowo po stronie klienta.
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const close = () => {
    setOpen(false);
    startTransition(async () => {
      await completeOnboardingAction();
    });
  };

  const next = () => {
    if (isLast) {
      close();
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        // Klik backdrop / Esc też powinien zapisać flagę (treat as skip).
        if (!o) close();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-[80] bg-black/40 supports-backdrop-filter:backdrop-blur-sm",
            "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-150",
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "dialog-glass fixed left-1/2 top-1/2 z-[81] w-[350px] max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[22px] outline-none",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-150",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {current.title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {current.desc}
          </DialogPrimitive.Description>

          {/* Illustration */}
          <div
            className="relative flex h-[170px] items-center justify-center overflow-hidden"
            style={{ background: current.illBg }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 50% 40%, ${current.aura}, transparent 60%)`,
              }}
            />
            <div
              className="relative grid size-16 place-items-center rounded-[20px] border border-white/20 text-white shadow-[0_12px_28px_-8px_rgba(0,0,0,0.5)]"
              style={{ background: "rgba(20,17,30,0.6)" }}
            >
              {current.icon}
            </div>
          </div>

          {/* Body */}
          <div className="p-5">
            <div className="font-mono text-[11px] text-[#9B8BE6]">
              Krok {current.num} / {STEPS.length}
            </div>
            <h2 className="mt-1.5 text-[18px] font-bold tracking-[-0.01em] text-foreground">
              {current.title}
            </h2>
            <p className="mt-1.5 min-h-[56px] text-[13.5px] leading-[1.55] text-muted-foreground">
              {current.desc}
            </p>

            <div className="mt-3.5 flex items-center justify-between">
              {/* Progress dots */}
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-200",
                      i === step
                        ? "w-[18px]"
                        : "w-1.5 bg-muted-foreground/25",
                    )}
                    style={
                      i === step
                        ? {
                            background:
                              "linear-gradient(135deg, #7C5CFF, #E1318F)",
                          }
                        : undefined
                    }
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {!isLast && (
                  <button
                    type="button"
                    onClick={close}
                    disabled={pending}
                    className="px-1 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                  >
                    Pomiń
                  </button>
                )}
                <button
                  type="button"
                  onClick={next}
                  disabled={pending}
                  className="rounded-[10px] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(124,92,255,0.6)] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
                  style={{
                    background: "linear-gradient(135deg, #7C5CFF, #E1318F)",
                  }}
                >
                  {current.cta}
                </button>
              </div>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
