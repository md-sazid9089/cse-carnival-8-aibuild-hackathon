"""Automated test suite for CampusOS Auth and Authority Full Access verification."""
import os
import sys

sys.path.insert(0, os.path.abspath("."))

from fastapi.testclient import TestClient
from app.main import app
from app.db import q, q1, execute
from app.services.auth import verify_password

results = []

def check(name, cond, evidence=""):
    results.append((name, bool(cond), str(evidence)[:160].replace("\n", " ")))

with TestClient(app) as client:
    print("=== Starting CampusOS Auth & Authority Role Tests ===")

    # 1. Verify Authority Seeded with Password Hash and Full Permissions
    auth_user = q1("SELECT * FROM users WHERE email = 'admin@aust.edu'")
    check("Authority user seeded in database", auth_user is not None, auth_user)
    check("Authority user has 'authority' role", auth_user and auth_user.get("role_id") == "authority", auth_user.get("role_id") if auth_user else None)
    check("Authority has password_hash stored", auth_user and bool(auth_user.get("password_hash")), auth_user.get("password_hash") if auth_user else None)
    check("Authority password_hash verifies 'admin@aust2026'", auth_user and verify_password("admin@aust2026", auth_user.get("password_hash")), "Hash verification")

    # 2. Authority Sign In via API
    r = client.post("/api/auth/signin", json={"email_or_id": "admin@aust.edu", "password": "admin@aust2026"})
    check("Authority POST /api/auth/signin -> 200", r.status_code == 200, r.json() if r.status_code != 200 else "ok")
    auth_token = r.json().get("token")
    auth_data = r.json().get("user", {})
    check("Authority sign in returns bearer token", bool(auth_token), auth_token[:20] if auth_token else None)
    check("Authority user role is 'authority'", auth_data.get("role_id") == "authority", auth_data.get("role_id"))
    check("Authority has full permissions list", len(auth_data.get("permissions", [])) >= 15, len(auth_data.get("permissions", [])))

    # 3. Student Sign In via API
    r = client.post("/api/auth/signin", json={"email_or_id": "sakibul.hassan@aust.edu", "password": "student123"})
    check("Student POST /api/auth/signin -> 200", r.status_code == 200, r.json() if r.status_code != 200 else "ok")
    student_token = r.json().get("token")
    student_data = r.json().get("user", {})
    check("Student sign in returns bearer token", bool(student_token), student_token[:20] if student_token else None)
    check("Student role is 'student'", student_data.get("role_id") == "student", student_data.get("role_id"))

    # 4. Sign In Validation
    r = client.post("/api/auth/signin", json={"email_or_id": "admin@aust.edu", "password": "wrongpassword"})
    check("Wrong password -> 401 INVALID_CREDENTIALS", r.status_code == 401, r.json())
    r = client.post("/api/auth/signin", json={"email_or_id": "nonexistent@aust.edu", "password": "anypassword"})
    check("Nonexistent user -> 401 INVALID_CREDENTIALS", r.status_code == 401, r.json())

    # 5. Sign Up: Initial role MUST be 'student' with hashed password
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
    check("New signup is initially assigned 'student' role", new_user.get("role_id") == "student", new_user.get("role_id"))
    check("New signup gets auto-generated student_id", bool(new_user.get("student_id")), new_user.get("student_id"))

    # Verify password hash in DB for newly signed up student
    db_new_user = q1("SELECT * FROM users WHERE email = %s", [unique_email])
    check("New signup has password_hash in DB (not plain text)", db_new_user and db_new_user["password_hash"].startswith("pbkdf2:sha256:"), db_new_user.get("password_hash") if db_new_user else None)
    check("New signup password hash verifies correctly", db_new_user and verify_password("mypassword123", db_new_user["password_hash"]), "Password check")

    # Duplicate email sign up check
    r_dup = client.post("/api/auth/signup", json={
        "name": "Duplicate Student",
        "email": unique_email,
        "password": "mypassword123"
    })
    check("Duplicate email signup -> 409 EMAIL_EXISTS", r_dup.status_code == 409, r_dup.json())

    # 6. GET /api/auth/me with Bearer token
    r_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {auth_token}"})
    check("GET /api/auth/me with Authority token -> returns authority profile", r_me.status_code == 200 and r_me.json().get("role_id") == "authority", r_me.json())
    r_me_student = client.get("/api/auth/me", headers={"Authorization": f"Bearer {new_token}"})
    check("GET /api/auth/me with Student token -> returns student profile", r_me_student.status_code == 200 and r_me_student.json().get("role_id") == "student", r_me_student.json())

    # 7. Authority Full Access: Override Booking
    # Create a room booking by student
    r_book = client.post("/api/rooms/room-002/bookings", json={
        "date": "2026-09-15",
        "start_time": "14:00",
        "end_time": "15:00",
        "purpose": "Study Group"
    }, headers={"Authorization": f"Bearer {new_token}"})
    check("Student creates room booking -> 200", r_book.status_code == 200, r_book.json() if r_book.status_code != 200 else "ok")
    bid = r_book.json().get("booking_id") if r_book.status_code == 200 else None

    # Another student tries to cancel it -> should be forbidden (403)
    if bid:
        r_cancel_other = client.delete(f"/api/rooms/room-002/bookings/{bid}", headers={"Authorization": f"Bearer {student_token}"})
        check("Another student cannot cancel someone else's booking -> 403 FORBIDDEN", r_cancel_other.status_code == 403, r_cancel_other.json())

        # Authority cancels the booking -> should SUCCEED (Authority Override)
        r_cancel_auth = client.delete(f"/api/rooms/room-002/bookings/{bid}", headers={"Authorization": f"Bearer {auth_token}"})
        check("Authority can override and cancel any booking -> 200", r_cancel_auth.status_code == 200, r_cancel_auth.json())

    # 8. Authority Full Access: Override Event Registration
    # Student registers for event evt-004
    r_reg = client.post("/api/events/evt-004/registrations", headers={"Authorization": f"Bearer {new_token}"})
    check("Student registers for evt-004 -> 200", r_reg.status_code == 200, r_reg.json().get("registered") if r_reg.status_code == 200 else r_reg.json())

    # Another student tries to cancel it -> 403
    r_unreg_other = client.delete(f"/api/events/evt-004/registrations/{new_user['student_id']}", headers={"Authorization": f"Bearer {student_token}"})
    check("Another student cannot cancel someone else's registration -> 403", r_unreg_other.status_code == 403, r_unreg_other.json())

    # Authority cancels the registration -> 200
    r_unreg_auth = client.delete(f"/api/events/evt-004/registrations/{new_user['student_id']}", headers={"Authorization": f"Bearer {auth_token}"})
    check("Authority can cancel any student's registration -> 200", r_unreg_auth.status_code == 200, r_unreg_auth.json())

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

