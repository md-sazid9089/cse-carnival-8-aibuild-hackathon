"""Hybrid search: tsvector keyword rank + pgvector cosine, fused with Reciprocal Rank Fusion (k=60)."""
from ..db import q
from .embedder import embed, to_pgvector


def hybrid_search(query: str, limit: int = 8) -> list[dict]:
    qvec = embed(query)
    if qvec is not None:
        sql = """
        WITH kw AS (
          SELECT entity_type, entity_id,
                 ROW_NUMBER() OVER (ORDER BY ts_rank(tsv, plainto_tsquery('english', %(q)s)) DESC) AS rnk
          FROM search_index
          WHERE tsv @@ plainto_tsquery('english', %(q)s)
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
        return q(sql, {"q": query, "v": to_pgvector(qvec), "n": limit})
    sql = """
    SELECT entity_type, entity_id, content,
           ts_rank(tsv, plainto_tsquery('english', %(q)s)) AS score
    FROM search_index
    WHERE tsv @@ plainto_tsquery('english', %(q)s)
    ORDER BY score DESC
    LIMIT %(n)s
    """
    return q(sql, {"q": query, "n": limit})
