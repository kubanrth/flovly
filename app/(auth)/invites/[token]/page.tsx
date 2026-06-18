import { db } from "@/lib/db";
import { AcceptInviteForm } from "./accept-form";
import { FlovlySignature } from "@/components/brand/flovly-logo";

// F12-K81 (v4 design): refactor do glass card centered na bg-aura.
// Layout 1:1 z `flovly v2/Flovly Auth & Workspaces.dc.html` (sekcja INVITE).
// Zachowany cały Prisma flow + invalidState branching + acceptInviteAction.

// Inicjały z imienia/maila — używane w avatar zapraszającego.
function getInitials(nameOrEmail: string): string {
  const cleaned = nameOrEmail.trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  // single token (np. email lub jedno-słowowe name) → 2 pierwsze litery
  return cleaned.slice(0, 2).toUpperCase();
}

// Mapowanie ENUM role z Prisma → human-readable PL label dla badge'a.
function roleLabel(role: string): string {
  const map: Record<string, string> = {
    OWNER: "Owner",
    ADMIN: "Admin",
    MEMBER: "Member",
    GUEST: "Gość",
  };
  return map[role] ?? role.toLowerCase();
}

export default async function InvitePage({
  params,
}: {
  // Next 16: params jest Promise<{}>, musi być await'owany.
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await db.invitation.findUnique({
    where: { token },
    include: {
      workspace: { select: { name: true, deletedAt: true } },
      inviter: { select: { name: true, email: true } },
    },
  });

  // Server Component — Date.now() jest deterministyczne per request na serwerze
  // (w przeciwieństwie do client renderu, gdzie React Compiler wyłapuje impurity).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const invalidState = !invitation
    ? "not-found"
    : invitation.workspace.deletedAt
      ? "workspace-deleted"
      : invitation.acceptedAt
        ? "already-used"
        : invitation.expiresAt.getTime() < now
          ? "expired"
          : null;

  // ── Niepoprawny / wygasły / wykorzystany token — fallback glass card ──
  if (invalidState || !invitation) {
    const message = {
      "not-found": "Zaproszenie nie istnieje lub zostało cofnięte.",
      "workspace-deleted":
        "Przestrzeń, do której zostałaś/eś zaproszona/y, już nie istnieje.",
      "already-used": "To zaproszenie zostało już wykorzystane.",
      expired: "To zaproszenie wygasło. Poproś admina o nowe.",
    }[invalidState as "not-found" | "workspace-deleted" | "already-used" | "expired"];

    return (
      <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-aura px-6 py-12">
        <div className="glass-surface relative w-full max-w-[420px] rounded-2xl p-8 text-center md:p-10">
          <div className="mb-6 flex justify-center">
            <FlovlySignature size="md" />
          </div>
          <span className="eyebrow text-destructive">Zaproszenie nieprawidłowe</span>
          <h1 className="mt-3 font-display text-[1.6rem] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
            Ups. Coś poszło nie tak.
          </h1>
          <p className="mt-3 text-[0.95rem] leading-[1.55] text-muted-foreground">
            {message}
          </p>
        </div>
      </div>
    );
  }

  const existingUser = await db.user.findUnique({
    where: { email: invitation.email },
    select: { id: true, passwordHash: true },
  });

  const isExistingUser = Boolean(existingUser?.passwordHash);

  const inviterName = invitation.inviter.name ?? invitation.inviter.email;
  const inviterInitials = getInitials(inviterName);

  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-aura px-6 py-12">
      {/* Niebieski blob u góry-prawej — z referencji v4 (invite ma niebieską aurę) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-20 -z-10 h-[420px] w-[420px] rounded-full opacity-55 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(52, 190, 248, 0.35), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-1/2 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--accent-brand) 30%, transparent), transparent 65%)",
        }}
      />

      <main className="glass-surface relative w-full max-w-[440px] rounded-2xl p-8 md:p-10">
        {/* Top — brand mark + intro */}
        <div className="mb-6 flex flex-col items-center text-center">
          <FlovlySignature size="md" />
          <p className="mt-4 text-[0.92rem] text-muted-foreground">
            Zostałaś/eś zaproszona/y do
          </p>
          <h1 className="mt-1 font-display text-[1.8rem] font-bold leading-[1.1] tracking-[-0.02em] text-foreground">
            <span className="text-brand-gradient">{invitation.workspace.name}</span>
          </h1>
        </div>

        {/* Row z zapraszającą osobą + role badge — z referencji v4 */}
        <div className="mb-7 flex items-center gap-3 rounded-2xl border border-border/60 bg-background/30 p-3.5">
          <div
            aria-hidden
            className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-brand-gradient font-display text-[0.82rem] font-bold text-white shadow-brand"
          >
            {inviterInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[0.92rem] font-semibold text-foreground">
              {inviterName}
            </div>
            <div className="text-[0.76rem] text-muted-foreground">
              zaprasza Cię jako
            </div>
          </div>
          <span
            className="rounded-full border border-[color-mix(in_oklch,var(--accent-brand)_30%,transparent)] bg-[color-mix(in_oklch,var(--accent-brand)_16%,transparent)] px-3 py-1 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-primary"
            // visual badge dla role — tylko display, prawdziwa wartość siedzi w invitation.role
          >
            {roleLabel(invitation.role)}
          </span>
        </div>

        <p className="mb-5 text-[0.86rem] leading-[1.55] text-muted-foreground">
          {isExistingUser
            ? "Wygląda na to, że masz już konto w FLOVLY — wpisz hasło, żeby dołączyć."
            : "Ustaw hasło, aby założyć konto i dołączyć."}
        </p>

        <AcceptInviteForm
          token={invitation.token}
          email={invitation.email}
          isExistingUser={isExistingUser}
          workspaceId={invitation.workspaceId}
        />
      </main>
    </div>
  );
}
