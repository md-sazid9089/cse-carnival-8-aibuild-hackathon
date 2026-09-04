import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "../components/logo";
import { APP_PATH, NAV_LINKS, SIGN_IN_PATH } from "../data/content";
import { scrollToHash, useNavigate } from "../hooks/use-navigate";

export function Navbar() {
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => setCompact(y > 24));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const go = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    scrollToHash(href);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <motion.nav
        aria-label="Primary"
        animate={{ paddingTop: compact ? 8 : 14, paddingBottom: compact ? 8 : 14 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between rounded-2xl border px-4 backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 sm:px-5",
          compact ? "border-line bg-surface/85 shadow-sm" : "border-transparent bg-canvas/50",
        )}
      >
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="rounded-lg"
          aria-label="CampusOS home"
        >
          <Logo />
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={go(l.href)}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink
            variant="ghost"
            size="sm"
            href={SIGN_IN_PATH}
            onClick={(e) => {
              e.preventDefault();
              navigate(SIGN_IN_PATH);
            }}
          >
            Sign In
          </ButtonLink>
          <Button size="sm" onClick={() => navigate(APP_PATH)}>
            Get Started
          </Button>
        </div>

        <button
          type="button"
          className="grid size-10 place-items-center rounded-lg text-ink transition-colors hover:bg-surface-3 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </motion.nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mx-auto mt-2 max-w-6xl rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur-xl md:hidden"
          >
            <ul className="flex flex-col">
              {NAV_LINKS.map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i }}
                >
                  <a
                    href={l.href}
                    onClick={go(l.href)}
                    className="block rounded-lg px-4 py-3 text-base font-medium text-ink hover:bg-surface-3"
                  >
                    {l.label}
                  </a>
                </motion.li>
              ))}
            </ul>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-3">
              <Button variant="secondary" onClick={() => navigate(SIGN_IN_PATH)}>
                Sign In
              </Button>
              <Button onClick={() => navigate(APP_PATH)}>Get Started</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
