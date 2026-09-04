import { motion } from "framer-motion";
import { Section } from "../components/section";
import { staggerContainer, staggerItem } from "../components/reveal";
import { HOW_IT_WORKS } from "../data/content";

export function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      eyebrow="How it works"
      title="Three steps. One source of truth."
      align="center"
    >
      <motion.ol
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-15% 0px" }}
        className="relative grid gap-10 md:grid-cols-3 md:gap-6"
      >
        {/* connecting line */}
        <motion.span
          aria-hidden
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeInOut", delay: 0.3 }}
          className="absolute top-7 right-[16.6%] left-[16.6%] hidden h-px origin-left bg-gradient-to-r from-line via-accent to-line md:block"
        />
        {HOW_IT_WORKS.map((s) => (
          <motion.li key={s.step} variants={staggerItem} className="relative flex flex-col items-center text-center">
            <span className="relative z-10 grid size-14 place-items-center rounded-full border-4 border-canvas bg-ink text-lg font-semibold text-ink-invert shadow-xs">
              {s.step}
            </span>
            <h3 className="mt-5 text-xl font-semibold tracking-tight text-ink">{s.title}</h3>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-2">{s.description}</p>
          </motion.li>
        ))}
      </motion.ol>
    </Section>
  );
}
