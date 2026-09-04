import {
  Bell,
  BookOpenCheck,
  CalendarDays,
  DoorOpen,
  Ticket,
  type LucideIcon,
} from "lucide-react";

export const NAV_LINKS = [
  { label: "Problem", href: "#problem" },
  { label: "AI Agent", href: "#ai-agent" },
  { label: "Live Data", href: "#realtime" },
  { label: "Trust", href: "#trust" },
] as const;

export const APP_PATH = "/overview";
export const SIGN_IN_PATH = "/auth/signin";

type CampusSystem = {
  id: "schedule" | "rooms" | "events" | "announcements" | "assignments";
  title: string;
  description: string;
  icon: LucideIcon;
};

export const CAMPUS_SYSTEMS: CampusSystem[] = [
  { id: "schedule", title: "Schedule", description: "Classes, rooms, instructors, and times.", icon: CalendarDays },
  { id: "rooms", title: "Rooms", description: "Capacity, equipment, availability, booking.", icon: DoorOpen },
  { id: "events", title: "Events", description: "Discover events and register instantly.", icon: Ticket },
  {
    id: "announcements",
    title: "Announcements",
    description: "Stay updated with important campus information.",
    icon: Bell,
  },
  { id: "assignments", title: "Assignments", description: "Track deadlines and academic tasks.", icon: BookOpenCheck },
];

export const SCATTERED_SOURCES = [
  { label: "Group chat", detail: "“anyone know if CSE321 is on today??”", tint: "bg-surface" },
  { label: "Spreadsheet", detail: "routine_v3_FINAL(2).xlsx", tint: "bg-surface-2" },
  { label: "Notice board", detail: "Pinned 3 weeks ago", tint: "bg-accent-soft" },
  { label: "Class schedule", detail: "Photo of a photo of a PDF", tint: "bg-surface-3" },
  { label: "Event poster", detail: "Seen once in a hallway", tint: "bg-surface" },
] as const;

type Conversation = {
  id: string;
  prompt: string;
  reply: string;
  source: string;
  tools: string[];
};

export const CONVERSATIONS: Conversation[] = [
  {
    id: "next-class",
    prompt: "When is my next class?",
    reply: "Your next class is CSE 4113 — Pattern Recognition — at 3:30 PM in Room 7A04. Note: it was moved from 7A07 per today’s announcement.",
    source: "Schedule + announcements, checked just now",
    tools: ["get_next_class", "list_announcements"],
  },
  {
    id: "due-week",
    prompt: "What do I have due this week?",
    reply: "Two deadlines: the Soft Computing lab report on Thursday, and the Compilers assignment on Friday via Google Classroom.",
    source: "Assignments, checked just now",
    tools: ["list_assignments"],
  },
  {
    id: "find-room",
    prompt: "Find me a room for 5 people with a projector.",
    reply: "Three rooms fit: 7A02, 7A05 and 7B03 all have projectors and are free this afternoon. Want me to book one?",
    source: "Rooms + bookings + timetable, checked just now",
    tools: ["find_free_rooms"],
  },
  {
    id: "book-room",
    prompt: "Book Room 302 tomorrow from 3–5 PM.",
    reply: "Done — Room 302 is booked for tomorrow, 3:00–5:00 PM under your name. Booking ID bk-014.",
    source: "Availability verified before booking",
    tools: ["find_free_rooms", "book_room"],
  },
  {
    id: "free-time",
    prompt: "What’s happening on campus while I’m free?",
    reply: "You’re free until 2 PM. The AI Club’s Deep Learning guest lecture starts at 12:30 in 7C02 and still has seats.",
    source: "Schedule + events, checked just now",
    tools: ["list_schedules", "list_events"],
  },
];

export const EDGE_CASES = [
  {
    title: "Ambiguous request",
    user: "Book me any room tomorrow afternoon.",
    ai: "Happy to — what time tomorrow afternoon would you like the room, and for how many people?",
  },
  {
    title: "Room unavailable",
    user: "Book Room 302 from 3 to 5 PM.",
    ai: "Room 302 is already booked from 3–5 PM. Rooms 304 and 305 are free in that slot — want one of those?",
  },
  {
    title: "Unauthorized request",
    user: "Move tomorrow’s CSE321 lecture to 9 AM.",
    ai: "You don’t have permission to modify the official schedule. I can notify you if it changes.",
  },
  {
    title: "No matching data",
    user: "When is my CSE999 class?",
    ai: "I couldn’t find that course in the current campus data. Could the code be different?",
  },
] as const;

export const FOOTER_LINKS = [
  { label: "Product", href: "#product" },
  { label: "AI Agent", href: "#ai-agent" },
  { label: "Live Data", href: "#realtime" },
  { label: "Trust", href: "#trust" },
  { label: "GitHub", href: "https://github.com", external: true },
  { label: "Contact", href: "mailto:hello@campusos.app" },
] as const;
