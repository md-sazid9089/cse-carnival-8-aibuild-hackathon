import { Container } from "../components/section";
import { Logo } from "../components/logo";
import { FOOTER_LINKS } from "../data/content";
import { scrollToHash } from "../hooks/use-navigate";

export function Footer() {
  return (
    <footer className="border-t border-cream-200 bg-cream-50 py-12 text-forest-deep">
      <Container className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            Intelligent campus infrastructure for the next generation of students — made only for Ahsanullah University
            of Science and Technology (AUST), for holders of an @aust.edu account.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm sm:grid-cols-3">
            {FOOTER_LINKS.map((l) => {
              const isHash = l.href.startsWith("#");
              return (
                <li key={l.label}>
                  <a
                    href={l.href}
                    onClick={isHash ? (e) => { e.preventDefault(); scrollToHash(l.href); } : undefined}
                    {...("external" in l && l.external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                    className="rounded text-forest transition-colors hover:text-terracotta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
                  >
                    {l.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </Container>
      <Container className="mt-10 border-t border-cream-200 pt-6">
        <p className="text-xs text-ink-muted">© 2026 CampusOS. Built for the AI Build Hackathon.</p>
      </Container>
    </footer>
  );
}
