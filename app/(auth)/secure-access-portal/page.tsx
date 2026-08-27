import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { APP_NAME, Wordmark } from "@/components/brand/mark";

export const metadata: Metadata = {
  title: `Wejście · ${APP_NAME}`,
};

// F6 (redesign v5): wyśrodkowana karta 400px na `--canvas`, bez dekoracji.
// Cała weryfikacja poświadczeń zostaje w `actions.ts` + `lib/auth.ts`.

// `?redirect=` trafia do `signIn({ redirectTo })`. Przepuszczamy wyłącznie
// ścieżki względne (nie `//host`, nie `https://…`) — inaczej link do logowania
// staje się open redirectem. Serwer i tak ma własny callback, to druga warstwa.
function safeRedirect(value: string | undefined): string {
  return value && /^\/(?!\/)/.test(value) ? value : "/workspaces";
}

export default async function SecureAccessPortalPage({
  searchParams,
}: {
  // Next 16: searchParams jest Promise<{}>, musi być await'owany.
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <div data-ui="login-page" className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <main data-ui="login-card" className="surface w-[400px] max-w-full p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Wordmark size="lg" />
          <div>
            <h1 className="text-md font-semibold text-foreground">Zaloguj się</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Wpisz dane swojego konta, żeby wrócić do pracy.
            </p>
          </div>
        </div>

        <LoginForm redirectTo={safeRedirect(redirect)} />

        <p className="mt-5 text-center text-2xs text-fg-3">
          Problem z dostępem? Skontaktuj się z administratorem przestrzeni.
        </p>
      </main>
    </div>
  );
}
