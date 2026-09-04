"""Server-side agent state: conversations, pending actions, idempotency.

Chat turns are operational metadata, never a cache of campus data — every tool call still
reads the live tables at call time.
"""
import hashlib
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from .. import config
from ..db import execute, q, q1

PENDING_TTL_MIN = 10
IDEMPOTENCY_TTL_MIN = 15


# ---------- conversations ----------
def ensure_conversation(conversation_id: str | None, student_id: str) -> str:
    """Return a conversation owned by this student, creating one when needed.

    A conversation belonging to a different profile is never reused, so one student's
    turns can never enter another student's context.
    """
    if conversation_id:
        row = q1("SELECT student_id FROM conversations WHERE id = %s", [conversation_id])
        if row and row["student_id"] == student_id:
            return conversation_id
    cid = f"conv-{uuid.uuid4().hex[:16]}"
    execute("INSERT INTO conversations (id, student_id) VALUES (%s,%s)", [cid, student_id])
    return cid


def load_history(conversation_id: str, student_id: str, limit: int | None = None) -> list[dict]:
    limit = limit or config.AGENT_HISTORY_TURNS
    rows = q(
        """SELECT role, content FROM conversation_turns
           WHERE conversation_id = %s AND student_id = %s
           ORDER BY id DESC LIMIT %s""",
        [conversation_id, student_id, limit],
    )
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def append_turn(conversation_id: str, student_id: str, role: str, content: str,
                tool_trace: list | None = None) -> None:
    execute(
        """INSERT INTO conversation_turns (conversation_id, student_id, role, content, tool_trace)
           VALUES (%s,%s,%s,%s,%s)""",
        [conversation_id, student_id, role, content, json.dumps(tool_trace or [])],
    )
    execute("UPDATE conversations SET updated_at = now() WHERE id = %s", [conversation_id])


def purge_old() -> None:
    execute("DELETE FROM conversations WHERE updated_at < now() - interval '24 hours'")
    execute("DELETE FROM pending_actions WHERE expires_at < now() - interval '1 hour'")
    execute("DELETE FROM idempotency WHERE created_at < now() - interval '1 hour'")


# ---------- pending actions (propose / confirm) ----------
def create_pending(student_id: str, conversation_id: str, tool: str, args: dict, summary: str) -> dict:
    action_id = f"act-{secrets.token_urlsafe(16)}"  # unguessable; this IS the credential
    expires = datetime.now(timezone.utc) + timedelta(minutes=PENDING_TTL_MIN)
    execute(
        """INSERT INTO pending_actions (action_id, student_id, conversation_id, tool, args, summary, expires_at)
           VALUES (%s,%s,%s,%s,%s,%s,%s)""",
        [action_id, student_id, conversation_id, tool, json.dumps(args), summary, expires],
    )
    return {"action_id": action_id, "summary": summary, "expires_at": expires.isoformat(),
            "expires_in_seconds": PENDING_TTL_MIN * 60}


def take_pending(action_id: str, student_id: str, conversation_id: str) -> dict | None:
    """Atomically claim a pending action. Fails closed on wrong student, wrong chat, expiry or reuse."""
    rows = q(
        """UPDATE pending_actions SET used = true
           WHERE action_id = %s AND student_id = %s AND conversation_id = %s
             AND used = false AND expires_at > now()
           RETURNING tool, args, summary""",
        [action_id, student_id, conversation_id],
    )
    if not rows:
        return None
    row = rows[0]
    args = row["args"]
    return {"tool": row["tool"], "args": json.loads(args) if isinstance(args, str) else args,
            "summary": row["summary"]}


def cancel_pending(action_id: str, student_id: str, conversation_id: str) -> bool:
    rows = q(
        """UPDATE pending_actions SET used = true
           WHERE action_id = %s AND student_id = %s AND conversation_id = %s AND used = false
           RETURNING action_id""",
        [action_id, student_id, conversation_id],
    )
    return bool(rows)


# ---------- idempotency ----------
def idempotency_key(student_id: str, conversation_id: str, turn_no: int, index: int,
                    tool: str, args: dict) -> str:
    canonical = json.dumps(args, sort_keys=True, separators=(",", ":"), default=str)
    raw = f"{student_id}|{conversation_id}|{turn_no}|{index}|{tool}|{canonical}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_idempotent(key: str, student_id: str) -> dict | None:
    row = q1(
        """SELECT result FROM idempotency
           WHERE key = %s AND student_id = %s AND created_at > now() - make_interval(mins => %s)""",
        [key, student_id, IDEMPOTENCY_TTL_MIN],
    )
    if not row:
        return None
    result = row["result"]
    return json.loads(result) if isinstance(result, str) else result


def put_idempotent(key: str, student_id: str, tool: str, result: dict) -> None:
    execute(
        """INSERT INTO idempotency (key, student_id, tool, result) VALUES (%s,%s,%s,%s)
           ON CONFLICT (key) DO NOTHING""",
        [key, student_id, tool, json.dumps(result, default=str)],
    )
