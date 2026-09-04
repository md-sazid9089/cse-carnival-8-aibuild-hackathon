import { useEffect, useState } from "react";
import { FiBell, FiCalendar, FiFileText, FiFlag, FiGrid, FiHome } from "react-icons/fi";
import { clearAuth, getStoredToken, getStoredUser, setAuth, setProfile as setApiProfile, toast } from "./api.js";
import ChatPanel from "./components/ChatPanel.jsx";
import Toast from "./components/Toast.jsx";
import { entities } from "./entities.jsx";
import Events from "./pages/Events.jsx";
import Overview from "./pages/Overview.jsx";
import ResourcePage from "./pages/ResourcePage.jsx";
import Rooms from "./pages/Rooms.jsx";
import SignIn from "./pages/SignIn.jsx";
import SignUp from "./pages/SignUp.jsx";

const NAV = [
  { id: "overview", label: "Overview", icon: FiHome },
  { id: "schedules", label: "Schedules", icon: FiCalendar },
  { id: "rooms", label: "Rooms", icon: FiGrid },
  { id: "events", label: "Events", icon: FiFlag },
  { id: "announcements", label: "Announcements", icon: FiBell },
  { id: "assignments", label: "Assignments", icon: FiFileText },
];

function getRouteFromPath(pathname) {
  const decoded = decodeURIComponent(pathname || "").toLowerCase().trim();
  if (
    decoded === "/auth/signin" ||
    decoded === "/auth/sign-in" ||
    decoded === "/auth/sign in" ||
    decoded === "/auth/sign%20in" ||
    decoded === "/auth/login" ||
    decoded === "/signin" ||
    decoded === "/login"
  ) {
    return "signin";
  }
  if (
    decoded === "/auth/signup" ||
    decoded === "/auth/sign-up" ||
    decoded === "/auth/sign up" ||
    decoded === "/auth/sign%20up" ||
    decoded === "/auth/register" ||
    decoded === "/signup" ||
    decoded === "/register"
  ) {
    return "signup";
  }
  for (const item of NAV) {
    if (decoded === `/${item.id}`) return item.id;
  }
  return "overview";
}

export default function App() {
  const [tab, setTab] = useState(() => getRouteFromPath(window.location.pathname));
  const [user, setUser] = useState(getStoredUser);
  const [chatOpen, setChatOpen] = useState(true);

  const profile = {
    student_id: user?.student_id || (user?.role_id === "student" ? "20-40532" : ""),
    name: user?.name || "Sakibul Hassan",
    role: user?.role_id || "student",
    email: user?.email || "",
  };

  useEffect(() => {
    setApiProfile(profile);
  }, [user]);

  // Synchronize history navigation and URL changes
  useEffect(() => {
    const onLocationChange = () => {
      setTab(getRouteFromPath(window.location.pathname));
    };
    window.addEventListener("popstate", onLocationChange);

    const onAuthChange = (e) => {
      setUser(e.detail?.user || getStoredUser());
    };
    window.addEventListener("campusos:auth_change", onAuthChange);

    return () => {
      window.removeEventListener("popstate", onLocationChange);
      window.removeEventListener("campusos:auth_change", onAuthChange);
    };
  }, []);

  const navigateTo = (newTab, updateHistory = true) => {
    setTab(newTab);
    if (updateHistory) {
      let targetPath = "/";
      if (newTab === "signin") targetPath = "/auth/signin";
      else if (newTab === "signup") targetPath = "/auth/signup";
      else if (newTab !== "overview") targetPath = `/${newTab}`;
      window.history.pushState(null, "", targetPath);
    }
  };

  const handleSignOut = () => {
    clearAuth();
    toast("Signed out successfully", "info");
    navigateTo("overview");
  };

  // If on Sign In or Sign Up routes, render dedicated full-page auth screens
  if (tab === "signin") {
    return (
      <>
        <SignIn onNavigate={navigateTo} onSuccess={() => navigateTo("overview")} />
        <Toast />
      </>
    );
  }

  if (tab === "signup") {
    return (
      <>
        <SignUp onNavigate={navigateTo} onSuccess={() => navigateTo("overview")} />
        <Toast />
      </>
    );
  }

  const isAuthority = user?.role_id === "authority";
  const hasToken = !!getStoredToken();

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar Navigation */}
      <nav className="w-56 shrink-0 bg-slate-900 text-slate-300 flex flex-col sticky top-0 h-screen border-r border-slate-800">
        <div className="px-4 py-5 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <h1 className="text-white font-bold text-lg tracking-tight">CampusOS</h1>
            <span className="text-[10px] bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 px-1.5 py-0.5 rounded font-mono">v1.0</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">AUST · AI University Platform</p>
        </div>

        <div className="py-2 flex-1 overflow-y-auto">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => navigateTo(n.id)}
              className={`w-full text-left px-4 py-2.5 text-sm flex gap-2.5 items-center transition-colors ${
                tab === n.id
                  ? "bg-slate-800 text-white font-medium border-l-4 border-indigo-500"
                  : "hover:bg-slate-800/60 text-slate-300"
              }`}
            >
              <n.icon className="text-base shrink-0" /> {n.label}
            </button>
          ))}
        </div>

        {/* User Account / Profile Footer */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-xs">
          <div className="flex items-start justify-between mb-2">
            <div className="min-w-0 pr-1">
              <div className="font-semibold text-white truncate text-xs">{user?.name || "Sakibul Hassan"}</div>
              <div className="text-[11px] text-slate-400 truncate">
                {user?.student_id ? `ID: ${user.student_id}` : user?.email || "Student Profile"}
              </div>
            </div>
            <span
              className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                isAuthority
                  ? "bg-purple-950/90 text-purple-300 border-purple-600 shadow-sm shadow-purple-900/40"
                  : user?.role_id === "teacher"
                  ? "bg-emerald-950/90 text-emerald-300 border-emerald-600"
                  : "bg-blue-950/90 text-blue-300 border-blue-600"
              }`}
            >
              {isAuthority ? "👑 Authority" : user?.role_id === "teacher" ? "👨‍🏫 Faculty" : "🎓 Student"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              onClick={() => navigateTo("signin")}
              className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-center font-medium transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => navigateTo("signup")}
              className="px-2 py-1.5 rounded bg-indigo-600/80 hover:bg-indigo-600 text-white text-center font-medium transition-colors"
            >
              Sign Up
            </button>
          </div>

          {hasToken && (
            <button
              onClick={handleSignOut}
              className="w-full mt-2 px-2 py-1 text-[11px] text-rose-400 hover:text-rose-300 text-center transition-colors"
            >
              Sign Out
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-medium text-slate-500">
              Active Context:
            </span>
            <span className="text-sm font-semibold text-slate-900 truncate">
              {user?.name}
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                isAuthority
                  ? "bg-purple-100 text-purple-800 border-purple-300 font-semibold"
                  : user?.role_id === "teacher"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-blue-100 text-blue-800 border-blue-300"
              }`}
            >
              {isAuthority ? "👑 Authority · Full System Access" : user?.role_id === "teacher" ? "👨‍🏫 Teacher" : "🎓 Student (Initial Role)"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <a
                href="/auth/signin"
                onClick={(e) => { e.preventDefault(); navigateTo("signin"); }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2.5 py-1 rounded-md hover:bg-indigo-50 border border-indigo-200 transition-colors"
              >
                /auth/signin
              </a>
              <a
                href="/auth/signup"
                onClick={(e) => { e.preventDefault(); navigateTo("signup"); }}
                className="text-xs text-slate-700 hover:text-slate-900 font-medium px-2.5 py-1 rounded-md hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                /auth/signup
              </a>
            </div>

            <button
              onClick={() => setChatOpen((o) => !o)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
            >
              {chatOpen ? "Hide Assistant" : "💬 AI Assistant"}
            </button>
          </div>
        </header>

        {/* Authority Full Access Banner */}
        {isAuthority && (
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-purple-100 px-6 py-2.5 text-xs flex items-center justify-between shadow-inner border-b border-purple-700">
            <div className="flex items-center gap-2">
              <span className="text-base">👑</span>
              <span className="font-semibold">Authority Mode Active:</span>
              <span>Full administrative CRUD permissions enabled across all campus schedules, rooms, events, announcements, and booking overrides.</span>
            </div>
            <span className="bg-purple-800/80 text-purple-200 border border-purple-600/60 px-2 py-0.5 rounded text-[10px] font-mono">
              ROLE: AUTHORITY
            </span>
          </div>
        )}

        <main className="flex-1 p-6 overflow-x-auto">
          {tab === "overview" && <Overview />}
          {tab === "schedules" && <ResourcePage entity="schedules" config={entities.schedules} />}
          {tab === "rooms" && <Rooms user={user} profile={profile} />}
          {tab === "events" && <Events user={user} profile={profile} />}
          {tab === "announcements" && <ResourcePage entity="announcements" config={entities.announcements} />}
          {tab === "assignments" && <ResourcePage entity="assignments" config={entities.assignments} />}
        </main>
      </div>

      <ChatPanel profile={profile} open={chatOpen} onToggle={() => setChatOpen((o) => !o)} />
      <Toast />
    </div>
  );
}

