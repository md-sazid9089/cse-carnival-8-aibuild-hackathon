import { AnimatePresence, motion, useInView } from "framer-motion";
import { Database, LayoutDashboard, Pencil, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ChatBubble, TypingDots } from "../components/chat";
import { Section } from "../components/section";

type Phase = 0 | 1 | 2 | 3 | 4;
// 0: original notice · 1: admin editing · 2: saved, propagating · 3: student asks · 4: agent answers

const TIMELINE: Array<[Phase, number]> = [
  [1, 900],
  [2, 2100],
  [3, 3200],
  [4, 4300],
];

function Connector({ active, vertical = false }: { active: boolean; vertical?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox={vertical ? "0 0 12 64" : "0 0 64 12"}
      className={cn("text-line-strong", vertical ? "mx-auto h-12 w-3" : "h-3 w-full")}
      preserveAspectRatio="none"
    >
      <path
        d={vertical ? "M6 0 V64" : "M0 6 H64"}
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="4 4"
        fill="none"
      />
      <motion.path
        d={vertical ? "M6 0 V64" : "M0 6 H64"}
        stroke="var(--accent)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: active ? 1 : 0 }}
        transition={{ duration: 0.7, ease: "easeInOut" }}
      />
    </svg>
  );
}

function Column({ icon: Icon, title, active, children }: { icon: typeof Database; title: string; active: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl border bg-surface p-5 shadow-xs transition-[border-color,box-shadow] duration-300",
        active ? "border-accent/50 shadow-md" : "border-line",
      )}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className={cn("grid size-8 place-items-center rounded-lg text-ink-invert transition-colors", active ? "bg-accent" : "bg-ink")}>
          <Icon className="size-4" aria-hidden />
        </span>
        <p className="text-sm font-semibold text-ink">{title}</p>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function Realtime() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-25% 0px" });
  const [phase, setPhase] = useState<Phase>(0);

  useEffect(() => {
    if (!inView) return;
    const timers = TIMELINE.map(([p, ms]) => window.setTimeout(() => setPhase(p), ms));
    return () => timers.forEach(window.clearTimeout);
  }, [inView]);

  const moved = phase >= 2;

  return (
    <Section
      id="realtime"
      eyebrow="Real-time truth"
      title="When campus changes, CampusOS changes with it."
      description="The agent never answers from memory. It reads the database at the moment you ask — so an edit made a minute ago is already the truth."
    >
      <div ref={ref} className="grid items-stretch gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <Column icon={LayoutDashboard} title="Dashboard" active={phase === 1}>
          <div className="rounded-xl border border-line bg-surface-2 p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold tracking-wider uppercase text-ink-3">Announcement · ann-012</p>
              <AnimatePresence>
                {phase === 1 && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent-ink"
                  >
                    <Pencil className="size-3" aria-hidden /> editing
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={moved ? "moved" : "cancelled"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-2 text-sm font-semibold text-ink"
              >
                {moved ? "CSE321 moved to Room 304 at 2:00 PM." : "CSE321 class cancelled."}
              </motion.p>
            </AnimatePresence>
            <p className="mt-1 text-xs text-ink-3">Posted by CSE Department · High priority</p>
          </div>
          <p className="mt-3 text-xs text-ink-3">
            {phase === 0 && "The original notice."}
            {phase === 1 && "An admin corrects it."}
            {phase >= 2 && "Saved. No refresh needed anywhere."}
          </p>
        </Column>

        <div className="hidden items-center lg:flex"><Connector active={phase >= 2} /></div>
        <div className="lg:hidden"><Connector active={phase >= 2} vertical /></div>

        <Column icon={Database} title="Backend" active={phase === 2}>
          <div className="space-y-2 font-mono text-[11px]">
            <div className="rounded-lg bg-brand-panel p-3 text-brand-panel-ink">
              <p className="text-brand-panel-ink/60">PUT /api/announcements/ann-012</p>
              <p className="mt-1">{moved ? '{ "body": "CSE321 moved to Room 304 at 2:00 PM." }' : "…"}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-surface-2 p-3 text-ink-2">
              <span className={cn("size-2 rounded-full", moved ? "bg-positive" : "bg-surface-3")} />
              {moved ? "committed · SSE broadcast → every tab" : "awaiting change"}
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-3">One Postgres row. The single source of truth.</p>
        </Column>

        <div className="hidden items-center lg:flex"><Connector active={phase >= 4} /></div>
        <div className="lg:hidden"><Connector active={phase >= 4} vertical /></div>

        <Column icon={Sparkles} title="AI agent" active={phase >= 3}>
          <div className="flex min-h-[150px] flex-col justify-end gap-3">
            {phase >= 3 && <ChatBubble role="user">Where is my CSE321 class?</ChatBubble>}
            {phase === 3 && (
              <ChatBubble role="ai">
                <TypingDots />
              </ChatBubble>
            )}
            {phase >= 4 && (
              <ChatBubble role="ai" source="list_announcements() · read just now">
                CSE321 has been moved to Room 304 today at 2:00 PM.
              </ChatBubble>
            )}
            {phase < 3 && <p className="text-xs text-ink-3">Waiting for a question…</p>}
          </div>
        </Column>
      </div>

      <p className="mt-10 text-center text-sm text-ink-2">
        Judges can edit any record mid-conversation. <span className="font-semibold text-ink">The very next answer reflects it.</span>
      </p>
    </Section>
  );
}
