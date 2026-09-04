from .. import sse
from ..db import execute, next_id, q, q1
from .common import DAYS, DomainError, check_enum, check_time, check_time_order, require
from .courses import ensure_course

FIELDS = ["course", "title", "day", "start_time", "end_time", "room", "instructor", "section"]


def list_schedules(day: str | None = None, course: str | None = None, instructor: str | None = None) -> list[dict]:
    sql, params = "SELECT * FROM schedules", []
    conds = []
    if day:
        conds.append("day = %s"); params.append(day)
    if course:
        conds.append("course ILIKE %s"); params.append(f"%{course}%")
    if instructor:
        conds.append("instructor ILIKE %s"); params.append(f"%{instructor}%")
    if conds:
        sql += " WHERE " + " AND ".join(conds)
    return q(sql + " ORDER BY array_position(%s::text[], day), start_time", params + [DAYS])


def get_schedule(sid: str) -> dict:
    row = q1("SELECT * FROM schedules WHERE id = %s", [sid])
    if not row:
        raise DomainError("NOT_FOUND", f"Schedule {sid} not found", 404)
    return row


def _validate(data: dict) -> None:
    check_enum(data["day"], DAYS, "day")
    check_time(data["start_time"], "start_time")
    check_time(data["end_time"], "end_time")
    check_time_order(data["start_time"], data["end_time"])


def create_schedule(data: dict) -> dict:
    require(data, FIELDS)
    _validate(data)
    ensure_course(data["course"], data["title"])
    sid = next_id("schedules", "sch")
    execute(
        "INSERT INTO schedules VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        [sid] + [data[f] for f in FIELDS],
    )
    sse.publish("schedules", "create", sid)
    return get_schedule(sid)


def update_schedule(sid: str, data: dict) -> dict:
    merged = {**get_schedule(sid), **{k: v for k, v in data.items() if k in FIELDS}}
    _validate(merged)
    ensure_course(merged["course"], merged["title"])
    execute(
        "UPDATE schedules SET course=%s,title=%s,day=%s,start_time=%s,end_time=%s,room=%s,instructor=%s,section=%s WHERE id=%s",
        [merged[f] for f in FIELDS] + [sid],
    )
    sse.publish("schedules", "update", sid)
    return get_schedule(sid)


def delete_schedule(sid: str) -> None:
    get_schedule(sid)
    execute("DELETE FROM schedules WHERE id = %s", [sid])
    sse.publish("schedules", "delete", sid)
