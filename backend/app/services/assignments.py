from .. import sse
from ..db import execute, next_id, q, q1
from ..search.indexer import reindex, unindex
from .common import DomainError, check_date, check_enum, require

FIELDS = ["course", "course_title", "title", "description", "assigned_date", "deadline",
          "submission_platform", "status", "marks"]
STATUSES = ["pending", "submitted", "graded", "late"]


def list_assignments(status: str | None = None, due_within_days: int | None = None) -> list[dict]:
    sql, params, conds = "SELECT * FROM assignments", [], []
    if status:
        conds.append("status = %s"); params.append(status)
    if due_within_days is not None:
        conds.append("deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + %s::int"); params.append(int(due_within_days))
    if conds:
        sql += " WHERE " + " AND ".join(conds)
    return q(sql + " ORDER BY deadline", params)


def get_assignment(aid: str) -> dict:
    row = q1("SELECT * FROM assignments WHERE id = %s", [aid])
    if not row:
        raise DomainError("NOT_FOUND", f"Assignment {aid} not found", 404)
    return row


def _validate(data: dict) -> None:
    check_date(data["assigned_date"], "assigned_date")
    check_date(data["deadline"], "deadline")
    check_enum(data["status"], STATUSES, "status")


def create_assignment(data: dict) -> dict:
    data.setdefault("status", "pending")
    require(data, FIELDS)
    _validate(data)
    aid = next_id("assignments", "asgn")
    execute("INSERT INTO assignments VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            [aid] + [data[f] if f != "marks" else int(data[f]) for f in FIELDS])
    rec = get_assignment(aid)
    reindex("assignment", rec)
    sse.publish("assignments", "create", aid)
    return rec


def update_assignment(aid: str, data: dict) -> dict:
    merged = {**get_assignment(aid), **{k: v for k, v in data.items() if k in FIELDS}}
    _validate(merged)
    execute(
        """UPDATE assignments SET course=%s,course_title=%s,title=%s,description=%s,assigned_date=%s,
           deadline=%s,submission_platform=%s,status=%s,marks=%s WHERE id=%s""",
        [merged[f] if f != "marks" else int(merged[f]) for f in FIELDS] + [aid])
    rec = get_assignment(aid)
    reindex("assignment", rec)
    sse.publish("assignments", "update", aid)
    return rec


def delete_assignment(aid: str) -> None:
    get_assignment(aid)
    execute("DELETE FROM assignments WHERE id = %s", [aid])
    unindex("assignment", aid)
    sse.publish("assignments", "delete", aid)
