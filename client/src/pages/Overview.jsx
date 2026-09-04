import { useMemo } from "react";
import { Badge, Button, Card, CardHeader, EmptyState, Meter, Skeleton, StatusBadge } from "../components/ui.jsx";
import { ErrorState, LiveDot } from "../components/page.jsx";
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

function Row({ children, className = "" }) {
  return <li className={cx("flex items-center gap-3 border-b border-line py-2.5 last:border-0", className)}>{children}</li>;
}

function StatTile({ icon: Icon, label, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-left shadow-xs transition-[box-shadow,border-color] duration-200 hover:border-line-strong hover:shadow-sm"
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
  const rooms = useApi("/api/rooms");

  const refreshAll = () => {
    schedules.refresh();
    events.refresh();
    announcements.refresh();
    assignments.refresh();
    rooms.refresh();
  };
  useSSE(null, refreshAll);

  const loading = schedules.loading || events.loading || announcements.loading || assignments.loading || rooms.loading;
  const error = schedules.error || events.error || announcements.error || assignments.error || rooms.error;

  const nowMinutes = minutesOf(nowTime);
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
  const nextClass = todaysClasses.find((row) => minutesOf(row.start_time) > nowMinutes);

  const dueSoon = useMemo(
    () =>
      (assignments.data ?? [])
        .filter((row) => row.status === "pending" && row.deadline <= weekEnd)
        .sort((a, b) => a.deadline.localeCompare(b.deadline)),
    [assignments.data, weekEnd],
  );

  const notices = useMemo(
    () =>
      (announcements.data ?? [])
        .filter((row) => row.priority === "high")
        .sort((a, b) => b.date.localeCompare(a.date)),
    [announcements.data],
  );

  const upcoming = useMemo(
    () =>
      (events.data ?? [])
        .filter((row) => row.date >= today && row.status !== "cancelled" && row.status !== "completed")
        .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
        .slice(0, 4),
    [events.data, today],
  );

  const freeNow = useMemo(() => {
    const list = rooms.data ?? [];
    return list.filter((room) => {
      if (room.status !== "available") return false;
      const busyBooking = room.bookings.some(
        (booking) =>
          booking.date === today && minutesOf(booking.start_time) <= nowMinutes && nowMinutes < minutesOf(booking.end_time),
      );
      if (busyBooking) return false;
      return !(schedules.data ?? []).some(
        (row) =>
          row.room === room.room_number &&
          row.day === weekday &&
          minutesOf(row.start_time) <= nowMinutes &&
          nowMinutes < minutesOf(row.end_time),
      );
    }).length;
  }, [rooms.data, schedules.data, today, weekday, nowMinutes]);

  if (error) {
    return (
      <div className="animate-fade-in">
        <ErrorState message={error} onRetry={refreshAll} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-fade-in space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-40 rounded-xl xl:col-span-2" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-64 rounded-xl md:col-span-2" />
          <Skeleton className="h-64 rounded-xl md:col-span-2" />
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
            {fmtLongDate(today)} · {fmtTime(`${nowTime}:00`)}{" "}
            <span className="text-ink-3/70">({timezone})</span>
          </p>
        </div>
        <LiveDot active={schedules.refreshing} />
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {/* Next up — the one thing a student opens this app for. */}
        <Card className="flex flex-col justify-between p-5 md:col-span-2">
          <div>
            <p className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">
              {currentClass ? "Happening now" : nextClass ? "Next class" : "Classes today"}
            </p>
            {currentClass || nextClass ? (
              <div className="mt-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-2xl font-semibold tracking-tight text-ink">
                    {(currentClass ?? nextClass).course}
                  </h2>
                  <p className="text-sm text-ink-2">{(currentClass ?? nextClass).title}</p>
                </div>
                <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
                  <div className="flex items-center gap-1.5 tabular">
                    <Clock size={15} className="text-ink-3" />
                    <dt className="sr-only">Time</dt>
                    <dd>{fmtTimeRange((currentClass ?? nextClass).start_time, (currentClass ?? nextClass).end_time)}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Pin size={15} className="text-ink-3" />
                    <dt className="sr-only">Room</dt>
                    <dd>Room {(currentClass ?? nextClass).room}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <dt className="sr-only">Instructor</dt>
                    <dd className="text-ink-3">{(currentClass ?? nextClass).instructor}</dd>
                  </div>
                </dl>
                {!currentClass && nextClass ? (
                  <p className="mt-3 inline-flex items-center rounded-md bg-accent-soft px-2 py-1 text-[13px] font-medium text-accent-ink tabular">
                    Starts in {Math.max(0, minutesOf(nextClass.start_time) - nowMinutes)} min
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-3">
                {todaysClasses.length
                  ? "All of today's classes are done. Enjoy the rest of the day."
                  : `No classes scheduled for ${weekday}.`}
              </p>
            )}
          </div>

          {notices.length ? (
            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-caution/30 bg-caution-soft px-3 py-2.5">
              <Alert size={16} className="mt-px shrink-0 text-caution" />
              <p className="text-[13px] leading-snug text-ink-2">
                <span className="font-medium text-ink">{notices.length} high-priority notice{notices.length === 1 ? "" : "s"}</span>{" "}
                may change today's plan — check announcements before heading to class.
              </p>
            </div>
          ) : null}
        </Card>

        <StatTile icon={Door} label="Rooms free right now" value={freeNow} onClick={() => onNavigate("rooms")} />
        <StatTile icon={Clipboard} label="Due in the next 7 days" value={dueSoon.length} onClick={() => onNavigate("assignments")} />
        <StatTile icon={Calendar} label={`Classes on ${weekday}`} value={todaysClasses.length} onClick={() => onNavigate("schedules")} />
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
                    <Row key={row.id} className={cx(done && "opacity-55")}>
                      <span
                        className={cx(
                          "w-24 shrink-0 text-[13px] font-medium tabular",
                          active ? "text-accent" : "text-ink-2",
                        )}
                      >
                        {fmtTime(row.start_time)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {row.course} · {row.title}
                        </span>
                        <span className="block text-[12px] text-ink-3">{row.instructor}</span>
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

      <p className="mt-4 text-center text-[12px] text-ink-3">
        Every figure above is read from the database on load and re-read the moment anything changes — nothing is cached.
      </p>
    </div>
  );
}
