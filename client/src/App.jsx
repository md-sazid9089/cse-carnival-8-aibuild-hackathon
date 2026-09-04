import { useEffect, useState } from "react";
import { setProfile as setApiProfile } from "./api.js";
import ChatPanel from "./components/ChatPanel.jsx";
import Toast from "./components/Toast.jsx";
import { entities } from "./entities.jsx";
import Events from "./pages/Events.jsx";
import Overview from "./pages/Overview.jsx";
import ResourcePage from "./pages/ResourcePage.jsx";
import Rooms from "./pages/Rooms.jsx";

const NAV = [
  { id: "overview", label: "Overview", icon: "🏠" },
  { id: "schedules", label: "Schedules", icon: "📅" },
  { id: "rooms", label: "Rooms", icon: "🚪" },
  { id: "events", label: "Events", icon: "🎪" },
  { id: "announcements", label: "Announcements", icon: "📢" },
  { id: "assignments", label: "Assignments", icon: "📝" },
];

const PROFILES = [
  { student_id: "20-40532", name: "Sakibul Hassan" },
  { student_id: "20-40511", name: "Farhan Ahmed" },
  { student_id: "21-41205", name: "Rafi Hossain" },
];

export default function App() {
  const [tab, setTab] = useState("overview");
  const [profile, setProfile] = useState(PROFILES[0]);
  const [chatOpen, setChatOpen] = useState(true);
  useEffect(() => setApiProfile(profile), [profile]);

  return (
    <div className="flex min-h-screen">
      <nav className="w-48 shrink-0 bg-slate-900 text-slate-300 flex flex-col sticky top-0 h-screen">
        <div className="px-4 py-5">
          <h1 className="text-white font-bold text-lg">CampusOS</h1>
          <p className="text-xs text-slate-500">AUST · AI Build Hackathon</p>
        </div>
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setTab(n.id)}
                  className={`text-left px-4 py-2.5 text-sm flex gap-2 items-center ${
                    tab === n.id ? "bg-slate-800 text-white border-l-2 border-indigo-500" : "hover:bg-slate-800/50"}`}>
            <span>{n.icon}</span> {n.label}
          </button>
        ))}
        <div className="mt-auto p-4">
          <label className="text-xs text-slate-500 block mb-1">Acting as</label>
          <select
            value={profile.student_id}
            onChange={(e) => setProfile(PROFILES.find((p) => p.student_id === e.target.value))}
            className="w-full bg-slate-800 text-slate-200 text-sm rounded-lg px-2 py-1.5"
          >
            {PROFILES.map((p) => <option key={p.student_id} value={p.student_id}>{p.name}</option>)}
          </select>
        </div>
      </nav>

      <main className="flex-1 min-w-0 p-6 overflow-x-auto">
        <div className="flex justify-end mb-2 lg:hidden">
          <button onClick={() => setChatOpen((o) => !o)} className="text-sm text-indigo-600 hover:underline">
            {chatOpen ? "Hide assistant" : "Show assistant"}
          </button>
        </div>
        {tab === "overview" && <Overview />}
        {tab === "schedules" && <ResourcePage entity="schedules" config={entities.schedules} />}
        {tab === "rooms" && <Rooms profile={profile} />}
        {tab === "events" && <Events profile={profile} />}
        {tab === "announcements" && <ResourcePage entity="announcements" config={entities.announcements} />}
        {tab === "assignments" && <ResourcePage entity="assignments" config={entities.assignments} />}
      </main>

      <ChatPanel profile={profile} open={chatOpen} onToggle={() => setChatOpen((o) => !o)} />
      <Toast />
    </div>
  );
}
