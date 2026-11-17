"""Shared test setup.

One database is migrated per test run, and each test gets its own copy of it,
so no test sees another's data and none touches data/accountable.db. Today is
fixed at Monday, Nov 16, 2026, the mockups' date, unless a test says otherwise.
"""

import os
import shutil
import tempfile
from datetime import datetime
from pathlib import Path

# Before any backend import: point the default database somewhere harmless.
_SAFE_DIR = Path(tempfile.mkdtemp(prefix="accountable-tests-"))
os.environ["ACCOUNTABLE_DB"] = str(_SAFE_DIR / "not-used.db")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend import clock, db  # noqa: E402
from backend.main import create_app  # noqa: E402

FIXED_NOW = datetime(2026, 11, 16, 12, 0, 0)


def sqlite_url(path: Path) -> str:
    return f"sqlite:///{Path(path).as_posix()}"


@pytest.fixture(scope="session")
def template_db(tmp_path_factory) -> Path:
    path = tmp_path_factory.mktemp("template") / "template.db"
    db.upgrade(sqlite_url(path))
    return path


@pytest.fixture
def db_path(template_db: Path, tmp_path: Path) -> Path:
    path = tmp_path / "test.db"
    shutil.copyfile(template_db, path)
    return path


@pytest.fixture
def db_url(db_path: Path) -> str:
    return sqlite_url(db_path)


@pytest.fixture(autouse=True)
def fixed_now():
    clock.set_now(FIXED_NOW)
    yield FIXED_NOW
    clock.set_now(None)


@pytest.fixture
def engine(db_url: str):
    engine = db.make_engine(db_url)
    yield engine
    engine.dispose()


@pytest.fixture
def client(db_url: str):
    with TestClient(create_app(db_url)) as test_client:
        yield test_client
