import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,box-shadow,transform] duration-150 ease-out disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-ink text-ink-invert shadow-xs hover:bg-ink/88",
        secondary: "bg-surface text-ink border border-line-control shadow-xs hover:bg-surface-2",
        accent: "bg-accent text-ink-invert shadow-xs hover:bg-accent-hover",
        ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
        inverted: "bg-brand-panel-ink text-brand-panel hover:opacity-90",
      },
      size: {
        sm: "h-9 rounded-lg px-3.5 text-[13px]",
        md: "h-10 rounded-lg px-4 text-sm",
        lg: "h-11 rounded-xl px-5 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & VariantProps<typeof buttonVariants>;

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { className, variant, size, ...props },
  ref,
) {
  return <a ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
