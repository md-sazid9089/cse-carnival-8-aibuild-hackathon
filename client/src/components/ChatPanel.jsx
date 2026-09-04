import { useRef, useState } from "react";
import { FiCheck, FiMessageCircle, FiX } from "react-icons/fi";
import { api } from "../api.js";

const SUGGESTIONS = [
  "When is my next class?",
  "What assignments do I have due this week?",
  "Show me all high priority announcements.",
  "Which labs have a projector and can fit at least 30 people?",
  "Book Room 7A02 tomorrow from 3 PM to 5 PM.",
  "I'm free until 2 PM — anything on campus I could drop into?",
];

const AGENT_COLORS = {
  router: "bg-slate-200 text-slate-700",
  analyst: "bg-indigo-100 text-indigo-700",
  coordinator: "bg-emerald-100 text-emerald-700",
  error: "bg-rose-100 text-rose-700",
};

export default function ChatPanel({ profile, open = true, onToggle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  const scrollToEnd = () => setTimeout(() => scrollRef.current?.scrollTo(0, 1e6), 50);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    const history = [...messages, { role: "user", content }];
    setMessages(history);
    setBusy(true);
    scrollToEnd();
    try {
      const res = await api.post("/api/agent/chat", {
        messages: history.map(({ role, content }) => ({ role, content })),
        profile,
      });
      setMessages([...history, { role: "assistant", content: res.reply, agent: res.agent, tool_calls: res.tool_calls }]);
    } catch (e) {
      setMessages([...history, { role: "assistant", content: e.message, agent: "error" }]);
    } finally {
      setBusy(false);
      scrollToEnd();
    }
  };

  if (!open) {
    return (
      <button onClick={onToggle} title="Open assistant"
              className="fixed bottom-5 right-5 z-30 rounded-full bg-indigo-600 text-white w-14 h-14 shadow-xl hover:bg-indigo-700 text-xl flex items-center justify-center">
        <FiMessageCircle />
      </button>
    );
  }

  return (
    <aside className="fixed inset-0 z-40 lg:sticky lg:z-auto lg:inset-auto lg:top-0 w-full lg:w-80 xl:w-96 shrink-0 border-l border-slate-200 bg-white flex flex-col h-screen">
      <header className="px-4 py-3 border-b border-slate-200 flex items-start justify-between">
        <div>
          <h2 className="font-semibold">CampusOS Assistant</h2>
          <p className="text-xs text-slate-400">Multi-agent · live data · {profile.name}</p>
        </div>
        <button onClick={onToggle} title="Collapse" aria-label="Close assistant" className="text-slate-400 hover:text-slate-600 text-xl leading-none p-1">
          <FiX />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-400">Try asking:</p>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)}
                      className="block w-full text-left text-sm px-3 py-2 rounded-lg bg-slate-50 hover:bg-indigo-50 border border-slate-200">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            {m.role === "assistant" && m.agent && (
              <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mb-1 ${AGENT_COLORS[m.agent] || "bg-slate-100 text-slate-500"}`}>
                {m.agent}
              </span>
            )}
            {m.tool_calls?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {m.tool_calls.map((t, j) => (
                  <span key={j} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${t.ok ? "border-emerald-300 text-emerald-700" : "border-rose-300 text-rose-700"}`}>
                    {t.ok ? <FiCheck /> : <FiX />} {t.tool}
                  </span>
                ))}
              </div>
            )}
            <div className={`inline-block max-w-[90%] text-sm px-3 py-2 rounded-2xl whitespace-pre-wrap ${
              m.role === "user" ? "bg-indigo-600 text-white rounded-br-sm" : "bg-slate-100 rounded-bl-sm"}`}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && <div className="text-sm text-slate-400 animate-pulse">Agents working…</div>}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 border-t border-slate-200 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about campus…"
               className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <button disabled={busy} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50">
          Send
        </button>
      </form>
    </aside>
  );
}
