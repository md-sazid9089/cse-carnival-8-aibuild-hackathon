"""Single OpenRouter client — swapping provider means editing only this file."""
import httpx

from ..config import OPENROUTER_API_KEY

BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
HEADERS = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
    "HTTP-Referer": "https://github.com/sakibul-shovon/cse-carnival-8-aibuild-hackathon",
    "X-Title": "CampusOS",
}


class LLMError(Exception):
    """Provider failure with a user-presentable message."""


def chat(model: str, messages: list[dict], tools: list[dict] | None = None,
         max_tokens: int = 900, temperature: float = 0.2) -> dict:
    if not OPENROUTER_API_KEY or OPENROUTER_API_KEY.startswith("sk-or-v1-your"):
        raise LLMError("OPENROUTER_API_KEY is not set. Add it to .env and restart the backend.")
    body = {"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": temperature}
    if tools:
        body["tools"] = tools
        body["tool_choice"] = "auto"
    try:
        with httpx.Client(timeout=90) as client:
            res = client.post(BASE_URL, headers=HEADERS, json=body)
    except httpx.TimeoutException as exc:
        raise LLMError("The AI model took too long to respond. Please try again.") from exc
    except httpx.HTTPError as exc:
        raise LLMError(f"Could not reach the AI provider: {exc.__class__.__name__}") from exc
    if res.status_code == 401:
        raise LLMError("OpenRouter rejected the API key (401). Check OPENROUTER_API_KEY in .env.")
    if res.status_code == 429:
        raise LLMError("AI provider rate limit hit (429). Wait a moment or switch OPENROUTER_MODEL.")
    if res.status_code >= 400:
        detail = res.text[:200]
        raise LLMError(f"AI provider error {res.status_code}: {detail}")
    data = res.json()
    if "error" in data:
        raise LLMError(f"AI provider error: {data['error'].get('message', 'unknown')}")
    choice = data["choices"][0]
    return {"message": choice["message"], "finish_reason": choice.get("finish_reason")}
