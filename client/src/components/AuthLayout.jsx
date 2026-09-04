import { Calendar, Door, Sparkle } from "../lib/icons.jsx";

const PROOF = [
  { icon: Sparkle, title: "Ask, don't dig", body: "“Am I free Thursday at 2?” beats clicking through five timetables." },
  { icon: Door, title: "Rooms that tell the truth", body: "Availability is computed against live bookings, never a stale cache." },
  { icon: Calendar, title: "One campus, one surface", body: "Routines, assignments, events and notices — in a single place." },
];

/**
 * Two-pane auth shell: an editorial panel that carries the pitch, and a form
 * column that stays narrow enough to read comfortably. The panel is decorative
 * and collapses away entirely below `lg`.
 */
export default function AuthLayout({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside
        aria-hidden="true"
        className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-ink-invert lg:flex"
      >
        <div
          className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full opacity-[0.16] blur-3xl"
          style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
        />
        <div className="relative flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-ink-invert text-[13px] font-bold text-ink">
            C
          </span>
          <span className="text-sm font-semibold">CampusOS</span>
        </div>

        <div className="relative max-w-md">
          <p className="text-[42px] leading-[1.08] font-semibold tracking-[-0.03em]">
            Your campus,
            <br />
            answered in a sentence.
          </p>
          <p className="mt-5 text-[15px] leading-relaxed opacity-70">
            Ahsanullah University of Science and Technology — schedules, rooms, assignments and events, backed by an
            assistant that reads the live database on every question.
          </p>

          <ul className="mt-10 space-y-5">
            {PROOF.map((item) => (
              <li key={item.title} className="flex gap-3.5">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/10">
                  <item.icon size={16} />
                </span>
                <span>
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="block text-[13px] leading-relaxed opacity-60">{item.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs opacity-45">© {new Date().getFullYear()} CampusOS · AUST</p>
      </aside>

      <main className="flex flex-col justify-center px-6 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-104">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-8 place-items-center rounded-lg bg-ink text-[13px] font-bold text-ink-invert">
              C
            </span>
            <span className="text-sm font-semibold text-ink">CampusOS</span>
          </div>

          <p className="text-[13px] font-medium tracking-wide text-ink-3 uppercase">{eyebrow}</p>
          <h1 className="mt-2 text-[28px] leading-tight font-semibold text-ink">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm leading-relaxed text-ink-2">{subtitle}</p> : null}

          <div className="mt-8">{children}</div>

          {footer ? <div className="mt-8 border-t border-line pt-6 text-[13px] text-ink-2">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
