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
            <div key={c} className="flex items-center gap-2 rounded-lg bg-cream-50 px-2.5 py-1.5 text-[11px]">
              <span className="font-mono text-ink-muted">{t}</span>
              <span className="font-semibold text-forest-deep">{c}</span>
              <span className="ml-auto rounded bg-sage/30 px-1.5 font-mono text-forest">{r}</span>
            </div>
          ))}
        </div>
      );
    case "rooms":
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-forest-deep">7B03 · Lab</span>
            <span className="text-ink-muted">30 seats</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className={cn("h-5 flex-1 rounded-sm", i < 4 || i > 8 ? "bg-sage/40" : "bg-terracotta/70")} />
            ))}
          </div>
          <div className="flex gap-1.5 text-[10px]">
            {["projector", "AC", "whiteboard"].map((e) => (
              <span key={e} className="rounded-full bg-cream-100 px-2 py-0.5 text-forest">{e}</span>
            ))}
          </div>
        </div>
      );
    case "events":
      return (
        <div className="rounded-lg bg-cream-50 p-2.5">
          <p className="text-[11px] font-semibold text-forest-deep">Deep Learning guest lecture</p>
          <p className="text-[10px] text-ink-muted">Sun · 12:30 · 7C02</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-200">
              <div className="h-full w-[78%] rounded-full bg-moss" />
            </div>
            <span className="text-[10px] text-ink-muted">47/60</span>
          </div>
          <span className="mt-2 inline-block rounded-full bg-forest-deep px-2.5 py-1 text-[10px] font-semibold text-cream-50">
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
            <div key={t} className="flex items-start gap-2 rounded-lg bg-cream-50 px-2.5 py-1.5">
              <span
                className={cn(
                  "mt-0.5 rounded-full px-1.5 text-[9px] font-bold uppercase",
                  p === "high" ? "bg-peach/70 text-terracotta-deep" : "bg-sage/40 text-forest",
                )}
              >
                {p}
              </span>
              <span className="text-[11px] text-forest-deep">{t}</span>
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
            <div key={t} className="flex items-center justify-between rounded-lg bg-cream-50 px-2.5 py-1.5 text-[11px]">
              <span className="text-forest-deep">{t}</span>
              <span className={cn("font-semibold", soon ? "text-terracotta" : "text-ink-muted")}>{d}</span>
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
          One platform. <span className="text-terracotta">Five</span> campus systems.
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
              "group flex flex-col rounded-3xl border border-cream-200 bg-white p-6 shadow-soft transition-shadow hover:shadow-lift",
              i === 0 && "lg:col-span-1",
            )}
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-forest-deep text-cream-50 transition-colors group-hover:bg-terracotta">
                <s.icon className="size-5" aria-hidden />
              </span>
              <h3 className="text-lg font-semibold text-forest-deep">{s.title}</h3>
            </div>
            <p className="text-sm leading-relaxed text-ink-muted">{s.description}</p>
            <div className="mt-5 rounded-2xl border border-cream-200 bg-cream-50/60 p-3">
              <Preview id={s.id} />
            </div>
          </motion.li>
        ))}
        <li className="flex flex-col justify-center rounded-3xl border border-dashed border-sage/70 bg-cream-100/50 p-6 text-sm text-forest">
          <p className="font-display text-xl font-semibold text-forest-deep">Add, edit, delete — instantly.</p>
          <p className="mt-2 leading-relaxed text-ink-muted">
            Every change is saved to the backend and pushed live to every open tab. Reload, come back tomorrow, ask the
            agent — it’s the same truth everywhere.
          </p>
        </li>
      </motion.ul>
    </Section>
  );
}
