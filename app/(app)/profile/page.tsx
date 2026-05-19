import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/profile/profile-form";
import { TwoFactorSection } from "@/components/profile/two-factor-section";

export default async function ProfilePage() {
  const session = await auth();
  const user = await db.user.findUnique({ where: { id: session!.user.id } });
  if (!user) throw new Error("User not found");

  return (
    <main className="flex-1 px-4 py-6 md:px-14 md:py-16">
      <div className="mx-auto flex max-w-[640px] flex-col gap-10">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Ustawienia konta</span>
          <h1 className="font-display text-[2rem] leading-[1.1] tracking-[-0.02em]">
            Twój profil
          </h1>
          <p className="text-[0.92rem] leading-[1.55] text-muted-foreground">
            Te informacje widzą inni członkowie w twoich przestrzeniach roboczych.
          </p>
        </div>

        <ProfileForm
          initialName={user.name ?? ""}
          initialTimezone={user.timezone}
          initialAvatarUrl={user.avatarUrl}
          email={user.email}
        />

        <TwoFactorSection enabled={!!user.totpEnabledAt} />

        {user.isSuperAdmin && (
          <div className="border-t border-border pt-6">
            <span className="eyebrow text-primary">Super Admin</span>
            <p className="mt-2 text-[0.88rem] leading-[1.55] text-muted-foreground">
              Masz dostęp do panelu administracyjnego (F7). Zarządzanie
              globalnymi tagami, flagami modułów oraz audit log’iem systemu.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
