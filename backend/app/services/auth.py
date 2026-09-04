"""Authentication service: AUST-only identity, password hashing (PBKDF2-HMAC-SHA256), sign up, and sign in."""
import base64
import hashlib
import hmac
import json
import re
import secrets
import time

from ..config import AUTH_SECRET, AUTH_TOKEN_TTL_S, EMAIL_DOMAIN
from ..db import execute, q, q1
from . import schedules
from .common import DomainError

ITERATIONS = 100_000

# AUST issues exactly one address per student — `<name>.<department>.<student id>@aust.edu` — so the
# address is the record: both the ID and the department are read from it, never typed by hand.
_DOMAIN = re.escape(EMAIL_DOMAIN)
CAMPUS_DOMAIN_RE = re.compile(rf"^[^@\s]+@(?:[a-z0-9-]+\.)*{_DOMAIN}$")
CAMPUS_EMAIL_RE = re.compile(
    rf"^(?P<name>[a-z][a-z.-]*)\.(?P<department>[a-z]{{2,10}})\.(?P<student_id>\d[\d-]{{3,19}})"
    rf"@(?:[a-z0-9-]+\.)*{_DOMAIN}$"
)
CAMPUS_EMAIL_HINT = (
    f"name.department.studentid@{EMAIL_DOMAIN} (for example tayeb.cse.20230104027@{EMAIL_DOMAIN})"
)
CAMPUS_ONLY_MESSAGE = f"CampusOS is for AUST students only — use your @{EMAIL_DOMAIN} email address"


def is_campus_email(email: str) -> bool:
    return bool(CAMPUS_DOMAIN_RE.match((email or "").strip().lower()))


def parse_campus_email(email: str) -> tuple[str, str]:
    """Return (department, student_id) read out of an AUST address."""
    match = CAMPUS_EMAIL_RE.match((email or "").strip().lower())
    if not match:
        raise DomainError("INVALID_CAMPUS_EMAIL", f"Use your AUST email in the format {CAMPUS_EMAIL_HINT}")
    return match.group("department").upper(), match.group("student_id")


def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with a cryptographically secure random salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), ITERATIONS)
    return f"pbkdf2:sha256:{ITERATIONS}${salt}${key.hex()}"


def verify_password(password: str, stored_hash: str | None) -> bool:
    """Verify password against stored hash in constant time."""
    if not stored_hash or not stored_hash.startswith("pbkdf2:sha256:"):
        return False
    try:
        parts = stored_hash.split("$")
        iterations = int(parts[0].split(":")[2])
        salt = parts[1]
        expected_key = parts[2]
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
        return secrets.compare_digest(key.hex(), expected_key)
    except Exception:
        return False


def _sign(raw: bytes) -> str:
    return hmac.new(AUTH_SECRET, raw, hashlib.sha256).hexdigest()


def create_token(user: dict) -> str:
    """Generate a signed, expiring bearer session token."""
    now = int(time.time())
    payload = {
        "uid": user["id"],
        "email": user["email"],
        "role": user["role_id"],
        "name": user["name"],
        "student_id": user.get("student_id"),
        "ts": now,
        "exp": now + AUTH_TOKEN_TTL_S,
    }
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return f"{base64.urlsafe_b64encode(raw).decode('utf-8')}.{_sign(raw)}"


def parse_token(token: str) -> dict | None:
    """Verify and parse a bearer session token. Returns None for forged or expired tokens."""
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        raw = base64.urlsafe_b64decode(parts[0].encode("utf-8"))
        if not hmac.compare_digest(parts[1], _sign(raw)):
            return None
        claims = json.loads(raw.decode("utf-8"))
        if int(claims.get("exp", 0)) < int(time.time()):
            return None
        return claims
    except Exception:
        return None


STUDENT_PERMISSIONS = [
    "schedules:view",
    "rooms:view", "rooms:book", "rooms:cancel_own",
    "events:view", "events:register", "events:cancel_own",
    "announcements:view",
    "assignments:view", "assignments:submit",
    "courses:view",
]


def get_user_permissions(role_id: str = "student") -> list[str]:
    """Migration 004 dropped the roles tables: every account is a student."""
    return list(STUDENT_PERMISSIONS)


def sign_up(name: str, email: str, password: str, student_id: str | None = None,
            department: str | None = None) -> dict:
    """Register a new AUST student. The campus email decides the student ID and the department."""
    name = (name or "").strip()
    email = (email or "").strip().lower()

    if not name:
        raise DomainError("MISSING_NAME", "Full name is required")
    if not email or "@" not in email:
        raise DomainError("INVALID_EMAIL", "A valid email address is required")
    if not is_campus_email(email):
        raise DomainError("NON_CAMPUS_EMAIL", CAMPUS_ONLY_MESSAGE)
    if not password or len(password) < 6:
        raise DomainError("WEAK_PASSWORD", "Password must be at least 6 characters")

    # Anything the form sent for these two is ignored: the university address is the source of truth.
    department, student_id = parse_campus_email(email)

    existing_email = q1("SELECT id FROM users WHERE LOWER(email) = %s", [email])
    if existing_email:
        raise DomainError("EMAIL_EXISTS", "An account with this email already exists", 409)

    existing_sid = q1("SELECT id FROM users WHERE student_id = %s", [student_id])
    if existing_sid:
        raise DomainError("STUDENT_ID_EXISTS", "An account with this student ID already exists", 409)

    # Keyed off the unique student ID so the account key is stable and collision-free.
    user_id = f"usr-{student_id}"
    hashed = hash_password(password)

    execute(
        """INSERT INTO users (id, role_id, student_id, name, email, department, status, password_hash)
           VALUES (%s, 'student', %s, %s, %s, %s, 'active', %s)""",
        [user_id, student_id, name, email, department, hashed],
    )
    # No registration data exists for someone who just arrived, so they start on the full cohort load.
    schedules.enroll_in_all_courses(user_id)

    user = q1(
        "SELECT id, role_id, student_id, employee_id, name, email, department, status, created_at FROM users WHERE id = %s",
        [user_id],
    )
    user["permissions"] = get_user_permissions(user["role_id"])
    token = create_token(user)

    return {"token": token, "user": user}


def sign_in(email_or_id: str, password: str) -> dict:
    """Sign in using an AUST email or the student ID, plus the password."""
    ident = (email_or_id or "").strip()
    if not ident or not password:
        raise DomainError("MISSING_CREDENTIALS", "Email/Student ID and password are required")

    if "@" in ident and not is_campus_email(ident):
        raise DomainError("NON_CAMPUS_EMAIL", CAMPUS_ONLY_MESSAGE)

    # Look up user by email or student ID
    user = q1(
        """SELECT id, role_id, student_id, employee_id, name, email, department, status, password_hash
           FROM users
           WHERE LOWER(email) = %s OR student_id = %s OR employee_id = %s OR id = %s""",
        [ident.lower(), ident, ident, ident],
    )

    if not user:
        raise DomainError("INVALID_CREDENTIALS", "Invalid credentials. Please check your email and password.", 401)

    if not verify_password(password, user.get("password_hash")):
        raise DomainError("INVALID_CREDENTIALS", "Invalid credentials. Please check your email and password.", 401)

    if user.get("status") != "active":
        raise DomainError("ACCOUNT_INACTIVE", "This account has been deactivated or suspended.", 403)

    user_data = {
        "id": user["id"],
        "role_id": user["role_id"],
        "student_id": user["student_id"],
        "employee_id": user["employee_id"],
        "name": user["name"],
        "email": user["email"],
        "department": user["department"],
        "status": user["status"],
        "permissions": get_user_permissions(user["role_id"]),
    }
    token = create_token(user_data)
    return {"token": token, "user": user_data}


def get_me(user_id: str) -> dict:
    user = q1(
        """SELECT id, role_id, student_id, employee_id, name, email, department, status
           FROM users WHERE id = %s""",
        [user_id],
    )
    if not user:
        raise DomainError("NOT_FOUND", "User not found", 404)
    user["permissions"] = get_user_permissions(user["role_id"])
    return user


def list_users() -> list[dict]:
    rows = q(
        """SELECT id, role_id, student_id, employee_id, name, email, department, status, created_at
           FROM users ORDER BY role_id, name"""
    )
    for r in rows:
        r["permissions"] = get_user_permissions(r["role_id"])
    return rows

