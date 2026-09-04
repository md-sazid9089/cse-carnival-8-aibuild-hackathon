"""Multi-agent orchestration: Router (fast classify) → Analyst (reads) / Coordinator (writes)."""
import json
import re

from ..config import FALLBACK_SINGLE_AGENT, OPENROUTER_MODEL, OPENROUTER_ROUTER_MODEL
from .loop import run_loop
from .openrouter import chat
from .prompts import analyst_prompt, coordinator_prompt, router_prompt, single_agent_prompt
from .tools import ALL_TOOLS, COORDINATOR_TOOLS, READ_TOOLS

_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


def _classify(history: list[dict], profile: dict) -> dict | None:
    for _ in range(2):
        try:
            res = chat(OPENROUTER_ROUTER_MODEL,
                       [{"role": "system", "content": router_prompt(profile)}] + history[-6:],
                       tools=None, max_tokens=200, temperature=0.0)
            match = _JSON_RE.search(res["message"].get("content") or "")
            if match:
                data = json.loads(match.group(0))
                if data.get("intent") in ("read_query", "action_request", "clarification_needed",
                                          "unauthorized", "smalltalk"):
                    return data
        except Exception as exc:  # noqa: BLE001 - router failure falls back to single agent
            print(f"[router] {exc}")
    return None


def handle_chat(history: list[dict], profile: dict) -> dict:
    if FALLBACK_SINGLE_AGENT:
        out = run_loop(OPENROUTER_MODEL, single_agent_prompt(profile), history, ALL_TOOLS, profile)
        return {**out, "agent": "assistant"}

    decision = _classify(history, profile)
    if decision is None:
        out = run_loop(OPENROUTER_MODEL, single_agent_prompt(profile), history, ALL_TOOLS, profile)
        return {**out, "agent": "assistant (router fallback)"}

    intent = decision["intent"]
    if intent in ("clarification_needed", "unauthorized", "smalltalk"):
        fallback = {
            "clarification_needed": "Could you give me a bit more detail — which room or event, what date, and what time window?",
            "unauthorized": "Sorry, I can only manage your own bookings and registrations.",
            "smalltalk": "Hi! Ask me about classes, rooms, events, deadlines, or tell me to book a room.",
        }[intent]
        return {"reply": decision.get("reply") or fallback, "agent": "router", "tool_calls": [],
                "intent": intent}

    if intent == "action_request":
        out = run_loop(OPENROUTER_MODEL, coordinator_prompt(profile), history, COORDINATOR_TOOLS, profile)
        return {**out, "agent": "coordinator", "intent": intent}

    out = run_loop(OPENROUTER_MODEL, analyst_prompt(profile), history, READ_TOOLS, profile)
    return {**out, "agent": "analyst", "intent": intent}
