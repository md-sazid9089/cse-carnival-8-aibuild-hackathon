"""Automated test suite for CampusOS Student Full Access & Single Role verification."""
import os
import sys

sys.path.insert(0, os.path.abspath("."))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db import q, q1, execute
from backend.app.services.auth import verify_password

results = []

def check(name, cond, evidence=""):
    results.append((name, bool(cond), str(evidence)[:160].replace("\n", " ")))

with TestClient(app) as client:
    print("=== Starting CampusOS Student Full Access & Single Role Tests ===")

    # 1. Verify roles and role_permissions tables are dropped
    roles_table = q1("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles'")
    check("roles table is dropped", roles_table is None, roles_table)

    role_perms_table = q1("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_permissions'")
    check("role_permissions table is dropped", role_perms_table is None, role_perms_table)

    # 2. Verify all users have role_id = 'student' and no teacher/authority users exist
    non_students = q("SELECT id, role_id, email FROM users WHERE role_id != 'student'")
    check("No non-student users exist", len(non_students) == 0, non_students)

    # 3. Verify student seeded with password hash and full permissions
    student_user = q1("SELECT * FROM users WHERE email = 'sakibul.hassan@aust.edu'")
    check("Student user seeded in database", student_user is not None, student_user)
    check("Student user has 'student' role", student_user and student_user.get("role_id") == "student", student_user.get("role_id") if student_user else None)
    check("Student has password_hash stored", student_user and bool(student_user.get("password_hash")), student_user.get("password_hash") if student_user else None)
    check("Student password_hash verifies 'student123'", student_user and verify_password("student123", student_user.get("password_hash")), "Hash verification")

    # 4. Student Sign In via API
    r = client.post("/api/auth/signin", json={"email_or_id": "sakibul.hassan@aust.edu", "password": "student123"})
    check("Student POST /api/auth/signin -> 200", r.status_code == 200, r.json() if r.status_code != 200 else "ok")
    student_token = r.json().get("token")
    student_data = r.json().get("user", {})
    check("Student sign in returns bearer token", bool(student_token), student_token[:20] if student_token else None)
    check("Student role is 'student'", student_data.get("role_id") == "student", student_data.get("role_id"))
    check("Student has full permissions list", len(student_data.get("permissions", [])) >= 15, len(student_data.get("permissions", [])))

    # 5. Sign In Validation
    r = client.post("/api/auth/signin", json={"email_or_id": "sakibul.hassan@aust.edu", "password": "wrongpassword"})
    check("Wrong password -> 401 INVALID_CREDENTIALS", r.status_code == 401, r.json())
    r = client.post("/api/auth/signin", json={"email_or_id": "nonexistent@aust.edu", "password": "anypassword"})
    check("Nonexistent user -> 401 INVALID_CREDENTIALS", r.status_code == 401, r.json())

    # 6. Sign Up: New user gets 'student' role with full permissions
    import time
    unique_email = f"newstudent_{int(time.time())}@aust.edu"
    r = client.post("/api/auth/signup", json={
        "name": "Newly Registered Student",
        "email": unique_email,
        "password": "mypassword123",
        "department": "CSE"
    })
    check("Sign up new user -> 200", r.status_code == 200, r.json() if r.status_code != 200 else "ok")
    new_user_res = r.json()
    new_token = new_user_res.get("token")
    new_user = new_user_res.get("user", {})
    check("New signup is assigned 'student' role", new_user.get("role_id") == "student", new_user.get("role_id"))
    check("New signup gets auto-generated student_id", bool(new_user.get("student_id")), new_user.get("student_id"))
    check("New signup has all permissions", len(new_user.get("permissions", [])) >= 15, len(new_user.get("permissions", [])))

    # Verify password hash in DB for newly signed up student
    db_new_user = q1("SELECT * FROM users WHERE email = %s", [unique_email])
    check("New signup has password_hash in DB (not plain text)", db_new_user and db_new_user["password_hash"].startswith("pbkdf2:sha256:"), db_new_user.get("password_hash") if db_new_user else None)
    check("New signup password hash verifies correctly", db_new_user and verify_password("mypassword123", db_new_user["password_hash"]), "Password check")

    # 7. GET /api/auth/me with Bearer token
    r_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {student_token}"})
    check("GET /api/auth/me with Student token -> returns student profile", r_me.status_code == 200 and r_me.json().get("role_id") == "student", r_me.json())

    # 8. Student Full Access: Create & Cancel Booking
    r_book = client.post("/api/rooms/room-002/bookings", json={
        "date": "2026-09-16",
        "start_time": "15:00",
        "end_time": "16:00",
        "purpose": "AI Group Study"
    }, headers={"Authorization": f"Bearer {new_token}"})
    check("Student creates room booking -> 200", r_book.status_code == 200, r_book.json() if r_book.status_code != 200 else "ok")
    bid = r_book.json().get("booking_id") if r_book.status_code == 200 else None

    if bid:
        r_cancel = client.delete(f"/api/rooms/room-002/bookings/{bid}", headers={"Authorization": f"Bearer {student_token}"})
        check("Student can cancel booking -> 200", r_cancel.status_code == 200, r_cancel.json() if r_cancel.status_code != 200 else "ok")

    # 9. Student Full Access: Register & Cancel Event Registration
    r_reg = client.post("/api/events/evt-004/registrations", headers={"Authorization": f"Bearer {new_token}"})
    check("Student registers for event -> 200", r_reg.status_code == 200, r_reg.json().get("registered") if r_reg.status_code == 200 else r_reg.json())

    r_unreg = client.delete(f"/api/events/evt-004/registrations/{new_user['student_id']}", headers={"Authorization": f"Bearer {new_token}"})
    check("Student cancels event registration -> 200", r_unreg.status_code == 200, r_unreg.json() if r_unreg.status_code != 200 else "ok")

    # Clean up test user
    execute("DELETE FROM users WHERE email = %s", [unique_email])

# Report
print("\n" + "=" * 60)
w = max(len(n) for n, _, _ in results)
for name, ok, ev in results:
    print(f"{'PASS' if ok else 'FAIL'}  {name.ljust(w)}  {ev if not ok else ''}")
p = sum(1 for _, ok, _ in results if ok)
print(f"\n{p}/{len(results)} passed")
print("=" * 60)
sys.exit(0 if p == len(results) else 1)
