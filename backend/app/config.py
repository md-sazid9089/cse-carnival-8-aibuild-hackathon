import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
# Load .env from workspace root or backend directory
load_dotenv(ROOT / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

def _csv(name: str, default: str = "") -> list[str]:
    return [v.strip() for v in os.getenv(name, default).split(",") if v.strip()]


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production"

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Copy .env.example to .env and point it at your Postgres "
        "(the docker-compose service, or any hosted instance with pgvector)."
    )

# --- OpenRouter (only provider). Pool of keys from separate accounts, cycled per request.
OPENROUTER_API_KEYS = _csv("OPENROUTER_API_KEYS") or _csv("OPENROUTER_API_KEY")
# Ordered model chain: each entry is tried against every healthy key before moving on.
OPENROUTER_MODELS = _csv(
    "OPENROUTER_MODELS",
    "z-ai/glm-5.2:free,minimax/minimax-m3:free,nvidia/nemotron-3.5-lightning:free",
)
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
# Free-tier allowances are per account; both are advisory (a real 429 always wins).
OPENROUTER_RPD_PER_KEY = _int("OPENROUTER_RPD_PER_KEY", 50)
OPENROUTER_RPM_PER_KEY = _int("OPENROUTER_RPM_PER_KEY", 20)

AGENT_MAX_ITERATIONS = _int("AGENT_MAX_ITERATIONS", 6)
# Two hops (decide tools -> answer from results) must both fit, and free models are slow.
AGENT_TURN_BUDGET_S = _int("AGENT_TURN_BUDGET_S", 75)
AGENT_CALL_TIMEOUT_S = _int("AGENT_CALL_TIMEOUT_S", 30)
AGENT_MAX_CONCURRENT = _int("AGENT_MAX_CONCURRENT", 8)
AGENT_MAX_TOKENS = _int("AGENT_MAX_TOKENS", 700)
AGENT_HISTORY_TURNS = _int("AGENT_HISTORY_TURNS", 12)
AGENT_DAILY_CAP = _int("AGENT_DAILY_CAP", 800)
AGENT_DEGRADED_MODE = os.getenv("AGENT_DEGRADED_MODE", "1") == "1"

# Per-visitor ceiling on agent calls, so one client cannot drain the shared free quota.
RATE_LIMIT_PER_MINUTE = _int("RATE_LIMIT_PER_MINUTE", 20)
RATE_LIMIT_PER_DAY = _int("RATE_LIMIT_PER_DAY", 200)

EMBEDDINGS_ENABLED = os.getenv("EMBEDDINGS_ENABLED", "1") == "1"
TZ_NAME = os.getenv("TZ_NAME", "Asia/Dhaka")
DEPARTMENT = os.getenv("DEPARTMENT", "CSE")
EMAIL_DOMAIN = os.getenv("EMAIL_DOMAIN", "aust.edu").lstrip("@")

# Session-token signing key. Outside production an unset key means a fresh random one per
# process, so tokens stop working after a restart — never a guessable constant in a public repo.
if IS_PRODUCTION and not os.getenv("AUTH_SECRET"):
    raise RuntimeError("AUTH_SECRET must be set in production, otherwise every restart signs out every user.")
AUTH_SECRET = (os.getenv("AUTH_SECRET") or secrets.token_hex(32)).encode("utf-8")
AUTH_TOKEN_TTL_S = _int("AUTH_TOKEN_TTL_S", 12 * 3600)
# Password for the accounts named in the seed data. Unset = those accounts cannot sign in
# and everyone registers their own; a password must never be shipped in the repo.
SEED_USER_PASSWORD = os.getenv("SEED_USER_PASSWORD", "").strip()

# Origins allowed to call the API. Localhost is only assumed while developing.
ALLOWED_ORIGINS = _csv("ALLOWED_ORIGINS")
if not IS_PRODUCTION:
    ALLOWED_ORIGINS += ["http://localhost:5173", "http://127.0.0.1:5173"]
APP_URL = os.getenv("APP_URL", "").strip()

DATA_DIR = ROOT / "data"
CLIENT_DIST = ROOT / "client" / "dist"
MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"

AGENT_CONFIGURED = bool(OPENROUTER_API_KEYS)
