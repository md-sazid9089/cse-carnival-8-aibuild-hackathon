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
            className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-xs transition-shadow hover:shadow-md"
          >
            <motion.span
              aria-hidden
              variants={{ hover: { scale: 1.6, opacity: 0.35 } }}
              initial={{ scale: 1, opacity: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 20 }}
              className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-accent-soft"
            />
            <motion.span
              variants={{ hover: { rotate: -6, scale: 1.06 } }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="relative grid size-11 place-items-center rounded-xl bg-ink text-ink-invert"
            >
              <c.icon className="size-5" aria-hidden />
            </motion.span>
            <h3 className="relative mt-5 text-xl font-semibold tracking-tight text-ink">{c.title}</h3>
            <p className="relative mt-2 text-sm leading-relaxed text-ink-2">{c.description}</p>
          </motion.li>
        ))}
      </motion.ul>
    </Section>
  );
}
