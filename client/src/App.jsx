import { useCallback, useEffect, useRef, useState } from "react";
import ChatPanel, { AssistantFab } from "./components/ChatPanel.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import ConfirmHost from "./components/ConfirmDialog.jsx";
import Toast from "./components/Toast.jsx";
import { Button, IconButton, Kbd } from "./components/ui.jsx";
import { useMediaQuery, useTheme } from "./hooks.js";
import { CampusProvider, useCampus } from "./lib/campus.jsx";
import { useFocusTrap } from "./lib/focus.js";
import { cx, initials } from "./lib/format.js";
import { Calendar, Clipboard, Door, Megaphone, Menu, Moon, Search, Sun, Ticket, Today, X } from "./lib/icons.jsx";
import Announcements from "./pages/Announcements.jsx";
import Assignments from "./pages/Assignments.jsx";
import Events from "./pages/Events.jsx";
import Overview from "./pages/Overview.jsx";
import Rooms from "./pages/Rooms.jsx";
import Schedules from "./pages/Schedules.jsx";
import SignIn from "./pages/SignIn.jsx";
import SignUp from "./pages/SignUp.jsx";
import LandingPage from "./landing/LandingPage.tsx";

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
        <span className="block text-[11px] leading-tight text-ink-3">AUST students only · live data</span>
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

function AccountCard({ onSignOut }) {
  const { profile, account, signOut } = useCampus();
  const handleSignOut = () => {
    signOut();
    onSignOut?.();
  };
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-2.5">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-ink">
          {initials(profile.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-ink">{profile.name}</span>
          <span className="block truncate text-[11px] text-ink-3 tabular">
            {account?.student_id ? `ID: ${account.student_id}` : "Student (Full Access)"}
          </span>
        </span>
      </div>
      <Button size="sm" variant="ghost" className="w-full" onClick={handleSignOut}>
        Sign out
      </Button>
    </div>
  );
}

function Shell({ onSignOut }) {
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
          <AccountCard onSignOut={onSignOut} />
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
              <AccountCard onSignOut={onSignOut} />
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
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className={cx("mx-auto w-full max-w-375 flex-1 px-4 py-5 sm:px-6", chatOpen ? "pb-8" : "pb-28")}
        >
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

const ROUTE_LANDING = "/";
const ROUTE_SIGNIN = "/auth/signin";
const ROUTE_SIGNUP = "/auth/signup";
const ROUTE_DASHBOARD = "/dashboard";

function normalizeRoute(pathname) {
  const clean = (pathname || "/").replace(/\/+$/, "") || "/";
  if (clean === "/" || clean === "") return ROUTE_LANDING;
  if (clean === "/auth/signin" || clean === "/signin") return ROUTE_SIGNIN;
  if (clean === "/auth/signup" || clean === "/signup" || clean === "/register") return ROUTE_SIGNUP;
  if (clean === "/dashboard" || clean === "/overview" || clean === "/app") return ROUTE_DASHBOARD;
  return clean;
}

function AppRouter() {
  const { account } = useCampus();
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  // Sync state when browser Back/Forward is clicked
  useEffect(() => {
    const onPop = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    let target = to;
    if (target === "signin" || target === "/signin") target = ROUTE_SIGNIN;
    else if (target === "signup" || target === "/signup" || target === "register" || target === "/register") target = ROUTE_SIGNUP;
    else if (target === "overview" || target === "dashboard" || target === "/dashboard" || target === "/overview") target = ROUTE_DASHBOARD;
    else if (target === "home" || target === "/") target = ROUTE_LANDING;

    if (window.location.pathname !== target) {
      if (replace) {
        window.history.replaceState(null, "", target);
      } else {
        window.history.pushState(null, "", target);
      }
    }
    setCurrentPath(target);
    window.scrollTo({ top: 0 });
  }, []);

  const route = normalizeRoute(currentPath);

  // Normalize legacy or aliased URLs in the browser address bar
  useEffect(() => {
    if (route === ROUTE_SIGNIN && window.location.pathname !== ROUTE_SIGNIN) {
      window.history.replaceState(null, "", ROUTE_SIGNIN);
    } else if (route === ROUTE_SIGNUP && window.location.pathname !== ROUTE_SIGNUP) {
      window.history.replaceState(null, "", ROUTE_SIGNUP);
    } else if (route === ROUTE_DASHBOARD && window.location.pathname !== ROUTE_DASHBOARD) {
      window.history.replaceState(null, "", ROUTE_DASHBOARD);
    }
  }, [route]);

  // If already logged in and visiting sign in or sign up, redirect to dashboard
  useEffect(() => {
    if (account && (route === ROUTE_SIGNIN || route === ROUTE_SIGNUP)) {
      navigate(ROUTE_DASHBOARD, { replace: true });
    }
  }, [account, route, navigate]);

  // If signed out and accessing dashboard, redirect to sign in
  useEffect(() => {
    if (!account && route === ROUTE_DASHBOARD) {
      navigate(ROUTE_SIGNIN, { replace: true });
    }
  }, [account, route, navigate]);

  if (route === ROUTE_LANDING) {
    return <LandingPage onNavigate={navigate} />;
  }

  if (route === ROUTE_SIGNUP) {
    if (account) return <Shell onSignOut={() => navigate(ROUTE_SIGNIN, { replace: true })} />;
    return (
      <>
        <SignUp
          onNavigate={(target) => navigate(target)}
          onSuccess={() => navigate(ROUTE_DASHBOARD)}
        />
        <Toast />
      </>
    );
  }

  if (route === ROUTE_SIGNIN) {
    if (account) return <Shell onSignOut={() => navigate(ROUTE_SIGNIN, { replace: true })} />;
    return (
      <>
        <SignIn
          onNavigate={(target) => navigate(target)}
          onSuccess={() => navigate(ROUTE_DASHBOARD)}
        />
        <Toast />
      </>
    );
  }

  if (route === ROUTE_DASHBOARD) {
    if (!account) {
      return (
        <>
          <SignIn
            onNavigate={(target) => navigate(target)}
            onSuccess={() => navigate(ROUTE_DASHBOARD)}
          />
          <Toast />
        </>
      );
    }
    return <Shell onSignOut={() => navigate(ROUTE_SIGNIN, { replace: true })} />;
  }

  // Any other route: if signed in, show dashboard; if signed out, show landing
  if (account) {
    return <Shell onSignOut={() => navigate(ROUTE_SIGNIN, { replace: true })} />;
  }
  return <LandingPage onNavigate={navigate} />;
}

export default function App() {
  return (
    <CampusProvider>
      <AppRouter />
    </CampusProvider>
  );
}
