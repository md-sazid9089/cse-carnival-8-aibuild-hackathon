import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "../components/section";
import { Reveal } from "../components/reveal";
import { APP_PATH } from "../data/content";
import { scrollToHash, useNavigate } from "../hooks/use-navigate";

/** Abstract campus network: a few nodes joined by faint arcs, drawn in on view. */
function Network() {
  const nodes = [
    [12, 22], [30, 70], [48, 30], [66, 76], [84, 26], [58, 55], [22, 50],
  ];
  const edges: Array<[number, number]> = [[0, 6], [6, 1], [1, 5], [5, 2], [2, 4], [5, 3], [3, 4], [0, 2]];
  return (
    <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-40">
      {edges.map(([a, b], i) => (
        <motion.line
          key={i}
          x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]}
          stroke="#A9B8AC" strokeWidth="0.25" vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, delay: 0.1 * i, ease: "easeInOut" }}
        />
      ))}
      {nodes.map(([x, y], i) => (
        <motion.circle
          key={i} cx={x} cy={y} r="0.9"
          fill={i === 5 ? "#B97861" : "#A9B8AC"}
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 * i, type: "spring", stiffness: 200, damping: 14 }}
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      ))}
    </svg>
  );
}

export function FinalCta() {
  const navigate = useNavigate();
  return (
    <section className="bg-cream-50 px-5 pb-20 sm:px-8 sm:pb-28">
      <Container>
        <Reveal className="relative overflow-hidden rounded-[2rem] bg-forest-deep px-6 py-16 text-center text-cream-50 shadow-lift sm:px-12 sm:py-24">
          <Network />
          <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-terracotta/20 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-16 size-80 rounded-full bg-sage/15 blur-3xl" />

          <div className="relative mx-auto max-w-2xl">
            <h2 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Your campus is already full of information.
              <span className="mt-2 block text-peach">Make it intelligent.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-sage sm:text-lg">
              One platform for campus data. One AI agent for everything you need to know and do — exclusively for AUST
              students, with your @aust.edu account.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" variant="accent" onClick={() => navigate(APP_PATH)} className="w-full sm:w-auto">
                Get Started
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button size="lg" variant="inverted" onClick={() => scrollToHash("#product")} className="w-full sm:w-auto">
                Explore the Platform
              </Button>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
