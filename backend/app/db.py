"""Connection pool, migrations, and row serialization."""
import datetime

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import DATABASE_URL, MIGRATIONS_DIR

pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=10, kwargs={"row_factory": dict_row}, open=False)


def ser(v):
    if isinstance(v, datetime.time):
        return v.strftime("%H:%M")
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.isoformat()
    return v


def ser_row(row: dict) -> dict:
    return {k: ser(v) for k, v in row.items()}


def q(sql: str, params=None) -> list[dict]:
    with pool.connection() as conn:
        rows = conn.execute(sql, params or []).fetchall()
    return [ser_row(r) for r in rows]


def q1(sql: str, params=None) -> dict | None:
    rows = q(sql, params)
    return rows[0] if rows else None


def execute(sql: str, params=None) -> None:
    with pool.connection() as conn:
        conn.execute(sql, params or [])


def next_id(table: str, prefix: str) -> str:
    row = q1(
        f"SELECT COALESCE(MAX(NULLIF(split_part(id, '-', 2), '')::int), 0) + 1 AS n FROM {table} WHERE id LIKE %s",
        [f"{prefix}-%"],
    )
    return f"{prefix}-{row['n']:03d}"


def migrate() -> None:
    pool.open()
    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        with pool.connection() as conn:
            conn.execute(path.read_text(encoding="utf-8"))
