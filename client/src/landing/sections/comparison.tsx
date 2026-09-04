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
              "flex flex-col rounded-3xl border p-6",
              col.highlight
                ? "border-forest-deep bg-forest-deep text-cream-50 shadow-lift lg:-my-4 lg:py-10"
                : "border-cream-200 bg-white text-forest-deep shadow-soft",
            )}
          >
            <h3 className={cn("font-display text-2xl font-semibold", col.highlight && "text-cream-50")}>{col.title}</h3>
            <ul className="mt-6 space-y-3">
              {col.items.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <span
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                      col.highlight ? "bg-terracotta text-cream-50" : "bg-cream-100 text-ink-muted",
                    )}
                  >
                    {col.highlight ? <Check className="size-3" aria-hidden /> : <Minus className="size-3" aria-hidden />}
                  </span>
                  <span className={col.highlight ? "text-cream-50" : "text-forest"}>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}
