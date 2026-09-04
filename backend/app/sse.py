"""In-memory SSE hub. Services run in worker threads, so publish is thread-safe."""
import asyncio
import json

_subscribers: set[asyncio.Queue] = set()
_loop: asyncio.AbstractEventLoop | None = None


def set_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def publish(entity: str, action: str, entity_id: str) -> None:
    if _loop is None:
        return
    payload = json.dumps({"entity": entity, "action": action, "id": entity_id})
    for queue in list(_subscribers):
        _loop.call_soon_threadsafe(queue.put_nowait, payload)


async def subscribe():
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers.add(queue)
    try:
        while True:
            data = await queue.get()
            yield f"data: {data}\n\n"
    finally:
        _subscribers.discard(queue)
