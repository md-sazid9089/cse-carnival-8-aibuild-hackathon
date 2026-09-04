"""All REST routes. Thin controllers — every rule lives in services."""
import asyncio
import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Body, Depends, Header, Request
from fastapi.responses import StreamingResponse

from .. import sse
from ..agents.agent import run_turn
from ..agents.gateway import gateway
from ..config import TZ_NAME
from ..db import q1
from ..search.hybrid import hybrid_search
from ..services import announcements, assignments, auth, events, rooms, schedules
from ..services.common import DomainError

log = logging.getLogger("campusos.api")


def current_user(authorization: str | None = Header(default=None)) -> dict:
    """The signed-in account, or 401.

    Identity is never inferred from a client-supplied name or ID: only a signature this
    server issued counts, so nobody can act as somebody else by editing a header.
    """
    header = authorization or ""
    claims = auth.parse_token(header.split(" ", 1)[1].strip()) if header.startswith("Bearer ") else None
    if not claims:
        raise DomainError("UNAUTHENTICATED", "Sign in to continue", 401)
    return {
        "id": claims.get("uid"),
        "student_id": claims.get("student_id") or "",
        "name": claims.get("name") or "",
        "email": claims.get("email"),
    }


# Everything on `router` requires a valid session; open endpoints live on `public`.
router = APIRouter(prefix="/api", dependencies=[Depends(current_user)])
public = APIRouter(prefix="/api")


def _last_user_message(payload: dict) -> str:
    """Accept {message} or the legacy {messages:[...]} shape; history itself lives server-side."""
    message = (payload.get("message") or "").strip()
    if not message:
        for m in reversed(payload.get("messages") or []):
            if m.get("role") == "user" and m.get("content"):
                message = str(m["content"]).strip()
                break
    if not message:
        raise DomainError("MISSING_FIELDS", "message is required")
    if len(message) > 2000:
        raise DomainError("MESSAGE_TOO_LONG", "Please keep messages under 2000 characters")
    return message


@public.get("/meta")
def meta():
    now = datetime.now(ZoneInfo(TZ_NAME))
    return {"now": now.isoformat(), "today": now.date().isoformat(), "weekday": now.strftime("%A"), "tz": TZ_NAME}


# ---- auth ----
@public.post("/auth/signup")
def auth_signup(data: dict = Body(...)):
    return auth.sign_up(
        name=data.get("name"),
        email=data.get("email"),
        password=data.get("password"),
        student_id=data.get("student_id"),
        department=data.get("department"),
    )


@public.post("/auth/signin")
@public.post("/auth/login")
def auth_signin(data: dict = Body(...)):
    ident = data.get("email_or_id") or data.get("email") or data.get("student_id") or data.get("username")
    return auth.sign_in(
        email_or_id=ident,
        password=data.get("password"),
    )


@router.get("/auth/me")
def auth_me(who: dict = Depends(current_user)):
    return auth.get_me(who["id"])


# ---- schedules ----
@router.get("/schedules")
def schedules_list(day: str | None = None, course: str | None = None, instructor: str | None = None,
                   mine: bool = False, who: dict = Depends(current_user)):
    return schedules.list_schedules(day, course, instructor, who["id"] if mine else None)


@router.get("/schedules/my-courses")
def schedules_my_courses(who: dict = Depends(current_user)):
    return schedules.my_courses(who["id"])


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


@router.get("/rooms/free")
def rooms_free(date: str, start_time: str, end_time: str,
               min_capacity: int | None = None, equipment: str | None = None):
    """Availability search — same service the agent's find_free_rooms tool calls."""
    wanted = [e.strip() for e in equipment.split(",") if e.strip()] if equipment else None
    return rooms.find_free_rooms(date, start_time, end_time, min_capacity, wanted)


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
def booking_create(rid: str, data: dict = Body(...), who: dict = Depends(current_user)):
    room = rooms.get_room(rid)
    data.pop("booked_by", None)
    return rooms.add_booking(room["room_number"], data, who["name"])


@router.delete("/rooms/{rid}/bookings/{booking_id}")
def booking_cancel(rid: str, booking_id: str, who: dict = Depends(current_user)):
    return rooms.cancel_booking(booking_id, requested_by=who["name"])


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
def registration_create(eid: str, who: dict = Depends(current_user)):
    return events.register(eid, who["student_id"], who["name"])


@router.delete("/events/{eid}/registrations/{student_id}")
def registration_cancel(eid: str, student_id: str, who: dict = Depends(current_user)):
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
async def agent_chat(payload: dict = Body(...), profile: dict = Depends(current_user)):
    message = _last_user_message(payload)
    return await run_turn(message, profile, payload.get("conversation_id"))


@router.post("/agent/chat/stream")
async def agent_chat_stream(payload: dict = Body(...), profile: dict = Depends(current_user)):
    message = _last_user_message(payload)
    conversation_id = payload.get("conversation_id")
    queue: asyncio.Queue = asyncio.Queue(maxsize=200)

    async def emit(event: str, data):
        try:
            queue.put_nowait((event, data))
        except asyncio.QueueFull:
            pass  # slow client: drop progress events, never block the agent

    async def worker():
        try:
            result = await run_turn(message, profile, conversation_id, emit=emit)
            await queue.put(("done", result))
        except Exception as exc:  # noqa: BLE001 - surface as a clean SSE error
            log.exception("agent turn failed")
            await queue.put(("error", {"detail": "The assistant hit an unexpected error.",
                                       "retryable": True, "error": type(exc).__name__}))
        finally:
            await queue.put((None, None))

    async def events():
        task = asyncio.create_task(worker())
        try:
            while True:
                event, data = await queue.get()
                if event is None:
                    break
                yield f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"
        finally:
            task.cancel()  # client disconnected: stop the upstream call too

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no",
                                      "Connection": "keep-alive"})


@public.get("/health")
def health():
    db_ok = True
    try:
        q1("SELECT 1 AS ok")
    except Exception:  # noqa: BLE001
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "db": db_ok, **gateway.health()}


# EventSource cannot send an Authorization header; the stream only announces which entity
# changed (never record contents), so subscribers still have to fetch through the guarded API.
@public.get("/stream")
async def stream(request: Request):
    return StreamingResponse(sse.subscribe(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

