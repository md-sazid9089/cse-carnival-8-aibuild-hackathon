"""All REST routes. Thin controllers — every rule lives in services."""
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Body, Header, Request
from fastapi.responses import StreamingResponse

from .. import sse
from ..agents.orchestrator import handle_chat
from ..config import TZ_NAME
from ..search.hybrid import hybrid_search
from ..services import announcements, assignments, events, rooms, schedules
from ..services.common import DomainError

router = APIRouter(prefix="/api")

DEFAULT_PROFILE = {"student_id": "20-40532", "name": "Sakibul Hassan"}


def _identity(x_student_id: str | None, x_student_name: str | None) -> dict:
    """Acting profile. Single-user app: identity is asserted by the client (profile switcher), not authenticated."""
    return {"student_id": x_student_id or DEFAULT_PROFILE["student_id"],
            "name": x_student_name or DEFAULT_PROFILE["name"]}


@router.get("/meta")
def meta():
    now = datetime.now(ZoneInfo(TZ_NAME))
    return {"now": now.isoformat(), "today": now.date().isoformat(), "weekday": now.strftime("%A"), "tz": TZ_NAME}


# ---- schedules ----
@router.get("/schedules")
def schedules_list(day: str | None = None, course: str | None = None):
    return schedules.list_schedules(day, course)


@router.post("/schedules")
def schedules_create(data: dict = Body(...)):
    return schedules.create_schedule(data)


@router.put("/schedules/{sid}")
def schedules_update(sid: str, data: dict = Body(...)):
    return schedules.update_schedule(sid, data)


@router.delete("/schedules/{sid}")
def schedules_delete(sid: str):
    schedules.delete_schedule(sid)
    return {"deleted": sid}


# ---- rooms + bookings ----
@router.get("/rooms")
def rooms_list(type: str | None = None, min_capacity: int | None = None):
    return rooms.list_rooms(type, min_capacity)


@router.post("/rooms")
def rooms_create(data: dict = Body(...)):
    return rooms.create_room(data)


@router.put("/rooms/{rid}")
def rooms_update(rid: str, data: dict = Body(...)):
    return rooms.update_room(rid, data)


@router.delete("/rooms/{rid}")
def rooms_delete(rid: str):
    rooms.delete_room(rid)
    return {"deleted": rid}


@router.post("/rooms/{rid}/bookings")
def booking_create(rid: str, data: dict = Body(...),
                   x_student_id: str | None = Header(default=None), x_student_name: str | None = Header(default=None)):
    room = rooms.get_room(rid)
    data.pop("booked_by", None)
    return rooms.add_booking(room["room_number"], data, _identity(x_student_id, x_student_name)["name"])


@router.delete("/rooms/{rid}/bookings/{booking_id}")
def booking_cancel(rid: str, booking_id: str,
                   x_student_id: str | None = Header(default=None), x_student_name: str | None = Header(default=None)):
    return rooms.cancel_booking(booking_id, requested_by=_identity(x_student_id, x_student_name)["name"])


# ---- events + registrations ----
@router.get("/events")
def events_list(date: str | None = None, status: str | None = None):
    return events.list_events(date, status)


@router.post("/events")
def events_create(data: dict = Body(...)):
    return events.create_event(data)


@router.put("/events/{eid}")
def events_update(eid: str, data: dict = Body(...)):
    return events.update_event(eid, data)


@router.delete("/events/{eid}")
def events_delete(eid: str):
    events.delete_event(eid)
    return {"deleted": eid}


@router.post("/events/{eid}/registrations")
def registration_create(eid: str, x_student_id: str | None = Header(default=None),
                        x_student_name: str | None = Header(default=None)):
    who = _identity(x_student_id, x_student_name)
    return events.register(eid, who["student_id"], who["name"])


@router.delete("/events/{eid}/registrations/{student_id}")
def registration_cancel(eid: str, student_id: str, x_student_id: str | None = Header(default=None),
                        x_student_name: str | None = Header(default=None)):
    who = _identity(x_student_id, x_student_name)
    if who["student_id"] != student_id:
        raise DomainError("FORBIDDEN", "You can only cancel your own registration", 403)
    return events.cancel_registration(eid, student_id)


# ---- announcements ----
@router.get("/announcements")
def announcements_list(priority: str | None = None, include_expired: bool = True):
    return announcements.list_announcements(priority, include_expired)


@router.post("/announcements")
def announcements_create(data: dict = Body(...)):
    return announcements.create_announcement(data)


@router.put("/announcements/{aid}")
def announcements_update(aid: str, data: dict = Body(...)):
    return announcements.update_announcement(aid, data)


@router.delete("/announcements/{aid}")
def announcements_delete(aid: str):
    announcements.delete_announcement(aid)
    return {"deleted": aid}


# ---- assignments ----
@router.get("/assignments")
def assignments_list(status: str | None = None, due_within_days: int | None = None):
    return assignments.list_assignments(status, due_within_days)


@router.post("/assignments")
def assignments_create(data: dict = Body(...)):
    return assignments.create_assignment(data)


@router.put("/assignments/{aid}")
def assignments_update(aid: str, data: dict = Body(...)):
    return assignments.update_assignment(aid, data)


@router.delete("/assignments/{aid}")
def assignments_delete(aid: str):
    assignments.delete_assignment(aid)
    return {"deleted": aid}


# ---- search / agent / sse ----
@router.get("/search")
def search(q: str):
    return hybrid_search(q)


@router.post("/agent/chat")
def agent_chat(payload: dict = Body(...), x_student_id: str | None = Header(default=None),
               x_student_name: str | None = Header(default=None)):
    history = [m for m in payload.get("messages", []) if m.get("role") in ("user", "assistant") and m.get("content")]
    if not history:
        raise DomainError("MISSING_FIELDS", "messages must contain at least one user message")
    profile = payload.get("profile") or _identity(x_student_id, x_student_name)
    return handle_chat(history[-20:], profile)


@router.get("/stream")
async def stream(request: Request):
    return StreamingResponse(sse.subscribe(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
