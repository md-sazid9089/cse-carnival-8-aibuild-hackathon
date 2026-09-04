"""Auth tests: password hashing, sign in/up, token handling, and owner-only enforcement.

Every account is a student (migration 004 dropped the roles tables), so authorization
comes down to one rule: you may only cancel what you created.

    cd backend; ..\\.venv\\Scripts\\python tests\\test_auth_rbac.py
"""
import os
import sys
import time

sys.path.insert(0, os.path.abspath("backend"))
sys.path.insert(0, os.path.abspath("."))

from fastapi.testclient import TestClient

from app.db import execute, q1
from app.main import app
from app.services.auth import verify_password

results = []


def check(name, cond, evidence=""):
    results.append((name, bool(cond), str(evidence)[:160].replace("\n", " ")))


with TestClient(app) as client:
    print("=== CampusOS auth tests ===")

    # 1. Seeded student account
    seed_user = q1("SELECT * FROM users WHERE email = 'sakibul.hassan@aust.edu'")
    check("Seed student exists", seed_user is not None, seed_user)
    check("Seed student has a password hash", seed_user and bool(seed_user.get("password_hash")))
    check("Seed student password verifies", seed_user and verify_password("student123", seed_user["password_hash"]))
    check("Every seeded account is a student", not q1("SELECT 1 AS x FROM users WHERE role_id <> 'student'"))

    # 2. Sign in
    r = client.post("/api/auth/signin", json={"email_or_id": "sakibul.hassan@aust.edu", "password": "student123"})
    check("POST /api/auth/signin -> 200", r.status_code == 200, r.json() if r.status_code != 200 else "ok")
    student_token = r.json().get("token")
    student_data = r.json().get("user", {})
    check("Sign in returns a bearer token", bool(student_token))
    check("Signed-in role is 'student'", student_data.get("role_id") == "student", student_data.get("role_id"))
    check("Sign in by student ID also works",
          client.post("/api/auth/signin", json={"email_or_id": "20-40532", "password": "student123"}).status_code == 200)

    r = client.post("/api/auth/signin", json={"email_or_id": "sakibul.hassan@aust.edu", "password": "wrongpassword"})
    check("Wrong password -> 401", r.status_code == 401, r.json())
    r = client.post("/api/auth/signin", json={"email_or_id": "nonexistent@aust.edu", "password": "anypassword"})
    check("Unknown account -> 401", r.status_code == 401, r.json())

    # 3. Sign up
    unique_email = f"newstudent_{int(time.time())}@aust.edu"
    r = client.post("/api/auth/signup", json={"name": "Newly Registered Student", "email": unique_email,
                                              "password": "mypassword123", "department": "CSE"})
    check("Sign up -> 200", r.status_code == 200, r.json() if r.status_code != 200 else "ok")
    new_user_res = r.json()
    new_token = new_user_res.get("token")
    new_user = new_user_res.get("user", {})
    check("New account is a student", new_user.get("role_id") == "student", new_user.get("role_id"))
    check("New account gets a student ID", bool(new_user.get("student_id")), new_user.get("student_id"))

    db_new_user = q1("SELECT * FROM users WHERE email = %s", [unique_email])
    check("Password is stored hashed, never in the clear",
          db_new_user and db_new_user["password_hash"].startswith("pbkdf2:sha256:"))
    check("Stored hash verifies", db_new_user and verify_password("mypassword123", db_new_user["password_hash"]))
    check("Short password -> 400",
          client.post("/api/auth/signup",
                      json={"name": "X", "email": f"x{unique_email}", "password": "123"}).status_code == 400)
    r_dup = client.post("/api/auth/signup", json={"name": "Duplicate Student", "email": unique_email,
                                                  "password": "mypassword123"})
    check("Duplicate email -> 409", r_dup.status_code == 409, r_dup.json())

    # 4. Token handling
    r_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {new_token}"})
    check("GET /api/auth/me returns the token's own profile",
          r_me.status_code == 200 and r_me.json().get("email") == unique_email, r_me.json())
    forged = client.get("/api/auth/me", headers={"Authorization": "Bearer eyJ1aWQiOiJ1c3ItMDAxIn0.deadbeefdeadbeef"})
    check("Forged token grants no identity", forged.json().get("email") != "sakibul.hassan@aust.edu", forged.json())

    # 5. Ownership: only the person who booked may cancel
    r_book = client.post("/api/rooms/room-002/bookings",
                         json={"date": "2026-09-15", "start_time": "14:00", "end_time": "15:00",
                               "purpose": "Study Group"},
                         headers={"Authorization": f"Bearer {new_token}"})
    check("Student creates a booking -> 200", r_book.status_code == 200,
          r_book.json() if r_book.status_code != 200 else "ok")
    bid = r_book.json().get("booking_id") if r_book.status_code == 200 else None

    if bid:
        r_other = client.delete(f"/api/rooms/room-002/bookings/{bid}",
                                headers={"Authorization": f"Bearer {student_token}"})
        check("Another student cannot cancel it -> 403", r_other.status_code == 403, r_other.json())
        r_own = client.delete(f"/api/rooms/room-002/bookings/{bid}",
                              headers={"Authorization": f"Bearer {new_token}"})
        check("The owner can cancel it -> 200", r_own.status_code == 200, r_own.json())

    r_reg = client.post("/api/events/evt-004/registrations", headers={"Authorization": f"Bearer {new_token}"})
    check("Student registers for evt-004 -> 200", r_reg.status_code == 200,
          r_reg.json().get("registered") if r_reg.status_code == 200 else r_reg.json())

    r_unreg_other = client.delete(f"/api/events/evt-004/registrations/{new_user['student_id']}",
                                  headers={"Authorization": f"Bearer {student_token}"})
    check("Another student cannot cancel that registration -> 403", r_unreg_other.status_code == 403,
          r_unreg_other.json())
    r_unreg_own = client.delete(f"/api/events/evt-004/registrations/{new_user['student_id']}",
                                headers={"Authorization": f"Bearer {new_token}"})
    check("The owner can cancel their registration -> 200", r_unreg_own.status_code == 200, r_unreg_own.json())

    execute("DELETE FROM users WHERE email = %s", [unique_email])

print("\n" + "=" * 60)
w = max(len(n) for n, _, _ in results)
for name, ok, ev in results:
    print(f"{'PASS' if ok else 'FAIL'}  {name.ljust(w)}  {ev if not ok else ''}")
p = sum(1 for _, ok, _ in results if ok)
print(f"\n{p}/{len(results)} passed")
print("=" * 60)
sys.exit(0 if p == len(results) else 1)
