import { useCallback, useEffect, useRef, useState } from "react";
import ChatPanel, { AssistantFab } from "./components/ChatPanel.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import ConfirmHost from "./components/ConfirmDialog.jsx";
import { useEffect, useState } from "react";
import { FiBell, FiCalendar, FiFileText, FiFlag, FiGrid, FiHome } from "react-icons/fi";
import { clearAuth, getStoredToken, getStoredUser, setAuth, setProfile as setApiProfile, toast } from "./api.js";
import ChatPanel from "./components/ChatPanel.jsx";
import Toast from "./components/Toast.jsx";
import { Button, IconButton, Kbd } from "./components/ui.jsx";
import { useMediaQuery, useTheme } from "./hooks.js";
import { CampusProvider, useCampus } from "./lib/campus.jsx";
import { useFocusTrap } from "./lib/focus.js";
import { cx, initials } from "./lib/format.js";
import { Calendar, Chat, Clipboard, Door, Megaphone, Menu, Moon, Search, Sun, Ticket, Today, X } from "./lib/icons.jsx";
import Announcements from "./pages/Announcements.jsx";
import Assignments from "./pages/Assignments.jsx";
import { entities } from "./entities.jsx";
import LandingPage from "./landing/LandingPage.tsx";
import Events from "./pages/Events.jsx";
import Overview from "./pages/Overview.jsx";
import Rooms from "./pages/Rooms.jsx";
import Schedules from "./pages/Schedules.jsx";
import SignIn from "./pages/SignIn.jsx";
import SignUp from "./pages/SignUp.jsx";

const NAV = [
  { id: "overview", label: "Today", icon: Today },
  { id: "schedules", label: "Schedules", icon: Calendar },
  { id: "rooms", label: "Rooms", icon: Door },
  { id: "events", label: "Events", icon: Ticket },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "assignments", label: "Assignments", icon: Clipboard },
];

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? "");

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink text-[13px] font-bold text-ink-invert">
        C
      </span>
      <span className="min-w-0">
        <span className="block text-sm leading-tight font-semibold text-ink">CampusOS</span>
        <span className="block text-[11px] leading-tight text-ink-3">AUST · live campus data</span>
      </span>
    </div>
  );
}

function NavList({ tab, onSelect }) {
  return (
    <nav aria-label="Sections" className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors duration-150",
              active ? "bg-surface-3 font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon size={17} className={active ? "text-ink" : "text-ink-3"} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function AccountCard() {
  const { profile, account, signOut } = useCampus();
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-2.5">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-ink">
          {initials(profile.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-ink">{profile.name}</span>
          <span className="block truncate text-[11px] text-ink-3 tabular">
            {account?.student_id || account?.employee_id || account?.role_id}
          </span>
        </span>
      </div>
      <Button size="sm" variant="ghost" className="w-full" onClick={signOut}>
        Sign out
      </Button>
    </div>
  );
}

function Shell() {
  const [tab, setTab] = useState("overview");
  const [navQuery, setNavQuery] = useState("");
  const [navKey, setNavKey] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const isWide = useMediaQuery("(min-width: 1280px)");
  const [chatOpen, setChatOpen] = useState(isWide);
  const { theme, toggle } = useTheme();
  const drawerRef = useRef(null);

  useFocusTrap({ active: drawer, containerRef: drawerRef, onClose: () => setDrawer(false) });

  // Auto-close when the dock no longer fits; never re-open a panel the user closed.
function getRouteFromPath(pathname) {
  const decoded = decodeURIComponent(pathname || "").toLowerCase().trim();
  if (decoded === "/" || decoded === "") return "landing";
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
    if (!isWide) setChatOpen(false);
  }, [isWide]);

  const navigate = useCallback((next, query = "") => {
    setTab(next);
    setNavQuery(query);
    setNavKey((value) => value + 1);
    setDrawer(false);
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      // Don't hijack the shortcut away from a dialog or a field being typed in.
      const target = event.target;
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? "")) return;
      if (document.querySelector('[role="dialog"]:not([aria-label="Search CampusOS"])')) return;
      event.preventDefault();
      setPalette((open) => !open);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const pages = {
    overview: <Overview onNavigate={navigate} />,
    schedules: <Schedules initialQuery={navQuery} />,
    rooms: <Rooms initialQuery={navQuery} />,
    events: <Events initialQuery={navQuery} />,
    announcements: <Announcements initialQuery={navQuery} />,
    assignments: <Assignments initialQuery={navQuery} />,
  };
  const navigateTo = (newTab, updateHistory = true) => {
    setTab(newTab);
    if (updateHistory) {
      let targetPath = "/overview";
      if (newTab === "landing") targetPath = "/";
      else if (newTab === "signin") targetPath = "/auth/signin";
      else if (newTab === "signup") targetPath = "/auth/signup";
      else if (newTab !== "overview") targetPath = `/${newTab}`;
      window.history.pushState(null, "", targetPath);
    }
  };

  // Landing CTAs hand over a path; resolve it to a tab so the SPA stays in control.
  const navigateToPath = (path) => {
    window.history.pushState(null, "", path);
    setTab(getRouteFromPath(path));
    window.scrollTo({ top: 0 });
  };

  const handleSignOut = () => {
    clearAuth();
    toast("Signed out successfully", "info");
    navigateTo("overview");
  };

  // If on Sign In or Sign Up routes, render dedicated full-page auth screens
  if (tab === "landing") {
    return <LandingPage onNavigate={navigateToPath} />;
  }

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
    <div className="flex min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-80 focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-[13px] focus:text-ink-invert"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-4 lg:flex">
        <div className="px-1.5 pb-4">
          <Brand />
        </div>
        <NavList tab={tab} onSelect={navigate} />
        <div className="mt-auto flex flex-col gap-2 pt-4">
          <button
            type="button"
            onClick={() => setPalette(true)}
            className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-[13px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2"
          >
            <Search size={15} />
            Search
            <span className="ml-auto flex gap-1">
              <Kbd>{IS_MAC ? "⌘" : "Ctrl"}</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <AccountCard />

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
              <span className="text-base"><n.icon /></span> {n.label}
            </button>
          ))}
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-overlay animate-fade-in" onClick={() => setDrawer(false)} aria-hidden="true" />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-line bg-surface px-3 py-4 shadow-lg animate-sheet"
          >
            <div className="flex items-center justify-between px-1.5 pb-4">
              <Brand />
              <IconButton icon={X} label="Close menu" onClick={() => setDrawer(false)} />
            </div>
            <NavList tab={tab} onSelect={navigate} />
            <div className="mt-auto pt-4">
              <AccountCard />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="chrome-blur sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line px-3 sm:px-5">
          <div className="lg:hidden">
            <IconButton icon={Menu} label="Open menu" onClick={() => setDrawer(true)} />
          </div>
          <div className="lg:hidden">
            <Brand />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <div className="lg:hidden">
              <IconButton icon={Search} label="Search" onClick={() => setPalette(true)} />
            </div>
            <IconButton
              icon={theme === "dark" ? Sun : Moon}
              label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggle}
            />
            <div className="hidden xl:block">
              <IconButton
                icon={chatOpen ? X : Chat}
                label={chatOpen ? "Hide assistant" : "Show assistant"}
                onClick={() => setChatOpen((open) => !open)}
              />
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-375 flex-1 px-4 py-5 pb-28 sm:px-6 xl:pb-8">
          <div key={`${tab}-${navKey}`}>{pages[tab]}</div>
        </main>
      </div>

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      <AssistantFab onClick={() => setChatOpen(true)} hidden={chatOpen} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} onNavigate={navigate} />
      <Toast />
      <ConfirmHost />
    </div>
  );
}

/** Nothing is readable without an identity: the whole dashboard is scoped to the signed-in account. */
function Gate() {
  const { account } = useCampus();
  const [view, setView] = useState("signin");

  if (account) return <Shell />;

  const Page = view === "signup" ? SignUp : SignIn;
  return (
    <>
      <Page onNavigate={(target) => setView(target === "signup" ? "signup" : "signin")} onSuccess={() => setView("signin")} />
      <Toast />
    </>
  );
}

export default function App() {
  return (
    <CampusProvider>
      <Gate />
    </CampusProvider>
  );
}
