"use client";

import { useActionState, useId, useRef, useState, startTransition } from "react";
import { Camera } from "lucide-react";
import {
  updateProfileAction,
  type ProfileFormState,
} from "@/app/(app)/profile/actions";
import { TIMEZONES } from "@/lib/schemas/profile";

export function ProfileForm({
  initialName,
  initialTimezone,
  initialAvatarUrl,
  email,
}: {
  initialName: string;
  initialTimezone: string;
  initialAvatarUrl: string | null;
  email: string;
}) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(
    updateProfileAction,
    null,
  );

  const [previewUrl, setPreviewUrl] = useState<string | null>(initialAvatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const tzId = useId();

  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;
  const formError = !state?.ok ? state?.error : undefined;
  const success = state?.ok ? state.message : null;

  const initials = (initialName || email).slice(0, 2).toUpperCase();

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      encType="multipart/form-data"
      className="flex flex-col gap-10"
    >
      {/* Avatar */}
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="Zmień awatar"
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" width={96} height={96} className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-[1.6rem] font-bold tracking-[-0.02em]">{initials}</span>
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size={20} className="text-white" />
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          name="avatar"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onFileChange}
          className="hidden"
        />
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Awatar</span>
          <p className="text-[0.92rem] leading-[1.55] text-muted-foreground">
            PNG, JPG, WebP lub GIF, maks 2&nbsp;MB.
            <br />
            Kliknij w miniaturę, żeby wgrać nowy.
          </p>
          {fieldErrors?.avatar && (
            <span className="font-mono text-[0.68rem] text-destructive">
              {fieldErrors.avatar}
            </span>
          )}
        </div>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-2">
        <label htmlFor={nameId} className="eyebrow">Imię i nazwisko</label>
        <input
          id={nameId}
          name="name"
          type="text"
          required
          maxLength={80}
          defaultValue={initialName}
          aria-invalid={!!fieldErrors?.name}
          className="h-10 border-b border-border bg-transparent pb-1 text-[1rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 aria-[invalid=true]:border-destructive"
        />
        {fieldErrors?.name && (
          <span className="font-mono text-[0.68rem] text-destructive">
            {fieldErrors.name}
          </span>
        )}
      </div>

      {/* Email (read-only) */}
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Email</span>
        <div className="h-10 border-b border-border pb-1 font-mono text-[0.92rem] text-muted-foreground">
          {email}
        </div>
        <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground/70">
          zmiana adresu email — F1+ (wymaga re-weryfikacji)
        </span>
      </div>

      {/* Timezone */}
      <div className="flex flex-col gap-2">
        <label htmlFor={tzId} className="eyebrow">Strefa czasowa</label>
        <select
          id={tzId}
          name="timezone"
          defaultValue={initialTimezone}
          className="h-10 appearance-none border-b border-border bg-transparent pb-1 font-mono text-[0.92rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        {fieldErrors?.timezone && (
          <span className="font-mono text-[0.68rem] text-destructive">
            {fieldErrors.timezone}
          </span>
        )}
      </div>

      {formError && (
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive">
          {formError}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-gradient px-6 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
        >
          {pending ? "Zapisuję…" : "Zapisz zmiany"}
        </button>
        {success && (
          <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-primary">
            {success}
          </span>
        )}
      </div>
    </form>
  );
}
