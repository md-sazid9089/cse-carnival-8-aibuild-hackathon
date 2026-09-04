import { motion } from "framer-motion";
import { Section } from "../components/section";
import { staggerContainer, staggerItem } from "../components/reveal";
import { CAPABILITIES } from "../data/content";

export function Capabilities() {
  return (
    <Section
      id="capabilities"
      eyebrow="Capabilities"
      title="Built to read, reason, and act — carefully."
      description="Six behaviours that separate an assistant you can trust from a chatbot that guesses."
    >
      <motion.ul
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-10% 0px" }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {CAPABILITIES.map((c) => (
          <motion.li
            key={c.title}
            variants={staggerItem}
            whileHover="hover"
            className="group relative overflow-hidden rounded-3xl border border-cream-200 bg-white p-6 shadow-soft transition-shadow hover:shadow-lift"
          >
            <motion.span
              aria-hidden
              variants={{ hover: { scale: 1.6, opacity: 0.35 } }}
              initial={{ scale: 1, opacity: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 20 }}
              className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-peach/60"
            />
            <motion.span
              variants={{ hover: { rotate: -6, scale: 1.06 } }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="relative grid size-11 place-items-center rounded-2xl bg-forest-deep text-cream-50"
            >
              <c.icon className="size-5" aria-hidden />
            </motion.span>
            <h3 className="relative mt-5 font-display text-2xl font-semibold text-forest-deep">{c.title}</h3>
            <p className="relative mt-2 text-sm leading-relaxed text-ink-muted">{c.description}</p>
          </motion.li>
        ))}
      </motion.ul>
    </Section>
  );
}
