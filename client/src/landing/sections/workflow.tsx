import { motion, useInView } from "framer-motion";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ChatBubble } from "../components/chat";
import { Section } from "../components/section";
import { WORKFLOW_RAIL, WORKFLOW_STEPS } from "../data/content";

const STEP_MS = 520;

export function Workflow() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-25% 0px" });
  const [done, setDone] = useState(0); // number of completed steps

  useEffect(() => {
    if (!inView) return;
    if (done >= WORKFLOW_STEPS.length) return;
    const t = window.setTimeout(() => setDone((d) => d + 1), done === 0 ? 700 : STEP_MS);
    return () => window.clearTimeout(t);
  }, [inView, done]);

  const finished = done >= WORKFLOW_STEPS.length;

  return (
    <Section
      id="acts"
      tone="dark"
      eyebrow="It actually acts"
      title="From a sentence to a confirmed booking."
      description="Every action is checked against real campus data before anything is written. Here’s what happens between “book me a room” and “done”."
    >
      <div ref={ref} className="grid gap-8 lg:grid-cols-[auto_1fr_1fr] lg:gap-10">
        {/* rail */}
        <ol className="hidden flex-col lg:flex" aria-label="Request lifecycle">
          {WORKFLOW_RAIL.map((label, i) => {
            const reached = done >= Math.ceil(((i + 1) / WORKFLOW_RAIL.length) * WORKFLOW_STEPS.length) || finished;
            return (
              <li key={label} className="flex items-stretch gap-3">
                <div className="flex flex-col items-center">
                  <motion.span
                    animate={{ scale: reached ? 1 : 0.85 }}
                    className={cn(
                      "grid size-7 place-items-center rounded-full text-[11px] font-semibold text-brand-panel-ink transition-colors",
                      reached ? "bg-accent" : "bg-white/12",
                    )}
                  >
                    {i + 1}
                  </motion.span>
                  {i < WORKFLOW_RAIL.length - 1 && (
                    <span className="relative my-1 w-px flex-1 bg-white/15">
                      <motion.span
                        className="absolute inset-x-0 top-0 bg-accent"
                        animate={{ height: reached ? "100%" : "0%" }}
                        transition={{ duration: 0.4 }}
                      />
                    </span>
                  )}
                </div>
                <p className={cn("pt-1 pb-6 text-sm font-medium transition-colors", reached ? "text-brand-panel-ink" : "text-brand-panel-ink/45")}>
                  {label}
                </p>
              </li>
            );
          })}
        </ol>

        {/* request + checks */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <ChatBubble role="user" onDark className="mb-5">
            Book a room for 5 people with a projector tomorrow from 2–4 PM.
          </ChatBubble>
          <ul className="space-y-2" aria-label="Validation steps">
            {WORKFLOW_STEPS.map((s, i) => {
              const state = i < done ? "done" : i === done && !finished ? "active" : "pending";
              return (
                <li
                  key={s}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    state === "done" && "bg-white/8 text-brand-panel-ink",
                    state === "active" && "bg-white/14 text-brand-panel-ink",
                    state === "pending" && "text-brand-panel-ink/40",
                  )}
                >
                  <span className="grid size-5 place-items-center">
                    {state === "done" && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid size-5 place-items-center rounded-full bg-positive">
                        <Check className="size-3 text-brand-panel" aria-hidden />
                      </motion.span>
                    )}
                    {state === "active" && <Loader2 className="size-4 animate-spin text-accent" aria-hidden />}
                    {state === "pending" && <span className="size-2 rounded-full bg-white/20" aria-hidden />}
                  </span>
                  {s}
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex items-center gap-2 lg:hidden">
            <ChevronDown className="size-4 text-brand-panel-ink/60" aria-hidden />
            <span className="text-xs text-brand-panel-ink/60">Result</span>
          </div>
        </div>

        {/* result */}
        <div className="flex items-center">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={finished ? { opacity: 1, y: 0, scale: 1 } : undefined}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full rounded-2xl border border-line bg-surface p-6 text-ink shadow-lg"
          >
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-positive text-ink-invert">
                <Check className="size-4" aria-hidden />
              </span>
              <p className="text-2xl font-semibold tracking-tight">Room 304 booked</p>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-surface-2 p-3">
                <dt className="text-[11px] font-semibold tracking-wider uppercase text-ink-3">When</dt>
                <dd className="mt-0.5 font-semibold">Tomorrow · 2:00–4:00 PM</dd>
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <dt className="text-[11px] font-semibold tracking-wider uppercase text-ink-3">Capacity</dt>
                <dd className="mt-0.5 font-semibold">8 people</dd>
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <dt className="text-[11px] font-semibold tracking-wider uppercase text-ink-3">Projector</dt>
                <dd className="mt-0.5 font-semibold">Yes</dd>
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <dt className="text-[11px] font-semibold tracking-wider uppercase text-ink-3">Booking</dt>
                <dd className="mt-0.5 font-mono font-semibold">bk-014</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-ink-3">
              Written through the same booking service the dashboard uses — a double-booking is rejected by the database
              itself.
            </p>
          </motion.div>
        </div>
      </div>
    </Section>
  );
}
