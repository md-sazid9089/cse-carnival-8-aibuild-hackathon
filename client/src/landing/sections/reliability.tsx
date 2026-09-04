import { motion } from "framer-motion";
import { Section } from "../components/section";
import { staggerContainer, staggerItem } from "../components/reveal";
import { RELIABILITY } from "../data/content";

export function Reliability() {
  return (
    <Section
      id="reliability"
      tone="cream"
      eyebrow="Reliability"
      title="Designed so the right thing happens — or nothing does."
      description="No unsupported promises. Just the guarantees the architecture actually gives you."
    >
      <motion.ul
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-10% 0px" }}
        className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3"
      >
        {RELIABILITY.map((r, i) => (
          <motion.li key={r.title} variants={staggerItem} className="bg-surface p-6">
            <p className="font-mono text-xs text-accent">0{i + 1}</p>
            <h3 className="mt-2 text-base font-semibold text-ink">{r.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{r.description}</p>
          </motion.li>
        ))}
      </motion.ul>
    </Section>
  );
}
