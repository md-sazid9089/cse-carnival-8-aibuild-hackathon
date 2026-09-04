from .. import sse
from ..db import execute, next_id, q, q1
from ..search.indexer import reindex, unindex
from .common import DomainError, check_date, check_enum, require

FIELDS = ["title", "body", "date", "priority", "posted_by", "expires"]
PRIORITIES = ["high", "medium", "low"]


def list_announcements(priority: str | None = None, include_expired: bool = False) -> list[dict]:
    sql, params, conds = "SELECT * FROM announcements", [], []
    if priority:
        conds.append("priority = %s"); params.append(priority)
    if not include_expired:
        conds.append("expires >= CURRENT_DATE")
    if conds:
        sql += " WHERE " + " AND ".join(conds)
    return q(sql + " ORDER BY date DESC, priority", params)


def get_announcement(aid: str) -> dict:
    row = q1("SELECT * FROM announcements WHERE id = %s", [aid])
    if not row:
        raise DomainError("NOT_FOUND", f"Announcement {aid} not found", 404)
    return row


def _validate(data: dict) -> None:
    check_date(data["date"], "date")
    check_date(data["expires"], "expires")
    check_enum(data["priority"], PRIORITIES, "priority")


def create_announcement(data: dict) -> dict:
    require(data, FIELDS)
    _validate(data)
    aid = next_id("announcements", "ann")
    execute("INSERT INTO announcements VALUES (%s,%s,%s,%s,%s,%s,%s)",
            [aid] + [data[f] for f in FIELDS])
    rec = get_announcement(aid)
    reindex("announcement", rec)
    sse.publish("announcements", "create", aid)
    return rec


def update_announcement(aid: str, data: dict) -> dict:
    merged = {**get_announcement(aid), **{k: v for k, v in data.items() if k in FIELDS}}
    _validate(merged)
    execute("UPDATE announcements SET title=%s,body=%s,date=%s,priority=%s,posted_by=%s,expires=%s WHERE id=%s",
            [merged[f] for f in FIELDS] + [aid])
    rec = get_announcement(aid)
    reindex("announcement", rec)
    sse.publish("announcements", "update", aid)
    return rec


def delete_announcement(aid: str) -> None:
    get_announcement(aid)
    execute("DELETE FROM announcements WHERE id = %s", [aid])
    unindex("announcement", aid)
    sse.publish("announcements", "delete", aid)
