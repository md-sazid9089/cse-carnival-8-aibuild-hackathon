"""All REST routes. Thin controllers — every rule lives in services."""
from fastapi import APIRouter, Body, Request
from fastapi.responses import JSONResponse, StreamingResponse

from .. import sse
from ..agents.orchestrator import handle_chat
from ..search.hybrid import hybrid_search
from ..services import announcements, assignments, events, rooms, schedules
from ..services.common import DomainError

router = APIRouter(prefix="/api")


def _err(e: DomainError) -> JSONResponse:
    return JSONResponse(status_code=e.status, content={"error": e.reason, "detail": e.detail})


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
def booking_create(rid: str, data: dict = Body(...)):
    room = rooms.get_room(rid)
    booked_by = data.pop("booked_by", None) or "Dashboard User"
    return rooms.add_booking(room["room_number"], data, booked_by)


@router.delete("/rooms/{rid}/bookings/{booking_id}")
def booking_cancel(rid: str, booking_id: str, booked_by: str | None = None):
    return rooms.cancel_booking(booking_id, requested_by=booked_by or "Dashboard User")


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
def registration_create(eid: str, data: dict = Body(...)):
    return events.register(eid, data["student_id"], data["name"])


@router.delete("/events/{eid}/registrations/{student_id}")
def registration_cancel(eid: str, student_id: str):
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
def agent_chat(payload: dict = Body(...)):
    history = payload.get("messages", [])
    profile = payload.get("profile") or {"student_id": "20-40532", "name": "Sakibul Hassan"}
    return handle_chat(history, profile)


@router.get("/stream")
async def stream(request: Request):
    return StreamingResponse(sse.subscribe(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
