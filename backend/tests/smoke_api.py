"""CampusOS judge-simulation API tests. Backend must be running on :8000.
Run: python backend/tests/smoke_api.py   (exit code 1 on any failure)
"""
import sys
import time

import httpx

B = "http://localhost:8000"
ME = {"X-Student-Id": "20-40532", "X-Student-Name": "Sakibul Hassan"}
QA = {"X-Student-Id": "99-00001", "X-Student-Name": "QA Tester"}
c = httpx.Client(base_url=B, timeout=60)
results: list[tuple[str, bool, str]] = []


def check(name, cond, evidence=""):
    results.append((name, bool(cond), str(evidence)[:160].replace("\n", " ")))


def j(r):
    try:
        return r.json()
    except Exception:  # noqa: BLE001
        return r.text


SEED = {"schedules": 24, "rooms": 20, "events": 7, "announcements": 8, "assignments": 8}

# ---------- baseline + shape
for ent, n in SEED.items():
    r = c.get(f"/api/{ent}")
    check(f"GET /api/{ent} = {n}", r.status_code == 200 and len(r.json()) == n, f"{r.status_code} count={len(j(r)) if r.status_code==200 else '?'}")
rooms = {r["id"]: r for r in c.get("/api/rooms").json()}
check("rooms nest bookings[]", rooms["room-006"]["bookings"][0]["booking_id"] == "bk-001", rooms["room-006"]["bookings"])
check("times HH:MM / dates ISO", rooms["room-006"]["bookings"][0]["start_time"] == "13:00" and rooms["room-006"]["bookings"][0]["date"] == "2026-09-07", rooms["room-006"]["bookings"][0])
events = {e["id"]: e for e in c.get("/api/events").json()}
check("seed registered=47 preserved", events["evt-001"]["registered"] == 47, events["evt-001"]["registered"])
check("/api/meta gives campus TZ date", c.get("/api/meta").json().get("tz") == "Asia/Dhaka", j(c.get("/api/meta")))

# ---------- CRUD every system
crud = {
    "schedules": ({"course": "QA 101", "title": "QA", "day": "Monday", "start_time": "08:00", "end_time": "08:50", "room": "7A01", "instructor": "QA", "section": "Q"}, {"room": "7A02"}, "room", "sch-"),
    "rooms": ({"room_number": "QA9", "type": "classroom", "capacity": 10, "equipment": ["projector"], "floor": 7}, {"capacity": 12}, "capacity", "room-"),
    "events": ({"name": "QA Event", "description": "qa", "date": "2026-09-20", "start_time": "10:00", "end_time": "11:00", "venue": "7A01", "organizer": "QA", "capacity": 5}, {"venue": "7A02"}, "venue", "evt-"),
    "announcements": ({"title": "QA Notice", "body": "qa body", "date": "2026-09-04", "priority": "low", "posted_by": "QA", "expires": "2026-09-30"}, {"priority": "high"}, "priority", "ann-"),
    "assignments": ({"course": "QA 101", "course_title": "QA", "title": "QA Asgn", "description": "qa", "assigned_date": "2026-09-01", "deadline": "2026-09-30", "submission_platform": "QA", "marks": 5}, {"marks": 7}, "marks", "asgn-"),
}
for ent, (body, patch, field, prefix) in crud.items():
    r = c.post(f"/api/{ent}", json=body)
    rid = j(r).get("id") if r.status_code == 200 else None
    check(f"POST {ent} -> id {prefix}NNN", r.status_code == 200 and str(rid).startswith(prefix), f"{r.status_code} {j(r)}")
    if rid:
        r = c.put(f"/api/{ent}/{rid}", json=patch)
        check(f"PUT {ent} partial update", r.status_code == 200 and j(r)[field] == patch[field], f"{r.status_code} {field}={j(r).get(field) if isinstance(j(r), dict) else j(r)}")
        r = c.delete(f"/api/{ent}/{rid}")
        check(f"DELETE {ent}", r.status_code == 200, r.status_code)
        check(f"{ent} gone after delete", all(x["id"] != rid for x in c.get(f"/api/{ent}").json()))

# ---------- validation: 4xx never 500
bad = [
    ("day=Friday", "/api/schedules", {**crud["schedules"][0], "day": "Friday"}, 400),
    ("time 25:99", "/api/schedules", {**crud["schedules"][0], "start_time": "25:99"}, 400),
    ("end before start", "/api/schedules", {**crud["schedules"][0], "start_time": "10:00", "end_time": "09:00"}, 400),
    ("missing fields", "/api/schedules", {"course": "X"}, 400),
    ("capacity='abc'", "/api/rooms", {**crud["rooms"][0], "capacity": "abc"}, 400),
    ("capacity=-5", "/api/rooms", {**crud["rooms"][0], "capacity": -5}, 400),
    ("equipment=string (coerced)", "/api/rooms", {**crud["rooms"][0], "equipment": "projector, AC"}, 200),
    ("equipment=number", "/api/rooms", {**crud["rooms"][0], "equipment": 42}, 400),
    ("duplicate room_number", "/api/rooms", {**crud["rooms"][0], "room_number": "7A01"}, 409),
    ("priority=urgent", "/api/announcements", {**crud["announcements"][0], "priority": "urgent"}, 400),
    ("expires before date", "/api/announcements", {**crud["announcements"][0], "expires": "2026-01-01"}, 400),
    ("marks=-1", "/api/assignments", {**crud["assignments"][0], "marks": -1}, 400),
    ("event capacity=0", "/api/events", {**crud["events"][0], "capacity": 0}, 400),
    ("10k-char title", "/api/announcements", {**crud["announcements"][0], "title": "x" * 10000}, 200),
    ("emoji body", "/api/announcements", {**crud["announcements"][0], "body": "🎉 ভালো"}, 200),
]
for name, path, body, expected in bad:
    r = c.post(path, json=body)
    check(f"validation: {name} -> {expected}", r.status_code == expected, f"{r.status_code} {str(j(r))[:100]}")
    if r.status_code == 200:
        c.delete(f"{path}/{r.json()['id']}")
r = c.put("/api/schedules/sch-999", json={"room": "X"})
check("PUT nonexistent -> 404", r.status_code == 404, r.status_code)
r = c.put("/api/events/evt-001", json={"registered": 0, "id": "evt-999"})
check("mass-assign registered/id ignored", r.status_code == 200 and j(r)["registered"] == 47 and j(r)["id"] == "evt-001", j(r) if r.status_code != 200 else "ok")
r = c.put("/api/events/evt-001", json={"capacity": 10})
check("capacity below registered -> 409", r.status_code == 409, f"{r.status_code} {j(r)}")

# ---------- bookings
r = c.post("/api/rooms/room-011/bookings", json={"date": "2026-09-05", "start_time": "14:30", "end_time": "15:30", "purpose": "QA"}, headers=QA)
check("overlap bk-002 -> 409 ROOM_CONFLICT", r.status_code == 409 and j(r)["error"] == "ROOM_CONFLICT", j(r))
r = c.post("/api/rooms/room-011/bookings", json={"date": "2026-09-05", "start_time": "16:00", "end_time": "17:00", "purpose": "QA"}, headers=QA)
check("adjacent slot 16:00-17:00 -> 200", r.status_code == 200, j(r))
bid = j(r).get("booking_id") if r.status_code == 200 else None
check("booked_by taken from identity header", bid and j(r)["booked_by"] == "QA Tester", j(r))
if bid:
    r = c.post("/api/rooms/room-011/bookings", json={"date": "2026-09-05", "start_time": "16:30", "end_time": "17:30", "purpose": "QA", "booked_by": "AUSTPIC"}, headers=QA)
    check("body booked_by ignored, conflict vs own booking -> 409", r.status_code == 409, j(r))
    r = c.delete(f"/api/rooms/room-011/bookings/{bid}", headers=ME)
    check("cancel someone else's booking -> 403", r.status_code == 403, j(r))
    r = c.delete(f"/api/rooms/room-011/bookings/{bid}", headers=QA)
    check("cancel own booking -> 200", r.status_code == 200, r.status_code)
r = c.delete("/api/rooms/room-017/bookings/bk-003", headers=ME)
check("cancel AUSTPIC bk-003 as student -> 403", r.status_code == 403, j(r))
r = c.post("/api/rooms/room-007/bookings", json={"date": "2026-09-06", "start_time": "13:00", "end_time": "14:00", "purpose": "QA"}, headers=QA)
check("class timetable conflict (CSE 4113 Sun 7A07) -> 409", r.status_code == 409 and "CSE 4113" in j(r)["detail"], j(r))
r = c.post("/api/rooms/room-007/bookings", json={"date": "2026-09-05", "start_time": "13:00", "end_time": "14:00", "purpose": "QA"}, headers=QA)
check("Saturday same slot -> 200 (no class)", r.status_code == 200, j(r))
if r.status_code == 200:
    c.delete(f"/api/rooms/room-007/bookings/{r.json()['booking_id']}", headers=QA)
r = c.post("/api/rooms/room-004/bookings", json={"date": "2026-09-06", "start_time": "17:00", "end_time": "18:00", "purpose": "QA"}, headers=QA)
check("event venue conflict (evt-003 7A04) -> 409", r.status_code == 409, j(r))
for name, body in [("bad date", {"date": "2026-13-45", "start_time": "10:00", "end_time": "11:00", "purpose": "x"}),
                   ("time 9:00", {"date": "2026-09-08", "start_time": "9:00", "end_time": "11:00", "purpose": "x"}),
                   ("start==end", {"date": "2026-09-08", "start_time": "10:00", "end_time": "10:00", "purpose": "x"})]:
    r = c.post("/api/rooms/room-001/bookings", json=body, headers=QA)
    check(f"booking {name} -> 400", r.status_code == 400, j(r))

# ---------- registrations
r = c.post("/api/events/evt-006/registrations", headers=QA)
check("register full evt-006 -> 409 EVENT_FULL", r.status_code == 409 and j(r)["error"] == "EVENT_FULL", j(r))
r = c.post("/api/events/evt-002/registrations", headers=ME)
check("duplicate registration -> 409", r.status_code == 409 and j(r)["error"] == "ALREADY_REGISTERED", j(r))
r = c.post("/api/events/evt-004/registrations", headers=QA)
check("register evt-004 -> registered 23", r.status_code == 200 and j(r)["registered"] == 23, j(r).get("registered") if r.status_code == 200 else j(r))
r = c.delete("/api/events/evt-004/registrations/99-00001", headers=ME)
check("cancel other's registration -> 403", r.status_code == 403, j(r))
r = c.delete("/api/events/evt-004/registrations/99-00001", headers=QA)
check("cancel own -> registered 22", r.status_code == 200 and j(r)["registered"] == 22, j(r).get("registered") if r.status_code == 200 else j(r))
r = c.post("/api/events", json={**crud["events"][0], "capacity": 1})
eid = r.json()["id"]
r = c.post(f"/api/events/{eid}/registrations", headers=QA)
check("cap-1 event flips to full", j(r)["status"] == "full", j(r).get("status"))
r = c.post(f"/api/events/{eid}/registrations", headers=ME)
check("second register -> 409", r.status_code == 409, j(r))
r = c.delete(f"/api/events/{eid}/registrations/99-00001", headers=QA)
check("cancel flips back to upcoming", j(r)["status"] == "upcoming", j(r).get("status"))
c.delete(f"/api/events/{eid}")

# ---------- search freshness + SQLi
orig = next(a for a in c.get("/api/announcements").json() if a["id"] == "ann-007")["body"]
c.put("/api/announcements/ann-007", json={"body": orig + " ZEBRAFISH"})
time.sleep(0.5)
r = c.get("/api/search", params={"q": "ZEBRAFISH"})
check("search finds fresh edit (keyword leg)", any(x["entity_id"] == "ann-007" for x in r.json()), [x["entity_id"] for x in r.json()])
c.put("/api/announcements/ann-007", json={"body": orig})
r = c.get("/api/search", params={"q": "water problems in building 7"})
check("semantic search: water problems -> ann-008 top", r.json() and r.json()[0]["entity_id"] == "ann-008", [x["entity_id"] for x in r.json()][:3])
r = c.get("/api/search", params={"q": "');DROP TABLE schedules;--"})
check("SQLi via search harmless", r.status_code == 200 and len(c.get("/api/schedules").json()) == 24, r.status_code)
r = c.get("/api/schedules", params={"course": "' OR 1=1 --"})
check("SQLi via filter harmless", r.status_code == 200 and r.json() == [], j(r))

# ---------- agent error path + routing
r = c.post("/api/agent/chat", json={"messages": [{"role": "user", "content": "When is my next class?"}]}, headers=ME)
check("agent w/ placeholder key -> clean JSON error, not 500", r.status_code == 200 and j(r).get("agent") == "error" and "OPENROUTER_API_KEY" in j(r).get("reply", ""), j(r))
r = c.post("/api/agent/chat", json={"messages": []}, headers=ME)
check("agent empty messages -> 400", r.status_code == 400, j(r))
r = c.get("/api/doesnotexist")
check("/api/unknown -> JSON 404 with error key", r.status_code == 404 and j(r).get("error") == "NOT_FOUND", j(r))
r = c.post("/api/rooms", content=b"{bad json", headers={"Content-Type": "application/json"})
check("malformed JSON -> 422 not 500", r.status_code == 422, r.status_code)

# ---------- SSE fan-out
import threading  # noqa: E402

got = []
def listen():
    try:
        with c.stream("GET", "/api/stream", timeout=8) as s:
            for line in s.iter_lines():
                if line.startswith("data:"):
                    got.append(line); break
    except Exception as exc:  # noqa: BLE001
        got.append(f"ERR {exc}")
t = threading.Thread(target=listen, daemon=True); t.start(); time.sleep(1)
c.put("/api/announcements/ann-007", json={"body": orig})
t.join(8)
check("SSE event delivered on mutation", got and '"entity": "announcements"' in got[0], got)

# ---------- final counts
for ent, n in SEED.items():
    check(f"cleanup: {ent} back to {n}", len(c.get(f"/api/{ent}").json()) == n, len(c.get(f"/api/{ent}").json()))
bk = [b["booking_id"] for r_ in c.get("/api/rooms").json() for b in r_["bookings"]]
check("seed bookings intact", sorted(bk) == ["bk-001", "bk-002", "bk-003"], bk)

# ---------- report
w = max(len(n) for n, _, _ in results)
for name, ok, ev in results:
    print(f"{'PASS' if ok else 'FAIL'}  {name.ljust(w)}  {ev if not ok else ''}")
p = sum(1 for _, ok, _ in results if ok)
print(f"\n{p}/{len(results)} passed")
sys.exit(0 if p == len(results) else 1)
