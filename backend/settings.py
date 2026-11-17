"""Settings from environment variables.

Each one is read when asked for, not at import, so tests can set their own.
"""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = "data/accountable.db"


def database_path() -> Path:
    """The SQLite file. `ACCOUNTABLE_DB` chooses it, relative to the repo root."""
    path = Path(os.environ.get("ACCOUNTABLE_DB") or DEFAULT_DB)
    if not path.is_absolute():
        path = ROOT / path
    return path


def database_url() -> str:
    """The database URL everything else uses."""
    return f"sqlite:///{database_path().as_posix()}"


def backend_port() -> int:
    return int(os.environ.get("BACKEND_PORT") or 8000)
