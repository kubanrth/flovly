"use client";

// F12-K83: onboarding — 4-krokowy dialog pokazywany przy pierwszym logowaniu.
// (app) layout mountuje go tylko gdy `User.onboardingCompletedAt === null`.
// „Zaczynamy", „Pomiń", Esc i klik w tło wywołują `completeOnboardingAction()`,
// która ustawia flagę → revalidatePath → dialog nie wraca.
//
// F6 (redesign v5): prymitywy `components/ui/dialog` + tokeny, bez gradientów.

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconBoards, IconCreative, IconGrid, IconStar } from "@/components/ui/icons";
import { APP_NAME } from "@/components/brand/mark";
import { completeOnboardingAction } from "@/app/(app)/onboarding/actions";
import { cn } from "@/lib/utils";

const STEPS: { title: string; desc: string; cta: string; icon: ReactNode }[] = [
  {
    title: `Witaj w ${APP_NAME}`,
    desc: "Jedno miejsce na projekty, zespół i pomysły. Pokażemy Ci to w cztery kroki — zajmie pół minuty.",
    cta: "Dalej",
    icon: <IconStar width={18} height={18} />,
  },
  {
    title: "Przestrzenie",
    desc: "Dziel pracę na przestrzenie — osobne dla klientów, projektów albo zespołów. Zapraszasz ludzi i nadajesz role.",
    cta: "Dalej",
    icon: <IconGrid width={18} height={18} />,
  },
  {
    title: "Tablice i widoki",
    desc: "Lista, Tablica, Oś czasu, Kalendarz, Whiteboard — ten sam zestaw zadań w widoku pasującym do etapu projektu.",
    cta: "Dalej",
    icon: <IconBoards width={18} height={18} />,
  },
  {
    title: "Asystent Ateron",
    desc: "Wbudowany asystent zna kontekst Twoich tablic — zapytasz go o status, wygenerujesz brief albo utworzysz zadanie.",
    cta: "Zaczynamy",
    icon: <IconCreative width={18} height={18} />,
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  const close = () => {
    setOpen(false);
    startTransition(async () => {
      await completeOnboardingAction();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Esc i klik w tło też zapisują flagę (traktujemy jak „Pomiń").
        if (!o) close();
      }}
    >
      <DialogContent data-ui="onboarding-dialog" size="sm" showCloseButton={false}>
        <DialogHeader>
          <span className="text-2xs font-semibold tracking-[.06em] text-fg-3 uppercase">
            Krok {step + 1} z {STEPS.length}
          </span>
          <DialogTitle>{current.title}</DialogTitle>
        </DialogHeader>

        <DialogBody className="flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-orange-50 text-orange-700">
            {current.icon}
          </span>
          <DialogDescription className="min-h-[60px] text-sm leading-5 text-muted-foreground">
            {current.desc}
          </DialogDescription>
        </DialogBody>

        <DialogFooter className="justify-between">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span
                key={s.title}
                className={cn("h-1.5 rounded-full", i === step ? "w-4 bg-orange-500" : "w-1.5 bg-n-300")}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!isLast && (
              <Button variant="ghost" onClick={close} disabled={pending}>
                Pomiń
              </Button>
            )}
            <Button
              onClick={() => (isLast ? close() : setStep((s) => s + 1))}
              disabled={pending}
              loading={pending}
            >
              {current.cta}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
