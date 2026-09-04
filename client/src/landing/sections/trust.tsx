import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { ChatBubble } from "../components/chat";
import { Section } from "../components/section";
import { staggerContainer, staggerItem } from "../components/reveal";
import { EDGE_CASES } from "../data/content";

export function Trust() {
  return (
    <Section
      id="trust"
      tone="cream"
      eyebrow="Trust"
      title="Smart enough to know when not to act."
      description="A useful agent isn’t the one that always says yes. CampusOS asks when a request is vague, refuses when it shouldn’t act, and never pretends something worked."
    >
      <motion.ul
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-10% 0px" }}
        className="grid gap-5 md:grid-cols-2"
      >
        {EDGE_CASES.map((c) => (
          <motion.li
            key={c.title}
            variants={staggerItem}
            className="flex flex-col gap-4 rounded-3xl border border-cream-200 bg-white p-6 shadow-soft"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-moss" aria-hidden />
              <h3 className="text-sm font-bold uppercase tracking-wider text-forest">{c.title}</h3>
            </div>
            <ChatBubble role="user">{c.user}</ChatBubble>
            <ChatBubble role="ai">{c.ai}</ChatBubble>
          </motion.li>
        ))}
      </motion.ul>
    </Section>
  );
}
