"""Local MiniLM-class embeddings via fastembed (ONNX, no torch). Degrades to None when unavailable."""
import threading

_model = None
_failed = False
_lock = threading.Lock()


def _get_model():
    global _model, _failed
    if _failed:
        return None
    with _lock:
        if _model is None and not _failed:
            try:
                from fastembed import TextEmbedding

                _model = TextEmbedding("BAAI/bge-small-en-v1.5")  # 384-dim, matches vector(384)
            except Exception as exc:  # noqa: BLE001 - any failure means keyword-only search
                print(f"[embedder] disabled: {exc}")
                _failed = True
    return _model


def embed(text: str) -> list[float] | None:
    from .. import config

    if not config.EMBEDDINGS_ENABLED:
        return None
    model = _get_model()
    if model is None:
        return None
    try:
        return [float(x) for x in next(iter(model.embed([text])))]
    except Exception as exc:  # noqa: BLE001
        print(f"[embedder] embed failed: {exc}")
        return None


def to_pgvector(vec: list[float]) -> str:
    return "[" + ",".join(f"{x:.7f}" for x in vec) + "]"


def warmup_async() -> None:
    threading.Thread(target=_get_model, daemon=True).start()
