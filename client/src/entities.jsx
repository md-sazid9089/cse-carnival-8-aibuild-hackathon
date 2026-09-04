import { Badge } from "./components/DataTable.jsx";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const priorityBadge = { high: "bg-rose-100 text-rose-700", medium: "bg-amber-100 text-amber-700", low: "bg-slate-100 text-slate-600" };
const statusBadge = {
  pending: "bg-amber-100 text-amber-700", submitted: "bg-emerald-100 text-emerald-700",
  graded: "bg-indigo-100 text-indigo-700", late: "bg-rose-100 text-rose-700",
  upcoming: "bg-indigo-100 text-indigo-700", ongoing: "bg-emerald-100 text-emerald-700",
  completed: "bg-slate-100 text-slate-600", cancelled: "bg-rose-100 text-rose-700", full: "bg-amber-100 text-amber-700",
  available: "bg-emerald-100 text-emerald-700", unavailable: "bg-rose-100 text-rose-700",
};

export const badge = (key) => (row) => <Badge value={row[key]} map={{ ...priorityBadge, ...statusBadge }} />;

export const entities = {
  schedules: {
    title: "Class Schedules",
    endpoint: "/api/schedules",
    columns: [
      { key: "course", label: "Course" }, { key: "title", label: "Title", wrap: true }, { key: "day", label: "Day" },
      { key: "start_time", label: "Start" }, { key: "end_time", label: "End" }, { key: "room", label: "Room" },
      { key: "instructor", label: "Instructor" }, { key: "section", label: "Section" },
    ],
    fields: [
      { key: "course", label: "Course code" }, { key: "title", label: "Course title", wide: true },
      { key: "day", label: "Day", type: "select", options: DAYS },
      { key: "start_time", label: "Start time", type: "time" }, { key: "end_time", label: "End time", type: "time" },
      { key: "room", label: "Room" }, { key: "instructor", label: "Instructor" }, { key: "section", label: "Section" },
    ],
  },
  announcements: {
    title: "Announcements",
    endpoint: "/api/announcements",
    columns: [
      { key: "title", label: "Title", wrap: true },
      { key: "priority", label: "Priority", render: badge("priority") },
      { key: "date", label: "Posted" }, { key: "expires", label: "Expires" }, { key: "posted_by", label: "By" },
    ],
    fields: [
      { key: "title", label: "Title", wide: true }, { key: "body", label: "Body", type: "textarea", wide: true },
      { key: "date", label: "Date", type: "date" }, { key: "expires", label: "Expires", type: "date" },
      { key: "priority", label: "Priority", type: "select", options: ["high", "medium", "low"] },
      { key: "posted_by", label: "Posted by" },
    ],
  },
  assignments: {
    title: "Assignments",
    endpoint: "/api/assignments",
    columns: [
      { key: "course", label: "Course" }, { key: "title", label: "Title", wrap: true },
      { key: "deadline", label: "Deadline" },
      { key: "status", label: "Status", render: badge("status") },
      { key: "submission_platform", label: "Submit via" }, { key: "marks", label: "Marks" },
    ],
    fields: [
      { key: "course", label: "Course code" }, { key: "course_title", label: "Course title" },
      { key: "title", label: "Assignment title", wide: true },
      { key: "description", label: "Description", type: "textarea", wide: true },
      { key: "assigned_date", label: "Assigned", type: "date" }, { key: "deadline", label: "Deadline", type: "date" },
      { key: "submission_platform", label: "Submission platform" },
      { key: "status", label: "Status", type: "select", options: ["pending", "submitted", "graded", "late"] },
      { key: "marks", label: "Marks", type: "number" },
    ],
  },
};

export const roomFields = [
  { key: "room_number", label: "Room number", placeholder: "7A08" },
  { key: "type", label: "Type", type: "select", options: ["classroom", "lab", "seminar"] },
  { key: "capacity", label: "Capacity", type: "number" },
  { key: "floor", label: "Floor", type: "number" },
  { key: "equipment", label: "Equipment (comma-separated)", type: "tags", wide: true },
  { key: "status", label: "Status", type: "select", options: ["available", "unavailable"], default: "available" },
];

export const eventFields = [
  { key: "name", label: "Event name", wide: true },
  { key: "description", label: "Description", type: "textarea", wide: true },
  { key: "date", label: "Date", type: "date" }, { key: "end_date", label: "End date (optional)", type: "date", optional: true },
  { key: "start_time", label: "Start", type: "time" }, { key: "end_time", label: "End", type: "time" },
  { key: "venue", label: "Venue (room)" }, { key: "organizer", label: "Organizer" },
  { key: "capacity", label: "Capacity", type: "number" },
  { key: "status", label: "Status", type: "select", options: ["upcoming", "ongoing", "completed", "cancelled", "full"], default: "upcoming" },
];

export const bookingFields = [
  { key: "date", label: "Date", type: "date" },
  { key: "purpose", label: "Purpose" },
  { key: "start_time", label: "Start", type: "time" },
  { key: "end_time", label: "End", type: "time" },
];
