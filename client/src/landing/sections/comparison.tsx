import { motion } from "framer-motion";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section } from "../components/section";
import { staggerContainer, staggerItem } from "../components/reveal";
import { COMPARISON } from "../data/content";

export function Comparison() {
  return (
    <Section
      id="why"
      eyebrow="Why CampusOS"
      title="More than a campus dashboard."
      description="Portals show you data. Chatbots talk about data. CampusOS is the layer where current data and a careful agent work together."
    >
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-10% 0px" }}
        className="grid gap-4 lg:grid-cols-3"
      >
        {COMPARISON.map((col) => (
          <motion.div
            key={col.title}
            variants={staggerItem}
            className={cn(
              "flex flex-col rounded-2xl border p-6",
              col.highlight
                ? "border-brand-panel bg-brand-panel text-brand-panel-ink shadow-lg lg:-my-4 lg:py-10"
                : "border-line bg-surface text-ink shadow-xs",
            )}
          >
            <h3 className="text-xl font-semibold tracking-tight">{col.title}</h3>
            <ul className="mt-6 space-y-3">
              {col.items.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <span
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                      col.highlight ? "bg-accent text-ink-invert" : "bg-surface-3 text-ink-3",
                    )}
                  >
                    {col.highlight ? <Check className="size-3" aria-hidden /> : <Minus className="size-3" aria-hidden />}
                  </span>
                  <span className={col.highlight ? "text-brand-panel-ink/85" : "text-ink-2"}>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}
