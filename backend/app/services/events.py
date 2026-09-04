from psycopg.rows import dict_row

from .. import sse
from ..db import execute, next_id, pool, q, q1, ser_row
from ..search.indexer import reindex, unindex
from .common import DomainError, check_date, check_enum, check_time, check_time_order, require, to_int

FIELDS = ["name", "description", "date", "start_time", "end_time", "end_date", "venue", "organizer", "capacity", "status"]
STATUSES = ["upcoming", "ongoing", "completed", "cancelled", "full"]


def _registrations(eid: str) -> list[dict]:
    return q("SELECT student_id, name FROM registrations WHERE event_id = %s ORDER BY name", [eid])


def list_events(date: str | None = None, status: str | None = None) -> list[dict]:
    sql, params, conds = "SELECT * FROM events", [], []
    if date:
        conds.append("date = %s"); params.append(date)
    if status:
        conds.append("status = %s"); params.append(status)
    if conds:
        sql += " WHERE " + " AND ".join(conds)
    events = q(sql + " ORDER BY date, start_time", params)
    for e in events:
        e["registrations"] = _registrations(e["id"])
    return events


def get_event(eid: str) -> dict:
    row = q1("SELECT * FROM events WHERE id = %s", [eid])
    if not row:
        raise DomainError("NOT_FOUND", f"Event {eid} not found", 404)
    row["registrations"] = _registrations(eid)
    return row


def _validate(data: dict) -> None:
    check_date(data["date"], "date")
    check_date(data["end_date"], "end_date")
    check_time(data["start_time"], "start_time")
    check_time(data["end_time"], "end_time")
    check_enum(data["status"], STATUSES, "status")
    data["capacity"] = to_int(data["capacity"], "capacity", minimum=1)
    if str(data["end_date"]) < str(data["date"]):
        raise DomainError("INVALID_DATE", "end_date must not be before date")
    if str(data["end_date"]) == str(data["date"]):
        check_time_order(data["start_time"], data["end_time"])
    if int(data.get("registered", 0)) > data["capacity"]:
        raise DomainError("INVALID_NUMBER", f"capacity ({data['capacity']}) cannot be below current registrations ({data['registered']})", 409)


def create_event(data: dict) -> dict:
    data.setdefault("status", "upcoming")
    if not data.get("end_date"):
        data["end_date"] = data.get("date")
    require(data, [f for f in FIELDS if f != "status"])
    _validate(data)
    eid = next_id("events", "evt")
    execute("INSERT INTO events VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0,%s)",
            [eid, data["name"], data["description"], data["date"], data["start_time"], data["end_time"],
             data["end_date"], data["venue"], data["organizer"], data["capacity"], data["status"]])
    rec = get_event(eid)
    reindex("event", rec)
    sse.publish("events", "create", eid)
    return rec


def update_event(eid: str, data: dict) -> dict:
    merged = {**get_event(eid), **{k: v for k, v in data.items() if k in FIELDS}}
    _validate(merged)
    execute(
        """UPDATE events SET name=%s,description=%s,date=%s,start_time=%s,end_time=%s,end_date=%s,
           venue=%s,organizer=%s,capacity=%s,status=%s WHERE id=%s""",
        [merged["name"], merged["description"], merged["date"], merged["start_time"], merged["end_time"],
         merged["end_date"], merged["venue"], merged["organizer"], merged["capacity"], merged["status"], eid])
    rec = get_event(eid)
    reindex("event", rec)
    sse.publish("events", "update", eid)
    return rec


def delete_event(eid: str) -> None:
    get_event(eid)
    execute("DELETE FROM events WHERE id = %s", [eid])
    unindex("event", eid)
    sse.publish("events", "delete", eid)


def register(eid: str, student_id: str, name: str) -> dict:
    """Transactional with row lock: capacity can never be exceeded."""
    with pool.connection() as conn:
        conn.row_factory = dict_row
        ev = conn.execute("SELECT * FROM events WHERE id = %s FOR UPDATE", [eid]).fetchone()
        if not ev:
            raise DomainError("NOT_FOUND", f"Event {eid} not found", 404)
        if ev["status"] in ("cancelled", "completed"):
            raise DomainError("EVENT_CLOSED", f"\"{ev['name']}\" is {ev['status']} — registration not possible", 409)
        if ev["status"] == "full" or ev["registered"] >= ev["capacity"]:
            raise DomainError("EVENT_FULL", f"\"{ev['name']}\" is full ({ev['registered']}/{ev['capacity']})", 409)
        dup = conn.execute("SELECT 1 FROM registrations WHERE event_id = %s AND student_id = %s",
                           [eid, student_id]).fetchone()
        if dup:
            raise DomainError("ALREADY_REGISTERED", f"{name} is already registered for \"{ev['name']}\"", 409)
        conn.execute("INSERT INTO registrations VALUES (%s,%s,%s)", [eid, student_id, name])
        new_count = ev["registered"] + 1
        new_status = "full" if new_count >= ev["capacity"] else ev["status"]
        conn.execute("UPDATE events SET registered = %s, status = %s WHERE id = %s", [new_count, new_status, eid])
    sse.publish("events", "update", eid)
    return get_event(eid)


def cancel_registration(eid: str, student_id: str) -> dict:
    with pool.connection() as conn:
        conn.row_factory = dict_row
        ev = conn.execute("SELECT * FROM events WHERE id = %s FOR UPDATE", [eid]).fetchone()
        if not ev:
            raise DomainError("NOT_FOUND", f"Event {eid} not found", 404)
        reg = conn.execute("SELECT 1 FROM registrations WHERE event_id = %s AND student_id = %s",
                           [eid, student_id]).fetchone()
        if not reg:
            raise DomainError("NOT_REGISTERED", f"Student {student_id} is not registered for \"{ev['name']}\"", 404)
        conn.execute("DELETE FROM registrations WHERE event_id = %s AND student_id = %s", [eid, student_id])
        new_count = max(0, ev["registered"] - 1)
        new_status = "upcoming" if ev["status"] == "full" and new_count < ev["capacity"] else ev["status"]
        conn.execute("UPDATE events SET registered = %s, status = %s WHERE id = %s", [new_count, new_status, eid])
    sse.publish("events", "update", eid)
    return get_event(eid)
