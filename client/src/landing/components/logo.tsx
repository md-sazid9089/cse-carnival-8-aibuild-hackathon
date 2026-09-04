import { cn } from "@/lib/utils";

/** Simple campus-grid mark: four rooms, one lit by the agent. */
export function Logo({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid size-8 grid-cols-2 gap-[3px] rounded-lg p-[5px]",
          dark ? "bg-cream-50" : "bg-forest-deep",
        )}
        aria-hidden
      >
        <span className={cn("rounded-[3px]", dark ? "bg-forest/40" : "bg-cream-50/40")} />
        <span className={cn("rounded-[3px]", dark ? "bg-forest/40" : "bg-cream-50/40")} />
        <span className={cn("rounded-[3px]", dark ? "bg-forest/40" : "bg-cream-50/40")} />
        <span className="rounded-[3px] bg-terracotta" />
      </span>
      <span className={cn("font-display text-lg font-semibold tracking-tight", dark ? "text-cream-50" : "text-forest-deep")}>
        CampusOS
      </span>
    </span>
  );
}
