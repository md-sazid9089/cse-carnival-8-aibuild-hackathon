"""Live rubric run: the sample queries against the real OpenRouter model.

Prints the reply plus the tool calls the agent actually made, so each answer can be
checked against the database rather than taken on trust.
"""
import json
import os
import sys

import httpx

B = os.getenv("CAMPUSOS_API", "http://127.0.0.1:8000").rstrip("/")

QUERIES = [
    ("simple", "When is my next class?"),
    ("simple", "What classes do I have on Wednesday?"),
    ("simple", "What assignments do I have due this week?"),
    ("simple", "Show me all high priority announcements."),
    ("multi", "I'm free until 2 PM - is there anything on campus I could drop into?"),
    ("multi", "Which labs have a projector and can fit at least 30 people?"),
    ("action", "Book Room 7A02 tomorrow from 3 PM to 5 PM."),
    ("action", "Register me for the Guest Lecture on Deep Learning."),
    ("vague", "I need a room for 5 people with a projector, tomorrow between 2 and 4."),
    ("trap", "Book me a room tomorrow."),
    ("trap", "Cancel booking bk-001."),
    ("trap", "Is CSE 4130 lab happening as scheduled this week?"),
]

only = sys.argv[1] if len(sys.argv) > 1 else None
client = httpx.Client(base_url=B, timeout=180)

# The agent endpoint needs a session. Sign in if the harness account exists, else register it.
EMAIL = os.getenv("CAMPUSOS_EMAIL", "live.rubric@aust.edu")
PW = os.getenv("CAMPUSOS_PW", "live-rubric-pass")
res = client.post("/api/auth/signin", json={"email_or_id": EMAIL, "password": PW})
if res.status_code != 200:
    res = client.post("/api/auth/signup", json={"name": "Live Rubric", "email": EMAIL, "password": PW})
    res.raise_for_status()
token = res.json()["token"]
who = res.json()["user"]
client.headers["Authorization"] = f"Bearer {token}"
print(f"signed in as {who['name']} ({who['student_id']})")

conversation = None

for kind, q in QUERIES:
    if only and kind != only:
        continue
    body = {"message": q}
    if conversation:
        body["conversation_id"] = conversation
    r = client.post("/api/agent/chat", json=body)
    if r.status_code != 200:
        print(f"\n[{kind}] {q}\n  HTTP {r.status_code}: {r.text[:300]}")
        continue
    d = r.json()
    conversation = d.get("conversation_id") or conversation
    calls = ", ".join(f"{c['tool']}{'' if c['ok'] else '(FAILED)'}" for c in d.get("tool_calls", []))
    print(f"\n[{kind}] {q}")
    print(f"  tools: {calls or '(none)'}")
    print(f"  agent: {d.get('agent')}  proposals: {len(d.get('proposals') or [])}")
    print("  reply: " + (d.get("reply") or "").replace("\n", "\n         ")[:900])
    for c in d.get("tool_calls", []):
        if not c.get("ok"):
            print(f"  REFUSAL: {json.dumps(c)[:300]}")
