import asyncio
import logging
from contextlib import asynccontextmanager

import psycopg.errors
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import sse
from .agents.gateway import gateway
from .agents.store import purge_old
from .config import ALLOWED_ORIGINS, CLIENT_DIST
from .db import migrate
from .ratelimit import rate_limit_middleware
from .routers.api import router
from .search.embedder import warmup_async
from .search.indexer import reindex_all
from .seed import seed_if_empty, seed_rbac
from .services.common import DomainError

log = logging.getLogger("campusos")


async def _housekeeping():
    """Persist advisory quota counters and drop stale agent state."""
    while True:
        await asyncio.sleep(10)
        try:
            await asyncio.to_thread(gateway.snapshot)
            await asyncio.to_thread(purge_old)
        except Exception as exc:  # noqa: BLE001 - housekeeping must never kill the app
            log.warning("housekeeping: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    sse.set_loop(asyncio.get_running_loop())
    migrate()
    seeded = seed_if_empty()
    seed_rbac()
    gateway.restore()
    print(f"[startup] database ready (seeded={seeded}); agent keys: {len(gateway.keys)}")
    warmup_async()
    reindex_all()  # backfills any rows still missing embeddings (idempotent)
    task = asyncio.create_task(_housekeeping())
    try:
        yield
    finally:
        task.cancel()
        await gateway.aclose()


app = FastAPI(title="CampusOS", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.middleware("http")(rate_limit_middleware)


@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError):
    return JSONResponse(status_code=exc.status, content={"error": exc.reason, "detail": exc.detail})


@app.exception_handler(psycopg.errors.IntegrityError)
async def integrity_error_handler(request: Request, exc: psycopg.errors.IntegrityError):
    # DB constraints are the last line of defense; surface them as clean 409s
    return JSONResponse(status_code=409, content={"error": "CONSTRAINT_VIOLATION",
                                                  "detail": (exc.diag.message_primary or str(exc)).split("\n")[0]})


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    log.exception("unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"error": "INTERNAL_ERROR",
                                                  "detail": "Something went wrong on the server. Please try again."})


app.include_router(router)


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def api_not_found(path: str):
    # keeps unknown /api/* paths as JSON 404 instead of falling through to the SPA index.html
    return JSONResponse(status_code=404, content={"error": "NOT_FOUND", "detail": f"/api/{path} does not exist"})


if CLIENT_DIST.exists():
    app.mount("/", StaticFiles(directory=CLIENT_DIST, html=True), name="client")
