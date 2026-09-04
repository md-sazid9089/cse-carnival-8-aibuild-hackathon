"""Course catalogue.

`schedules.course` and `assignments.course` are foreign keys to `courses.code`
(migration 003), so a course code arriving through CRUD or an agent tool has to be
registered before the referencing row is written — otherwise a perfectly valid
"add a class for CSE 4118" would fail on a constraint the user never asked about.
"""
from ..db import execute


def ensure_course(code: str, title: str | None = None) -> None:
    code = str(code or "").strip()
    if not code:
        return
    name = str(title or "").strip() or code
    execute(
        """INSERT INTO courses (code, title, department, kind)
           VALUES (%s, %s, split_part(%s, ' ', 1), %s)
           ON CONFLICT (code) DO NOTHING""",
        [code, name, code, "lab" if name.lower().endswith("lab") else "theory"],
    )
