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


def chat(model: str, messages: list[dict], tools: list[dict] | None = None,
         max_tokens: int = 900, temperature: float = 0.2) -> dict:
    body = {"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": temperature}
    if tools:
        body["tools"] = tools
        body["tool_choice"] = "auto"
    with httpx.Client(timeout=90) as client:
        res = client.post(BASE_URL, headers=HEADERS, json=body)
        res.raise_for_status()
        data = res.json()
    choice = data["choices"][0]
    return {"message": choice["message"], "finish_reason": choice.get("finish_reason")}
