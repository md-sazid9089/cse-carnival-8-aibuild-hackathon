import { motion, useInView } from "framer-motion";
import {
  Bell,
  BookOpenCheck,
  CalendarDays,
  DoorOpen,
  LayoutDashboard,
  Sparkles,
  Ticket,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ChatBubble, TypingDots, TypingText } from "../../components/chat";

const SIDEBAR = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Schedule", icon: CalendarDays },
  { label: "Rooms", icon: DoorOpen },
  { label: "Events", icon: Ticket },
  { label: "Announcements", icon: Bell },
  { label: "Assignments", icon: BookOpenCheck },
  { label: "AI Assistant", icon: Sparkles },
];

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-cream-200 bg-white p-3.5", className)}>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">{title}</p>
      {children}
    </div>
  );
}

/**
 * Faux CampusOS window shown in the hero. Plays a short, looping story:
 * the user asks about a moved class, the agent answers from live data.
 */
export function ProductMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);

  useEffect(() => {
    if (!inView) return;
    const timers = [
      window.setTimeout(() => setPhase(1), 600),
      window.setTimeout(() => setPhase(2), 1400),
      window.setTimeout(() => setPhase(3), 2300),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [inView]);

  return (
    <div ref={ref} className="relative">
      {/* floating accents */}
      <motion.div
        aria-hidden
        className="absolute -left-4 top-16 hidden rounded-2xl border border-cream-200 bg-white px-3.5 py-2.5 shadow-lift lg:block"
        initial={{ opacity: 0, x: -12 }}
        animate={inView ? { opacity: 1, x: 0 } : undefined}
        transition={{ delay: 0.9, duration: 0.5 }}
      >
        <div className="animate-float">
          <p className="text-[10px] font-bold uppercase tracking-wider text-terracotta">Announcement edited</p>
          <p className="mt-0.5 text-xs font-semibold text-forest-deep">CSE321 → Room 304, 2:00 PM</p>
        </div>
      </motion.div>

      <motion.div
        aria-hidden
        className="absolute -right-3 bottom-20 hidden rounded-2xl border border-cream-200 bg-white px-3.5 py-2.5 shadow-lift lg:block"
        initial={{ opacity: 0, x: 12 }}
        animate={inView && phase >= 4 ? { opacity: 1, x: 0 } : undefined}
        transition={{ duration: 0.5 }}
      >
        <div className="animate-float [animation-delay:1.2s]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-moss">Tool call</p>
          <p className="mt-0.5 font-mono text-xs text-forest-deep">list_announcements() ✓</p>
        </div>
      </motion.div>

      {/* window */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={inView ? { opacity: 1, y: 0, scale: 1 } : undefined}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-3xl border border-cream-200 bg-cream-50 shadow-lift"
      >
        <div className="flex items-center gap-1.5 border-b border-cream-200 bg-white/70 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-cream-200" />
          <span className="size-2.5 rounded-full bg-cream-200" />
          <span className="size-2.5 rounded-full bg-cream-200" />
          <span className="ml-3 rounded-md bg-cream-100 px-2 py-0.5 text-[10px] font-medium text-ink-muted">
            campusos.app/overview
          </span>
        </div>

        <div className="grid grid-cols-[auto_1fr] lg:grid-cols-[150px_1fr_260px]">
          <aside className="hidden flex-col gap-0.5 border-r border-cream-200 bg-white/60 p-3 sm:flex">
            {SIDEBAR.map((s) => (
              <div
                key={s.label}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs",
                  s.active ? "bg-forest-deep font-semibold text-cream-50" : "text-forest",
                )}
              >
                <s.icon className="size-3.5" aria-hidden />
                <span className="hidden lg:inline">{s.label}</span>
              </div>
            ))}
          </aside>

          <main className="col-span-2 grid gap-3 p-4 sm:col-span-1 sm:grid-cols-2">
            <Panel title="Next class" className="sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">CSE321 · Software Engineering</p>
                  <motion.p
                    key={phase >= 1 ? "moved" : "orig"}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-ink-muted"
                  >
                    {phase >= 1 ? "Today · 2:00 PM · Room 304" : "Today · 11:00 AM · Room 201"}
                  </motion.p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    phase >= 1 ? "bg-peach/60 text-terracotta-deep" : "bg-sage/30 text-forest",
                  )}
                >
                  {phase >= 1 ? "Rescheduled" : "On time"}
                </span>
              </div>
            </Panel>
            <Panel title="Upcoming assignments">
              <ul className="space-y-1.5 text-xs">
                <li className="flex justify-between"><span>Compiler lab report</span><span className="text-terracotta">Thu</span></li>
                <li className="flex justify-between"><span>ML assignment 2</span><span className="text-ink-muted">Sun</span></li>
              </ul>
            </Panel>
            <Panel title="Today’s events">
              <p className="text-xs font-semibold">Deep Learning guest lecture</p>
              <p className="text-xs text-ink-muted">12:30 · 7C02 · 18 seats left</p>
            </Panel>
            <Panel title="Important announcement">
              <p className="text-xs font-semibold">CSE321 moved to Room 304</p>
              <p className="text-xs text-ink-muted">Posted 2 min ago · High</p>
            </Panel>
            <Panel title="Available rooms">
              <div className="flex flex-wrap gap-1">
                {["7A02", "7A05", "7B03", "7C01"].map((r) => (
                  <span key={r} className="rounded-md bg-sage/25 px-1.5 py-0.5 font-mono text-[10px] text-forest">{r}</span>
                ))}
              </div>
            </Panel>
          </main>

          <section
            aria-label="AI assistant"
            className="col-span-2 flex min-h-[220px] flex-col border-t border-cream-200 bg-white/70 p-4 lg:col-span-1 lg:border-l lg:border-t-0"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-full bg-forest text-cream-50">
                <Sparkles className="size-3" aria-hidden />
              </span>
              <p className="text-xs font-semibold">AI Assistant</p>
              <span className="ml-auto flex items-center gap-1 text-[10px] text-moss">
                <span className="size-1.5 rounded-full bg-moss" /> live
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-end gap-3">
              {phase >= 1 && <ChatBubble role="user">Where is my CSE321 class today?</ChatBubble>}
              {phase === 2 && (
                <ChatBubble role="ai">
                  <TypingDots />
                </ChatBubble>
              )}
              {phase >= 3 && (
                <ChatBubble role="ai" source={phase >= 4 ? "Updated from campus data" : undefined}>
                  <TypingText
                    text="CSE321 has been moved to Room 304 today at 2:00 PM."
                    onDone={() => setPhase(4)}
                  />
                </ChatBubble>
              )}
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
