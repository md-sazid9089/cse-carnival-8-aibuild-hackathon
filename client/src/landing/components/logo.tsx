import { cn } from "@/lib/utils";

/** Simple campus-grid mark: four rooms, one lit by the agent. */
export function Logo({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid size-8 grid-cols-2 gap-[3px] rounded-lg p-[5px]",
          dark ? "bg-brand-panel-ink" : "bg-ink",
        )}
        aria-hidden
      >
        <span className={cn("rounded-[3px]", dark ? "bg-brand-panel/40" : "bg-ink-invert/40")} />
        <span className={cn("rounded-[3px]", dark ? "bg-brand-panel/40" : "bg-ink-invert/40")} />
        <span className={cn("rounded-[3px]", dark ? "bg-brand-panel/40" : "bg-ink-invert/40")} />
        <span className="rounded-[3px] bg-accent" />
      </span>
      <span className={cn("text-lg font-semibold tracking-tight", dark ? "text-brand-panel-ink" : "text-ink")}>
        CampusOS
      </span>
    </span>
  );
}
