# CampusOS — AI Build Hackathon

An intelligent university platform powered by an AI agent that understands and acts on real-time campus data.

---

## The Challenge

Students struggle daily with scattered campus information — class changes buried in group chats, deadlines forgotten until the last minute, no easy way to know what's happening on campus right now.

Your job: build **CampusOS** — a two-part app with a data dashboard and an AI agent that always reads live data.

Read the full problem statement → [`PROBLEM_STATEMENT.md`](./PROBLEM_STATEMENT.md)

---

## Repository Structure

```
campusos-hackathon/
│
├── README.md                    ← You are here
├── PROBLEM_STATEMENT.md         ← Full problem statement + scoring
├── SUBMISSION.md                ← How and where to submit
│
├── data/                        ← Seed data (load these into your backend)
│   ├── schedules.json
│   ├── rooms.json
│   ├── events.json
│   ├── announcements.json
│   └── assignments.json
│
├── schema/
│   └── schema.md                ← Field names, types, and constraints for all 5 systems
│
└── sample_queries/
    └── sample_queries.md        ← Queries we will use when judging your agent
```

---

## How to Participate

### 1. Fork the repository

Click **Fork** in the top-right corner of this repo's GitHub page. This creates your own copy under your GitHub account, where you'll build your solution.

### 2. Clone your fork

```bash
git clone https://github.com/YOUR_USERNAME/campusos-hackathon.git
cd campusos-hackathon
```

### 3. Build your solution inside your fork

> Your solution lives in your fork — do not open a pull request to this repo.

### 4. Making your fork private

By default, a fork is public. If you want to keep your work hidden from other participants while you build:

1. Go to your fork on GitHub
2. Open **Settings** (top of the repo page)
3. Scroll to the **Danger Zone** at the bottom
4. Click **Change repository visibility** → **Make private**
5. Confirm by typing the repository name

> **You may keep your fork private during the hackathon period, but it must be switched back to public by 8:30 PM on the submission deadline.** Repositories still private after that time will not be judged. To make it public again, repeat the steps above and choose **Make public** instead.

### 5. Submit

Submit your fork's public URL via the instructions in [`SUBMISSION.md`](./SUBMISSION.md).

---

## Quick Links

| Resource               | Link                                                                     |
| ---------------------- | ------------------------------------------------------------------------ |
| Full problem statement | [`PROBLEM_STATEMENT.md`](./PROBLEM_STATEMENT.md)                         |
| Data schema            | [`schema/schema.md`](./schema/schema.md)                                 |
| Sample agent queries   | [`sample_queries/sample_queries.md`](./sample_queries/sample_queries.md) |
| Submission guide       | [`SUBMISSION.md`](./SUBMISSION.md)                                       |

---

## Seed Data Overview

| File                 | Records | What It Contains                                                  |
| -------------------- | ------- | ----------------------------------------------------------------- |
| `schedules.json`     | 24      | Class timetable — course, day, time, room, instructor             |
| `rooms.json`         | 20      | Rooms 7A01–7A07, 7B01–7B08, 7C01–7C05 with equipment and bookings |
| `events.json`        | 7       | Campus events with registration lists                             |
| `announcements.json` | 8       | Notices with priority levels and expiry dates                     |
| `assignments.json`   | 8       | Course assignments with deadlines and submission status           |

> **Important:** These JSON files are only the starting/seed data — not the database itself. Load them into a real backend (a database, or at minimum a backend service with persistent storage) on app startup. Your dashboard and AI agent must both read from and write to that backend, not the static JSON files directly. If you add, edit, or delete a record, the change must be saved in your backend and still be there after a reload — the JSON files in this repo will not update. The agent is also expected to always query the current backend state, not a cached or hardcoded copy of the seed data.

---

Good luck. Build something that actually works.

---

# Our Solution — CampusOS

Full-stack implementation: **FastAPI (Python) + PostgreSQL/pgvector + React (Vite + Tailwind)** with a **multi-agent AI assistant** (Router → Analyst/Coordinator over OpenRouter) that does real function calling against the live database. Design rationale: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) · Team split: [TEAM_PLAN.md](./TEAM_PLAN.md)

## Tech Stack

| Layer    | Tech                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| Backend  | Python 3.11+, FastAPI, psycopg3 (plain SQL, no ORM)                                                                      |
| Database | PostgreSQL 16 + pgvector (Docker) — seeded from `data/*.json` on first boot                                              |
| AI       | OpenRouter — `z-ai/glm-5.2:free` specialists + `nvidia/nemotron-3.5-lightning:free` router; local `fastembed` embeddings |
| Search   | Hybrid: Postgres `tsvector` + pgvector cosine, fused with Reciprocal Rank Fusion                                         |
| Frontend | React 18, Vite, Tailwind CSS 4; live updates via Server-Sent Events                                                      |

## Run It

Prereqs: **Node 18+**, **Python 3.11+**, **Docker** (or any hosted Postgres URL, e.g. free [Neon](https://neon.tech) — pgvector supported).

```bash
# 1. Database
docker compose up -d

# 2. Environment
cp .env.example .env          # then put your OpenRouter API key in .env

# 3. Backend deps (use a venv)
python -m venv .venv
.venv\Scripts\activate        # Windows   |   source .venv/bin/activate  # macOS/Linux
pip install -r backend/requirements.txt

# 4. Frontend deps + run everything (backend :8000 + frontend :5173)
npm install
cd client && npm install && cd ..
npm run dev
```

Open **http://localhost:5173**. Migrations + seeding run automatically on first boot; data persists across restarts.

Production build: `npm run build && npm start` → FastAPI serves the built client at http://localhost:8000.

## Environment Variables (`.env`)

| Key                       | Required | Notes                                                       |
| ------------------------- | -------- | ----------------------------------------------------------- |
| `DATABASE_URL`            | yes      | Default matches `docker-compose.yml`                        |
| `OPENROUTER_API_KEY`      | yes      | Free at openrouter.ai/settings/keys                         |
| `OPENROUTER_MODEL`        | no       | Specialist model (default `z-ai/glm-5.2:free`)              |
| `OPENROUTER_ROUTER_MODEL` | no       | Router model (default `nvidia/nemotron-3.5-lightning:free`) |
| `FALLBACK_SINGLE_AGENT`   | no       | `1` = single-agent loop instead of orchestration            |
| `EMBEDDINGS_ENABLED`      | no       | `0` = keyword-only search (no model download)               |

## Using the Agent

Chat panel is docked on the right. It reads/writes the **live database** through function calling — edit anything in the dashboard and ask about it immediately. Try:

- "When is my next class?" (cross-checks announcements for reschedules)
- "Which labs have a projector and can fit at least 30 people?"
- "Book Room 7A02 tomorrow from 3 PM to 5 PM." (verifies conflicts first)
- "Register me for the Guest Lecture on Deep Learning."
- "Just book me any room" → it will ask for specifics instead of guessing
- Anything fuzzy: "any announcements about water problems?" (hybrid search)

Each reply shows **which agent** handled it (router / analyst / coordinator) and chips for every **tool call** made — proof of real function calling.

## Team

| Member     | Ownership                                                          |
| ---------- | ------------------------------------------------------------------ |
| **Tayeb**  | AI chatbot (agents, prompts, tool calling) + UI refinement         |
| **Shehab** | E2E testing, workflow fixes, data consistency, backend correctness |
| **Sazid**  | Deployment (Docker/Neon/Render), run reliability, submission ops   |
