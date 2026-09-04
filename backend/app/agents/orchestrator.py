"""Chat entrypoint: tool-calling loop with the full toolset over the live database."""
from ..config import OPENROUTER_MODEL
from .loop import run_loop
from .openrouter import LLMError
from .prompts import system_prompt
from .tools import ALL_TOOLS


def handle_chat(history: list[dict], profile: dict) -> dict:
    try:
        out = run_loop(OPENROUTER_MODEL, system_prompt(profile), history, ALL_TOOLS, profile)
        return {**out, "agent": "assistant"}
    except LLMError as exc:
        return {"reply": str(exc), "agent": "error", "tool_calls": []}
