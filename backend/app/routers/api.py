"""All REST routes. Thin controllers — every rule lives in services."""
import asyncio
import json
import logging
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Body, Header, Request
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
router = APIRouter(prefix="/api")

DEFAULT_PROFILE = {"student_id": "20-40532", "name": "Sakibul Hassan", "role": "student"}
STUDENT_ID_RE = re.compile(r"^[0-9]{2}-[0-9]{5}$")


def _identity(x_student_id: str | None = None,
              x_student_name: str | None = None,
              authorization: str | None = None) -> dict:
    """Acting profile.

    A signed bearer token is the only source of a privileged role: the client may assert
    *who* it is (demo profile switcher) but never *what it may do* — a self-declared
    role header would let anyone cancel other people's bookings.
    """
    if authorization and authorization.startswith("Bearer "):
        claims = auth.parse_token(authorization.split(" ", 1)[1].strip())
        if claims:
            return {
                "id": claims.get("uid"),
                "student_id": claims.get("student_id") or DEFAULT_PROFILE["student_id"],
                "name": claims.get("name") or DEFAULT_PROFILE["name"],
                "role": claims.get("role") or "student",
                "email": claims.get("email"),
            }
    sid = (x_student_id or "").strip()
    name = (x_student_name or "").strip()[:80]
    if not STUDENT_ID_RE.match(sid):
        sid = DEFAULT_PROFILE["student_id"]
        name = name or DEFAULT_PROFILE["name"]
    return {"id": None, "student_id": sid, "name": name or DEFAULT_PROFILE["name"], "role": "student"}


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


@router.get("/meta")
def meta():
    now = datetime.now(ZoneInfo(TZ_NAME))
    return {"now": now.isoformat(), "today": now.date().isoformat(), "weekday": now.strftime("%A"), "tz": TZ_NAME}


# ---- auth ----
@router.post("/auth/signup")
def auth_signup(data: dict = Body(...)):
    return auth.sign_up(
        name=data.get("name"),
        email=data.get("email"),
        password=data.get("password"),
        student_id=data.get("student_id"),
        department=data.get("department", "CSE"),
    )


@router.post("/auth/signin")
@router.post("/auth/login")
def auth_signin(data: dict = Body(...)):
    ident = data.get("email_or_id") or data.get("email") or data.get("student_id") or data.get("username")
    return auth.sign_in(
        email_or_id=ident,
        password=data.get("password"),
    )


@router.get("/auth/me")
def auth_me(authorization: str | None = Header(default=None),
            x_student_id: str | None = Header(default=None),
            x_student_name: str | None = Header(default=None)):
    who = _identity(x_student_id, x_student_name, authorization)
    if who.get("id"):
        return auth.get_me(who["id"])
    return who


@router.get("/auth/users")
def auth_users(authorization: str | None = Header(default=None)):
    # the directory carries every account's email, so it stays behind a signed authority token
    if _identity(authorization=authorization)["role"] != "authority":
        raise DomainError("FORBIDDEN", "Only campus authorities can list user accounts", 403)
    return auth.list_users()


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
def booking_create(rid: str, data: dict = Body(...),
                   x_student_id: str | None = Header(default=None),
                   x_student_name: str | None = Header(default=None),
                   authorization: str | None = Header(default=None)):
    room = rooms.get_room(rid)
    data.pop("booked_by", None)
    who = _identity(x_student_id, x_student_name, authorization)
    return rooms.add_booking(room["room_number"], data, who["name"])


@router.delete("/rooms/{rid}/bookings/{booking_id}")
def booking_cancel(rid: str, booking_id: str,
                   x_student_id: str | None = Header(default=None),
                   x_student_name: str | None = Header(default=None),
                   authorization: str | None = Header(default=None)):
    who = _identity(x_student_id, x_student_name, authorization)
    return rooms.cancel_booking(booking_id, requested_by=who["name"], is_authority=who["role"] == "authority")


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
def registration_create(eid: str,
                        x_student_id: str | None = Header(default=None),
                        x_student_name: str | None = Header(default=None),
                        authorization: str | None = Header(default=None)):
    who = _identity(x_student_id, x_student_name, authorization)
    return events.register(eid, who["student_id"], who["name"])


@router.delete("/events/{eid}/registrations/{student_id}")
def registration_cancel(eid: str, student_id: str,
                        x_student_id: str | None = Header(default=None),
                        x_student_name: str | None = Header(default=None),
                        authorization: str | None = Header(default=None)):
    who = _identity(x_student_id, x_student_name, authorization)
    if who["student_id"] != student_id and who["role"] != "authority":
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
async def agent_chat(payload: dict = Body(...), x_student_id: str | None = Header(default=None),
                     x_student_name: str | None = Header(default=None),
                     authorization: str | None = Header(default=None)):
    profile = _identity(x_student_id, x_student_name, authorization)
    message = _last_user_message(payload)
    return await run_turn(message, profile, payload.get("conversation_id"))


@router.post("/agent/chat/stream")
async def agent_chat_stream(payload: dict = Body(...), x_student_id: str | None = Header(default=None),
                            x_student_name: str | None = Header(default=None),
                            authorization: str | None = Header(default=None)):
    profile = _identity(x_student_id, x_student_name, authorization)
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


@router.get("/health")
def health():
    db_ok = True
    try:
        q1("SELECT 1 AS ok")
    except Exception:  # noqa: BLE001
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "db": db_ok, **gateway.health()}


@router.get("/stream")
async def stream(request: Request):
    return StreamingResponse(sse.subscribe(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

