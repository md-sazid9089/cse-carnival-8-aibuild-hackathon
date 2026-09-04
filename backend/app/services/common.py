"""Shared validation + the domain error type routers/tools translate uniformly."""
import re
from datetime import date as date_cls

TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]


class DomainError(Exception):
    def __init__(self, reason: str, detail: str, status: int = 400):
        super().__init__(detail)
        self.reason = reason
        self.detail = detail
        self.status = status


def require(data: dict, fields: list[str]) -> None:
    missing = [f for f in fields if data.get(f) in (None, "", [])]
    if missing:
        raise DomainError("MISSING_FIELDS", f"Missing required fields: {', '.join(missing)}")


def check_time(value: str, field: str) -> None:
    if not TIME_RE.match(str(value)):
        raise DomainError("INVALID_TIME", f"{field} must be 24h HH:MM, got {value!r}")


def check_time_order(start: str, end: str) -> None:
    if str(start) >= str(end):
        raise DomainError("INVALID_TIME_RANGE", f"start_time {start} must be before end_time {end}")


def check_date(value: str, field: str) -> None:
    try:
        date_cls.fromisoformat(str(value))
    except ValueError as exc:
        raise DomainError("INVALID_DATE", f"{field} must be YYYY-MM-DD, got {value!r}") from exc


def check_enum(value: str, allowed: list[str], field: str) -> None:
    if value not in allowed:
        raise DomainError("INVALID_ENUM", f"{field} must be one of {allowed}, got {value!r}")


def to_int(value, field: str, minimum: int | None = None) -> int:
    try:
        if isinstance(value, bool):
            raise ValueError
        n = int(value)
    except (TypeError, ValueError) as exc:
        raise DomainError("INVALID_NUMBER", f"{field} must be an integer, got {value!r}") from exc
    if minimum is not None and n < minimum:
        raise DomainError("INVALID_NUMBER", f"{field} must be >= {minimum}, got {n}")
    return n


def to_str_list(value, field: str) -> list[str]:
    if isinstance(value, str):
        value = [v.strip() for v in value.split(",")]
    if not isinstance(value, (list, tuple)) or not all(isinstance(v, str) for v in value):
        raise DomainError("INVALID_LIST", f"{field} must be a list of strings")
    return [v for v in value if v]


def weekday_name(iso_date: str) -> str:
    return date_cls.fromisoformat(str(iso_date)).strftime("%A")
