import { AnimatePresence, motion, useInView } from "framer-motion";
import { Bell, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Section } from "../components/section";

const AI_STATES = ["Idle", "Reading campus data…", "Ready"] as const;

const SCHEDULE = [
  { time: "09:00", course: "CSE 4113", room: "7A04", past: true },
  { time: "11:00", course: "CSE 4129", room: "7A03", past: true },
  { time: "14:00", course: "IPE 4111", room: "7C01", next: true },
  { time: "16:00", course: "CSE 4137", room: "7A02" },
];

const ROOMS = ["7A01", "7A02", "7A03", "7A04", "7A05", "7B01", "7B02", "7B03", "7C01", "7C02"];

function Tile({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface p-4", className)}>
      <p className="mb-2.5 text-[10px] font-semibold tracking-[0.14em] uppercase text-ink-3">{title}</p>
      {children}
    </div>
  );
}

export function DashboardPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px" });
  const [aiState, setAiState] = useState(0);
  const [toast, setToast] = useState(false);
  const [busyRooms, setBusyRooms] = useState<Set<string>>(() => new Set(["7A03", "7B02", "7C02"]));

  useEffect(() => {
    if (!inView) return;
    const ai = window.setInterval(() => setAiState((s) => (s + 1) % AI_STATES.length), 1800);
    const tShow = window.setTimeout(() => setToast(true), 1400);
    const tHide = window.setTimeout(() => setToast(false), 5200);
    const rooms = window.setInterval(() => {
      setBusyRooms((prev) => {
        const next = new Set(prev);
        const pick = ROOMS[Math.floor(Math.random() * ROOMS.length)];
        next.has(pick) ? next.delete(pick) : next.add(pick);
        return next;
      });
    }, 2600);
    return () => {
      window.clearInterval(ai);
      window.clearTimeout(tShow);
      window.clearTimeout(tHide);
      window.clearInterval(rooms);
    };
  }, [inView]);

  return (
    <Section
      id="dashboard"
      tone="cream"
      eyebrow="The dashboard"
      title="A campus that updates itself."
      description="Every card below is a live view of the same database the agent reads. Change something anywhere and it changes here."
    >
      <div ref={ref} className="relative mx-auto max-w-5xl">
        <AnimatePresence>
          {toast && (
            <motion.div
              role="status"
              initial={{ opacity: 0, y: -12, x: 12 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute top-4 right-4 z-10 flex items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 shadow-lg"
            >
              <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent-ink">
                <Bell className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-semibold text-ink">New announcement</p>
                <p className="text-[11px] text-ink-3">Library hours extended this week</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-2xl border border-line bg-canvas shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-line bg-surface/70 px-5 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">Good afternoon, Sakibul</p>
              <p className="text-[11px] text-ink-3">Thursday · 3 classes · 2 deadlines this week</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5">
              <Sparkles className={cn("size-3.5", aiState === 1 ? "animate-pulse text-accent" : "text-ink-3")} aria-hidden />
              <AnimatePresence mode="wait">
                <motion.span
                  key={aiState}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="text-[11px] font-medium text-ink-2"
                >
                  {AI_STATES[aiState]}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile title="Today’s schedule" className="lg:col-span-2">
              <ul className="space-y-1.5">
                {SCHEDULE.map((s) => (
                  <li
                    key={s.course}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-xs",
                      s.next ? "bg-ink text-ink-invert" : "bg-surface-2 text-ink",
                      s.past && "opacity-50",
                    )}
                  >
                    <span className="font-mono">{s.time}</span>
                    <span className="font-semibold">{s.course}</span>
                    {s.next && <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-semibold">Next</span>}
                    <span className={cn("ml-auto font-mono", s.next ? "text-ink-invert/60" : "text-ink-3")}>{s.room}</span>
                  </li>
                ))}
              </ul>
            </Tile>

            <Tile title="Next class">
              <p className="text-3xl font-semibold tracking-tight text-ink tabular">14:00</p>
              <p className="mt-1 text-xs font-semibold text-ink">IPE 4111 · Industrial Management</p>
              <p className="text-xs text-ink-3">Room 7C01 · starts in 1h 12m</p>
            </Tile>

            <Tile title="Deadlines">
              <ul className="space-y-1.5 text-xs">
                <li className="flex justify-between"><span>Compiler lab report</span><span className="font-semibold text-accent">2 days</span></li>
                <li className="flex justify-between"><span>ML assignment 2</span><span className="text-ink-3">5 days</span></li>
                <li className="flex justify-between"><span>Cyber Security quiz</span><span className="text-ink-3">6 days</span></li>
              </ul>
            </Tile>

            <Tile title="Room availability · now" className="lg:col-span-2">
              <div className="grid grid-cols-5 gap-1.5">
                {ROOMS.map((r) => {
                  const busy = busyRooms.has(r);
                  return (
                    <motion.div
                      key={r}
                      layout
                      animate={{ backgroundColor: busy ? "var(--critical-soft)" : "var(--positive-soft)" }}
                      transition={{ duration: 0.4 }}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 font-mono text-[11px] text-ink"
                    >
                      {r}
                      <span className={cn("size-1.5 rounded-full", busy ? "bg-critical" : "bg-positive")} aria-label={busy ? "busy" : "free"} />
                    </motion.div>
                  );
                })}
              </div>
            </Tile>

            <Tile title="Upcoming events">
              <p className="text-xs font-semibold text-ink">Deep Learning guest lecture</p>
              <p className="text-[11px] text-ink-3">Sun · 12:30 · 7C02</p>
              <p className="mt-2 text-xs font-semibold text-ink">Git & GitHub workshop</p>
              <p className="text-[11px] text-ink-3">Tue · 15:00 · 7B01 · full</p>
            </Tile>

            <Tile title="Announcements">
              <ul className="space-y-1.5 text-xs">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 rounded bg-critical-soft px-1.5 text-[9px] font-semibold uppercase text-critical">high</span>
                  <span className="text-ink">CSE 4113 rescheduled</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 rounded bg-caution-soft px-1.5 text-[9px] font-semibold uppercase text-caution">med</span>
                  <span className="text-ink">Library hours extended</span>
                </li>
              </ul>
            </Tile>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}
