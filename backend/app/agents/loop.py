"""Shared specialist loop: OpenAI-standard tool calling until a text answer or iteration cap."""
import json

from .openrouter import chat
from .tools import dispatch, dumps

MAX_ITERATIONS = 8


def run_loop(model: str, system_prompt: str, history: list[dict], tools: list[dict], profile: dict) -> dict:
    messages = [{"role": "system", "content": system_prompt}] + history
    trace = []
    for _ in range(MAX_ITERATIONS):
        res = chat(model, messages, tools)
        msg = res["message"]
        tool_calls = msg.get("tool_calls") or []
        if res["finish_reason"] == "tool_calls" or tool_calls:
            messages.append(msg)
            for call in tool_calls:
                name = call["function"]["name"]
                raw = call["function"].get("arguments") or "{}"
                if isinstance(raw, dict):
                    args = raw
                else:
                    try:
                        args = json.loads(raw)
                    except json.JSONDecodeError:
                        args = {}
                result = dispatch(name, args, profile)
                trace.append({"tool": name, "args": args, "ok": result.get("ok", False)})
                messages.append({"role": "tool", "tool_call_id": call["id"], "name": name,
                                 "content": dumps(result)})
            continue
        return {"reply": msg.get("content") or "(no reply)", "tool_calls": trace}
    return {"reply": "I could not finish that request within my step limit — please try rephrasing.",
            "tool_calls": trace}
