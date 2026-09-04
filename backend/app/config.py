import os
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


DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://campusos:campusos@localhost:5433/campusos")

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
AGENT_TURN_BUDGET_S = _int("AGENT_TURN_BUDGET_S", 45)
AGENT_CALL_TIMEOUT_S = _int("AGENT_CALL_TIMEOUT_S", 30)
AGENT_MAX_CONCURRENT = _int("AGENT_MAX_CONCURRENT", 8)
AGENT_MAX_TOKENS = _int("AGENT_MAX_TOKENS", 700)
AGENT_HISTORY_TURNS = _int("AGENT_HISTORY_TURNS", 12)
AGENT_DAILY_CAP = _int("AGENT_DAILY_CAP", 800)
AGENT_DEGRADED_MODE = os.getenv("AGENT_DEGRADED_MODE", "1") == "1"

EMBEDDINGS_ENABLED = os.getenv("EMBEDDINGS_ENABLED", "1") == "1"
TZ_NAME = os.getenv("TZ_NAME", "Asia/Dhaka")
# Local dev origins plus any extra origin for a separately hosted frontend.
ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"] + _csv("ALLOWED_ORIGINS")
APP_URL = os.getenv("APP_URL", "http://localhost:8000")

DATA_DIR = ROOT / "data"
CLIENT_DIST = ROOT / "client" / "dist"
MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"

AGENT_CONFIGURED = bool(OPENROUTER_API_KEYS)
