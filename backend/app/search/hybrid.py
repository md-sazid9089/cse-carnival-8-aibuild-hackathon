"""Hybrid search: tsvector keyword rank + pgvector cosine, fused with Reciprocal Rank Fusion (k=60).

The keyword leg ORs the query terms (plainto_tsquery ANDs them, so one extra word like "problems"
would drop an otherwise perfect match). Ranking still puts multi-term hits on top.
"""
import re

from ..db import q
from .embedder import embed, to_pgvector

STOPWORDS = {"the", "a", "an", "of", "in", "on", "at", "for", "to", "is", "are", "any", "about",
             "what", "when", "where", "which", "who", "me", "my", "i", "do", "does", "there", "and"}


def _or_query(text: str) -> str:
    """Build 'term:* | term:*' — prefix matching so 'announce' also finds 'announcement'."""
    terms = [t for t in re.split(r"\W+", str(text).lower()) if len(t) > 1 and t not in STOPWORDS]
    return " | ".join(f"{t}:*" for t in terms[:12])


def hybrid_search(query: str, limit: int = 8) -> list[dict]:
    tsq = _or_query(query)
    if not tsq:
        return []
    qvec = embed(query)
    if qvec is not None:
        sql = """
        WITH kw AS (
          SELECT entity_type, entity_id,
                 ROW_NUMBER() OVER (ORDER BY ts_rank(tsv, to_tsquery('english', %(q)s)) DESC) AS rnk
          FROM search_index
          WHERE tsv @@ to_tsquery('english', %(q)s)
          LIMIT 20
        ),
        vec AS (
          SELECT entity_type, entity_id,
                 ROW_NUMBER() OVER (ORDER BY embedding <=> %(v)s::vector) AS rnk
          FROM search_index
          WHERE embedding IS NOT NULL
          LIMIT 20
        )
        SELECT si.entity_type, si.entity_id, si.content,
               COALESCE(1.0 / (60 + kw.rnk), 0) + COALESCE(1.0 / (60 + vec.rnk), 0) AS score
        FROM search_index si
        LEFT JOIN kw ON kw.entity_type = si.entity_type AND kw.entity_id = si.entity_id
        LEFT JOIN vec ON vec.entity_type = si.entity_type AND vec.entity_id = si.entity_id
        WHERE kw.rnk IS NOT NULL OR vec.rnk IS NOT NULL
        ORDER BY score DESC
        LIMIT %(n)s
        """
        return q(sql, {"q": tsq, "v": to_pgvector(qvec), "n": limit})
    sql = """
    SELECT entity_type, entity_id, content,
           ts_rank(tsv, to_tsquery('english', %(q)s)) AS score
    FROM search_index
    WHERE tsv @@ to_tsquery('english', %(q)s)
    ORDER BY score DESC
    LIMIT %(n)s
    """
    return q(sql, {"q": tsq, "n": limit})
