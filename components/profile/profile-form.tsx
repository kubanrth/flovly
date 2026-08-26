"use client";

import { useActionState, useId, useRef, useState, startTransition } from "react";
import { updateProfileAction, type ProfileFormState } from "@/app/(app)/profile/actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TIMEZONES } from "@/lib/schemas/profile";

const FIELD_ERROR = "text-2xs text-danger-text";

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
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      {/* Awatar */}
      <div className="flex items-center gap-3.5">
        <Avatar name={initialName || email} src={previewUrl} size={44} />
        <input
          ref={fileInputRef}
          type="file"
          name="avatar"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onFileChange}
          className="hidden"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <Button type="button" variant="secondary" size="sm" className="w-fit" onClick={() => fileInputRef.current?.click()}>
            Zmień awatar
          </Button>
          <span className="text-2xs text-fg-3">PNG, JPG, WebP lub GIF, maks 2&nbsp;MB.</span>
          {fieldErrors?.avatar && <span className={FIELD_ERROR}>{fieldErrors.avatar}</span>}
        </div>
      </div>

      {/* Imię i nazwisko */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={nameId}>Imię i nazwisko</Label>
        <Input id={nameId} name="name" required maxLength={80} defaultValue={initialName} error={fieldErrors?.name} />
      </div>

      {/* Email (tylko do odczytu) */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" value={email} readOnly disabled className="font-mono" />
        <span className="text-2xs text-fg-3">Zmiana adresu wymaga ponownej weryfikacji — wkrótce.</span>
      </div>

      {/* Strefa czasowa */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={tzId}>Strefa czasowa</Label>
        <select
          id={tzId}
          name="timezone"
          defaultValue={initialTimezone}
          className="h-8 w-full rounded-sm border border-input-border bg-card px-2.5 font-mono text-sm outline-none hover:border-input-border-hover focus-visible:border-orange-500"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        {fieldErrors?.timezone && <span className={FIELD_ERROR}>{fieldErrors.timezone}</span>}
      </div>

      {formError && (
        <p role="alert" className="rounded-md border border-danger bg-chip-red-bg px-3 py-2 text-xs text-danger-text">
          {formError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} disabled={pending}>
          {pending ? "Zapisuję…" : "Zapisz zmiany"}
        </Button>
        {success && <span className="text-xs text-success-text">{success}</span>}
      </div>
    </form>
  );
}
