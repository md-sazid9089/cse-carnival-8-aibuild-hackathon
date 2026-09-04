"""Try every configured model with one key. Prints no key material."""
import asyncio
import sys

import httpx

sys.path.insert(0, ".")
from app.config import OPENROUTER_API_KEYS, OPENROUTER_MODELS  # noqa: E402


async def main() -> None:
    key = OPENROUTER_API_KEYS[0]
    async with httpx.AsyncClient(timeout=60) as c:
        for model in OPENROUTER_MODELS:
            try:
                r = await c.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}"},
                    json={"model": model,
                          "messages": [{"role": "user", "content": "Reply with the single word: ok"}],
                          "max_tokens": 10},
                )
                body = r.text[:160].replace("\n", " ")
                print(f"{model:42s} -> {r.status_code}  {body}")
                print(f"{'':42s}    retry-after={r.headers.get('retry-after')} "
                      f"x-ratelimit-reset={r.headers.get('x-ratelimit-reset')}")
            except Exception as e:
                print(f"{model:42s} -> EXC {type(e).__name__}: {e}")


asyncio.run(main())
