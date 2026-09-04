"""Drive the real gateway a few times and report which model/key served each call."""
import asyncio
import sys

sys.path.insert(0, ".")
from app.agents.gateway import LLMError, gateway  # noqa: E402


async def main() -> None:
    msgs = [{"role": "user", "content": "Reply with the single word: ok"}]
    for i in range(5):
        try:
            out = await gateway.complete(msgs)
            print(f"call {i}: model={out['model']} key#{out['key_index']} -> {out['message']['content']!r}")
        except LLMError as e:
            print(f"call {i}: LLMError reason={e.reason} msg={e}")
        print(f"          health={gateway.health()}")
        print(f"          breakers={{ {', '.join(f'{m}: closed={b.closed()}' for m, b in gateway.breakers.items())} }}")
    await gateway.aclose()


asyncio.run(main())
