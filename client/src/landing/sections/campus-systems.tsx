import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Section } from "../components/section";
import { staggerContainer, staggerItem } from "../components/reveal";
import { CAMPUS_SYSTEMS, type CampusSystem } from "../data/content";

function Preview({ id }: { id: CampusSystem["id"] }) {
  switch (id) {
    case "schedule":
      return (
        <div className="space-y-1.5">
          {[
            ["09:00", "CSE 4113", "7A04"],
            ["11:00", "CSE 4129", "7A03"],
            ["14:00", "IPE 4111", "7C01"],
          ].map(([t, c, r]) => (
            <div key={c} className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[11px]">
              <span className="font-mono text-ink-3">{t}</span>
              <span className="font-semibold text-ink">{c}</span>
              <span className="ml-auto rounded bg-surface-3 px-1.5 font-mono text-ink-2">{r}</span>
            </div>
          ))}
        </div>
      );
    case "rooms":
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-ink">7B03 · Lab</span>
            <span className="text-ink-3">30 seats</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className={cn("h-5 flex-1 rounded-sm", i < 4 || i > 8 ? "bg-surface-3" : "bg-accent/60")} />
            ))}
          </div>
          <div className="flex gap-1.5 text-[10px]">
            {["projector", "AC", "whiteboard"].map((e) => (
              <span key={e} className="rounded-md bg-surface-3 px-2 py-0.5 text-ink-2">{e}</span>
            ))}
          </div>
        </div>
      );
    case "events":
      return (
        <div className="rounded-lg bg-surface-2 p-2.5">
          <p className="text-[11px] font-semibold text-ink">Deep Learning guest lecture</p>
          <p className="text-[10px] text-ink-3">Sun · 12:30 · 7C02</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full w-[78%] rounded-full bg-accent" />
            </div>
            <span className="text-[10px] text-ink-3">47/60</span>
          </div>
          <span className="mt-2 inline-block rounded-md bg-ink px-2.5 py-1 text-[10px] font-semibold text-ink-invert">
            Register
          </span>
        </div>
      );
    case "announcements":
      return (
        <div className="space-y-1.5">
          {[
            ["high", "CSE 4113 rescheduled to 3:30 PM"],
            ["medium", "Library hours extended"],
          ].map(([p, t]) => (
            <div key={t} className="flex items-start gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5">
              <span
                className={cn(
                  "mt-0.5 rounded px-1.5 text-[9px] font-semibold uppercase",
                  p === "high" ? "bg-critical-soft text-critical" : "bg-caution-soft text-caution",
                )}
              >
                {p}
              </span>
              <span className="text-[11px] text-ink">{t}</span>
            </div>
          ))}
        </div>
      );
    case "assignments":
      return (
        <div className="space-y-1.5">
          {(
            [
              ["Compiler lab report", "Due Thu", true],
              ["ML assignment 2", "Due Sun", false],
            ] as Array<[string, string, boolean]>
          ).map(([t, d, soon]) => (
            <div key={t} className="flex items-center justify-between rounded-lg bg-surface-2 px-2.5 py-1.5 text-[11px]">
              <span className="text-ink">{t}</span>
              <span className={cn("font-semibold", soon ? "text-accent" : "text-ink-3")}>{d}</span>
            </div>
          ))}
        </div>
      );
  }
}

export function CampusSystems() {
  return (
    <Section
      id="features"
      eyebrow="One platform"
      title={
        <>
          One platform. <span className="text-accent">Five</span> campus systems.
        </>
      }
      description="Everything a student needs to know about their week, managed in one place and kept honest by a single database."
    >
      <motion.ul
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-10% 0px" }}
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {CAMPUS_SYSTEMS.map((s, i) => (
          <motion.li
            key={s.id}
            variants={staggerItem}
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className={cn(
              "group flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-xs transition-shadow hover:shadow-md",
              i === 0 && "lg:col-span-1",
            )}
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-ink text-ink-invert transition-colors group-hover:bg-accent">
                <s.icon className="size-5" aria-hidden />
              </span>
              <h3 className="text-lg font-semibold text-ink">{s.title}</h3>
            </div>
            <p className="text-sm leading-relaxed text-ink-2">{s.description}</p>
            <div className="mt-5 rounded-xl border border-line bg-canvas p-3">
              <Preview id={s.id} />
            </div>
          </motion.li>
        ))}
        <li className="flex flex-col justify-center rounded-2xl border border-dashed border-line-strong bg-surface-2 p-6 text-sm text-ink-2">
          <p className="text-xl font-semibold tracking-tight text-ink">Add, edit, delete — instantly.</p>
          <p className="mt-2 leading-relaxed text-ink-2">
            Every change is saved to the backend and pushed live to every open tab. Reload, come back tomorrow, ask the
            agent — it’s the same truth everywhere.
          </p>
        </li>
      </motion.ul>
    </Section>
  );
}
