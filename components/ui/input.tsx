import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Kbd } from "./kbd";

export const inputVariants = cva(
  "w-full min-w-0 rounded-sm border border-input-border bg-card px-2.5 text-sm text-foreground outline-none placeholder:text-fg-3 hover:border-input-border-hover focus:border-orange-500 disabled:pointer-events-none disabled:border-n-200 disabled:bg-n-100 disabled:text-n-400 aria-invalid:border-danger",
  { variants: { size: { sm: "h-7", md: "h-8", lg: "h-11 px-3 text-base" } }, defaultVariants: { size: "md" } },
);

export type InputProps = Omit<ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants> & { error?: string };

function withError(el: ReactNode, error?: string) {
  return error ? <div className="flex flex-col gap-1">{el}<p className="text-xs text-danger-text">{error}</p></div> : el;
}

export function Input({ className, size, error, ...props }: InputProps) {
  return withError(<input data-slot="input" {...props} aria-invalid={error ? true : props["aria-invalid"]} className={cn(inputVariants({ size }), className)} />, error);
}

export type TextareaProps = ComponentProps<"textarea"> & { autoGrow?: boolean; error?: string };

export function Textarea({ className, autoGrow, error, ...props }: TextareaProps) {
  return withError(
    <textarea data-slot="textarea" {...props} aria-invalid={error ? true : props["aria-invalid"]} className={cn(inputVariants({ size: "md" }), "h-auto min-h-16 py-2 leading-5", autoGrow && "field-sizing-content resize-none", className)} />,
    error,
  );
}

export interface InputGroupProps extends InputProps {
  leading?: ReactNode;
  trailing?: ReactNode;
  kbd?: string;
}

export function InputGroup({ leading, trailing, kbd, className, size, error, ...props }: InputGroupProps) {
  return withError(
    <label className={cn(inputVariants({ size }), "flex cursor-text items-center gap-2 focus-within:border-orange-500 focus-within:shadow-[var(--focus)] has-[:disabled]:pointer-events-none has-[:disabled]:bg-n-100 has-[:disabled]:text-n-400", error && "border-danger", className)}>
      {leading && <span className="shrink-0 text-fg-3 [&_svg]:size-3.5">{leading}</span>}
      <input {...props} aria-invalid={error ? true : props["aria-invalid"]} className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-fg-3 focus-visible:shadow-none" />
      {kbd && <Kbd>{kbd}</Kbd>}
      {trailing && <span className="shrink-0 text-fg-3 [&_svg]:size-3.5">{trailing}</span>}
    </label>,
    error,
  );
}
