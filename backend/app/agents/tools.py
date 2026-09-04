"""Tool schemas (OpenAI format) + dispatcher. Read set → Analyst, write set → Coordinator."""
import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from ..config import TZ_NAME
from ..search.hybrid import hybrid_search
from ..services import announcements, assignments, events, rooms, schedules
from ..services.common import DAYS, DomainError


def _p(props: dict, required: list[str]) -> dict:
    return {"type": "object", "properties": props, "required": required}


READ_TOOLS = [
    {"type": "function", "function": {
        "name": "list_schedules",
        "description": "List class schedule entries, optionally filtered by day and/or course code. Always cross-check list_announcements for reschedules before answering about a class.",
        "parameters": _p({"day": {"type": "string", "enum": DAYS}, "course": {"type": "string"}}, [])}},
    {"type": "function", "function": {
        "name": "get_next_class",
        "description": "Compute the next upcoming class from the current date/time (university week Sunday-Thursday).",
        "parameters": _p({}, [])}},
    {"type": "function", "function": {
        "name": "list_assignments",
        "description": "List assignments, optionally by status or due within N days from today.",
        "parameters": _p({"status": {"type": "string", "enum": assignments.STATUSES},
                          "due_within_days": {"type": "integer"}}, [])}},
    {"type": "function", "function": {
        "name": "list_announcements",
        "description": "List campus announcements (non-expired by default), optionally by priority.",
        "parameters": _p({"priority": {"type": "string", "enum": announcements.PRIORITIES},
                          "include_expired": {"type": "boolean"}}, [])}},
    {"type": "function", "function": {
        "name": "list_events",
        "description": "List campus events, optionally by date (YYYY-MM-DD) or status.",
        "parameters": _p({"date": {"type": "string"}, "status": {"type": "string", "enum": events.STATUSES}}, [])}},
    {"type": "function", "function": {
        "name": "list_rooms",
        "description": "List rooms with optional filters: type, minimum capacity, required equipment.",
        "parameters": _p({"type": {"type": "string", "enum": rooms.TYPES},
                          "min_capacity": {"type": "integer"},
                          "equipment": {"type": "array", "items": {"type": "string"}}}, [])}},
    {"type": "function", "function": {
        "name": "find_free_rooms",
        "description": "Find rooms free in a specific time window (checks bookings, class timetable, and events).",
        "parameters": _p({"date": {"type": "string", "description": "YYYY-MM-DD"},
                          "start_time": {"type": "string", "description": "24h HH:MM"},
                          "end_time": {"type": "string", "description": "24h HH:MM"},
                          "min_capacity": {"type": "integer"},
                          "equipment": {"type": "array", "items": {"type": "string"}}},
                         ["date", "start_time", "end_time"])}},
    {"type": "function", "function": {
        "name": "search_campus",
        "description": "Hybrid keyword+semantic search across announcements, events, and assignments. Use for fuzzy or topical queries.",
        "parameters": _p({"query": {"type": "string"}}, ["query"])}},
]

WRITE_TOOLS = [
    {"type": "function", "function": {
        "name": "book_room",
        "description": "Book a room. ALL parameters are required — if the user did not give an exact room, date, and time window, ask them instead of calling this.",
        "parameters": _p({"room_number": {"type": "string"},
                          "date": {"type": "string", "description": "YYYY-MM-DD"},
                          "start_time": {"type": "string", "description": "24h HH:MM"},
                          "end_time": {"type": "string", "description": "24h HH:MM"},
                          "purpose": {"type": "string"}},
                         ["room_number", "date", "start_time", "end_time", "purpose"])}},
    {"type": "function", "function": {
        "name": "cancel_booking",
        "description": "Cancel a booking by its booking_id. Only the person who made the booking can cancel it.",
        "parameters": _p({"booking_id": {"type": "string"}}, ["booking_id"])}},
    {"type": "function", "function": {
        "name": "register_for_event",
        "description": "Register the current student for an event by event id. Fails if full, cancelled, or already registered.",
        "parameters": _p({"event_id": {"type": "string"}}, ["event_id"])}},
    {"type": "function", "function": {
        "name": "cancel_registration",
        "description": "Cancel the current student's registration for an event.",
        "parameters": _p({"event_id": {"type": "string"}}, ["event_id"])}},
]

# Coordinator can verify before writing
COORDINATOR_TOOLS = WRITE_TOOLS + [READ_TOOLS[6], READ_TOOLS[4]]  # find_free_rooms, list_events
ALL_TOOLS = READ_TOOLS + WRITE_TOOLS


def _next_class(now: datetime) -> dict:
    today_name = now.strftime("%A")
    candidates = []
    for offset in range(0, 8):
        day = now + timedelta(days=offset)
        name = day.strftime("%A")
        if name not in DAYS:
            continue
        for s in schedules.list_schedules(day=name):
            if offset == 0 and s["start_time"] <= now.strftime("%H:%M"):
                continue
            candidates.append({**s, "date": day.date().isoformat(), "days_from_now": offset})
        if candidates:
            break
    return {"now": now.isoformat(), "today": today_name, "next_class": candidates[0] if candidates else None,
            "note": "Cross-check announcements for reschedules affecting this class."}


def dispatch(name: str, args: dict, profile: dict) -> dict:
    now = datetime.now(ZoneInfo(TZ_NAME))
    try:
        if name == "list_schedules":
            return {"ok": True, "data": schedules.list_schedules(args.get("day"), args.get("course")),
                    "note": "Cross-check announcements for reschedules."}
        if name == "get_next_class":
            return {"ok": True, "data": _next_class(now)}
        if name == "list_assignments":
            return {"ok": True, "data": assignments.list_assignments(args.get("status"), args.get("due_within_days"))}
        if name == "list_announcements":
            return {"ok": True, "data": announcements.list_announcements(args.get("priority"),
                                                                         bool(args.get("include_expired", False)))}
        if name == "list_events":
            return {"ok": True, "data": events.list_events(args.get("date"), args.get("status"))}
        if name == "list_rooms":
            return {"ok": True, "data": rooms.list_rooms(args.get("type"), args.get("min_capacity"),
                                                         args.get("equipment"))}
        if name == "find_free_rooms":
            return {"ok": True, "data": rooms.find_free_rooms(args["date"], args["start_time"], args["end_time"],
                                                              args.get("min_capacity"), args.get("equipment"))}
        if name == "search_campus":
            return {"ok": True, "data": hybrid_search(args["query"])}
        if name == "book_room":
            booking = rooms.add_booking(args["room_number"],
                                        {k: args[k] for k in ("date", "start_time", "end_time", "purpose")},
                                        booked_by=profile["name"])
            return {"ok": True, "data": booking}
        if name == "cancel_booking":
            return {"ok": True, "data": rooms.cancel_booking(args["booking_id"], requested_by=profile["name"])}
        if name == "register_for_event":
            ev = events.register(args["event_id"], profile["student_id"], profile["name"])
            return {"ok": True, "data": {"event": ev["name"], "registered": ev["registered"],
                                         "capacity": ev["capacity"], "status": ev["status"]}}
        if name == "cancel_registration":
            ev = events.cancel_registration(args["event_id"], profile["student_id"])
            return {"ok": True, "data": {"event": ev["name"], "registered": ev["registered"]}}
        return {"ok": False, "reason": "UNKNOWN_TOOL", "detail": f"No tool named {name}"}
    except DomainError as e:
        return {"ok": False, "reason": e.reason, "detail": e.detail}
    except (KeyError, TypeError, ValueError) as e:
        return {"ok": False, "reason": "BAD_ARGS", "detail": str(e)}


def dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, default=str)
