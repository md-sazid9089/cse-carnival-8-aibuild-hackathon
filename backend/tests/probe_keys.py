"""Report what OpenRouter says for each configured key. Prints no key material."""
import asyncio
import sys

import httpx

sys.path.insert(0, ".")
from app.config import OPENROUTER_API_KEYS, OPENROUTER_MODELS  # noqa: E402


async def main() -> None:
    print(f"{len(OPENROUTER_API_KEYS)} key(s), models: {OPENROUTER_MODELS}")
    async with httpx.AsyncClient(timeout=45) as c:
        for i, key in enumerate(OPENROUTER_API_KEYS):
            tail = key[-4:] if len(key) > 4 else "????"
            for model in OPENROUTER_MODELS:
                try:
                    r = await c.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers={"Authorization": f"Bearer {key}"},
                        json={"model": model, "messages": [{"role": "user", "content": "ping"}],
                              "max_tokens": 5},
                    )
                    print(f"key #{i} (...{tail}) {model} -> {r.status_code} {r.text[:180]}")
                except Exception as e:  # noqa: BLE001
                    print(f"key #{i} (...{tail}) {model} -> EXC {type(e).__name__}: {e}")


asyncio.run(main())
