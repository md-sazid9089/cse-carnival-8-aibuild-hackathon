"""Load seed JSON into Postgres on first boot. Repo JSON files are never mutated."""
import json

from .config import DATA_DIR
from .db import pool, q1
from .search.indexer import build_content, reindex_all


def _load(name: str):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def seed_if_empty() -> bool:
    if q1("SELECT COUNT(*) AS n FROM schedules")["n"] > 0:
        return False

    schedules = _load("schedules.json")
    rooms = _load("rooms.json")
    events = _load("events.json")
    announcements = _load("announcements.json")
    assignments = _load("assignments.json")

    with pool.connection() as conn:
        for s in schedules:
            conn.execute(
                "INSERT INTO schedules VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                [s["id"], s["course"], s["title"], s["day"], s["start_time"], s["end_time"],
                 s["room"], s["instructor"], s["section"]],
            )
        for r in rooms:
            conn.execute(
                "INSERT INTO rooms VALUES (%s,%s,%s,%s,%s,%s,%s)",
                [r["id"], r["room_number"], r["type"], r["capacity"], r["equipment"], r["floor"], r["status"]],
            )
            for b in r.get("bookings", []):
                conn.execute(
                    "INSERT INTO bookings VALUES (%s,%s,%s,%s,%s,%s,%s)",
                    [b["booking_id"], r["id"], b["booked_by"], b["date"], b["start_time"],
                     b["end_time"], b["purpose"]],
                )
        for e in events:
            conn.execute(
                "INSERT INTO events VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                [e["id"], e["name"], e["description"], e["date"], e["start_time"], e["end_time"],
                 e["end_date"], e["venue"], e["organizer"], e["capacity"], e["registered"], e["status"]],
            )
            for reg in e.get("registrations", []):
                conn.execute(
                    "INSERT INTO registrations VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                    [e["id"], reg["student_id"], reg["name"]],
                )
        for a in announcements:
            conn.execute(
                "INSERT INTO announcements VALUES (%s,%s,%s,%s,%s,%s,%s)",
                [a["id"], a["title"], a["body"], a["date"], a["priority"], a["posted_by"], a["expires"]],
            )
        for a in assignments:
            conn.execute(
                "INSERT INTO assignments VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                [a["id"], a["course"], a["course_title"], a["title"], a["description"], a["assigned_date"],
                 a["deadline"], a["submission_platform"], a["status"], a["marks"]],
            )
        # populate search index synchronously (keyword leg); embeddings backfill async
        for e in events:
            conn.execute(
                "INSERT INTO search_index (entity_type, entity_id, content) VALUES (%s,%s,%s)",
                ["event", e["id"], build_content("event", e)],
            )
        for a in announcements:
            conn.execute(
                "INSERT INTO search_index (entity_type, entity_id, content) VALUES (%s,%s,%s)",
                ["announcement", a["id"], build_content("announcement", a)],
            )
        for a in assignments:
            conn.execute(
                "INSERT INTO search_index (entity_type, entity_id, content) VALUES (%s,%s,%s)",
                ["assignment", a["id"], build_content("assignment", a)],
            )
    reindex_all()
    return True
