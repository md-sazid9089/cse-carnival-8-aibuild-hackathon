import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background-color,color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-forest-deep text-cream-50 shadow-soft hover:bg-forest hover:shadow-lift",
        secondary:
          "bg-white text-forest-deep border border-cream-200 shadow-soft hover:border-sage hover:bg-cream-50",
        accent: "bg-terracotta text-white shadow-soft hover:bg-terracotta-deep hover:shadow-lift",
        ghost: "text-forest hover:bg-cream-100 hover:text-forest-deep",
        inverted: "bg-cream-50 text-forest-deep hover:bg-white",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
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
