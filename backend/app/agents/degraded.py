"""Read-only fallback used when keys exist but every provider/model failed or quota ran out.

Answers a small set of question shapes directly from live data. It never writes and never pretends
to be the model — the client shows a clear banner.
"""
import re

from ..services import announcements, assignments, events, rooms, schedules
from ..services.common import DAYS, now_local

OFFLINE_MSG = ("The AI is temporarily unavailable, so I can't take actions right now. "
               "Use the dashboard to book a room or register for an event — I can still answer "
               "questions from live data.")

# Anchored, non-backtracking patterns; write verbs and negations are excluded before matching.
WRITE_VERBS = re.compile(r"\b(book|booking|reserve|register|registration|enrol|enroll|sign\s?up|cancel|"
                         r"unbook|delete|remove|edit|change|confirm|claim)\b", re.I)
# read words that become write requests in front of a resource noun ("schedule a room" vs "my schedule")
WRITE_PHRASES = re.compile(r"\b(schedule|get|grab|take|need|want)\s+(me\s+)?(a|an|the)?\s*"
                           r"(room|lab|seminar|slot|spot|seat|place)\b", re.I)
NEGATION = re.compile(r"\b(don'?t|do not|never|without|not)\b", re.I)

INTENTS = [
    ("next_class", re.compile(r"\bnext\s+(class|lecture)\b|\bwhen\s+is\s+my\s+(next\s+)?class\b", re.I)),
    ("due", re.compile(r"\b(due|deadline|assignment)s?\b", re.I)),
    ("announcements", re.compile(r"\b(announcement|notice|priority)s?\b", re.I)),
    ("events", re.compile(r"\bevent|happening|going on\b", re.I)),
    ("classes_today", re.compile(r"\b(class|classes|schedule|timetable)\b", re.I)),
    ("rooms", re.compile(r"\broom|lab|seminar\b", re.I)),
]


def _fmt(rows: list[str]) -> str:
    return "\n".join(f"• {r}" for r in rows) if rows else "• nothing found"


def answer(message: str, profile: dict) -> dict | None:
    """Return a templated read-only answer, or None when the message is not safely answerable."""
    text = (message or "").strip()
    if not text:
        return None
    if WRITE_VERBS.search(text) or WRITE_PHRASES.search(text) or NEGATION.search(text):
        return {"reply": OFFLINE_MSG, "degraded": True, "tool_calls": []}

    intent = next((name for name, rx in INTENTS if rx.search(text)), None)
    if intent is None:
        return None

    now = now_local()
    today_name = now.strftime("%A")
    try:
        if intent == "next_class":
            upcoming = None
            for offset in range(0, 9):
                day = now.date().fromordinal(now.date().toordinal() + offset)
                name = day.strftime("%A")
                if name not in DAYS:
                    continue
                rows = schedules.list_schedules(day=name)
                if offset == 0:
                    rows = [s for s in rows if s["start_time"] > now.strftime("%H:%M")]
                if rows:
                    upcoming = (day, rows[0])
                    break
            body = ("no upcoming class found" if not upcoming else
                    f"{upcoming[1]['course']} ({upcoming[1]['title']}) on {upcoming[0]:%A %Y-%m-%d} at "
                    f"{upcoming[1]['start_time']} in {upcoming[1]['room']}")
            tool = "get_next_class"
        elif intent == "due":
            rows = assignments.list_assignments(due_within_days=7)
            body = _fmt([f"{a['course']} — {a['title']} (due {a['deadline']})" for a in rows])
            tool = "list_assignments"
        elif intent == "announcements":
            rows = announcements.list_announcements(include_expired=False)
            body = _fmt([f"[{a['priority']}] {a['title']} ({a['date']})" for a in rows[:6]])
            tool = "list_announcements"
        elif intent == "events":
            rows = [e for e in events.list_events()
                    if e["status"] not in ("completed", "cancelled") and e["date"] >= now.date().isoformat()]
            body = _fmt([f"{e['name']} — {e['date']} {e['start_time']} in {e['venue']} "
                         f"({e['registered']}/{e['capacity']})" for e in rows[:6]])
            tool = "list_events"
        elif intent == "rooms":
            rows = rooms.list_rooms()
            free_now = [r["room_number"] for r in rows if r["status"] == "available"][:12]
            body = "rooms in the building: " + (", ".join(free_now) or "none")
            tool = "list_rooms"
        else:
            rows = schedules.list_schedules(day=today_name) if today_name in DAYS else []
            body = (f"{today_name} is a weekend — no classes." if today_name not in DAYS
                    else _fmt([f"{s['course']} {s['start_time']}–{s['end_time']} in {s['room']}" for s in rows]))
            tool = "list_schedules"
    except Exception:  # noqa: BLE001 - degraded mode must never raise
        return None

    return {"reply": f"{body}", "degraded": True,
            "tool_calls": [{"tool": tool, "label": tool, "ok": True}]}
