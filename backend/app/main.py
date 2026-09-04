import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import sse
from .config import CLIENT_DIST
from .db import migrate
from .routers.api import router
from .search.embedder import warmup_async
from .search.indexer import reindex_all
from .seed import seed_if_empty
from .services.common import DomainError


@asynccontextmanager
async def lifespan(app: FastAPI):
    sse.set_loop(asyncio.get_running_loop())
    migrate()
    seeded = seed_if_empty()
    print(f"[startup] database ready (seeded={seeded})")
    warmup_async()
    reindex_all()  # backfills any rows still missing embeddings (idempotent)
    yield


app = FastAPI(title="CampusOS", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError):
    return JSONResponse(status_code=exc.status, content={"error": exc.reason, "detail": exc.detail})


app.include_router(router)

if CLIENT_DIST.exists():
    app.mount("/", StaticFiles(directory=CLIENT_DIST, html=True), name="client")
