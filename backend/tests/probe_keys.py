"""Report what OpenRouter actually says for each configured key. Prints no key material."""
import asyncio
import sys

import httpx

sys.path.insert(0, ".")
from app.config import OPENROUTER_API_KEYS, OPENROUTER_MODELS  # noqa: E402


async def main() -> None:
    async with httpx.AsyncClient(timeout=45) as c:
        for i, key in enumerate(OPENROUTER_API_KEYS):
            tail = key[-4:] if len(key) > 4 else "????"
            try:
                r = await c.get("https://openrouter.ai/api/v1/key",
                                headers={"Authorization": f"Bearer {key}"})
                print(f"key #{i} (...{tail}) /key -> {r.status_code} {r.text[:200]}")
            except Exception as e:
                print(f"key #{i} (...{tail}) /key -> EXC {type(e).__name__}: {e}")

            try:
                r = await c.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}"},
                    json={"model": OPENROUTER_MODELS[0],
                          "messages": [{"role": "user", "content": "ping"}],
                          "max_tokens": 5},
                )
                print(f"   chat({OPENROUTER_MODELS[0]}) -> {r.status_code} {r.text[:200]}")
            except Exception as e:
                print(f"   chat -> EXC {type(e).__name__}: {e}")


asyncio.run(main())
