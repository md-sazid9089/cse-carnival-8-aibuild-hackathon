from fastapi.testclient import TestClient

from app.db import execute, q
from app.main import app

with TestClient(app):
    execute("DELETE FROM users WHERE email IN ('ui.preview@campusos.test', 'cse.20250888@aust.edu')")
    print([r["email"] for r in q("SELECT email FROM users ORDER BY id")])
