import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useMediaQuery } from "../hooks.js";
import { useCampus } from "../lib/campus.jsx";
import { cx } from "../lib/format.js";
import { Alert, Check, Send, Sparkle, Spinner, Trash, X } from "../lib/icons.jsx";
import { Button, IconButton } from "./ui.jsx";

const SUGGESTIONS = [
  { group: "Ask", items: ["When is my next class?", "What do I have due this week?", "Any high-priority notices today?"] },
  {
    group: "Do",
    items: [
      "I need a room for 5 people with a projector tomorrow between 2 and 4.",
      "Register me for the AI workshop.",
      "Just book me any room tomorrow afternoon.",
    ],
  },
];

/** Friendly labels for the tool trace — proof that answers come from real calls. */
const TOOL_LABELS = {
  list_schedules: "Read timetable",
  get_next_class: "Find next class",
  list_assignments: "Read assignments",
  list_announcements: "Read announcements",
  list_events: "Read events",
  list_rooms: "Read rooms",
  find_free_rooms: "Check availability",
  search_campus: "Search campus",
  book_room: "Book room",
  cancel_booking: "Cancel booking",
  register_for_event: "Register for event",
  cancel_registration: "Cancel registration",
};

/** Minimal, injection-safe formatting: builds React nodes, never HTML. */
function RichText({ text }) {
  const blocks = [];
  let list = null;

  const inline = (line, key) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return (
      <span key={key}>
        {parts.map((part, index) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={index} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          ) : (
            part
          ),
        )}
      </span>
    );
  };

  String(text)
    .split("\n")
    .forEach((line, index) => {
      const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
      if (bullet) {
        list ??= [];
        list.push(<li key={index}>{inline(bullet[1], index)}</li>);
        return;
      }
      if (list) {
        blocks.push(
          <ul key={`list-${index}`} className="my-1 ml-4 list-disc space-y-0.5">
            {list}
          </ul>,
        );
        list = null;
      }
      if (line.trim()) blocks.push(<p key={index}>{inline(line, index)}</p>);
    });

  if (list)
    blocks.push(
      <ul key="list-end" className="my-1 ml-4 list-disc space-y-0.5">
        {list}
      </ul>,
    );

  return <div className="space-y-1.5">{blocks}</div>;
}

function ToolTrace({ calls }) {
  if (!calls?.length) return null;
  return (
    <ul className="mb-1.5 flex flex-wrap gap-1">
      {calls.map((call, index) => (
        <li key={index}>
          <span
            title={Object.keys(call.args ?? {}).length ? JSON.stringify(call.args) : undefined}
            className={cx(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
              call.ok ? "border-positive/30 bg-positive-soft text-positive" : "border-critical/30 bg-critical-soft text-critical",
            )}
          >
            {call.ok ? <Check size={11} /> : <X size={11} />}
            {TOOL_LABELS[call.tool] ?? call.tool}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Composer({ onSend, busy }) {
  const [value, setValue] = useState("");
  const ref = useRef(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 132)}px`;
  }, [value]);

  const submit = (event) => {
    event.preventDefault();
    const text = value.trim();
    if (!text || busy) return;
    setValue("");
    onSend(text);
  };

  return (
    <form
      onSubmit={submit}
      className="border-t border-line bg-surface px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-end gap-2 rounded-xl border border-line bg-surface-2 p-1.5 transition-colors focus-within:border-line-strong">
        <label htmlFor="assistant-input" className="sr-only">
          Message the campus assistant
        </label>
        <textarea
          id="assistant-input"
          ref={ref}
          rows={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) submit(event);
          }}
          placeholder="Ask about classes, rooms, events…"
          className="max-h-33 min-h-8 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-snug outline-none"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          aria-label="Send message"
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink text-ink-invert transition-[opacity,transform] duration-150 not-disabled:active:scale-95 disabled:opacity-35"
        >
          {busy ? <Spinner size={15} /> : <Send size={15} />}
        </button>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-ink-3">
        Enter to send · Shift + Enter for a new line
      </p>
    </form>
  );
}

export default function ChatPanel({ open, onClose }) {
  const { profile } = useCampus();
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const isWide = useMediaQuery("(min-width: 1280px)");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (isWide || !open) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isWide, open, onClose]);

  const send = async (content) => {
    const history = [...messages, { role: "user", content }];
    setMessages(history);
    setBusy(true);
    try {
      const res = await api.post("/api/agent/chat", {
        messages: history.map(({ role, content: text }) => ({ role, content: text })),
        profile,
      });
      setMessages([...history, { role: "assistant", content: res.reply, agent: res.agent, tool_calls: res.tool_calls }]);
    } catch (error) {
      setMessages([...history, { role: "assistant", content: error.message, agent: "error" }]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const body = (
    <>
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink text-ink-invert">
            <Sparkle size={16} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Campus Assistant</h2>
            <p className="truncate text-[12px] text-ink-3">Live data · acting as {profile.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {messages.length ? (
            <IconButton icon={Trash} label="Clear conversation" size={15} onClick={() => setMessages([])} />
          ) : null}
          <IconButton icon={X} label="Close assistant" size={17} onClick={onClose} />
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="animate-fade-in">
            <p className="text-sm leading-relaxed text-ink-2">
              Ask me anything about your campus. I read the same database the dashboard writes to — including edits made a
              second ago — and I call real tools to answer or act.
            </p>
            {SUGGESTIONS.map((section) => (
              <div key={section.group} className="mt-4">
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{section.group}</p>
                <div className="flex flex-col gap-1.5">
                  {section.items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => send(item)}
                      className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-left text-[13px] leading-snug text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-3 hover:text-ink"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="flex flex-col gap-3.5">
            {messages.map((message, index) => (
              <li key={index} className={cx("flex flex-col", message.role === "user" ? "items-end" : "items-start")}>
                {message.role === "assistant" ? <ToolTrace calls={message.tool_calls} /> : null}
                <div
                  className={cx(
                    "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed animate-pop",
                    message.role === "user"
                      ? "rounded-br-md bg-ink text-ink-invert"
                      : message.agent === "error"
                        ? "rounded-bl-md border border-critical/30 bg-critical-soft text-ink"
                        : "rounded-bl-md bg-surface-3 text-ink",
                  )}
                >
                  {message.agent === "error" ? (
                    <p className="flex items-start gap-2">
                      <Alert size={15} className="mt-0.5 shrink-0 text-critical" />
                      <span>{message.content}</span>
                    </p>
                  ) : (
                    <RichText text={message.content} />
                  )}
                </div>
              </li>
            ))}
            {busy ? (
              <li className="flex items-center gap-2 text-[13px] text-ink-3" aria-live="polite">
                <Spinner size={14} />
                Reading live campus data…
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <Composer onSend={send} busy={busy} />
    </>
  );

  if (isWide) {
    return (
      <aside
        aria-label="Campus assistant"
        className="sticky top-0 flex h-screen w-95 shrink-0 flex-col border-l border-line bg-surface 2xl:w-105"
      >
        {body}
      </aside>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" role="dialog" aria-modal="true" aria-label="Campus assistant">
      <button className="flex-1 bg-overlay animate-fade-in" onClick={onClose} aria-label="Close assistant" tabIndex={-1} />
      <div className="flex h-[88vh] flex-col overflow-hidden rounded-t-2xl border-t border-line bg-surface shadow-lg animate-sheet">
        {body}
      </div>
    </div>
  );
}

export function AssistantFab({ onClick, hidden }) {
  if (hidden) return null;
  return (
    <Button
      onClick={onClick}
      variant="primary"
      size="lg"
      icon={Sparkle}
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 rounded-full shadow-lg xl:hidden"
    >
      Assistant
    </Button>
  );
}
