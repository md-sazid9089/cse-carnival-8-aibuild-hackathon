import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium tracking-wide",
  {
    variants: {
      variant: {
        default: "border-line bg-surface text-ink-2",
        accent: "border-accent/25 bg-accent-soft text-accent-ink",
        outline: "border-line bg-transparent text-ink-3",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
