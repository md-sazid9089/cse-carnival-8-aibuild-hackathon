"""Exercise the real streaming path with a real tool schema."""
import asyncio
import sys

sys.path.insert(0, ".")
from app.agents.gateway import LLMError, gateway  # noqa: E402
from app.agents.tools import tools_for  # noqa: E402


async def one(label: str, text: str) -> None:
    msgs = [{"role": "system", "content": "You are a campus assistant. Use tools for data questions."},
            {"role": "user", "content": text}]
    tools, choice = tools_for(text, True)
    print(f"\n{label}: {text!r}  (tools={len(tools)} tool_choice={choice})")
    try:
        async for kind, payload in gateway.stream(msgs, tools=tools, tool_choice=choice):
            if kind == "token":
                continue
            print(f"   {kind}: finish={payload.get('finish_reason')} model={payload.get('model')} "
                  f"key#{payload.get('key_index')} tool_calls={len(payload.get('message', {}).get('tool_calls') or [])}")
    except LLMError as e:
        print(f"   LLMError reason={e.reason} msg={e}")
    except Exception as e:  # noqa: BLE001
        print(f"   {type(e).__name__}: {e}")


async def main() -> None:
    await one("A", "When is my next class?")
    await one("B", "Show me all high priority announcements.")
    await one("C", "What classes do I have on Wednesday?")
    await gateway.aclose()


asyncio.run(main())
