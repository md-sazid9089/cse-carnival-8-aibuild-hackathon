# CampusOS — AUST CSE Campus Platform + AI Agent

**Live demo:** [cse-carnival-8-aibuild-hackathon.vercel.app](https://cse-carnival-8-aibuild-hackathon.vercel.app/) · **API:** [cse-carnival-8-aibuild-hackathon.onrender.com](https://cse-carnival-8-aibuild-hackathon.onrender.com/api/meta)

> ⏳ The free-tier backend sleeps when idle — the **first request can take 30–60 s** while it wakes up.

## Overview

CampusOS keeps a student's campus life in one place: class schedules, rooms (with booking), events (with registration), announcements, and assignment deadlines — all stored in PostgreSQL and managed through a live dashboard. On top sits an **AI agent with real function calling**: it answers questions and takes actions (book a room, register for an event) by calling typed tools that read and write the same live database the dashboard uses. Nothing is cached — edit a record in the dashboard and the agent knows about it on the very next message.

The agent runs as a **single tool-calling loop** over one typed toolset: read tools answer, write tools act, and every write is authorized and validated by the same service layer the REST API uses. A provider gateway cycles a pool of API keys across an ordered model chain, so one exhausted free-tier key never takes the assistant down; if every provider fails, the agent still answers read-only questions straight from the database and refuses to act.

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | Python 3.12+, FastAPI, uvicorn |
| Database | PostgreSQL 16 + pgvector (Docker Compose locally, Neon in production) |
| LLM | OpenRouter — ordered chain of `z-ai/glm-5.2:free`, `minimax/minimax-m3:free`, `nvidia/nemotron-3.5-lightning:free`, OpenAI-standard `tools`/`tool_calls` |
| Search | Hybrid: Postgres full-text (`tsvector`) + local embeddings (fastembed, `bge-small-en-v1.5`) fused with Reciprocal Rank Fusion |
| Frontend | React 18, Vite, Tailwind CSS 4, SSE for live updates |
| Deploy | Vercel (frontend) + Render (API) + Neon (Postgres) |

## Run Locally

Prerequisites: **Node 18+**, **Python 3.12+**, **Docker Desktop** (or any Postgres 16 with pgvector).

```bash
git clone https://github.com/md-sazid9089/cse-carnival-8-aibuild-hackathon.git
cd cse-carnival-8-aibuild-hackathon

# 1. Database (Docker; or set DATABASE_URL to any pgvector-enabled Postgres, e.g. free Neon)
docker compose up -d

# 2. Environment
cp .env.example .env        # then edit .env: set OPENROUTER_API_KEYS (free key at openrouter.ai)

# 3. Backend  (Windows: .venv\Scripts\activate)
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# first boot: runs migrations, seeds the database from data/*.json, downloads the embedding model

# 4. Frontend (new terminal)
cd client
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` to the backend on port 8000.

## Environment Variables

Copy [.env.example](.env.example) to `.env` (repo root). Never commit `.env`.

| Key | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string (default matches docker-compose.yml, port **5433**) |
| `OPENROUTER_API_KEYS` | yes (for chat) | Comma-separated OpenRouter keys; the gateway cycles them so free-tier quota multiplies (`OPENROUTER_API_KEY` also accepted) |
| `OPENROUTER_MODELS` | no | Ordered model chain tried across every healthy key |
| `AGENT_DEGRADED_MODE` | no | `1` = answer read-only questions from live data when every provider fails |
| `EMBEDDINGS_ENABLED` | no | `0` = keyword-only search (saves ~200 MB RAM) |
| `ALLOWED_ORIGINS` | no | Extra CORS origins for a separately hosted frontend (comma-separated) |
| `AUTH_SECRET` | no | Signing key for sign-in session tokens (unset = random per process, so restarts end sessions) |
| `TZ_NAME` | no | Timezone for "today/tomorrow" resolution (default `Asia/Dhaka`) |
| `VITE_API_BASE` | deploy only | (Frontend, [client/.env.example](client/.env.example)) base URL of the hosted API |

## Using the Agent

Chat lives in the right-hand panel. It always reads the live database and shows every tool call it makes as a chip above the answer. Try:

- *"When is my next class?"* — cross-checks announcements for reschedules automatically
- *"What assignments do I have due this week?"*
- *"Which labs have a projector and can fit at least 30 people?"*
- *"Book Room 7A02 tomorrow from 3 PM to 5 PM."* — verifies the slot is free (bookings ∪ timetable ∪ events) before booking
- *"Register me for the Guest Lecture on Deep Learning."* — registers the active profile; refuses full/cancelled events
- *"Just book me any room."* — deliberately vague: the agent asks for details instead of acting

Switch the acting student with the **"Acting as"** selector (bottom-left). Authorization is enforced server-side: you can only cancel your own bookings and registrations, and capacity/conflict rules cannot be bypassed by any phrasing — booking overlaps are ultimately rejected by a database `EXCLUDE` constraint.

## Project Structure

```
backend/app/
  main.py            # FastAPI bootstrap: migrations + seeding on startup
  routers/api.py     # thin REST controllers (all 5 systems + agent + search + SSE)
  services/          # ALL business rules: validation, conflicts, authorization
  agents/            # single tool-calling agent, tool schemas, provider gateway (key pool + failover)
  search/            # hybrid tsvector + pgvector search, local embedder
  migrations/        # plain SQL, applied in order on boot
client/src/          # React dashboard + chat panel
data/                # seed JSON (read-only; loaded into Postgres on first boot)
```

## Deployment

- **API (Render)**: [render.yaml](render.yaml) blueprint — root dir `backend`, health check `/api/meta`. Set `DATABASE_URL` (Neon), `OPENROUTER_API_KEYS`, and `ALLOWED_ORIGINS` (your frontend URL).
- **Frontend (Vercel)**: root directory `client`, framework Vite. Set `VITE_API_BASE` to the Render URL (rebuild required after changing it).
