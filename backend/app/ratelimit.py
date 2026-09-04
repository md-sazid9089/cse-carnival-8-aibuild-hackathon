"""Per-IP rate limiting for the agent endpoints.

Protects the shared free-tier OpenRouter quota when the app is on a public URL: one visitor
cannot drain the pool. In-memory sliding windows (single-instance deployment by design).
"""
import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse

from .config import RATE_LIMIT_PER_DAY, RATE_LIMIT_PER_MINUTE

PROTECTED_PREFIX = "/api/agent"

_hits: dict[str, deque] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check(request: Request) -> tuple[bool, int]:
    """Return (allowed, retry_after_seconds)."""
    now = time.monotonic()
    hits = _hits[_client_ip(request)]
    while hits and now - hits[0] > 86400:
        hits.popleft()
    last_minute = sum(1 for t in hits if now - t <= 60)
    if last_minute >= RATE_LIMIT_PER_MINUTE:
        return False, 60
    if len(hits) >= RATE_LIMIT_PER_DAY:
        return False, 3600
    hits.append(now)
    return True, 0


async def rate_limit_middleware(request: Request, call_next):
    if request.url.path.startswith(PROTECTED_PREFIX) and request.method == "POST":
        allowed, retry_after = check(request)
        if not allowed:
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": str(retry_after)},
                content={"error": "RATE_LIMITED",
                         "detail": "Too many assistant requests from this device. Try again shortly.",
                         "retryable": True, "retry_after_s": retry_after},
            )
    return await call_next(request)
