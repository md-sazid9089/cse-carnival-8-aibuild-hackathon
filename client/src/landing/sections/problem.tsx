import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "../components/logo";
import { Section } from "../components/section";
import { CAMPUS_SYSTEMS, SCATTERED_SOURCES } from "../data/content";

// Where each card sits before it snaps into the tidy stack.
const SCATTER = [
  { x: -36, y: -28, rotate: -8 },
  { x: 40, y: -14, rotate: 6 },
  { x: -22, y: 26, rotate: 4 },
  { x: 30, y: 34, rotate: -5 },
  { x: 0, y: -44, rotate: 9 },
];

export function Problem() {
  const reduced = useReducedMotion();

  return (
    <Section
      id="problem"
      tone="cream"
      eyebrow="The problem"
      title="Campus information shouldn’t feel like detective work."
      description="The answer usually exists somewhere — a pinned message, a spreadsheet, a poster in a hallway. It’s just never in one place when you need it."
    >
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
        {/* scattered sources */}
        <div className="relative mx-auto w-full max-w-sm">
          <ul className="relative flex flex-col gap-3">
            {SCATTERED_SOURCES.map((s, i) => (
              <motion.li
                key={s.label}
                initial={reduced ? false : { ...SCATTER[i], opacity: 0 }}
                whileInView={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                viewport={{ once: true, margin: "0px 0px -10% 0px" }}
                transition={{ duration: 0.8, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "rounded-xl border border-line px-4 py-3 shadow-xs",
                  s.tint,
                )}
              >
                <p className="text-xs font-semibold tracking-wider uppercase text-ink-2">{s.label}</p>
                <p className="mt-0.5 text-sm text-ink">{s.detail}</p>
              </motion.li>
            ))}
          </ul>
          <p className="mt-4 text-center text-xs font-medium text-ink-3">Five places. Zero certainty.</p>
        </div>

        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "0px 0px -10% 0px" }}
          transition={{ duration: 0.4 }}
          className="mx-auto grid size-12 place-items-center rounded-full bg-ink text-ink-invert shadow-xs"
        >
          <ArrowRight className="size-5 rotate-90 lg:rotate-0" />
        </motion.div>

        {/* unified */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -10% 0px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-lg"
        >
          <div className="mb-4 flex items-center justify-between">
            <Logo />
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-positive">
              <span className="size-1.5 rounded-full bg-positive animate-pulse-dot" /> synced
            </span>
          </div>
          <ul className="space-y-2">
            {CAMPUS_SYSTEMS.map((s, i) => (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, x: 10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "0px 0px -10% 0px" }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-ink text-ink-invert">
                  <s.icon className="size-4" aria-hidden />
                </span>
                <span className="text-sm font-semibold text-ink">{s.title}</span>
                <Check className="ml-auto size-4 text-positive" aria-hidden />
              </motion.li>
            ))}
          </ul>
          <p className="mt-4 text-center text-xs font-medium text-ink-3">One place. Always current.</p>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "0px 0px -10% 0px" }}
        transition={{ duration: 0.6 }}
        className="mt-14 text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
      >
        Everything your campus knows, finally connected.
      </motion.p>
    </Section>
  );
}
