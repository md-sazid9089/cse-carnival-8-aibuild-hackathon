import { useMemo } from "react";
import { Badge, Button, Card, CardHeader, EmptyState, Meter, Skeleton, StatusBadge } from "../components/ui.jsx";
import { ErrorState, LiveDot, StaleNotice } from "../components/page.jsx";
import { DAYS } from "../entities.jsx";
import { useApi, useSSE } from "../hooks.js";
import { useCampus } from "../lib/campus.jsx";
import { addDays, cx, fmtLongDate, fmtTime, fmtTimeRange, minutesOf, relativeDay } from "../lib/format.js";
import { Alert, ArrowRight, Calendar, Clipboard, Clock, Door, Megaphone, Pin, Ticket } from "../lib/icons.jsx";

const greeting = (time) => {
  const hour = Number(String(time).slice(0, 2));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

/** First class at or after now in the Sun–Thu cycle, so the card still answers
 *  "what's next?" late in the evening or on a weekend. */
/** First class at or after now, walking the teaching week. Days present in the
 *  data but outside the canonical week are included so the card and the
 *  timetable never disagree. */
function findNextClass(rows, weekday, nowMinutes) {
  const cycle = [...DAYS, ...new Set(rows.map((row) => row.day).filter((day) => !DAYS.includes(day)))];
  const startIndex = cycle.indexOf(weekday);
  const isTeachingDay = startIndex !== -1;
  const order = cycle.map((_, i) => (isTeachingDay ? (startIndex + i) % cycle.length : i));
  for (const [offset, dayIndex] of order.entries()) {
    const day = cycle[dayIndex];
    const candidates = rows
      // "Later today" only applies on a day that is actually today.
      .filter((row) => row.day === day && (!isTeachingDay || offset > 0 || minutesOf(row.start_time) > nowMinutes))
      .sort((a, b) => minutesOf(a.start_time) - minutesOf(b.start_time));
    if (candidates.length) return { row: candidates[0], dayOffset: isTeachingDay ? offset : 2 };
  }
  return null;
}

function Row({ children, className = "" }) {
  return <li className={cx("flex items-center gap-3 border-b border-line py-2.5 last:border-0", className)}>{children}</li>;
}

function StatTile({ icon: Icon, label, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full items-center gap-3 self-start rounded-xl border border-line bg-surface px-3.5 py-3 text-left shadow-xs transition-[box-shadow,border-color] duration-200 hover:border-line-strong hover:shadow-sm"
    >
      <span className="grid size-9 place-items-center rounded-lg bg-surface-3 text-ink-2">
        <Icon size={17} />
      </span>
      <span className="min-w-0">
        <span className="block text-lg leading-none font-semibold text-ink tabular">{value}</span>
        <span className="mt-1 block truncate text-[12px] text-ink-3">{label}</span>
      </span>
      <ArrowRight size={15} className="ml-auto text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

export default function Overview({ onNavigate }) {
  const { today, weekday, nowTime, profile, timezone } = useCampus();

  const schedules = useApi("/api/schedules");
  const events = useApi("/api/events");
  const announcements = useApi("/api/announcements?include_expired=false");
  const assignments = useApi("/api/assignments");

  const nowMinutes = minutesOf(nowTime);
  // "Free right now" is a server rule (it also weighs events) — never re-derive it here.
  const windowEnd =
    nowMinutes >= 23 * 60 ? null : `${String(Number(nowTime.slice(0, 2)) + 1).padStart(2, "0")}:${nowTime.slice(3, 5)}`;
  const freeRooms = useApi(
    windowEnd ? `/api/rooms/free?date=${today}&start_time=${nowTime}&end_time=${windowEnd}` : "/api/rooms",
    { enabled: Boolean(windowEnd) },
  );

  const refreshAll = () => {
    schedules.refresh();
    events.refresh();
    announcements.refresh();
    assignments.refresh();
    freeRooms.refresh();
  };
  useSSE(null, refreshAll);

  const sources = [schedules, events, announcements, assignments];
  const loading = sources.some((s) => s.loading);
  const failed = sources.filter((s) => s.error);
  // One dead endpoint must not be rendered as "nothing due" — say so instead.
  const fatal = failed.length === sources.length ? failed[0].error : null;
  const stale = sources.find((s) => s.staleError)?.staleError ?? failed[0]?.error ?? null;

  const weekEnd = addDays(today, 7);

  const todaysClasses = useMemo(
    () =>
      (schedules.data ?? [])
        .filter((row) => row.day === weekday)
        .sort((a, b) => minutesOf(a.start_time) - minutesOf(b.start_time)),
    [schedules.data, weekday],
  );

  const currentClass = todaysClasses.find(
    (row) => nowMinutes >= minutesOf(row.start_time) && nowMinutes < minutesOf(row.end_time),
  );
  const upNext = useMemo(
    () => (currentClass ? null : findNextClass(schedules.data ?? [], weekday, nowMinutes)),
    [schedules.data, weekday, nowMinutes, currentClass],
  );
  const nextClass = upNext?.row ?? null;
  const featured = currentClass ?? nextClass;

  const dueSoon = useMemo(
    () =>
      (assignments.data ?? [])
        .filter((row) => row.status === "pending" && row.deadline && row.deadline <= weekEnd)
        .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline))),
    [assignments.data, weekEnd],
  );

  const notices = useMemo(
    () =>
      (announcements.data ?? [])
        .filter((row) => row.priority === "high")
        .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [announcements.data],
  );

  const upcoming = useMemo(
    () =>
      (events.data ?? [])
        .filter((row) => row.date >= today && row.status !== "cancelled" && row.status !== "completed")
        .sort(
          (a, b) =>
            String(a.date).localeCompare(String(b.date)) || String(a.start_time).localeCompare(String(b.start_time)),
        )
        .slice(0, 4),
    [events.data, today],
  );

  if (fatal) {
    return (
      <div className="animate-fade-in">
        <ErrorState message={fatal} onRetry={refreshAll} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-fade-in space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-44 rounded-xl md:col-span-2" />
          <Skeleton className="h-16 self-start rounded-xl" />
          <Skeleton className="h-16 self-start rounded-xl" />
          <Skeleton className="h-16 self-start rounded-xl" />
          <Skeleton className="h-16 self-start rounded-xl" />
          <Skeleton className="h-56 rounded-xl md:col-span-2" />
          <Skeleton className="h-56 rounded-xl md:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">
            {greeting(nowTime)}, {profile.name.split(" ")[0]}
          </h1>
          <p className="mt-1.5 text-sm text-ink-3">
            {fmtLongDate(today)} · {fmtTime(`${nowTime}:00`)} <span>({timezone})</span>
          </p>
        </div>
        <LiveDot active={schedules.refreshing} />
      </header>

      <StaleNotice message={stale} onRetry={refreshAll} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {/* Next up — the one thing a student opens this app for. */}
        <Card className="flex flex-col justify-between p-5 md:col-span-2">
          <div>
            <p className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">
              {currentClass ? "Happening now" : nextClass ? "Next class" : "Classes"}
            </p>
            {featured ? (
              <div className="mt-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-2xl font-semibold tracking-tight text-ink">{featured.course}</h2>
                  <p className="text-sm text-ink-2">{featured.title}</p>
                </div>
                <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
                  <div className="flex items-center gap-1.5 tabular">
                    <Clock size={15} className="text-ink-3" />
                    <dt className="sr-only">Time</dt>
                    <dd>{fmtTimeRange(featured.start_time, featured.end_time)}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Pin size={15} className="text-ink-3" />
                    <dt className="sr-only">Room</dt>
                    <dd>Room {featured.room}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <dt className="sr-only">Instructor</dt>
                    <dd className="text-ink-3">{featured.instructor}</dd>
                  </div>
                </dl>
                {nextClass ? (
                  <p className="mt-3 inline-flex items-center rounded-md bg-accent-soft px-2 py-1 text-[13px] font-medium text-accent-ink tabular">
                    {upNext.dayOffset === 0
                      ? `Starts in ${Math.max(0, minutesOf(nextClass.start_time) - nowMinutes)} min`
                      : `${upNext.dayOffset === 1 ? "Tomorrow" : nextClass.day} at ${fmtTime(nextClass.start_time)}`}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-3">No classes are on the timetable yet.</p>
            )}
          </div>

          {notices.length ? (
            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-caution/30 bg-caution-soft px-3 py-2.5">
              <Alert size={16} className="mt-px shrink-0 text-caution" />
              <p className="text-[13px] leading-snug text-ink-2">
                <span className="font-medium text-ink">
                  {notices.length} high-priority notice{notices.length === 1 ? "" : "s"}
                </span>{" "}
                may change today’s plan — check announcements before heading to class.
              </p>
            </div>
          ) : null}
        </Card>

        <StatTile
          icon={Door}
          label={windowEnd ? "Rooms free for the next hour" : "Room availability"}
          value={windowEnd ? (freeRooms.data?.length ?? "—") : "Check"}
          onClick={() => onNavigate("rooms")}
        />
        <StatTile
          icon={Clipboard}
          label="Due in the next 7 days"
          value={dueSoon.length}
          onClick={() => onNavigate("assignments")}
        />
        <StatTile
          icon={Calendar}
          label={`Classes on ${weekday}`}
          value={todaysClasses.length}
          onClick={() => onNavigate("schedules")}
        />
        <StatTile icon={Ticket} label="Upcoming events" value={upcoming.length} onClick={() => onNavigate("events")} />

        {/* Today */}
        <Card className="md:col-span-2">
          <CardHeader
            title={`Today · ${weekday}`}
            icon={Calendar}
            action={
              <Button size="sm" variant="ghost" onClick={() => onNavigate("schedules")}>
                Timetable
              </Button>
            }
          />
          <div className="px-4 pb-3">
            {todaysClasses.length ? (
              <ul>
                {todaysClasses.map((row) => {
                  const done = minutesOf(row.end_time) <= nowMinutes;
                  const active = row === currentClass;
                  return (
                    <Row key={row.id}>
                      <span
                        className={cx(
                          "w-24 shrink-0 text-[13px] font-medium tabular",
                          active ? "text-accent" : "text-ink-2",
                        )}
                      >
                        {fmtTime(row.start_time)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cx(
                            "block truncate text-sm font-medium",
                            done ? "text-ink-2 line-through" : "text-ink",
                          )}
                        >
                          {row.course} · {row.title}
                        </span>
                        <span className="block text-[12px] text-ink-3">{done ? "Finished" : row.instructor}</span>
                      </span>
                      <Badge tone={active ? "accent" : "neutral"}>{row.room}</Badge>
                    </Row>
                  );
                })}
              </ul>
            ) : (
              <EmptyState compact title="Nothing scheduled" description={`No classes on ${weekday}.`} />
            )}
          </div>
        </Card>

        {/* Deadlines */}
        <Card className="md:col-span-2">
          <CardHeader
            title="Due this week"
            icon={Clipboard}
            action={
              <Button size="sm" variant="ghost" onClick={() => onNavigate("assignments")}>
                All assignments
              </Button>
            }
          />
          <div className="px-4 pb-3">
            {dueSoon.length ? (
              <ul>
                {dueSoon.slice(0, 5).map((row) => (
                  <Row key={row.id}>
                    <Badge tone="accent">{row.course}</Badge>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{row.title}</span>
                    <span
                      className={cx(
                        "shrink-0 text-[13px] font-medium tabular",
                        row.deadline <= today ? "text-critical" : "text-caution",
                      )}
                    >
                      {relativeDay(row.deadline, today)}
                    </span>
                  </Row>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="Nothing due" description="No pending deadlines in the next 7 days." />
            )}
          </div>
        </Card>

        {/* Notices */}
        <Card className="md:col-span-2">
          <CardHeader
            title="High-priority notices"
            icon={Megaphone}
            action={
              <Button size="sm" variant="ghost" onClick={() => onNavigate("announcements")}>
                All notices
              </Button>
            }
          />
          <div className="px-4 pb-3">
            {notices.length ? (
              <ul>
                {notices.slice(0, 4).map((row) => (
                  <Row key={row.id} className="items-start">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-critical" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{row.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-[13px] text-ink-3">{row.body}</span>
                      <span className="mt-1 block text-[12px] text-ink-3">
                        {row.posted_by} · {relativeDay(row.date, today)}
                      </span>
                    </span>
                  </Row>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="All clear" description="No active high-priority notices." />
            )}
          </div>
        </Card>

        {/* Events */}
        <Card className="md:col-span-2">
          <CardHeader
            title="Coming up on campus"
            icon={Ticket}
            action={
              <Button size="sm" variant="ghost" onClick={() => onNavigate("events")}>
                All events
              </Button>
            }
          />
          <div className="px-4 pb-3">
            {upcoming.length ? (
              <ul>
                {upcoming.map((row) => (
                  <Row key={row.id}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{row.name}</span>
                      <span className="block text-[12px] text-ink-3 tabular">
                        {relativeDay(row.date, today)} · {fmtTime(row.start_time)} · {row.venue}
                      </span>
                    </span>
                    <span className="hidden w-28 shrink-0 sm:block">
                      <Meter value={row.registered} max={row.capacity} />
                    </span>
                    <StatusBadge value={row.status} />
                  </Row>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No upcoming events" description="Nothing scheduled after today." />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
