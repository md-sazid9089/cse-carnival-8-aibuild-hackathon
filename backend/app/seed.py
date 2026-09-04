"""Load seed JSON into Postgres on first boot. Repo JSON files are never mutated."""
import json
import re

from .config import DATA_DIR, DEPARTMENT, EMAIL_DOMAIN, SEED_USER_PASSWORD
from .db import pool, q1
from .search.indexer import build_content, reindex_all


def _load(name: str):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def _courses_from(schedules: list[dict], assignments: list[dict]) -> list[tuple]:
    titles: dict[str, str] = {}
    for s in schedules:
        titles.setdefault(s["course"], s["title"])
    for a in assignments:
        titles.setdefault(a["course"], a["course_title"])
    return [
        (code, title, code.split(" ")[0], "lab" if title.lower().endswith("lab") else "theory")
        for code, title in titles.items()
    ]


def link_identities() -> None:
    """Attach seeded records to user accounts and build course enrollments.

    Runs on every boot and is a no-op once everything resolves. Rows whose author
    has no account simply stay unlinked - the free-text name remains the display value.
    """
    with pool.connection() as conn:
        conn.execute(
            """INSERT INTO course_enrollments (user_id, course_code, section, role_in_course)
               SELECT DISTINCT ON (u.id, s.course) u.id, s.course, s.section, 'instructor'
               FROM schedules s JOIN users u ON u.name = s.instructor
               ON CONFLICT DO NOTHING"""
        )
        conn.execute(
            """INSERT INTO course_enrollments (user_id, course_code, section, role_in_course)
               SELECT u.id, c.code,
                      COALESCE((SELECT s.section FROM schedules s WHERE s.course = c.code LIMIT 1), 'B'),
                      'student'
               FROM users u CROSS JOIN courses c
               WHERE u.role_id = 'student'
               ON CONFLICT DO NOTHING"""
        )
        conn.execute(
            """UPDATE registrations r SET user_id = u.id
               FROM users u WHERE u.student_id = r.student_id AND r.user_id IS NULL"""
        )
        conn.execute(
            """UPDATE bookings b SET user_id = (
                   SELECT u.id FROM users u
                   WHERE u.name = b.booked_by OR u.name LIKE '%' || b.booked_by
                   ORDER BY length(u.name) LIMIT 1)
               WHERE b.user_id IS NULL"""
        )
        conn.execute(
            """UPDATE announcements a SET created_by = u.id
               FROM users u WHERE u.name = a.posted_by AND a.created_by IS NULL"""
        )
        conn.execute(
            """UPDATE events e SET created_by = u.id
               FROM users u WHERE u.name = e.organizer AND e.created_by IS NULL"""
        )


def _people_from_data() -> list[tuple[str, str]]:
    """Every (student_id, name) the seed data names as an event registrant.

    Accounts are derived from the dataset rather than listed here, so editing
    data/events.json is the only place a person is introduced.
    """
    people: dict[str, str] = {}
    for event in _load("events.json"):
        for reg in event.get("registrations", []):
            sid = str(reg.get("student_id", "")).strip()
            name = str(reg.get("name", "")).strip()
            if sid and name:
                people.setdefault(sid, name)
    return sorted(people.items())


def _email_for(name: str) -> str:
    parts = [p for p in re.split(r"[^A-Za-z]+", name.lower()) if p]
    return f"{'.'.join(parts) or 'student'}@{EMAIL_DOMAIN}"


def seed_users() -> None:
    """Give the people named in the seed data an account, idempotently.

    They can only sign in when SEED_USER_PASSWORD is configured; with no password set
    the accounts exist purely so their bookings and registrations have an owner, and
    everyone else registers through /api/auth/signup.
    """
    from .services.auth import hash_password

    pw_hash = hash_password(SEED_USER_PASSWORD) if SEED_USER_PASSWORD else None

    with pool.connection() as conn:
        for student_id, name in _people_from_data():
            conn.execute(
                """INSERT INTO users (id, role_id, student_id, name, email, department, status, password_hash)
                   VALUES (%s, 'student', %s, %s, %s, %s, 'active', %s)
                   ON CONFLICT (student_id) DO UPDATE SET
                       name = EXCLUDED.name,
                       status = EXCLUDED.status,
                       password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash)""",
                [f"usr-{student_id}", student_id, name, _email_for(name), DEPARTMENT, pw_hash],
            )
    link_identities()


def seed_if_empty() -> bool:
    seed_users()

    if q1("SELECT COUNT(*) AS n FROM schedules")["n"] > 0:
        return False

    schedules = _load("schedules.json")
    rooms = _load("rooms.json")
    events = _load("events.json")
    announcements = _load("announcements.json")
    assignments = _load("assignments.json")

    with pool.connection() as conn:
        for code, title, dept, kind in _courses_from(schedules, assignments):
            conn.execute(
                "INSERT INTO courses (code, title, department, kind) VALUES (%s,%s,%s,%s) ON CONFLICT (code) DO NOTHING",
                [code, title, dept, kind],
            )
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
