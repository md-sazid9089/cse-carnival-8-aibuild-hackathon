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
import { Calendar, Chat, Clipboard, Door, Megaphone, Menu, Moon, Search, Sun, Ticket, Today, X } from "./lib/icons.jsx";
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
          <AccountCard />
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
function Gate({ initialView = "signin" }) {
  const { account } = useCampus();
  const [view, setView] = useState(initialView);

  if (account) return <Shell />;

  const Page = view === "signup" ? SignUp : SignIn;
  return (
    <>
      <Page onNavigate={(target) => setView(target === "signup" ? "signup" : "signin")} onSuccess={() => setView("signin")} />
      <Toast />
    </>
  );
}

const isLandingPath = (pathname) => pathname === "/" || pathname === "";

export default function App() {
  // "/" is the marketing page; every other path drops into the gated app.
  const [entered, setEntered] = useState(() => !isLandingPath(window.location.pathname));
  const [initialView, setInitialView] = useState(() =>
    /signup|register/i.test(window.location.pathname) ? "signup" : "signin",
  );

  useEffect(() => {
    const onPop = () => setEntered(!isLandingPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const enter = (path) => {
    window.history.pushState(null, "", path);
    setInitialView(/signup|register/i.test(path) ? "signup" : "signin");
    setEntered(true);
    window.scrollTo({ top: 0 });
  };

  if (!entered) return <LandingPage onNavigate={enter} />;

  return (
    <CampusProvider>
      <Gate initialView={initialView} />
    </CampusProvider>
  );
}
