"""Time the write-action turns against a running server (rubric 'actions' line)."""
import os
import time

import httpx

B = os.getenv("CAMPUSOS_API", "http://127.0.0.1:8000").rstrip("/")
c = httpx.Client(base_url=B, timeout=240)
r = c.post("/api/auth/signin", json={"email_or_id": "live.rubric@aust.edu", "password": "live-rubric-pass"})
if r.status_code != 200:
    r = c.post("/api/auth/signup", json={"name": "Live Rubric", "email": "live.rubric@aust.edu",
                                         "password": "live-rubric-pass"})
r.raise_for_status()
c.headers["Authorization"] = "Bearer " + r.json()["token"]

for q in ["Book Room 7A02 tomorrow from 3 PM to 5 PM.",
          "Register me for the Guest Lecture on Deep Learning."]:
    t = time.time()
    a = c.post("/api/agent/chat", json={"message": q})
    d = a.json()
    print(f"--- {q}  [{time.time() - t:.1f}s http{a.status_code}]")
    print("  agent=", d.get("agent"))
    print("  tools=", [(x["tool"], x["ok"]) for x in d.get("tool_calls", [])])
    print("  reply=", (d.get("reply") or "")[:400])
