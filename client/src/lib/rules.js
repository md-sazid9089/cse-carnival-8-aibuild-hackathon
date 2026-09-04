import { minutesOf } from "./format.js";

/**
 * Display rules shared by the card and table views of a page.
 *
 * These are pre-flight hints only — the server stays authoritative for every
 * decision. They exist so two views of the same record never disagree.
 */

export const isExpired = (notice, today) => Boolean(notice?.expires && notice.expires < today);

export function registrationState(event, studentId) {
  const registered = Boolean(event.registrations?.some((r) => r.student_id === studentId));
  const closed = event.status === "cancelled" || event.status === "completed";
  const full = event.registered >= event.capacity;
  const blocked = closed || (full && !registered);
  const reason = closed ? `This event is ${event.status}` : full && !registered ? "This event is full" : null;
  return { registered, blocked, reason, full, closed };
}

export function bookingState(room) {
  const unavailable = room.status !== "available";
  return { blocked: unavailable, reason: unavailable ? "Marked unavailable" : null };
}

/**
 * Every window that would make a room busy on one date — bookings, timetabled
 * classes and events at that venue — merged and time-ordered so the user can
 * see *why* a slot will be refused before trying it.
 */
export function busyWindows({ room, date, weekday, schedules = [], events = [] }) {
  const windows = room.bookings
    .filter((booking) => booking.date === date)
    .map((booking) => ({
      key: booking.booking_id,
      kind: "booking",
      label: booking.purpose,
      by: booking.booked_by,
      start: booking.start_time,
      end: booking.end_time,
      booking,
    }));

  schedules
    .filter((row) => row.room === room.room_number && row.day === weekday)
    .forEach((row) =>
      windows.push({
        key: `class-${row.id}`,
        kind: "class",
        label: `${row.course} class`,
        by: row.instructor,
        start: row.start_time,
        end: row.end_time,
      }),
    );

  events
    .filter((event) => event.venue === room.room_number && event.date === date && event.status !== "cancelled" && event.status !== "completed")
    .forEach((event) =>
      windows.push({
        key: `event-${event.id}`,
        kind: "event",
        label: event.name,
        by: event.organizer,
        start: event.start_time,
        end: event.end_time,
      }),
    );

  return windows.sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
}
