import { AnimatePresence, motion, useInView } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ChatBubble, TypingDots, TypingText } from "../components/chat";
import { Reveal } from "../components/reveal";
import { Section } from "../components/section";
import { CONVERSATIONS } from "../data/content";

const ROTATE_MS = 6500;

export function AiAgent() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px" });
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<"typing" | "answer" | "done">("typing");
  const [paused, setPaused] = useState(false);

  const active = CONVERSATIONS[index];

  // advance to the answer after a short "thinking" pause
  useEffect(() => {
    setStage("typing");
    const t = window.setTimeout(() => setStage("answer"), 900);
    return () => window.clearTimeout(t);
  }, [index]);

  // auto-rotate while visible and not being interacted with
  useEffect(() => {
    if (!inView || paused || stage !== "done") return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % CONVERSATIONS.length), ROTATE_MS - 3000);
    return () => window.clearTimeout(t);
  }, [inView, paused, stage, index]);

  return (
    <Section
      id="ai-agent"
      tone="cream"
      eyebrow="The AI agent"
      title="Don’t search. Just ask."
      description="CampusOS understands your campus data and turns natural language into useful answers and real actions."
    >
      <div ref={ref} className="grid items-start gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        {/* chat */}
        <Reveal
          className="flex min-h-[420px] flex-col rounded-2xl border border-line bg-surface shadow-lg"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
            <span className="grid size-7 place-items-center rounded-lg bg-ink text-ink-invert">
              <Sparkles className="size-3.5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">CampusOS Assistant</p>
              <p className="text-[11px] text-ink-3">Reads live data · Acts with permission</p>
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-end gap-4 px-5 py-6" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                className="flex flex-col gap-4"
              >
                <ChatBubble role="user">{active.prompt}</ChatBubble>
                {stage === "typing" ? (
                  <ChatBubble role="ai">
                    <TypingDots />
                  </ChatBubble>
                ) : (
                  <ChatBubble role="ai" source={stage === "done" ? active.source : undefined}>
                    <TypingText text={active.reply} speed={14} onDone={() => setStage("done")} />
                  </ChatBubble>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {active.tools.map((t, i) => (
                <motion.span
                  key={`${active.id}-${t}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={stage !== "typing" ? { opacity: 1, y: 0 } : undefined}
                  transition={{ delay: i * 0.12 }}
                  className="rounded-md border border-line bg-surface-3 px-2.5 py-1 font-mono text-[11px] text-ink-3"
                >
                  {t}()
                </motion.span>
              ))}
            </div>
          </div>
        </Reveal>

        {/* queries */}
        <div>
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-accent">Try asking</p>
            <ul className="mt-4 flex flex-col gap-2" role="tablist" aria-label="Example queries">
              {CONVERSATIONS.map((c, i) => {
                const selected = i === index;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => {
                        setIndex(i);
                        setPaused(true);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-[background-color,border-color,transform] duration-200",
                        selected
                          ? "border-ink bg-ink text-ink-invert shadow-xs"
                          : "border-line bg-surface text-ink hover:-translate-y-0.5 hover:border-line-strong",
                      )}
                    >
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          selected ? "bg-accent" : "bg-surface-3",
                        )}
                        aria-hidden
                      />
                      “{c.prompt}”
                    </button>
                  </li>
                );
              })}
            </ul>
          </Reveal>

          <Reveal delay={0.1} className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              ["Reads everything", "Schedules, rooms, events, notices and deadlines — cross-referenced in one answer."],
              ["Takes real actions", "Books rooms and registers for events through the same rules the dashboard enforces."],
              ["Knows what changed", "Edit a notice in the dashboard and the very next question reflects it."],
              ["Knows when to stop", "Vague request? It asks. Not allowed? It refuses, and tells you why."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-line bg-surface/70 p-4">
                <p className="text-sm font-semibold text-ink">{t}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{d}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
