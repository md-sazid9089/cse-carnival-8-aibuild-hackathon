"""OpenRouter gateway: key pool + model chain, quota buckets, circuit breakers, streaming.

Only provider. Keys come from separate OpenRouter accounts and are cycled per request so the
per-account free-tier daily allowance multiplies by the number of keys.
"""
import asyncio
import hashlib
import json
import logging
import random
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timezone

import httpx

from .. import config
from ..db import execute, q

log = logging.getLogger("campusos.gateway")

RETRYABLE_STATUS = {408, 409, 425, 429, 500, 502, 503, 504}


class LLMError(Exception):
    """Every attempt in the chain failed."""

    def __init__(self, detail: str, reason: str = "LLM_UNAVAILABLE", retryable: bool = True):
        super().__init__(detail)
        self.detail = detail
        self.reason = reason
        self.retryable = retryable


def _key_hash(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()[:16]


@dataclass
class KeyState:
    key: str
    index: int
    hash: str
    day: date
    used_today: int = 0
    minute_start: float = field(default_factory=time.monotonic)
    used_minute: int = 0
    blocked_until: float = 0.0  # monotonic; set by 429 Retry-After
    exhausted_day: date | None = None

    def _roll(self) -> None:
        today = datetime.now(timezone.utc).date()
        if today != self.day:
            self.day, self.used_today = today, 0
            if self.exhausted_day and self.exhausted_day != today:
                self.exhausted_day = None
        now = time.monotonic()
        if now - self.minute_start >= 60:
            self.minute_start, self.used_minute = now, 0

    def available(self) -> bool:
        self._roll()
        if self.exhausted_day == self.day:
            return False
        if time.monotonic() < self.blocked_until:
            return False
        if self.used_today >= config.OPENROUTER_RPD_PER_KEY:
            return False
        return self.used_minute < config.OPENROUTER_RPM_PER_KEY

    def note_request(self) -> None:
        self._roll()
        self.used_today += 1
        self.used_minute += 1

    def note_429(self, retry_after: float | None) -> None:
        self._roll()
        if retry_after and retry_after < 300:
            self.blocked_until = time.monotonic() + retry_after
        else:  # free-tier daily cap: park this key until tomorrow
            self.exhausted_day = self.day

    def limit_status(self) -> str:
        self._roll()
        if self.exhausted_day == self.day or time.monotonic() < self.blocked_until:
            return "exhausted"
        if self.used_today >= config.OPENROUTER_RPD_PER_KEY * 0.8:
            return "warning"
        return "ok"


@dataclass
class Breaker:
    """Per-model breaker: 3 consecutive failures open it for 45 s, then one real probe."""
    failures: int = 0
    open_until: float = 0.0
    p50_ms: float = 2500.0

    def closed(self) -> bool:
        return time.monotonic() >= self.open_until

    def record(self, ok: bool, elapsed_ms: float | None = None) -> None:
        if ok:
            self.failures = 0
            self.open_until = 0.0
            if elapsed_ms:
                self.p50_ms = 0.8 * self.p50_ms + 0.2 * elapsed_ms
        else:
            self.failures += 1
            if self.failures >= 3:
                self.open_until = time.monotonic() + 45
                self.failures = 0

    def ttft_budget_s(self) -> float:
        return min(max(3.0, (self.p50_ms * 3) / 1000), 15.0)

    def park(self, seconds: float) -> None:
        """Hold this model back briefly without counting it as a hard failure."""
        self.open_until = max(self.open_until, time.monotonic() + seconds)


class Gateway:
    def __init__(self) -> None:
        today = datetime.now(timezone.utc).date()
        self.keys = [KeyState(key=k, index=i, hash=_key_hash(k), day=today)
                     for i, k in enumerate(config.OPENROUTER_API_KEYS)]
        self.models = config.OPENROUTER_MODELS
        self.breakers: dict[str, Breaker] = {m: Breaker() for m in self.models}
        self._cursor = 0
        self._client: httpx.AsyncClient | None = None
        self._sem = asyncio.Semaphore(config.AGENT_MAX_CONCURRENT)
        self._day = today
        self._turns_today = 0

    # ---- lifecycle ----
    async def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            headers = {"Content-Type": "application/json", "X-Title": "CampusOS"}
            if config.APP_URL:  # OpenRouter attribution, only meaningful once deployed
                headers["HTTP-Referer"] = config.APP_URL
            self._client = httpx.AsyncClient(
                base_url=config.OPENROUTER_BASE_URL,
                timeout=httpx.Timeout(config.AGENT_CALL_TIMEOUT_S, connect=5.0, read=config.AGENT_CALL_TIMEOUT_S,
                                      write=10.0, pool=5.0),
                headers=headers,
            )
        return self._client

    async def aclose(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # ---- quota / health ----
    def configured(self) -> bool:
        return bool(self.keys)

    def note_turn(self) -> bool:
        """Deployment-wide daily turn cap (protects the free quota from strangers)."""
        today = datetime.now(timezone.utc).date()
        if today != self._day:
            self._day, self._turns_today = today, 0
        if self._turns_today >= config.AGENT_DAILY_CAP:
            return False
        self._turns_today += 1
        return True

    def any_capacity(self) -> bool:
        return any(k.available() for k in self.keys)

    def health(self) -> dict:
        if not self.keys:
            return {"agent": "not_configured", "providers": []}
        statuses = [k.limit_status() for k in self.keys]
        overall = "ok" if "ok" in statuses else ("warning" if "warning" in statuses else "exhausted")
        models_up = [m for m in self.models if self.breakers[m].closed()]
        return {
            "agent": "configured",
            "providers": [{"name": "openrouter", "keys": len(self.keys),
                           "status": "ok" if models_up else "degraded", "limit_status": overall}],
            "models_available": len(models_up),
        }

    def snapshot(self) -> None:
        for k in self.keys:
            try:
                execute(
                    """INSERT INTO llm_quota_snapshot (key_hash, day, requests) VALUES (%s,%s,%s)
                       ON CONFLICT (key_hash, day) DO UPDATE SET requests = GREATEST(llm_quota_snapshot.requests, EXCLUDED.requests)""",
                    [k.hash, k.day, k.used_today],
                )
            except Exception as exc:  # noqa: BLE001 - snapshotting must never break a request
                log.warning("quota snapshot failed: %s", exc)

    def restore(self) -> None:
        today = datetime.now(timezone.utc).date()
        try:
            rows = q("SELECT key_hash, requests FROM llm_quota_snapshot WHERE day = %s", [today])
        except Exception:  # noqa: BLE001 - table may not exist on first boot
            return
        by_hash = {r["key_hash"]: r["requests"] for r in rows}
        for k in self.keys:
            k.used_today = max(k.used_today, by_hash.get(k.hash, 0))

    # ---- attempt planning ----
    def _note_429(self, model: str, ks: KeyState, res: httpx.Response) -> None:
        """Split the two very different things a 429 can mean.

        A free model that is busy upstream answers with a short Retry-After and names the
        provider; that throttles the *model* for everyone, so parking the key would burn the
        whole pool on a five-second hiccup. Only an account-level cap parks the key.
        """
        retry_after = _retry_after(res)
        detail = _error_detail(res).lower()
        upstream = "upstream" in detail or "provider returned error" in detail
        if upstream or (retry_after is not None and retry_after <= 60):
            self.breakers.setdefault(model, Breaker()).park(min(max(retry_after or 5.0, 2.0), 60.0))
            return
        ks.note_429(retry_after)

    def _park_wait_s(self, models: list[str] | None = None) -> float | None:
        """Seconds until the soonest briefly-parked model frees up, when keys are still usable.

        Free models go busy for a few seconds at a time. Waiting that out beats telling the
        student the assistant is offline.
        """
        if not any(k.available() for k in self.keys):
            return None
        now = time.monotonic()
        waits = [b.open_until - now for m, b in self.breakers.items()
                 if (models is None or m in models) and b.open_until > now]
        return min(waits) if waits else None

    def _attempts(self, models: list[str] | None = None) -> list[tuple[str, KeyState]]:
        """(model, key) pairs: every healthy key for the first model, then the next model."""
        plan: list[tuple[str, KeyState]] = []
        if not self.keys:
            return plan
        start = self._cursor  # snapshot then advance, so overlapping turns start on different keys
        self._cursor = (start + 1) % len(self.keys)
        for model in (models or self.models):
            if not self.breakers.setdefault(model, Breaker()).closed():
                continue
            for offset in range(len(self.keys)):
                ks = self.keys[(start + offset) % len(self.keys)]
                if ks.available():
                    plan.append((model, ks))
        return plan

    def _body(self, model: str, messages: list[dict], tools: list[dict] | None,
              tool_choice: str | None, stream: bool) -> dict:
        body: dict = {
            "model": model,
            "messages": messages,
            "max_tokens": config.AGENT_MAX_TOKENS,
            "temperature": 0.2,
            "stream": stream,
            # keeps reasoning out of the payload (smaller + faster to parse); ignored by non-reasoning models
            "reasoning": {"exclude": True},
        }
        if tools:
            body["tools"] = tools
            body["tool_choice"] = tool_choice or "auto"
        return body

    # ---- calls ----
    async def complete(self, messages: list[dict], tools: list[dict] | None = None,
                       tool_choice: str | None = None, models: list[str] | None = None) -> dict:
        """Non-streaming completion with key/model failover. Raises LLMError when every attempt fails."""
        if not self.keys:
            raise LLMError("No OpenRouter API keys configured.", "NOT_CONFIGURED", retryable=False)
        last: str = "unknown error"
        client = await self.client()
        for _round in range(MAX_THROTTLE_ROUNDS):
            attempts = self._attempts(models)
            for model, ks in attempts:
                if not self.breakers[model].closed():  # parked mid-loop: don't burn more keys on it
                    continue
                body = self._body(model, messages, tools, tool_choice, stream=False)
                started = time.monotonic()
                try:
                    async with self._sem:
                        ks.note_request()
                        res = await client.post("/chat/completions", json=body,
                                                headers={"Authorization": f"Bearer {ks.key}"})
                    if res.status_code == 429:
                        self._note_429(model, ks, res)
                        last = "rate limited"
                        continue
                    if res.status_code in RETRYABLE_STATUS or res.status_code >= 500:
                        self.breakers[model].record(False)
                        last = f"HTTP {res.status_code}"
                        await asyncio.sleep(0.5 + random.random() * 0.5)
                        continue
                    if res.status_code >= 400:
                        detail = _error_detail(res)
                        if res.status_code in (401, 403):
                            ks.exhausted_day = ks.day  # bad/blocked key: stop using it this run
                            last = f"auth failed ({detail})"
                            continue
                        self.breakers[model].record(False)
                        last = detail
                        continue
                    data = res.json()
                    choice = (data.get("choices") or [{}])[0]
                    msg = _normalize_message(choice.get("message") or {})
                    self.breakers[model].record(True, (time.monotonic() - started) * 1000)
                    return {"message": msg, "finish_reason": choice.get("finish_reason"),
                            "model": data.get("model", model), "key_index": ks.index,
                            "usage": data.get("usage") or {}}
                except (httpx.TimeoutException, httpx.TransportError) as exc:
                    self.breakers[model].record(False)
                    last = f"{type(exc).__name__}"
                    continue
            wait = self._park_wait_s(models)
            if wait is None or wait > MAX_THROTTLE_WAIT_S:
                break
            await asyncio.sleep(wait + 0.2)
        if not any(k.available() for k in self.keys):
            raise LLMError("All API keys are rate-limited right now.", "RATE_LIMITED")
        raise LLMError(f"All providers failed ({last}).", "LLM_UNAVAILABLE")

    async def stream(self, messages: list[dict], tools: list[dict] | None = None,
                     tool_choice: str | None = None, models: list[str] | None = None):
        """Yield ('token', str) / ('done', payload). Tool-call deltas are aggregated internally and
        only surfaced on 'done' with finish_reason='tool_calls' — a stream cut before finish_reason
        discards everything, so nothing is ever dispatched from a partial response."""
        if not self.keys:
            raise LLMError("No OpenRouter API keys configured.", "NOT_CONFIGURED", retryable=False)
        attempts = self._attempts(models)
        if not attempts:
            raise LLMError("All API keys are rate-limited right now.", "RATE_LIMITED")
        last = "unknown error"
        client = await self.client()
        for model, ks in attempts:
            if not self.breakers[model].closed():  # parked mid-loop: don't burn more keys on it
                continue
            body = self._body(model, messages, tools, tool_choice, stream=True)
            started = time.monotonic()
            emitted = False
            try:
                async with self._sem:
                    ks.note_request()
                    async with client.stream("POST", "/chat/completions", json=body,
                                             headers={"Authorization": f"Bearer {ks.key}"}) as res:
                        if res.status_code == 429:
                            await res.aread()
                            self._note_429(model, ks, res)
                            last = "rate limited"
                            continue
                        if res.status_code >= 400:
                            await res.aread()
                            detail = _error_detail(res)
                            if res.status_code in (401, 403):
                                ks.exhausted_day = ks.day
                            else:
                                self.breakers[model].record(False)
                            last = detail
                            continue
                        content_parts: list[str] = []
                        tool_parts: dict[int, dict] = {}
                        finish: str | None = None
                        async for line in res.aiter_lines():
                            if not line or line.startswith(":"):
                                continue
                            if not line.startswith("data:"):
                                continue
                            payload = line[5:].strip()
                            if payload == "[DONE]":
                                break
                            try:
                                chunk = json.loads(payload)
                            except json.JSONDecodeError:
                                continue
                            choice = (chunk.get("choices") or [{}])[0]
                            delta = choice.get("delta") or {}
                            text = delta.get("content")
                            if text:
                                content_parts.append(text)
                                emitted = True
                                yield ("token", text)
                            for tc in delta.get("tool_calls") or []:
                                idx = tc.get("index", 0)
                                slot = tool_parts.setdefault(
                                    idx, {"id": "", "type": "function",
                                          "function": {"name": "", "arguments": ""}})
                                if tc.get("id"):
                                    slot["id"] = tc["id"]
                                fn = tc.get("function") or {}
                                if fn.get("name"):
                                    slot["function"]["name"] += fn["name"]
                                if fn.get("arguments"):
                                    slot["function"]["arguments"] += fn["arguments"]
                            if choice.get("finish_reason"):
                                finish = choice["finish_reason"]
                        if finish is None:
                            # stream ended without a terminator: discard partial tool calls
                            raise httpx.ReadError("stream ended before finish_reason")
                        calls = [tool_parts[i] for i in sorted(tool_parts)] if tool_parts else []
                        for c in calls:
                            c["id"] = c["id"] or f"call_{model[:6]}_{random.randint(1000, 9999)}"
                        self.breakers[model].record(True, (time.monotonic() - started) * 1000)
                        yield ("done", {"message": {"role": "assistant",
                                                    "content": "".join(content_parts) or None,
                                                    "tool_calls": calls or None},
                                        "finish_reason": finish, "model": model, "key_index": ks.index})
                        return
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                self.breakers[model].record(False)
                last = type(exc).__name__
                if emitted:
                    # tokens already shown to the user: don't restart on another provider
                    yield ("done", {"message": {"role": "assistant", "content": None, "tool_calls": None},
                                    "finish_reason": "error", "model": model, "key_index": ks.index})
                    return
                continue
        raise LLMError(f"All providers failed ({last}).", "LLM_UNAVAILABLE")


def _retry_after(res: httpx.Response) -> float | None:
    raw = res.headers.get("retry-after") or res.headers.get("x-ratelimit-reset")
    try:
        return float(raw) if raw else None
    except (TypeError, ValueError):
        return None


def _error_detail(res: httpx.Response) -> str:
    try:
        body = res.json()
        err = body.get("error") or {}
        return str(err.get("message") or body)[:200]
    except Exception:  # noqa: BLE001
        return f"HTTP {res.status_code}"


def _normalize_message(msg: dict) -> dict:
    """Some providers return tool-call arguments as an object instead of a JSON string."""
    calls = msg.get("tool_calls") or []
    for call in calls:
        fn = call.get("function") or {}
        args = fn.get("arguments")
        if isinstance(args, (dict, list)):
            fn["arguments"] = json.dumps(args)
        elif args is None:
            fn["arguments"] = "{}"
    return {"role": msg.get("role", "assistant"), "content": msg.get("content"),
            "tool_calls": calls or None}


gateway = Gateway()
