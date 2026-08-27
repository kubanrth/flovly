"use client";

// Ikonowy submit w formularzu akcji admina z potwierdzeniem. Potwierdzenie
// jest tylko wygodą — uprawnienia sprawdza `requireSuperAdmin()` w akcji.

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConfirmSubmit({
  label,
  confirmMessage,
  destructive,
  disabled,
  children,
}: {
  label: string;
  confirmMessage: string;
  destructive?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      iconOnly
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(destructive && "hover:text-danger-text")}
      onClick={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
