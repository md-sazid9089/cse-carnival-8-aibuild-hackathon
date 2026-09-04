import psycopg.errors

from .. import sse
from ..db import execute, next_id, pool, q, q1, ser_row
from .common import (DomainError, check_date, check_enum, check_time, check_time_order, require, to_int,
                     to_str_list, weekday_name)

FIELDS = ["room_number", "type", "capacity", "equipment", "floor", "status"]
TYPES = ["classroom", "lab", "seminar"]
STATUSES = ["available", "unavailable"]


def _bookings(room_id: str) -> list[dict]:
    return q("SELECT * FROM bookings WHERE room_id = %s ORDER BY date, start_time", [room_id])


def list_rooms(type: str | None = None, min_capacity: int | None = None, equipment: list[str] | None = None) -> list[dict]:
    sql, params, conds = "SELECT * FROM rooms", [], []
    if type:
        conds.append("type = %s"); params.append(type)
    if min_capacity:
        conds.append("capacity >= %s"); params.append(int(min_capacity))
    if equipment:
        conds.append("equipment @> %s"); params.append(list(equipment))
    if conds:
        sql += " WHERE " + " AND ".join(conds)
    rooms = q(sql + " ORDER BY room_number", params)
    for r in rooms:
        r["bookings"] = _bookings(r["id"])
    return rooms


def get_room(rid: str) -> dict:
    row = q1("SELECT * FROM rooms WHERE id = %s", [rid])
    if not row:
        raise DomainError("NOT_FOUND", f"Room {rid} not found", 404)
    row["bookings"] = _bookings(rid)
    return row


def get_room_by_number(room_number: str) -> dict:
    row = q1("SELECT * FROM rooms WHERE room_number = %s", [room_number])
    if not row:
        raise DomainError("NOT_FOUND", f"Room {room_number} does not exist", 404)
    row["bookings"] = _bookings(row["id"])
    return row


def _normalize(data: dict) -> dict:
    check_enum(data["type"], TYPES, "type")
    check_enum(data["status"], STATUSES, "status")
    return {
        "room_number": str(data["room_number"]).strip(),
        "type": data["type"],
        "capacity": to_int(data["capacity"], "capacity", minimum=1),
        "equipment": to_str_list(data["equipment"], "equipment"),
        "floor": to_int(data["floor"], "floor", minimum=0),
        "status": data["status"],
    }


def create_room(data: dict) -> dict:
    require(data, FIELDS[:-1])  # status defaults to available
    data.setdefault("status", "available")
    n = _normalize(data)
    if q1("SELECT 1 FROM rooms WHERE room_number = %s", [n["room_number"]]):
        raise DomainError("DUPLICATE", f"Room {n['room_number']} already exists", 409)
    rid = next_id("rooms", "room")
    execute("INSERT INTO rooms VALUES (%s,%s,%s,%s,%s,%s,%s)",
            [rid, n["room_number"], n["type"], n["capacity"], n["equipment"], n["floor"], n["status"]])
    sse.publish("rooms", "create", rid)
    return get_room(rid)


def update_room(rid: str, data: dict) -> dict:
    merged = {**get_room(rid), **{k: v for k, v in data.items() if k in FIELDS}}
    n = _normalize(merged)
    execute("UPDATE rooms SET room_number=%s,type=%s,capacity=%s,equipment=%s,floor=%s,status=%s WHERE id=%s",
            [n["room_number"], n["type"], n["capacity"], n["equipment"], n["floor"], n["status"], rid])
    sse.publish("rooms", "update", rid)
    return get_room(rid)


def delete_room(rid: str) -> None:
    get_room(rid)
    execute("DELETE FROM rooms WHERE id = %s", [rid])
    sse.publish("rooms", "delete", rid)


def conflict_reason(room_number: str, date: str, start: str, end: str) -> str | None:
    """Bookings ∪ class timetable ∪ events at this venue."""
    room = get_room_by_number(room_number)
    if room["status"] != "available":
        return f"Room {room_number} is marked unavailable"
    b = q1(
        """SELECT booking_id, booked_by, start_time, end_time FROM bookings
           WHERE room_id = %s AND date = %s AND start_time < %s AND %s < end_time LIMIT 1""",
        [room["id"], date, end, start],
    )
    if b:
        return f"Conflicts with booking {b['booking_id']} by {b['booked_by']} ({b['start_time']}–{b['end_time']})"
    day = weekday_name(date)
    s = q1(
        """SELECT course, start_time, end_time FROM schedules
           WHERE room = %s AND day = %s AND start_time < %s AND %s < end_time LIMIT 1""",
        [room_number, day, end, start],
    )
    if s:
        return f"Conflicts with {s['course']} class on {day} ({s['start_time']}–{s['end_time']})"
    e = q1(
        """SELECT name, start_time, end_time FROM events
           WHERE venue = %s AND date = %s AND status NOT IN ('cancelled','completed')
             AND start_time < %s AND %s < end_time LIMIT 1""",
        [room_number, date, end, start],
    )
    if e:
        return f"Conflicts with event \"{e['name']}\" ({e['start_time']}–{e['end_time']})"
    return None


def add_booking(room_number: str, data: dict, booked_by: str) -> dict:
    require(data, ["date", "start_time", "end_time", "purpose"])
    check_date(data["date"], "date")
    check_time(data["start_time"], "start_time")
    check_time(data["end_time"], "end_time")
    check_time_order(data["start_time"], data["end_time"])
    room = get_room_by_number(room_number)
    reason = conflict_reason(room_number, data["date"], data["start_time"], data["end_time"])
    if reason:
        raise DomainError("ROOM_CONFLICT", reason, 409)
    bid = next_id_booking()
    try:
        execute("INSERT INTO bookings VALUES (%s,%s,%s,%s,%s,%s,%s)",
                [bid, room["id"], booked_by, data["date"], data["start_time"], data["end_time"], data["purpose"]])
    except psycopg.errors.ExclusionViolation as exc:  # DB-level last line of defense
        raise DomainError("ROOM_CONFLICT", f"Room {room_number} is already booked in that window", 409) from exc
    sse.publish("rooms", "update", room["id"])
    return q1("SELECT * FROM bookings WHERE booking_id = %s", [bid])


def next_id_booking() -> str:
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT COALESCE(MAX(NULLIF(split_part(booking_id,'-',2),'')::int),0)+1 AS n FROM bookings WHERE booking_id LIKE 'bk-%'"
        ).fetchone()
    return f"bk-{row['n']:03d}"


def cancel_booking(booking_id: str, requested_by: str) -> dict:
    b = q1("SELECT * FROM bookings WHERE booking_id = %s", [booking_id])
    if not b:
        raise DomainError("NOT_FOUND", f"Booking {booking_id} not found", 404)
    if b["booked_by"] != requested_by:
        raise DomainError("FORBIDDEN", f"Booking {booking_id} was made by {b['booked_by']}; you can only cancel your own bookings", 403)
    execute("DELETE FROM bookings WHERE booking_id = %s", [booking_id])
    sse.publish("rooms", "update", b["room_id"])
    return ser_row(b)


def find_free_rooms(date: str, start: str, end: str, min_capacity: int | None = None,
                    equipment: list[str] | None = None) -> list[dict]:
    check_date(date, "date")
    check_time(start, "start_time")
    check_time(end, "end_time")
    check_time_order(start, end)
    free = []
    for room in list_rooms(min_capacity=min_capacity, equipment=equipment):
        if room["status"] == "available" and conflict_reason(room["room_number"], date, start, end) is None:
            free.append({k: room[k] for k in ("room_number", "type", "capacity", "equipment", "floor")})
    return free
