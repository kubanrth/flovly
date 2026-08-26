import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md outline-none disabled:pointer-events-none aria-busy:pointer-events-none aria-busy:opacity-85 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-orange-500 font-semibold text-ink hover:bg-orange-600 active:bg-orange-700 disabled:bg-n-100 disabled:text-n-400",
        secondary: "border border-border bg-card font-medium text-foreground hover:bg-n-100 active:border-n-300 active:bg-n-200 disabled:border-n-100 disabled:bg-canvas disabled:text-n-400",
        ghost: "font-medium text-n-700 hover:bg-n-100 hover:text-foreground active:bg-n-200 disabled:text-n-400",
        // ponytail: active = ten sam odcień co hover (brak tokenu danger-active); dodaj gdy trafi do tokens.css
        danger: "bg-danger font-semibold text-white hover:bg-danger-text active:bg-danger-text disabled:bg-n-100 disabled:text-n-400",
        link: "h-auto rounded-none px-0 font-medium text-link hover:text-orange-800 hover:underline active:text-orange-900 disabled:text-n-400",
      },
      size: {
        sm: "h-7 px-2.5 text-xs [&_svg]:size-3",
        md: "h-8 px-3 text-sm [&_svg]:size-3.5",
        lg: "h-9 px-3.5 text-sm [&_svg]:size-4",
      },
      iconOnly: { true: "px-0" },
    },
    compoundVariants: [
      { iconOnly: true, size: "sm", class: "w-7" },
      { iconOnly: true, size: "md", class: "w-8 [&_svg]:size-4" },
      { iconOnly: true, size: "lg", class: "w-9" },
      { iconOnly: true, variant: "ghost", class: "text-muted-foreground" },
    ],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { loading?: boolean };

export function Button({ className, variant, size, iconOnly, loading, children, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive data-slot="button" aria-busy={loading || undefined} className={cn(buttonVariants({ variant, size, iconOnly }), className)} {...props}>
      {loading && <Spinner />}
      {children}
    </ButtonPrimitive>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("size-3 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current", className)} />;
}
