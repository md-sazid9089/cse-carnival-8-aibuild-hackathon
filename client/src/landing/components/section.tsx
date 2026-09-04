import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)} {...props} />;
}

type SectionProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "cream" | "dark";
  children: ReactNode;
};

const tones = {
  light: "bg-cream-50 text-forest-deep",
  cream: "bg-cream-100/60 text-forest-deep",
  dark: "bg-forest-deep text-cream-50",
};

export function Section({
  id,
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
  className,
  children,
  ...props
}: SectionProps) {
  const centered = align === "center";
  return (
    <section id={id} className={cn("scroll-mt-24 py-20 sm:py-28", tones[tone], className)} {...props}>
      <Container>
        <Reveal className={cn("max-w-2xl", centered && "mx-auto text-center")}>
          {eyebrow && (
            <p
              className={cn(
                "mb-4 text-xs font-bold uppercase tracking-[0.18em]",
                tone === "dark" ? "text-sage" : "text-terracotta",
              )}
            >
              {eyebrow}
            </p>
          )}
          <h2 className="font-display text-[2rem] font-semibold leading-[1.08] tracking-tight sm:text-[2.75rem]">
            {title}
          </h2>
          {description && (
            <p
              className={cn(
                "mt-5 text-base leading-relaxed sm:text-lg",
                tone === "dark" ? "text-sage" : "text-ink-muted",
              )}
            >
              {description}
            </p>
          )}
        </Reveal>
        <div className="mt-14">{children}</div>
      </Container>
    </section>
  );
}
