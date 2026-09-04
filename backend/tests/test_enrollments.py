"""Per-student scoping tests: enrollments decide whose routine is whose.

data/enrollments.json is the source of truth for who takes what. These tests prove the
routine actually differs between students instead of every account seeing one cohort.

    cd backend; ..\\.venv\\Scripts\\python tests\\test_enrollments.py
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.abspath("backend"))
sys.path.insert(0, os.path.abspath("."))

from fastapi.testclient import TestClient

from app.config import DATA_DIR
from app.db import q1
from app.main import app
from app.services import schedules
from app.services.auth import create_token

results = []


def check(name, cond, evidence=""):
    results.append((name, bool(cond), str(evidence)[:160].replace("\n", " ")))


def routine(student_id: str) -> list[dict]:
    user = q1("SELECT id FROM users WHERE student_id = %s", [student_id])
    return schedules.list_schedules(user_id=user["id"]) if user else []


LISTED = json.loads((DATA_DIR / "enrollments.json").read_text(encoding="utf-8"))["students"]
BY_ID = {s["student_id"]: s for s in LISTED}

with TestClient(app) as client:
    print("=== CampusOS enrollment tests ===")

    everyone = schedules.list_schedules()
    check("Timetable itself is untouched", len(everyone) == 24, len(everyone))
    check("Seed data names more than one student", len(LISTED) >= 4, len(LISTED))

    # 1. Every listed student exists and is enrolled in exactly what the file says
    for student in LISTED:
        sid = student["student_id"]
        user = q1("SELECT id, name, email FROM users WHERE student_id = %s", [sid])
        check(f"{sid} has an account", user is not None, sid)
        if not user:
            continue
        enrolled = {c["course_code"] for c in schedules.my_courses(user["id"])}
        check(f"{sid} enrolled in exactly their listed courses",
              enrolled == set(student["courses"]), sorted(enrolled ^ set(student["courses"])))
        check(f"{sid} has an AUST address", user["email"].endswith(f".{sid}@aust.edu"), user["email"])

    # 2. A routine only ever contains classes the student is registered for
    for student in LISTED:
        sid = student["student_id"]
        rows = routine(sid)
        check(f"{sid} routine is a subset of the timetable",
              rows and {r["course"] for r in rows} <= set(student["courses"]),
              {r["course"] for r in rows} - set(student["courses"]))

    # 3. Different students genuinely see different routines
    sizes = {s["student_id"]: len(routine(s["student_id"])) for s in LISTED}
    check("Routine sizes differ between students", len(set(sizes.values())) >= 3, sizes)

    cs = next(s for s in LISTED if "CSE 4173" in s["courses"])
    dwm = next(s for s in LISTED if "CSE 4141" in s["courses"])
    cs_rows = {r["id"] for r in routine(cs["student_id"])}
    dwm_rows = {r["id"] for r in routine(dwm["student_id"])}
    check("Elective tracks produce different timetables", cs_rows != dwm_rows,
          f"{cs['student_id']}={len(cs_rows)} {dwm['student_id']}={len(dwm_rows)}")
    check("Cyber Security classes belong only to that track",
          {r["id"] for r in everyone if r["course"] in ("CSE 4173", "CSE 4174")} <= cs_rows
          and not {r["id"] for r in everyone if r["course"] in ("CSE 4173", "CSE 4174")} & dwm_rows)

    smallest = min(sizes, key=sizes.get)
    check("A reduced course load means a shorter week", sizes[smallest] < len(everyone), sizes[smallest])
    check("Lab group is recorded per student",
          all(c["section"] == BY_ID[cs["student_id"]]["lab_group"]
              for c in schedules.my_courses(q1("SELECT id FROM users WHERE student_id = %s",
                                               [cs["student_id"]])["id"]) if c["kind"] == "lab"))

    # 4. Over HTTP: mine=1 is scoped, the plain list is not
    user = q1("SELECT * FROM users WHERE student_id = %s", [cs["student_id"]])
    headers = {"Authorization": f"Bearer {create_token(user)}"}
    r_mine = client.get("/api/schedules?mine=1", headers=headers)
    r_all = client.get("/api/schedules", headers=headers)
    check("GET /api/schedules?mine=1 returns only their classes",
          r_mine.status_code == 200 and {row["id"] for row in r_mine.json()} == cs_rows, r_mine.status_code)
    check("GET /api/schedules still returns the whole timetable",
          r_all.status_code == 200 and len(r_all.json()) == len(everyone), r_all.status_code)
    r_courses = client.get("/api/schedules/my-courses", headers=headers)
    check("GET /api/schedules/my-courses lists their registrations",
          r_courses.status_code == 200
          and {c["course_code"] for c in r_courses.json()} == set(cs["courses"]), r_courses.status_code)

    # 5. Someone the file does not name still gets a usable routine
    stamp = int(time.time())
    signup = client.post("/api/auth/signup", json={"name": "Enrollment Fallback",
                                                   "email": f"fallback.cse.{stamp}@aust.edu",
                                                   "password": f"pw-{stamp}"})
    check("New account can be created", signup.status_code == 200, signup.text)
    if signup.status_code == 200:
        new_headers = {"Authorization": f"Bearer {signup.json()['token']}"}
        r_new = client.get("/api/schedules?mine=1", headers=new_headers)
        check("An unlisted student falls back to the full cohort timetable",
              r_new.status_code == 200 and len(r_new.json()) == len(everyone),
              len(r_new.json()) if r_new.status_code == 200 else r_new.status_code)

passed = sum(1 for _, ok, _ in results if ok)
for name, ok, evidence in results:
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"   [{evidence}]" if not ok else ""))
print(f"\n{passed}/{len(results)} passed")
sys.exit(0 if passed == len(results) else 1)
