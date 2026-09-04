"""Single live turn - used sparingly to confirm the real model path while free quota lasts."""
import os
import sys

import httpx

B = os.getenv("CAMPUSOS_API", "http://127.0.0.1:8000").rstrip("/")
q = " ".join(sys.argv[1:]) or "What classes do I have on Wednesday?"

c = httpx.Client(base_url=B, timeout=180)
EMAIL, PW = "live.rubric@aust.edu", "live-rubric-pass"
r = c.post("/api/auth/signin", json={"email_or_id": EMAIL, "password": PW})
if r.status_code != 200:
    r = c.post("/api/auth/signup", json={"name": "Live Rubric", "email": EMAIL, "password": PW})
    r.raise_for_status()
c.headers["Authorization"] = f"Bearer {r.json()['token']}"

d = c.post("/api/agent/chat", json={"message": q}).json()
print(f"Q: {q}")
print(f"agent: {d.get('agent')}  tools: {[t['tool'] for t in d.get('tool_calls', [])]}")
print("reply:", (d.get("reply") or "")[:700])
