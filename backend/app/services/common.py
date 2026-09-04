"""Shared validation + the domain error type routers/tools translate uniformly."""
import re
from datetime import date as date_cls
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from ..config import TZ_NAME

TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]
WEEKEND = ["Friday", "Saturday"]


def now_local() -> datetime:
    """Campus time. All date logic uses this, never the database's CURRENT_DATE (which is UTC)."""
    return datetime.now(ZoneInfo(TZ_NAME))


def today_local() -> date_cls:
    return now_local().date()


def date_in(days: int) -> date_cls:
    return today_local() + timedelta(days=days)


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


_TIME_FORMS = re.compile(r"^\s*(\d{1,2})\s*[:.\s]?\s*(\d{2})?\s*([ap])\.?m?\.?\s*$", re.IGNORECASE)


def parse_time(value, field: str = "time") -> str:
    """Accept 15:00, 3 PM, 3pm, 15.00, 3:05pm → 'HH:MM'. A bare hour with no meridiem is ambiguous."""
    if value is None:
        raise DomainError("INVALID_TIME", f"{field} is required")
    text = str(value).strip()
    if TIME_RE.match(text):
        return text
    m = _TIME_FORMS.match(text)
    if not m:
        compact = re.match(r"^\s*(\d{1,2})[:.](\d{2})\s*$", text)
        if compact:
            hour, minute = int(compact.group(1)), int(compact.group(2))
            if hour > 23 or minute > 59:
                raise DomainError("INVALID_TIME", f"{field} must be 24h HH:MM, got {value!r}")
            return f"{hour:02d}:{minute:02d}"
        raise DomainError("INVALID_TIME", f"{field} must be 24h HH:MM (or '3 PM'), got {value!r}")
    hour = int(m.group(1))
    minute = int(m.group(2) or 0)
    meridiem = (m.group(3) or "").lower()
    if not meridiem:
        raise DomainError("AMBIGUOUS_TIME", f"{field} {value!r} is ambiguous — say AM/PM or use 24h HH:MM")
    if hour < 1 or hour > 12 or minute > 59:
        raise DomainError("INVALID_TIME", f"{field} is not a valid time: {value!r}")
    if meridiem == "p" and hour != 12:
        hour += 12
    if meridiem == "a" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"
