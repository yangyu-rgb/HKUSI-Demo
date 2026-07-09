"""Export the FastAPI schema used to generate frontend TypeScript contracts."""

from pathlib import Path
import json
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402


output = ROOT_DIR / "docs" / "openapi.json"
output.write_text(
    json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print(output)
