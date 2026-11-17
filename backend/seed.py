"""npm run seed: replaces all data with fresh sample data, after asking.

    uv run python -m backend.seed          asks first
    uv run python -m backend.seed --yes    doesn't ask

It saves a copy of the current database in a backups folder beside it first.
The database is emptied and rebuilt in place, rather than deleted, so an app
that's still running sees the new data after a browser refresh.
"""

import argparse
import sqlite3
import sys
import warnings
from collections.abc import Callable
from pathlib import Path

from sqlalchemy import MetaData, create_engine
from sqlalchemy.exc import SAWarning

from backend import clock, db, settings
from backend.main import add_sample_data

QUESTION = "Replace all data with fresh sample data? (y/N) "


def backup_path(database: Path) -> Path:
    stamp = clock.now().strftime("%Y%m%d-%H%M%S")
    return database.parent / "backups" / f"accountable-{stamp}.db"


def _backup(database: Path) -> Path:
    target = backup_path(database)
    target.parent.mkdir(parents=True, exist_ok=True)
    source = sqlite3.connect(database)
    copy = sqlite3.connect(target)
    try:
        source.backup(copy)  # a consistent copy, even if the app is running
    finally:
        copy.close()
        source.close()
    return target


def _empty(url: str) -> None:
    """Drops every table, including Alembic's, whichever migrations made them.

    A plain autocommit connection, since SQLite ignores the foreign keys pragma
    and refuses VACUUM inside a transaction.
    """
    engine = create_engine(url)
    try:
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.exec_driver_sql("PRAGMA foreign_keys = OFF")
            meta = MetaData()
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", SAWarning)  # expression indexes go with their tables
                meta.reflect(conn)
            meta.drop_all(conn)
            conn.exec_driver_sql("VACUUM")
    finally:
        engine.dispose()


def run(argv: list[str] | None = None, ask: Callable[[str], str] = input, say: Callable[[str], None] = print) -> int:
    parser = argparse.ArgumentParser(description="Reset Accountable's data to the sample data.")
    parser.add_argument("--yes", action="store_true", help="don't ask first")
    args = parser.parse_args(argv)

    database = settings.database_path()
    url = settings.database_url()

    if database.exists():
        say(
            "This replaces everything in Accountable with fresh sample data.\n"
            f"Your current data is in {database}. A copy of it is saved first."
        )
        if not args.yes:
            answer = ask(QUESTION).strip().lower()
            if answer not in ("y", "yes"):
                say("Nothing changed.")
                return 0
        saved = _backup(database)
        say(f"Saved a copy of your data to {saved}")
        _empty(url)
    else:
        say(f"There's no database yet, so a new one with the sample data is being made at {database}")

    db.upgrade(url)
    engine = db.make_engine(url)
    try:
        add_sample_data(engine)
    finally:
        engine.dispose()
    say("Done. Accountable has fresh sample data. If it's open in your browser, refresh the page.")
    return 0


if __name__ == "__main__":
    sys.exit(run())
