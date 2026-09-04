# CampusOS — Implementation Plan (Production-Ready, PWA, Single-Agent)

**Status:** PLAN ONLY — nothing in this document is implemented yet. Every work package below must follow `AGENTS.md` (read docs → implement → Multi-Agent QA loop ≥ 9/10 → report) before it is considered done.
**Supersedes:** the task lists in `TEAM_PLAN.md` (its coordination rules still apply).
**Scoring reference:** R1–R13 in `docs/ARCHITECTURE.md` §1.

---

## 0. Two decisions this plan locks in

| Decision | What changes | Why |
| --- | --- | --- |
| **Single-agent, no multi-agent orchestration** | Delete Router/Analyst/Coordinator (`agents/orchestrator.py`). One tool-calling loop with **all 12 tools**, one system prompt that merges the Analyst + Coordinator rules (cross-check announcements, never guess missing params, refuse others' resources, relay `ok:false` honestly). Remove `FALLBACK_SINGLE_AGENT` and `OPENROUTER_ROUTER_MODEL`; keep `OPENROUTER_MODEL` + new `OPENROUTER_FALLBACK_MODEL` (OpenRouter `models: [...]` array). | Fewer LLM round-trips per turn (lower latency), one prompt to tune, fewer failure modes. Rubric R5–R8 are won by tool design + service-layer rules, not by routing. |
| **PWA, mobile-first** | Installable app (manifest + service worker), offline app-shell, responsive layout that works on phones (bottom tab bar, card lists, full-screen sheets), HTTPS deploy. **Service worker never caches `/api/*`** (invariant R7: judges edit data mid-eval). | "Usable on mobile" + installability is a strong UI/UX (R10) differentiator and a deployment (R13) showcase. |

---

## 1. Current state (verified 2026-09-04)

**Done and tested (83/83 API smoke tests green, UI verified in browser):**
- FastAPI + Postgres/pgvector (Docker, host port **5433**), migrations + idempotent seeding, all 5 CRUD systems, bookings/registrations sub-resources with conflict/capacity/ownership rules, DB `EXCLUDE` constraint, identity via `X-Student-Id`/`X-Student-Name` headers, `DomainError`/IntegrityError/unhandled → clean JSON, JSON 404 for `/api/*`, `/api/meta` (server time/TZ), SSE hub, hybrid search (tsvector + pgvector + RRF), `fastembed` local embeddings with graceful degradation.
- React 18 + Vite + Tailwind 4 client: Overview (server-TZ aware), config-driven CRUD pages, Rooms (book/cancel drawer), Events (register/unregister, capacity bars), collapsible ChatPanel with tool-call chips, skeletons, toasts, profile switcher, `end_date` default, submit-busy state.
- Root: `docker-compose.yml`, `package.json` dev runner, `.env.example`, README "Our Solution", `AGENTS.md`/`CLAUDE.md`, `backend/tests/smoke_api.py`.

**Not done:** single-agent refactor, streaming, PWA, mobile layout, Pydantic request models, pytest/Playwright suites, CI, Dockerfile, cloud deploy, health endpoints, rate limiting, structured logging, docs sync after the two decisions above.

**Known bugs to fix (found by QA, not yet fixed):**
1. `announcements.list` (`expires >= CURRENT_DATE`) and `assignments.list` (`deadline BETWEEN CURRENT_DATE …`) use the **Postgres server date (UTC)**, not the app's `Asia/Dhaka` date → wrong results between 00:00–06:00 Dhaka. Pass the app-computed date as a parameter.
2. `/api/agent/chat` is a **sync** endpoint doing a 90 s HTTP call → exhausts the default 40-thread pool under concurrent judges. Make it `async` with `httpx.AsyncClient`.
3. Chat has no streaming / timeout feedback — user stares at "Agents working…" for up to 90 s.
4. `window.confirm` used for deletes (not accessible, blocks PWA feel).
5. `CORS allow_origins` hardcoded to `localhost:5173`; must come from env for any deployed preview origin.

---

## 2. Work packages

Priority: **P0** = must ship for judging (today, freeze 7:00 PM) · **P1** = production hardening (next) · **P2** = polish.
Each WP lists owner, files, acceptance criteria (AC), and rubric lines served.

### 2.1 Tayeb — AI Agent + Frontend/PWA

| WP | Pri | Scope | Files | Acceptance criteria |
| --- | --- | --- | --- | --- |
| **A1 Single-agent refactor** | P0 | Delete `orchestrator.py`; `loop.py` becomes `agent.py` with `run(history, profile)`; one merged prompt in `prompts.py`; `tools.py` exposes `ALL_TOOLS` only; response `{reply, tool_calls, agent:"assistant"}`; remove `FALLBACK_SINGLE_AGENT`, `OPENROUTER_ROUTER_MODEL`; add `OPENROUTER_FALLBACK_MODEL` via `models` array; async `httpx.AsyncClient` (fixes bug #2); retry 429/5xx ×2 with backoff; clean structured error `{reply, agent:"error", error}` on provider failure (never 500). | `backend/app/agents/*`, `routers/api.py`, `config.py`, `.env.example`, `docs/ARCHITECTURE.md §6`, `README` | All `sample_queries.md` answered correctly with real key; "book me any room" → asks; evt-006 → refused; bk-003 cancel → refused; ann-001 cross-check works; provider 401 → clean JSON. R5–R9 |
| **A2 Streaming chat** | P0 | `POST /api/agent/chat/stream` → SSE events `tool_call`, `tool_result`, `token`, `done`, `error`; client renders tokens progressively and tool chips live; `AbortController` cancel button; "still working…" notice at 15 s; non-stream endpoint kept for tests. | `agents/agent.py`, `routers/api.py`, `client/src/components/ChatPanel.jsx`, `hooks.js` | First token visible < 3 s on GLM; cancel works; tool chips appear before the answer. R5, R10 |
| **A3 Prompt & behaviour tuning** | P0 | Confirmation protocol for writes when params were inferred; explicit refusal phrasing; date/relative-time hints ("tomorrow" = server date + 1, week Sun–Thu); history window (last 12 messages) + token budget; `max_tokens` 700, `reasoning.effort` env (`high`); markdown-lite answers (short bullets, concrete room/time/date). Run the full battery 3× to check consistency. | `agents/prompts.py`, `agents/agent.py` | Battery pass-rate ≥ 95% over 3 runs; no false "success" claims; answers cite tool data only. R5–R8 |
| **A4 Chat UX** | P1 | Safe markdown rendering (no raw HTML), conversation persisted per profile in `localStorage`, clear/copy, expandable tool args, quick prompts, scroll anchoring, iOS keyboard-safe input, empty/typing/error states, `aria-live` region. | `ChatPanel.jsx`, new `Markdown.jsx` | Works on 375 px viewport; screen reader announces replies. R10 |
| **A5 PWA** | P0 | `vite-plugin-pwa` (Workbox `generateSW`): manifest (`name`, `short_name`, `theme_color`, `background_color`, `display: standalone`, icons 192/512 + maskable, `start_url: /`), precache app shell (hashed assets), **`/api/*` = `NetworkOnly`** (no data caching — R7), `index.html`/`sw.js` no-cache, offline fallback page, update prompt ("New version — reload"), install button (`beforeinstallprompt`) + iOS "Add to Home Screen" hint, `apple-touch-icon`, `viewport-fit=cover`, offline banner that disables mutations, SSE auto-reconnect on regain. | `client/vite.config.js`, `client/public/*` (icons, `offline.html`), `client/src/pwa.js`, `index.html`, `App.jsx` | Lighthouse PWA installable ✓; Chrome/Android + iOS Safari install works on deployed HTTPS URL; killing network shows offline banner, no stale data ever served. R10, R13 |
| **A6 Mobile-first responsive layout** | P0 | Breakpoints: `<md` sidebar → bottom tab bar (5 tabs + Chat tab); chat becomes full-screen tab on mobile, dock on desktop; tables → card lists on `<md` (`DataTable` renders cards); modals → full-screen bottom sheets; touch targets ≥ 44 px; safe-area insets; no horizontal scroll at 360 px; profile switcher in a header menu. | `App.jsx`, `DataTable.jsx`, `RecordModal.jsx`, `ChatPanel.jsx`, `index.css` | Manual check at 360/390/768/1366 px; Playwright mobile viewport E2E green (B4). R10 |
| **A7 Accessibility & polish** | P1 | Accessible confirm dialog component (replaces `window.confirm`, bug #4), focus trap + ESC in modals, labelled icon buttons, badges with text + icon (not colour-only), contrast ≥ AA, `prefers-reduced-motion`, skeletons/empty states everywhere, optional dark mode via `prefers-color-scheme`. | `components/ConfirmDialog.jsx`, all pages | Lighthouse a11y ≥ 90; keyboard-only run through CRUD + chat succeeds. R10 |
| **A8 Frontend quality** | P1 | ESLint + Prettier config, React error boundary with retry, route-level code splitting, `VITE_API_BASE` env, bundle < 250 kB gz, Lighthouse perf ≥ 85 on deployed URL. | `client/*` | CI lint green; Lighthouse thresholds met. R13 |

### 2.2 Shehab — Backend correctness, testing, consistency

| WP | Pri | Scope | Files | Acceptance criteria |
| --- | --- | --- | --- | --- |
| **B1 Typed request/response models** | P0 | Pydantic models for every body (`ScheduleIn`, `RoomIn`, `BookingIn`, `EventIn`, `RegistrationIn`, `AnnouncementIn`, `AssignmentIn`, `ChatIn`) with enums, `HH:MM`/date regex, positive ints, max lengths, `equipment: list[str]`; `RequestValidationError` handler that returns the same `{error:"VALIDATION_ERROR", detail, fields}` shape; response models for OpenAPI; services keep their validation as second layer. | `backend/app/schemas.py`, `routers/api.py`, `main.py` | No input can produce a 500; `/docs` shows accurate schemas; smoke tests still green. R3, R11 |
| **B2 Service hardening** | P0 | Fix TZ bug #1 (compute "today" in app TZ, pass as param everywhere `CURRENT_DATE` is used); `end_date >= date`; positive capacity/marks/floor; trim strings; ID generation race-safe (Postgres advisory lock or `ON CONFLICT` retry); confirm cascades (room→bookings, event→registrations) and document ghost-room policy (schedules may reference unknown rooms; `find_free_rooms` ignores them); registrations: cancel only own (`X-Student-Id`) — verify; `list_*` optional `limit`/`offset`. | `services/*.py`, `db.py`, `migrations/002_*.sql` (indexes: `schedules(room,day)`, `events(venue,date)`, `bookings(date)`) | New pytest cases for each rule pass; migration 002 applies cleanly on fresh and existing DBs. R3, R4, R6 |
| **B3 pytest suite** | P0 | `pytest` + `httpx` `TestClient`; test DB via `TEST_DATABASE_URL` (separate DB in the same container) with per-test transaction rollback or truncate+reseed; port `smoke_api.py` into `tests/test_api_*.py`; unit tests for `conflict_reason`, `register`/`cancel_registration` status flips, `_next_class` across Sun–Thu/Fri/Sat, `hybrid_search` (keyword-only + vector), `dispatch` for every tool incl. bad args; agent loop tests with a **mocked OpenRouter** (recorded fixtures: tool_calls turn → final turn; 401; 429). Coverage ≥ 80% on `services/` and `agents/`. | `backend/tests/**`, `backend/pyproject.toml` (pytest, ruff config) | `pytest -q` green locally and in CI (C3). R3, R5–R8 |
| **B4 Playwright E2E** | P0 | Judge flows: CRUD on all 5 systems with reload persistence; book/cancel; register/unregister; **mid-eval edit drill** (edit announcement → ask agent → answer reflects it; uses real key in CI secret or mocked agent locally); vague → asks; full event → refuses; other's booking → refuses; SSE two-context live update; **mobile viewport** (Pixel 5) run of the core flows; PWA manifest + SW registered. Traces/screenshots on failure. | `e2e/**`, `playwright.config.ts` | `npx playwright test` green headless; runs in CI. R3, R7, R8, R10 |
| **B5 SSE & live-data robustness** | P1 | Heartbeat comment every 15 s (proxy keep-alive), client reconnect with full refetch, subscriber cap + cleanup on disconnect, event payload includes `ts`; verify search index updates synchronously and embeddings backfill within 2 s; bound the embedding thread pool (queue, not one thread per write). | `sse.py`, `search/indexer.py`, `client/src/hooks.js` | Two-tab test passes through the deployed proxy; no thread leak under 200 rapid writes. R3, R7 |
| **B6 Observability** | P1 | Request-ID middleware, structured JSON logs (method, path, status, ms, request_id), agent call log (model, latency, tool names, token usage — **no prompts/keys**), `GET /api/health` (DB ping, embedder state, model configured, version) and `GET /api/ready`; log level from env. | `main.py`, `middleware.py`, `agents/agent.py` | `/api/health` used by Docker/Render healthchecks (C1/C2); logs parseable. R13 |
| **B7 Security hardening** | P1 | Rate limiting (`slowapi`): `/api/agent/chat*` 20/min/IP, writes 60/min/IP; body size limit 64 kB; `ALLOWED_ORIGINS` env (bug #5); security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy` compatible with SW, `frame-ancestors 'none'`); validate identity headers (regex `^\d{2}-\d{5}$`, name ≤ 80 chars); `pip-audit` + `npm audit` clean; pre-commit secret scan. Document that identity is asserted, not authenticated (single-user demo) in README. | `main.py`, `config.py`, `.pre-commit-config.yaml` | Rate-limit returns 429 JSON; audits clean; CSP doesn't break PWA. R12 |
| **B8 Consistency sweep** | P0 | After A1: `docs/ARCHITECTURE.md` §2/§3/§6 describe single-agent; README agent section; `.env.example` keys match `config.py` exactly; `TEAM_PLAN.md` points here; remove dead code/env flags; `registered` integrity check script (`scripts/check_integrity.py`). | docs, `scripts/` | Grep for "router"/"orchestrat"/"FALLBACK_SINGLE_AGENT" returns nothing in code/docs. R13 |

### 2.3 Sazid — Deployment, infra, release, submission

| WP | Pri | Scope | Files | Acceptance criteria |
| --- | --- | --- | --- | --- |
| **C1 Containerization** | P0 | Multi-stage `Dockerfile` (node:20 builds `client/dist` → `python:3.12-slim` runtime, non-root user, `HEALTHCHECK` → `/api/health`), `.dockerignore`, `docker-compose.prod.yml` (app + db, named volumes), pre-download `fastembed` model into the image (or mounted cache volume) with `EMBEDDINGS_ENABLED=0` fallback documented. | `Dockerfile`, `.dockerignore`, `docker-compose.prod.yml` | `docker compose -f docker-compose.prod.yml up` serves the full app on `:8000` from a fresh clone. R11, R13 |
| **C2 Cloud deploy (HTTPS)** | P0 | Neon free Postgres (`CREATE EXTENSION vector, btree_gist`; verify `CREATE TYPE timerange` privilege — if denied, coordinate with Shehab for a `tsrange`/`int4range(minutes)` migration variant), Render (or Railway/Fly) web service from `Dockerfile`, env vars set, proxy buffering off for SSE, cold-start check, custom domain optional. **HTTPS is mandatory** for PWA install (A5). Deployed URL in README. | Render/Neon config, `render.yaml` | Deployed URL: seed present, CRUD persists, agent answers, SSE live, PWA installable on a phone. R13 |
| **C3 CI/CD** | P1 | GitHub Actions: `ruff` + `eslint`; `pytest` with Postgres service container (pgvector image); client build; Playwright smoke (mocked agent) with artifacts; Docker build; deploy hook on `main`. Branch protection, PR template with the AGENTS.md QA checklist, `CODEOWNERS` (Tayeb `client/`, `agents/`; Shehab `services/`, `routers/`, `tests/`, `e2e/`; Sazid infra/docs). | `.github/workflows/*.yml`, `.github/CODEOWNERS`, `.github/pull_request_template.md` | Green pipeline on a PR; failed tests block merge. R13 |
| **C4 Config & fail-fast** | P0 | `config.py` validates on boot: missing `DATABASE_URL` → clear exit; missing `OPENROUTER_API_KEY` → app runs, agent returns a friendly "not configured" reply (never crash); env docs table single-sourced in README; `PORT`, `TZ_NAME`, `LOG_LEVEL`, `ALLOWED_ORIGINS`, `EMBEDDINGS_ENABLED`, `OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODEL`. | `config.py`, `.env.example`, README | Boot with empty `.env` gives one actionable error line. R11, R12 |
| **C5 Local-run reliability** | P0 | Fresh-clone runs on Windows/macOS/Linux; `scripts/dev.ps1` + `scripts/dev.sh` (compose up → venv → pip → npm → run), port-conflict detection (5433/8000/5173), Python `>=3.11` pin (`pyproject.toml`), Node `engines`, README troubleshooting (Docker not running, native Postgres on 5432, fastembed download blocked → `EMBEDDINGS_ENABLED=0`, OpenRouter 429 daily cap). | `scripts/*`, `pyproject.toml`, README | A teammate on a clean machine reaches the dashboard in ≤ 10 min following README only. R11 |
| **C6 Static assets & performance** | P1 | Gzip/Brotli for static files, `Cache-Control: immutable` for hashed assets and `no-cache` for `index.html`/`sw.js`/`manifest.webmanifest`, generate PWA icon set (192/512/maskable/apple-touch) from one SVG, Lighthouse run on deployed URL (perf ≥ 85, PWA ✓). | `main.py` static config, `client/public/*` | Lighthouse report attached to README. R10, R13 |
| **C7 Ops runbooks** | P1 | `docs/RUNBOOK.md`: migrations & rollback, DB backup/restore (Neon PITR + `pg_dump` script), seed reset (`scripts/reset_db.py`, guarded by `CONFIRM_RESET=1`), key rotation, OpenRouter quota ($10 top-up → 1000 req/day; fallback model switch), incident checklist for judging day, uptime ping. | `docs/RUNBOOK.md`, `scripts/*` | Runbook exercised once end-to-end. R13 |
| **C8 Docs & submission** | P0 | README final: overview, stack, exact setup, env table, agent usage, PWA install steps, screenshots/GIF (desktop + mobile), live URL, architecture link; `SUBMISSION.md` checklist ticked; repo **public by 8:00 PM**; Google Form; demo script for judges (`docs/DEMO.md`: the 11 queries + 4 traps + mid-eval edit). | README, `docs/DEMO.md` | Checklist complete; link submitted with margin. R11–R13 |

---

## 3. Cross-team dependencies & handoffs

| Dependency | From → To | Contract |
| --- | --- | --- |
| Chat response shape after single-agent | A1 (Tayeb) → B3/B4 (Shehab) | `{reply, tool_calls:[{tool,args,ok}], agent:"assistant"|"error", error?}`; stream events `tool_call`/`tool_result`/`token`/`done`/`error` |
| Validation error shape | B1 (Shehab) → client `api.js` (Tayeb) | Always `{error, detail, fields?}`; client shows `detail`, highlights `fields` |
| `/api/health` | B6 (Shehab) → C1/C2 (Sazid) | 200 `{status:"ok", db:true, embedder:"ready|disabled|loading", model}` |
| HTTPS deploy | C2 (Sazid) → A5 (Tayeb) | PWA install can only be verified on the deployed URL |
| Neon `CREATE TYPE` privilege | C2 (Sazid) → B2 (Shehab) | If denied, migration variant using built-in range type |
| Playwright suite | B4 (Shehab) → C3 (Sazid) | Runs headless in CI with mocked agent; real-key run manual before submission |
| Docs sync | A1 → B8 → C8 | Shehab sweeps docs after Tayeb's refactor; Sazid finalizes README last |

---

## 4. Timeline

**Phase 1 — judging day (today), freeze 7:00 PM, submit by 8:00 PM**

| Slot | Tayeb | Shehab | Sazid |
| --- | --- | --- | --- |
| Now → +2 h | A1 single-agent refactor, A3 battery pass 1 | B1 Pydantic models, B2 TZ bug + hardening | C1 Dockerfile, C4 fail-fast config, C5 dev scripts |
| +2 → +4 h | A2 streaming, A6 mobile layout | B3 pytest suite green | C2 Neon + Render deploy (HTTPS live) |
| +4 → +6 h | A5 PWA on deployed URL, A3 battery pass 2–3 | B4 Playwright judge flows, B8 docs sweep | C8 README/DEMO/screenshots, fresh-clone test on 2nd machine |
| 7:00 PM freeze | Full judge simulation on **deployed** + **local** builds by all three; fix only. | | |
| 8:00 PM | Repo public, form submitted, live URL verified from a phone. | | |

**Phase 2 — production hardening (post-deadline):** A4, A7, A8 · B5, B6, B7 · C3, C6, C7.

---

## 5. Definition of done (every WP)

1. Docs read per `AGENTS.md §1`; rubric line named in the PR description.
2. Invariants hold (`AGENTS.md §2`): services own rules, no `/api` caching (incl. service worker), migrations append-only, structured tool results, injection-resistance clause, no secrets, env-driven model.
3. Tests: relevant `pytest` + Playwright cases added/updated and green; `backend/tests/smoke_api.py` still 83/83.
4. Multi-Agent QA loop (`AGENTS.md §3`) run with ≥ 3 independent QA agents, evidence-based, until ≥ 9/10; final report (score, tests, issues fixed, limitations, re-test confirmation) attached to the PR.
5. README / `.env.example` / `docs/ARCHITECTURE.md` updated if behaviour or config changed.
6. Small PR, owner-area only, reviewed by one teammate, merged to `main` same day.

---

## 6. Production-readiness checklist (roll-up)

- [ ] Single-agent loop, streaming, fallback model, clean provider errors (A1–A3)
- [ ] PWA installable on Android + iOS, offline shell, no API caching, update prompt (A5)
- [ ] Mobile-first layout verified at 360–1366 px (A6); a11y ≥ 90 (A7)
- [ ] Typed validation, no 500s on any input (B1); TZ-correct date logic (B2)
- [ ] pytest ≥ 80% on services/agents (B3); Playwright judge flows incl. mobile (B4)
- [ ] SSE heartbeat/reconnect (B5); health/ready + structured logs (B6); rate limits, CORS env, headers, audits (B7)
- [ ] Docker multi-stage + prod compose (C1); HTTPS cloud deploy with Neon (C2); CI/CD with branch protection (C3)
- [ ] Fail-fast config (C4); one-command local run on 3 OSes (C5); asset caching + Lighthouse (C6); runbooks + backups (C7)
- [ ] README/DEMO final, repo public, form submitted (C8)
