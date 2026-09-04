"""Auth tests: password hashing, sign in/up, token handling, and owner-only enforcement.

Every account is a student (migration 004 dropped the roles tables), so authorization
comes down to one rule: you may only cancel what you created.

    cd backend; ..\\.venv\\Scripts\\python tests\\test_auth_rbac.py
"""
import os
import sys
import time

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

    # 1. Accounts derived from the seed data, with no password shipped in the repo
    seed_user = q1("SELECT * FROM users WHERE student_id = '20-40532'")
    check("Person named in the seed data has an account", seed_user is not None, seed_user)
    check("Every seeded account is a student", not q1("SELECT 1 AS x FROM users WHERE role_id <> 'student'"))
    check("No password is stored in plain text",
          not q1("SELECT 1 AS x FROM users WHERE password_hash IS NOT NULL AND password_hash NOT LIKE %s",
                 ["pbkdf2:%"]))

    # 2. Register, then sign in with those credentials
    stamp = int(time.time())
    owner_email, owner_password = f"cse.{stamp}01@aust.edu", f"owner-pw-{stamp}"
    r = client.post("/api/auth/signup", json={"name": "Owner Student", "email": owner_email,
                                              "password": owner_password})
    check("Sign up -> 200", r.status_code == 200, r.json() if r.status_code != 200 else "ok")
    owner = r.json().get("user", {})
    owner_token = r.json().get("token")
    check("New account is a student", owner.get("role_id") == "student", owner.get("role_id"))
    check("Student ID is read from the AUST email", owner.get("student_id") == f"{stamp}01", owner.get("student_id"))
    check("Department is read from the AUST email", owner.get("department") == "CSE", owner.get("department"))

    # 2b. CampusOS is for AUST students only
    r_outside = client.post("/api/auth/signup", json={"name": "Outsider", "email": f"cse.{stamp}03@gmail.com",
                                                      "password": owner_password})
    check("Sign up with a non-AUST email -> 400", r_outside.status_code == 400, r_outside.json())
    r_shape = client.post("/api/auth/signup", json={"name": "Wrong Shape", "email": f"student{stamp}@aust.edu",
                                                    "password": owner_password})
    check("AUST email must be dept.id@aust.edu -> 400", r_shape.status_code == 400, r_shape.json())
    check("Sign in with a non-AUST email -> 400",
          client.post("/api/auth/signin",
                      json={"email_or_id": "someone@gmail.com", "password": "x"}).status_code == 400)

    db_owner = q1("SELECT * FROM users WHERE email = %s", [owner_email])
    check("Password is stored hashed, never in the clear",
          db_owner and db_owner["password_hash"].startswith("pbkdf2:sha256:"))
    check("Stored hash verifies", db_owner and verify_password(owner_password, db_owner["password_hash"]))
    check("Short password -> 400",
          client.post("/api/auth/signup",
                      json={"name": "X", "email": f"x{owner_email}", "password": "123"}).status_code == 400)
    r_dup = client.post("/api/auth/signup", json={"name": "Duplicate", "email": owner_email,
                                                  "password": owner_password})
    check("Duplicate email -> 409", r_dup.status_code == 409, r_dup.json())

    r = client.post("/api/auth/signin", json={"email_or_id": owner_email, "password": owner_password})
    check("POST /api/auth/signin -> 200", r.status_code == 200, r.json() if r.status_code != 200 else "ok")
    check("Sign in returns a bearer token", bool(r.json().get("token")))
    check("Sign in by student ID also works",
          client.post("/api/auth/signin",
                      json={"email_or_id": owner["student_id"], "password": owner_password}).status_code == 200)
    check("Wrong password -> 401",
          client.post("/api/auth/signin", json={"email_or_id": owner_email, "password": "wrong"}).status_code == 401)
    check("Unknown account -> 401",
          client.post("/api/auth/signin", json={"email_or_id": "nobody@aust.edu", "password": "x"}).status_code == 401)

    # A second account so ownership can be tested from the other side
    other_email, other_password = f"eee.{stamp}02@aust.edu", f"other-pw-{stamp}"
    r = client.post("/api/auth/signup", json={"name": "Other Student", "email": other_email,
                                              "password": other_password})
    other_token = r.json().get("token")
    student_token, new_token, new_user, unique_email = other_token, owner_token, owner, owner_email

    # 3. The API refuses anything it did not sign
    check("No token -> 401", client.get("/api/schedules").status_code == 401)
    check("Forged token -> 401",
          client.get("/api/schedules", headers={"Authorization": "Bearer forged.signature"}).status_code == 401)
    check("Public endpoints stay reachable", client.get("/api/meta").status_code == 200)
    r_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {new_token}"})
    check("GET /api/auth/me returns the token's own profile",
          r_me.status_code == 200 and r_me.json().get("email") == unique_email, r_me.json())

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

    execute("DELETE FROM users WHERE email IN (%s, %s)", [owner_email, other_email])

print("\n" + "=" * 60)
w = max(len(n) for n, _, _ in results)
for name, ok, ev in results:
    print(f"{'PASS' if ok else 'FAIL'}  {name.ljust(w)}  {ev if not ok else ''}")
p = sum(1 for _, ok, _ in results if ok)
print(f"\n{p}/{len(results)} passed")
print("=" * 60)
sys.exit(0 if p == len(results) else 1)
