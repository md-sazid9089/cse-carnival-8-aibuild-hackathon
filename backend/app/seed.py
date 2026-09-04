"""Load seed JSON into Postgres on first boot. Repo JSON files are never mutated."""
import json
import re

from .config import DATA_DIR, DEPARTMENT, EMAIL_DOMAIN, SEED_USER_PASSWORD
from .db import pool, q1
from .search.indexer import build_content, reindex_all


def _load(name: str):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def _enrollments() -> list[dict]:
    """Who takes what. Optional: without the file every student sees the whole cohort's timetable."""
    path = DATA_DIR / "enrollments.json"
    if not path.exists():
        return []
    return [s for s in _load("enrollments.json").get("students", []) if s.get("student_id")]


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


def _enroll_listed_students(conn) -> None:
    """data/enrollments.json is authoritative for the students it names.

    Their list replaces whatever they were enrolled in before, so a routine reflects the file
    rather than an earlier boot. Students it does not name fall back to the whole cohort.
    """
    for student in _enrollments():
        sid = str(student["student_id"]).strip()
        courses = [str(c).strip() for c in student.get("courses", []) if str(c).strip()]
        if not sid or not courses:
            continue
        section = str(student.get("section") or "B").strip()
        lab_group = str(student.get("lab_group") or section).strip()
        conn.execute(
            """DELETE FROM course_enrollments
               WHERE role_in_course = 'student' AND course_code <> ALL(%s)
                 AND user_id = (SELECT id FROM users WHERE student_id = %s)""",
            [courses, sid],
        )
        for code in courses:
            conn.execute(
                """INSERT INTO course_enrollments (user_id, course_code, section, role_in_course)
                   SELECT u.id, c.code, CASE WHEN c.kind = 'lab' THEN %s ELSE %s END, 'student'
                   FROM users u, courses c
                   WHERE u.student_id = %s AND c.code = %s
                   ON CONFLICT (user_id, course_code) DO UPDATE SET section = EXCLUDED.section""",
                [lab_group, section, sid, code],
            )


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
        _enroll_listed_students(conn)
        conn.execute(
            """INSERT INTO course_enrollments (user_id, course_code, section, role_in_course)
               SELECT u.id, c.code,
                      COALESCE((SELECT s.section FROM schedules s WHERE s.course = c.code LIMIT 1), 'B'),
                      'student'
               FROM users u CROSS JOIN courses c
               WHERE u.role_id = 'student'
                 AND NOT EXISTS (SELECT 1 FROM course_enrollments e WHERE e.user_id = u.id)
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


def _people_from_data() -> list[dict]:
    """Every person the seed data names: enrolled students and event registrants.

    Accounts are derived from the dataset rather than listed here, so data/enrollments.json
    and data/events.json are the only places a person is introduced.
    """
    people: dict[str, dict] = {}
    for student in _enrollments():
        sid = str(student["student_id"]).strip()
        name = str(student.get("name", "")).strip()
        if sid and name:
            people[sid] = {"student_id": sid, "name": name,
                           "department": str(student.get("department") or DEPARTMENT).strip()}
    for event in _load("events.json"):
        for reg in event.get("registrations", []):
            sid = str(reg.get("student_id", "")).strip()
            name = str(reg.get("name", "")).strip()
            if sid and name:
                people.setdefault(sid, {"student_id": sid, "name": name, "department": DEPARTMENT})
    return [people[sid] for sid in sorted(people)]


def _email_for(name: str, student_id: str, department: str) -> str:
    """AUST addresses are name.department.studentid@domain — the same shape sign-up requires."""
    parts = [p for p in re.split(r"[^A-Za-z]+", name.lower()) if p]
    return f"{'.'.join(parts) or 'student'}.{department.lower()}.{student_id}@{EMAIL_DOMAIN}"


def seed_users() -> None:
    """Give the people named in the seed data an account, idempotently.

    They can only sign in when SEED_USER_PASSWORD is configured; with no password set
    the accounts exist purely so their bookings and registrations have an owner, and
    everyone else registers through /api/auth/signup.
    """
    from .services.auth import hash_password

    pw_hash = hash_password(SEED_USER_PASSWORD) if SEED_USER_PASSWORD else None

    with pool.connection() as conn:
        for person in _people_from_data():
            sid, name, dept = person["student_id"], person["name"], person["department"]
            conn.execute(
                """INSERT INTO users (id, role_id, student_id, name, email, department, status, password_hash)
                   VALUES (%s, 'student', %s, %s, %s, %s, 'active', %s)
                   ON CONFLICT (student_id) DO UPDATE SET
                       name = EXCLUDED.name,
                       email = EXCLUDED.email,
                       department = EXCLUDED.department,
                       status = EXCLUDED.status,
                       password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash)""",
                [f"usr-{sid}", sid, name, _email_for(name, sid, dept), dept, pw_hash],
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
