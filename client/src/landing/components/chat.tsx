import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type BubbleProps = {
  role: "user" | "ai";
  children: React.ReactNode;
  className?: string;
  source?: string;
  /** Set on the constant dark brand panel, where the light surfaces have no contrast. */
  onDark?: boolean;
};

export function ChatBubble({ role, children, className, source, onDark = false }: BubbleProps) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex w-full gap-2.5", isUser ? "justify-end" : "justify-start", className)}
    >
      {!isUser && (
        <span
          className={cn(
            "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg",
            onDark ? "bg-white/12 text-brand-panel-ink" : "bg-ink text-ink-invert",
          )}
        >
          <Sparkles className="size-3.5" aria-hidden />
        </span>
      )}
      <div className={cn("max-w-[85%]", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed",
            isUser ? "rounded-br-md" : "rounded-bl-md",
            onDark
              ? isUser
                ? "bg-brand-panel-ink text-brand-panel"
                : "bg-white/10 text-brand-panel-ink"
              : isUser
                ? "bg-ink text-ink-invert"
                : "bg-surface-3 text-ink",
          )}
        >
          {children}
        </div>
        {source && (
          <div
            className={cn(
              "mt-1.5 flex items-center gap-1.5 text-[11px] font-medium",
              onDark ? "text-brand-panel-ink/60" : "text-ink-3",
            )}
          >
            <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden />
            {source}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-1", className)} aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-ink-3 animate-pulse-dot"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  );
}

/** Reveals `text` one character at a time. Renders instantly under reduced motion. */
export function TypingText({ text, speed = 18, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? text : "");

  useEffect(() => {
    if (reduced) {
      setShown(text);
      onDone?.();
      return;
    }
    setShown("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        onDone?.();
      }
    }, speed);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, reduced]);

  return <span>{shown}</span>;
}
