import { StatusBadge } from "./components/ui.jsx";
import { useCampus } from "./lib/campus.jsx";
import { dueLabel, fmtDate, fmtTimeRange } from "./lib/format.js";

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

const badge = (key) => (row) => <StatusBadge value={row[key]} />;

/** Config-driven CRUD: one definition per system feeds the table, the form and the filters. */
export const entities = {
  schedules: {
    title: "Class Schedules",
    singular: "class",
    endpoint: "/api/schedules",
    entity: "schedules",
    blurb: "Every timetabled class, Sunday to Thursday.",
    searchKeys: ["course", "title", "room", "instructor", "section"],
    filters: [{ key: "day", label: "Day", allLabel: "Any day", options: DAYS }],
    columns: [
      { key: "course", label: "Course", primary: true, sortable: true },
      { key: "title", label: "Title", wrap: true },
      {
        key: "day",
        label: "Day",
        sortable: true,
        // A class can be created on any weekday; unknown days sort last, not first.
        sortValue: (r) => (DAYS.indexOf(r.day) === -1 ? DAYS.length : DAYS.indexOf(r.day)),
      },
      {
        key: "start_time",
        label: "Time",
        sortable: true,
        render: (r) => fmtTimeRange(r.start_time, r.end_time),
      },
      { key: "room", label: "Room", sortable: true },
      { key: "instructor", label: "Instructor" },
      { key: "section", label: "Section" },
    ],
    fields: [
      { key: "course", label: "Course code", placeholder: "CSE 4113" },
      { key: "section", label: "Section", placeholder: "A" },
      { key: "title", label: "Course title", wide: true },
      { key: "day", label: "Day", type: "select", options: DAYS },
      { key: "room", label: "Room", placeholder: "7A01" },
      { key: "start_time", label: "Start time", type: "time" },
      { key: "end_time", label: "End time", type: "time" },
      { key: "instructor", label: "Instructor", wide: true },
    ],
  },

  announcements: {
    title: "Announcements",
    singular: "announcement",
    endpoint: "/api/announcements",
    entity: "announcements",
    blurb: "Notices from departments and clubs. High-priority ones can change today’s plan.",
    searchKeys: ["title", "body", "posted_by"],
    filters: [{ key: "priority", label: "Priority", allLabel: "Any priority", options: ["high", "medium", "low"] }],
    columns: [
      { key: "title", label: "Title", primary: true, wrap: true, sortable: true },
      { key: "priority", label: "Priority", sortable: true, render: badge("priority") },
      { key: "date", label: "Posted", sortable: true, render: (r) => fmtDate(r.date) },
      { key: "expires", label: "Expires", sortable: true, render: (r) => fmtDate(r.expires) },
      { key: "posted_by", label: "Posted by" },
    ],
    fields: [
      { key: "title", label: "Title", wide: true },
      { key: "body", label: "Body", type: "textarea", rows: 4, wide: true },
      { key: "priority", label: "Priority", type: "select", options: ["high", "medium", "low"], default: "medium" },
      { key: "posted_by", label: "Posted by", placeholder: "Dept. of CSE" },
      { key: "date", label: "Posted on", type: "date" },
      { key: "expires", label: "Expires", type: "date" },
    ],
  },

  assignments: {
    title: "Assignments",
    singular: "assignment",
    endpoint: "/api/assignments",
    entity: "assignments",
    blurb: "Every deadline across your courses, closest first.",
    searchKeys: ["title", "course", "course_title", "description", "submission_platform"],
    filters: [
      { key: "status", label: "Status", allLabel: "Any status", options: ["pending", "submitted", "graded", "late"] },
    ],
    columns: [
      { key: "title", label: "Assignment", primary: true, wrap: true, sortable: true },
      { key: "course", label: "Course", sortable: true },
      {
        key: "deadline",
        label: "Deadline",
        sortable: true,
        render: (r) => (
          <span className="inline-flex items-center gap-2">
            {fmtDate(r.deadline)}
            <DeadlineHint deadline={r.deadline} status={r.status} />
          </span>
        ),
      },
      { key: "status", label: "Status", sortable: true, render: badge("status") },
      { key: "submission_platform", label: "Submit via" },
      { key: "marks", label: "Marks", align: "right", sortable: true },
    ],
    fields: [
      { key: "course", label: "Course code", placeholder: "CSE 4113" },
      { key: "course_title", label: "Course title" },
      { key: "title", label: "Assignment title", wide: true },
      { key: "description", label: "Description", type: "textarea", wide: true },
      { key: "assigned_date", label: "Assigned on", type: "date" },
      { key: "deadline", label: "Deadline", type: "date" },
      { key: "submission_platform", label: "Submission platform", default: "Google Classroom" },
      { key: "status", label: "Status", type: "select", options: ["pending", "submitted", "graded", "late"], default: "pending" },
      { key: "marks", label: "Marks", type: "number", min: 0, default: 0, optional: true, hint: "0 until graded" },
    ],
  },
};

function DeadlineHint({ deadline, status }) {
  const { today } = useCampus();
  if (status !== "pending") return null;
  const { text, tone } = dueLabel(deadline, today);
  if (tone === "neutral") return null;
  const color = tone === "critical" ? "text-critical" : "text-caution";
  return <span className={`text-xs font-medium ${color}`}>{text}</span>;
}

export const roomFields = [
  { key: "room_number", label: "Room number", placeholder: "7A08" },
  { key: "type", label: "Type", type: "select", options: ["classroom", "lab", "seminar"] },
  { key: "capacity", label: "Capacity", type: "number", min: 1 },
  { key: "floor", label: "Floor", type: "number", min: 0 },
  { key: "equipment", label: "Equipment", type: "tags", wide: true, hint: "Comma separated — e.g. projector, whiteboard, ac" },  { key: "status", label: "Status", type: "select", options: ["available", "unavailable"], default: "available" },
];

export const eventFields = [
  { key: "name", label: "Event name", wide: true },
  { key: "description", label: "Description", type: "textarea", wide: true },
  { key: "date", label: "Date", type: "date" },
  { key: "end_date", label: "End date", type: "date", optional: true, omitWhenEmpty: true, hint: "Only for multi-day events" },
  { key: "start_time", label: "Start", type: "time" },
  { key: "end_time", label: "End", type: "time" },
  { key: "venue", label: "Venue", placeholder: "7C01" },
  { key: "organizer", label: "Organizer" },
  { key: "capacity", label: "Capacity", type: "number", min: 1 },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["upcoming", "ongoing", "completed", "cancelled", "full"],
    default: "upcoming",
  },
];

export const bookingFields = [
  { key: "date", label: "Date", type: "date" },
  { key: "purpose", label: "Purpose", placeholder: "Project meeting" },
  { key: "start_time", label: "Start", type: "time" },
  { key: "end_time", label: "End", type: "time" },
];
