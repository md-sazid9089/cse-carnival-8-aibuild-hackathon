"""Maintain search_index rows on every write (keyword sync, embedding fire-and-forget)."""
import threading

from ..db import execute, q
from .embedder import embed, to_pgvector

SEARCHABLE = {"announcement", "event", "assignment"}


def build_content(entity_type: str, rec: dict) -> str:
    if entity_type == "announcement":
        return f"{rec['title']}. {rec['body']} (posted by {rec['posted_by']}, priority {rec['priority']})"
    if entity_type == "event":
        return f"{rec['name']}. {rec['description']} (venue {rec['venue']}, organizer {rec['organizer']}, date {rec['date']})"
    return f"{rec['course']} {rec['course_title']}: {rec['title']}. {rec['description']} (deadline {rec['deadline']})"


def _embed_and_store(entity_type: str, entity_id: str, content: str) -> None:
    vec = embed(content)
    if vec is not None:
        execute(
            "UPDATE search_index SET embedding = %s::vector WHERE entity_type = %s AND entity_id = %s",
            [to_pgvector(vec), entity_type, entity_id],
        )


def reindex(entity_type: str, rec: dict) -> None:
    content = build_content(entity_type, rec)
    execute(
        """INSERT INTO search_index (entity_type, entity_id, content) VALUES (%s,%s,%s)
           ON CONFLICT (entity_type, entity_id) DO UPDATE SET content = EXCLUDED.content, embedding = NULL""",
        [entity_type, rec["id"], content],
    )
    threading.Thread(target=_embed_and_store, args=(entity_type, rec["id"], content), daemon=True).start()


def unindex(entity_type: str, entity_id: str) -> None:
    execute("DELETE FROM search_index WHERE entity_type = %s AND entity_id = %s", [entity_type, entity_id])


def reindex_all() -> None:
    def run():
        for row in q("SELECT entity_type, entity_id, content FROM search_index WHERE embedding IS NULL"):
            _embed_and_store(row["entity_type"], row["entity_id"], row["content"])

    threading.Thread(target=run, daemon=True).start()
