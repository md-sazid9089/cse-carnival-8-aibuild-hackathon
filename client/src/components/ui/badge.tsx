import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide",
  {
    variants: {
      variant: {
        default: "border-cream-200 bg-white text-forest",
        sage: "border-sage/50 bg-sage/20 text-forest-deep",
        peach: "border-peach bg-peach/40 text-terracotta-deep",
        forest: "border-forest bg-forest text-cream-50",
        outline: "border-cream-200 bg-transparent text-ink-muted",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
