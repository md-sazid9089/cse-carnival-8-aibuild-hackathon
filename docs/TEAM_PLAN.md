# CampusOS — Team Plan (deadline: 8:30 PM, 4 Sep)

Base scaffold is committed and runnable (see README "Run It" section). Everything below is refinement, hardening, and shipping. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first — it maps every choice to the marking rubric.

## Who owns what

### Tayeb — AI Chatbot + UI Refinement

**Chatbot (`backend/app/agents/`, `client/src/components/ChatPanel.jsx`)**

- Tune the three prompts in `agents/prompts.py` against real model behavior (GLM 5.2 + Lightning router). Router misclassification is the top risk — test all 5 intents.
- Run the full battery in `sample_queries/sample_queries.md` + the traps:
  - "Book me any room tomorrow" → must ask, never book
  - Register for the Git workshop (evt-006) → must refuse (full)
  - "Where is my CSE 4113 class Sunday?" → must reflect ann-001 reschedule
  - Cancel booking bk-003 (booked by AUSTPIC) → must refuse
- If GLM free endpoint is slow/flaky during testing: flip `OPENROUTER_MODEL`, or set `FALLBACK_SINGLE_AGENT=1` and compare quality.
- Confirmation flow: Coordinator should restate action before writing when params came from context (not verbatim).
  **UI refinement (whole `client/`)**
- Polish pass: spacing, empty states, mobile/tablet breakpoints, dark-mode-ish sidebar consistency, loading skeletons instead of "Loading…".
- Chat: auto-scroll on every message, Enter-to-send is done, add expandable tool-call args on chip click.

### Shehab — E2E Testing + Workflow Fixes + Data Consistency

- Write the judge-simulation script (Python + httpx against `localhost:8000`, or Playwright if time): every sample query via `/api/agent/chat`, every CRUD path, both refusal traps, and the **mid-eval edit drill**: PUT an announcement → immediately ask the agent → answer must reflect the edit.
- Verify persistence: create/edit/delete each entity → restart backend → data intact (never reseeds a non-empty DB).
- Consistency sweeps:
  - SSE: change data in one browser tab, second tab must update without refresh (all 5 sections + overview).
  - `registered` count vs registrations rows after register→cancel→register cycles; `full` status flips both ways.
  - Booking conflicts vs class timetable (e.g. 7A07 Sunday 13:00 clashes with CSE 4113) and vs events (7C02 on 2026-09-06 15:00–18:00 clashes with bk-003... verify both bookings and events legs).
  - Ghost rooms `7C07`/`9A05` in schedules must not crash room lookups or find_free_rooms.
  - Expired announcements hidden from agent by default but visible in dashboard.
- Fix whatever you find; you own `backend/app/services/` and `routers/`.

### Sazid — Deployment + Data Plumbing + Submission

- **Local run reliability** (the "doesn't start = not judged" gate): fresh-clone test on a second machine — Docker path AND Neon path. Fix any friction; keep README exact.
- **Deploy (bonus marks)**: Neon free Postgres (enable `vector` extension) + Render/Railway: build client (`npm run build`), start uvicorn (FastAPI serves `client/dist`). Set env vars; verify seeding + agent on the deployed URL.
- Watch: fastembed model download on first boot (~100 MB) — if the host blocks it, set `EMBEDDINGS_ENABLED=0` (search degrades gracefully).
- **Submission ops**: repo public before 8:30 PM, README final (overview/stack/setup/env/agent usage — template below), `.env` never committed, Google Form submission, live URL in README.
- OpenRouter account: top up $10 once if possible → free-model cap 50 req/day → ~1000 (protects judging).

## Coordination rules

- Base is on `main`; branch per person (`tayeb/agents`, `shehab/testing`, `sazid/deploy`), small PRs, merge fast — no long-lived branches today.
- All business rules live in `backend/app/services/` — never bypass them from routers or agent tools.
- Any schema change goes in a new `backend/app/migrations/00X_*.sql` file (never edit 001).
- Ping the group before touching another owner's area.

## Milestones (today)

1. Everyone: fresh clone + run locally, smoke-test one CRUD + one agent query.
2. Mid-afternoon: Shehab's test script green locally; Tayeb's sample-query battery passes; Sazid has staging deploy.
3. 7:00 PM: feature freeze — only fixes. Full judge simulation on the deployed + local build.
4. 8:00 PM: repo public, README final, form submitted. Do not cut it to 8:29.
