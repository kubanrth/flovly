"use server";

// F12-K83: server action wywoływana z <OnboardingTour /> po kliknięciu
// "Zaczynamy" (last step) lub "Pomiń". Zapisuje czas ukończenia żeby
// (app) layout nie pokazywał już tej karuzeli temu userowi.

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function completeOnboardingAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "unauthorized" };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { onboardingCompletedAt: new Date() },
  });

  // Re-render (app) layout — flaga jest tam czytana żeby gateować
  // mount'owanie <OnboardingTour />. Bez tego po skipie tour by się nie zamknął
  // dla SSR'owanych stron (modal closeuje się lokalnie ale przy nawigacji
  // wracałby).
  revalidatePath("/", "layout");
  return { ok: true };
}
