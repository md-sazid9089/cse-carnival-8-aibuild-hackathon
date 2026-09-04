"""Single-agent runtime: one tool-calling loop over OpenRouter, streaming or buffered.

Safety rules encoded here:
* a write that already executed is never re-attempted on another provider (the turn finishes from the
  tool result instead of asking a second model);
* tool calls only run from a complete `finish_reason`-terminated response;
* everything is bounded (iterations, wall clock, history).
"""
import asyncio
import json
import logging
import re
import time

from .. import config
from ..services.common import now_local
from . import degraded, store
from .gateway import LLMError, gateway
from .prompts import system_prompt
from .tools import TOOL_LABELS, dispatch_many, dumps, tools_for

log = logging.getLogger("campusos.agent")

NOT_CONFIGURED = ("The AI assistant isn't configured yet. Add OPENROUTER_API_KEYS to your .env "
                  "(free keys from openrouter.ai/settings/keys) and restart the server. "
                  "The dashboard works fully without it.")
BUSY = "I'm handling a lot of requests right now — please try again in a few seconds."
CAP_REACHED = ("The assistant has reached today's usage cap for this deployment. "
               "The dashboard still works normally.")

CONFIRM_RE = re.compile(r"\b(confirm|cancel)\s+(act-[A-Za-z0-9_\-]+)", re.I)


def _label(name: str) -> str:
    return TOOL_LABELS.get(name, name.replace("_", " "))


def _write_summary(trace: list[dict]) -> str | None:
    """Templated close-out used when a write succeeded but the follow-up model call failed."""
    done = [t for t in trace if t["ok"] and t["tool"] in
            {"book_room", "cancel_booking", "register_for_event", "cancel_registration", "confirm_action"}]
    if not done:
        return None
    return "Done: " + "; ".join(t.get("summary") or t["tool"] for t in done) + "."


def _messages(profile: dict, history: list[dict], user_msg: str) -> list[dict]:
    msgs = [{"role": "system", "content": system_prompt(profile)}]
    msgs += [{"role": h["role"], "content": h["content"]} for h in history]
    msgs.append({"role": "user", "content": user_msg})
    return msgs


def _signature(call: dict) -> str:
    fn = call.get("function") or {}
    return f"{fn.get('name')}|{fn.get('arguments')}"


def _from_trace(trace: list[dict]) -> str | None:
    """Answer from what the tools already returned, for when the model won't finish the job."""
    facts = [t["summary"] for t in trace if t.get("ok") and t.get("summary")]
    if not facts:
        return None
    return "Here's what I found: " + "; ".join(dict.fromkeys(facts)) + "."


def _presentable(reply: str | None) -> bool:
    """Weak models sometimes emit a stray '[' or a bare JSON fragment instead of an answer."""
    text = (reply or "").strip()
    if len(text) < 12:
        return False
    return not (text[0] in "[{" and text[-1] not in "]}")


async def run_turn(user_msg: str, profile: dict, conversation_id: str | None = None,
                   emit=None) -> dict:
    """Execute one user turn. `emit` is an optional async callback for streaming events."""
    async def send(event: str, data):
        if emit:
            await emit(event, data)

    if not gateway.configured():
        return {"reply": NOT_CONFIGURED, "tool_calls": [], "conversation_id": conversation_id,
                "agent": "not_configured"}

    cid = await asyncio.to_thread(store.ensure_conversation, conversation_id, profile["student_id"])
    history = await asyncio.to_thread(store.load_history, cid, profile["student_id"])
    turn_no = len(history)
    ctx = {"profile": profile, "conversation_id": cid, "turn_no": turn_no, "writes": [], "proposals": []}

    if not gateway.note_turn():
        return {"reply": CAP_REACHED, "tool_calls": [], "conversation_id": cid, "agent": "capped"}

    # "confirm act-xyz" / "cancel act-xyz" from the confirmation card: handled without the model.
    m = CONFIRM_RE.search(user_msg or "")
    if m:
        verb, action_id = m.group(1).lower(), m.group(2)
        if verb == "cancel":
            ok = await asyncio.to_thread(store.cancel_pending, action_id, profile["student_id"], cid)
            reply = "Cancelled — nothing was changed." if ok else "That request already expired."
            await _persist(cid, profile, user_msg, reply, [])
            return {"reply": reply, "tool_calls": [], "conversation_id": cid, "agent": "assistant"}
        results = await dispatch_many(
            [{"id": "confirm", "function": {"name": "confirm_action",
                                            "arguments": json.dumps({"action_id": action_id})}}], ctx)
        res = results[0]["result"]
        reply = res["summary"] if res.get("ok") else f"Couldn't do that: {res.get('detail')}"
        trace = [{"tool": "confirm_action", "label": _label("confirm_action"), "ok": res.get("ok", False),
                  "summary": res.get("summary")}]
        await send("tool_result", trace[0])
        await _persist(cid, profile, user_msg, reply, trace)
        return {"reply": reply, "tool_calls": trace, "conversation_id": cid, "agent": "assistant"}

    messages = _messages(profile, history, user_msg)
    trace: list[dict] = []
    deadline = time.monotonic() + config.AGENT_TURN_BUDGET_S
    reply: str | None = None
    models_override: list[str] | None = None
    needs_tool = False   # the first hop demanded a tool call, so an answer without one is ungrounded
    retried_toolless = False
    seen: set[str] = set()

    for hop in range(config.AGENT_MAX_ITERATIONS):
        if time.monotonic() > deadline:
            done = _write_summary(trace)
            if done:
                reply = done
                break
            # Out of time on a read question: answer from the database rather than stalling.
            slow = degraded.answer(user_msg, profile, note="slow") if config.AGENT_DEGRADED_MODE else None
            if slow:
                await _persist(cid, profile, user_msg, slow["reply"], slow["tool_calls"])
                return {**slow, "conversation_id": cid, "agent": "degraded",
                        "tool_calls": slow["tool_calls"]}
            reply = ("That took longer than expected. I checked: " +
                     ", ".join(t["label"] for t in trace) + ". Please ask again.") if trace else BUSY
            break
        tools, choice = tools_for(user_msg, first_hop=(hop == 0 or retried_toolless))
        if hop == 0:
            needs_tool = choice == "required"
        await send("status", {"text": "Thinking…" if hop == 0 else "Working on it…"})
        try:
            res = await _call(messages, tools, choice, emit=send, models=models_override)
        except LLMError as exc:
            done = _write_summary(trace)
            if done:  # a write already happened: never re-ask another provider
                reply = done
                break
            fallback = degraded.answer(user_msg, profile) if config.AGENT_DEGRADED_MODE else None
            if fallback:
                await _persist(cid, profile, user_msg, fallback["reply"], fallback["tool_calls"])
                return {**fallback, "conversation_id": cid, "agent": "degraded",
                        "tool_calls": fallback["tool_calls"]}
            reply = (degraded.OFFLINE_MSG if config.AGENT_DEGRADED_MODE
                     else f"The AI service is unavailable right now ({exc.reason}).")
            break

        msg = res["message"]
        calls = msg.get("tool_calls") or []
        if not calls:
            # Some free models ignore tool_choice='required' and answer from memory. A data question
            # answered without reading the database is a wrong answer, so try the rest of the chain,
            # then fall back to live data rather than trusting the model's recollection.
            if needs_tool and not trace:
                others = [m for m in gateway.models if m != res.get("model")]
                if others and not retried_toolless:
                    retried_toolless = True
                    models_override = others
                    continue
                grounded = degraded.answer(user_msg, profile, note="grounded") if config.AGENT_DEGRADED_MODE else None
                if grounded:
                    await _persist(cid, profile, user_msg, grounded["reply"], grounded["tool_calls"])
                    return {**grounded, "conversation_id": cid, "agent": "degraded",
                            "tool_calls": grounded["tool_calls"]}
            reply = (msg.get("content") or "").strip() or _write_summary(trace) or \
                "I couldn't put an answer together — could you rephrase?"
            break

        messages.append({"role": "assistant", "content": msg.get("content"), "tool_calls": calls})
        if calls and all(_signature(c) in seen for c in calls):
            # the model is asking for data it already has: answer instead of burning another hop
            reply = _write_summary(trace) or _from_trace(trace)
            break
        for call in calls:
            seen.add(_signature(call))
            name = (call.get("function") or {}).get("name", "?")
            await send("tool_call", {"tool": name, "label": _label(name)})
        results = await dispatch_many(calls, ctx)
        for item in results:
            r = item["result"]
            entry = {"tool": item["name"], "label": _label(item["name"]), "ok": bool(r.get("ok")),
                     "summary": r.get("summary")}
            trace.append(entry)
            await send("tool_result", entry)
            messages.append({"role": "tool", "tool_call_id": item["tool_call_id"], "name": item["name"],
                             "content": dumps(r)})
    else:
        reply = _write_summary(trace) or "I ran out of steps on that one — please ask again more specifically."

    reply = reply or "Sorry, I couldn't answer that."
    if not _presentable(reply):
        reply = _write_summary(trace) or _from_trace(trace) or \
            "I couldn't put that into words — could you ask again?"
    for pending in ctx.get("proposals", []):
        await send("action_proposed", pending)
    await _persist(cid, profile, user_msg, reply, trace)
    return {"reply": reply, "tool_calls": trace, "conversation_id": cid, "agent": "assistant",
            "proposals": ctx.get("proposals", [])}


async def _call(messages, tools, choice, emit, models=None) -> dict:
    """Streaming call with token pass-through; falls back to a buffered call if streaming fails."""
    buffer: list[str] = []
    try:
        async for kind, payload in gateway.stream(messages, tools, choice, models):
            if kind == "token":
                buffer.append(payload)
                await emit("token", payload)
            elif kind == "done":
                if payload["finish_reason"] == "error" and not payload["message"].get("tool_calls"):
                    text = "".join(buffer).strip()
                    if len(text) > 40:
                        # the answer was essentially complete when the stream dropped: keep it
                        return {"message": {"role": "assistant", "content": text, "tool_calls": None},
                                "finish_reason": "stop", "model": payload.get("model"),
                                "key_index": payload.get("key_index")}
                    raise LLMError("stream interrupted", "STREAM_INTERRUPTED")
                return payload
    except LLMError:
        if buffer:
            raise
        return await gateway.complete(messages, tools, choice, models)
    return await gateway.complete(messages, tools, choice, models)


async def _persist(cid: str, profile: dict, user_msg: str, reply: str, trace: list[dict]) -> None:
    await asyncio.to_thread(store.append_turn, cid, profile["student_id"], "user", user_msg)
    await asyncio.to_thread(store.append_turn, cid, profile["student_id"], "assistant", reply, trace)
