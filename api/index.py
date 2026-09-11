import sys
from pathlib import Path

# The backend package uses `app.*` imports, so expose backend/ as the import root.
BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app  # noqa: E402

__all__ = ["app"]
