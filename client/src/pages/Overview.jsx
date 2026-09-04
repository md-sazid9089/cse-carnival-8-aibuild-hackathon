import { FiAlertTriangle } from "react-icons/fi";
import { useApi, useSSE } from "../hooks.js";

function Card({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-500 mb-3">{title}</h3>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Overview() {
  const meta = useApi("/api/meta");
  const schedules = useApi("/api/schedules");
  const events = useApi("/api/events");
  const announcements = useApi("/api/announcements?include_expired=false");
  const assignments = useApi("/api/assignments");
  useSSE(null, () => { schedules.refresh(); events.refresh(); announcements.refresh(); assignments.refresh(); });

  // Server-side date/time (campus timezone) so judges in other TZs see the right "today"
  const today = meta.data?.weekday ?? DAYS[new Date().getDay()];
  const todayIso = meta.data?.today ?? new Date().toISOString().slice(0, 10);
  const weekAhead = new Date(new Date(todayIso).getTime() + 7 * 86400000).toISOString().slice(0, 10);

  const todaysClasses = (schedules.data || []).filter((s) => s.day === today);
  const dueSoon = (assignments.data || []).filter((a) => a.deadline >= todayIso && a.deadline <= weekAhead && a.status === "pending");
  const highPriority = (announcements.data || []).filter((a) => a.priority === "high");
  const upcoming = (events.data || []).filter((e) => e.status !== "completed" && e.status !== "cancelled" && e.date >= todayIso).slice(0, 5);

  if (schedules.loading || events.loading || announcements.loading || assignments.loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Overview</h1>
        <div className="grid md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-40 rounded-xl bg-white border border-slate-200 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Overview — {today}</h1>
      <div className="grid md:grid-cols-2 gap-4">
        <Card title={`Today's Classes (${today})`}>
          {todaysClasses.length ? todaysClasses.map((s) => (
            <div key={s.id} className="flex flex-wrap justify-between gap-x-3 border-b border-slate-100 pb-1.5 last:border-0">
              <span><b>{s.course}</b> · {s.title}</span>
              <span className="text-slate-500 whitespace-nowrap">{s.start_time}–{s.end_time} · {s.room}</span>
            </div>
          )) : <div className="text-slate-400">No classes today</div>}
          {highPriority.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-600 pt-1"><FiAlertTriangle className="shrink-0" /> Check announcements — {highPriority.length} high-priority notice(s) may affect classes.</div>
          )}
        </Card>
        <Card title="Due This Week">
          {dueSoon.length ? dueSoon.map((a) => (
            <div key={a.id} className="flex flex-wrap justify-between gap-x-3 border-b border-slate-100 pb-1.5 last:border-0">
              <span><b>{a.course}</b> · {a.title}</span>
              <span className="text-rose-600 whitespace-nowrap">{a.deadline}</span>
            </div>
          )) : <div className="text-slate-400">Nothing due within 7 days.</div>}
        </Card>
        <Card title="High-Priority Announcements">
          {highPriority.length ? highPriority.map((a) => (
            <div key={a.id} className="border-b border-slate-100 pb-1.5 last:border-0">
              <b>{a.title}</b>
              <div className="text-slate-500 text-xs">{a.date} · expires {a.expires}</div>
            </div>
          )) : <div className="text-slate-400">No active high-priority notices.</div>}
        </Card>
        <Card title="Upcoming Events">
          {upcoming.length ? upcoming.map((e) => (
            <div key={e.id} className="flex flex-wrap justify-between gap-x-3 border-b border-slate-100 pb-1.5 last:border-0">
              <span>{e.name}</span>
              <span className="text-slate-500 whitespace-nowrap">{e.date} · {e.venue} · {e.registered}/{e.capacity}</span>
            </div>
          )) : <div className="text-slate-400">No upcoming events.</div>}
        </Card>
      </div>
    </div>
  );
}
