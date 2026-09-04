import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
# Load .env from workspace root or backend directory
load_dotenv(ROOT / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://campusos:campusos@localhost:5433/campusos")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "z-ai/glm-5.2:free")
OPENROUTER_ROUTER_MODEL = os.getenv("OPENROUTER_ROUTER_MODEL", "nvidia/nemotron-3.5-lightning:free")
FALLBACK_SINGLE_AGENT = os.getenv("FALLBACK_SINGLE_AGENT", "0") == "1"
EMBEDDINGS_ENABLED = os.getenv("EMBEDDINGS_ENABLED", "1") == "1"
TZ_NAME = os.getenv("TZ_NAME", "Asia/Dhaka")
# Comma-separated extra origins for a separately hosted frontend (e.g. https://campusos.vercel.app)
ALLOWED_ORIGINS = ["http://localhost:5173"] + [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()
]
DATA_DIR = ROOT / "data"
CLIENT_DIST = ROOT / "client" / "dist"
MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"
