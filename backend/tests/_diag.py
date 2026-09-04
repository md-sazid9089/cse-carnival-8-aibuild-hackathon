import json, httpx
B = "http://localhost:8000"
c = httpx.Client(timeout=30)

def show(label, r):
    print(f"\n== {label}: {r.status_code}\n{r.text[:300]}")

show("adjacent booking 16-17", c.post(f"{B}/api/rooms/room-011/bookings", json={"date":"2026-09-05","start_time":"16:00","end_time":"17:00","purpose":"QA","booked_by":"QA"}))
show("timetable conflict body", c.post(f"{B}/api/rooms/room-007/bookings", json={"date":"2026-09-06","start_time":"13:00","end_time":"14:00","purpose":"QA","booked_by":"QA"}))
show("evt-006 full body", c.post(f"{B}/api/events/evt-006/registrations", json={"student_id":"99","name":"QA"}))
show("/api/unknown", c.get(f"{B}/api/doesnotexist"))
show("agent bad key", c.post(f"{B}/api/agent/chat", json={"messages":[{"role":"user","content":"hi"}],"profile":{"student_id":"1","name":"QA"}}))
print("\nbookings:", c.get(f"{B}/api/rooms").json() and [ (b["booking_id"], b["booked_by"]) for r in c.get(f"{B}/api/rooms").json() for b in r["bookings"] ])
print("rooms count:", len(c.get(f"{B}/api/rooms").json()))
