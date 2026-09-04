"""Load seed JSON into Postgres on first boot and manage RBAC seeds. Repo JSON files are never mutated."""
import json

from .config import DATA_DIR
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


def seed_rbac() -> bool:
    """Seed roles, permissions, role-permission matrix, and seed users idempotently."""
    roles = [
        ("student", "Student", "Undergraduate / graduate student enrolled in university courses"),
        ("teacher", "Teacher / Faculty", "Academic instructor, professor, or lab lecturer"),
        ("authority", "Campus Authority", "Administrative staff, department head, or campus administration"),
    ]

    permissions = [
        # schedules
        ("schedules:view", "View Schedules", "schedules", "View class routines and timetables"),
        ("schedules:manage", "Manage Schedules", "schedules", "Create, edit, or delete class schedule slots"),
        # rooms
        ("rooms:view", "View Rooms", "rooms", "Browse rooms, equipment, capacity, and current bookings"),
        ("rooms:book", "Book Room", "rooms", "Book a free room for study, lab, or class session"),
        ("rooms:cancel_own", "Cancel Own Booking", "rooms", "Cancel reservations booked by oneself"),
        ("rooms:manage", "Manage Rooms", "rooms", "Add, edit, or remove rooms and configure equipment"),
        ("rooms:override_bookings", "Override Bookings", "rooms", "Cancel or reassign any room reservation"),
        # events
        ("events:view", "View Events", "events", "Browse campus events, workshops, and seminars"),
        ("events:register", "Register for Event", "events", "Register for an open campus event"),
        ("events:cancel_own", "Cancel Event Registration", "events", "Cancel one's own event registration"),
        ("events:manage", "Manage Events", "events", "Create, edit, cancel, or delete campus events"),
        # announcements
        ("announcements:view", "View Announcements", "announcements", "Read notices and departmental announcements"),
        ("announcements:create", "Create Announcements", "announcements", "Post notices, rescheduling updates, or alerts"),
        ("announcements:manage", "Manage Announcements", "announcements", "Edit or take down existing announcements"),
        # assignments
        ("assignments:view", "View Assignments", "assignments", "View course assignments, tasks, and deadlines"),
        ("assignments:submit", "Submit Assignment", "assignments", "Submit solutions or assignments before deadlines"),
        ("assignments:manage", "Manage Assignments", "assignments", "Create, update, or delete assignments and set marks"),
        ("assignments:grade", "Grade Assignments", "assignments", "Review and grade student submissions"),
        # courses
        ("courses:view", "View Courses", "courses", "Browse the course catalogue and enrollments"),
        ("courses:manage", "Manage Courses", "courses", "Create or edit courses and manage enrollments"),
        # system
        ("users:manage", "Manage Users", "system", "Manage user profiles and roles"),
        ("logs:view", "View Activity Logs", "system", "Inspect system audit logs and activity trail"),
    ]

    # Mapping of which role gets which permissions
    role_perms = {
        "student": [
            "schedules:view",
            "rooms:view", "rooms:book", "rooms:cancel_own",
            "events:view", "events:register", "events:cancel_own",
            "announcements:view",
            "assignments:view", "assignments:submit",
            "courses:view",
        ],
        "teacher": [
            "schedules:view", "schedules:manage",
            "rooms:view", "rooms:book", "rooms:cancel_own",
            "events:view", "events:register", "events:cancel_own", "events:manage",
            "announcements:view", "announcements:create", "announcements:manage",
            "assignments:view", "assignments:manage", "assignments:grade",
            "courses:view", "courses:manage",
        ],
        "authority": [p[0] for p in permissions],  # All permissions
    }

    from .services.auth import hash_password

    users = [
        # (id, role_id, student_id, employee_id, name, email, department, status, password)
        ("usr-001", "student", "20-40532", None, "Sakibul Hassan", "sakibul.hassan@aust.edu", "CSE", "active", "student123"),
        ("usr-002", "student", "99-00001", None, "QA Tester", "qa.tester@aust.edu", "CSE", "active", "student123"),
        ("usr-003", "student", "20-40533", None, "Tanvir Ahmed", "tanvir.ahmed@aust.edu", "CSE", "active", "student123"),
        ("usr-004", "teacher", None, "FAC-0101", "Prof. Dr. Md. Shahriar Mahbub", "shahriar.mahbub@aust.edu", "CSE", "active", "teacher123"),
        ("usr-005", "teacher", None, "FAC-0102", "Prof. Dr. Md. Shamim Akhter", "shamim.akhter@aust.edu", "CSE", "active", "teacher123"),
        ("usr-006", "authority", None, "AUTH-0001", "AUST Administration", "admin@aust.edu", "CSE", "active", "admin@aust2026"),
        ("usr-007", "authority", None, "AUTH-0002", "Head of Department", "head.cse@aust.edu", "CSE", "active", "admin@aust2026"),
    ]

    with pool.connection() as conn:
        for r_id, r_name, r_desc in roles:
            conn.execute(
                """INSERT INTO roles (id, name, description)
                   VALUES (%s, %s, %s)
                   ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description""",
                [r_id, r_name, r_desc],
            )

        for p_id, p_name, p_cat, p_desc in permissions:
            conn.execute(
                """INSERT INTO permissions (id, name, category, description)
                   VALUES (%s, %s, %s, %s)
                   ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description""",
                [p_id, p_name, p_cat, p_desc],
            )

        for role_id, perms in role_perms.items():
            for perm_id in perms:
                conn.execute(
                    """INSERT INTO role_permissions (role_id, permission_id)
                       VALUES (%s, %s)
                       ON CONFLICT DO NOTHING""",
                    [role_id, perm_id],
                )

        for u_id, role_id, student_id, employee_id, name, email, dept, status, plain_pw in users:
            pw_hash = hash_password(plain_pw)
            conn.execute(
                """INSERT INTO users (id, role_id, student_id, employee_id, name, email, department, status, password_hash)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (id) DO UPDATE SET
                       name = EXCLUDED.name,
                       email = EXCLUDED.email,
                       role_id = EXCLUDED.role_id,
                       student_id = EXCLUDED.student_id,
                       employee_id = EXCLUDED.employee_id,
                       department = EXCLUDED.department,
                       status = EXCLUDED.status,
                       password_hash = EXCLUDED.password_hash""",
                [u_id, role_id, student_id, employee_id, name, email, dept, status, pw_hash],
            )
    link_identities()
    return True


def seed_if_empty() -> bool:
    seed_rbac()

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
