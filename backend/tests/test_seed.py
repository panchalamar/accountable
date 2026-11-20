import re
from datetime import date, datetime
from pathlib import Path

import pytest
from sqlalchemy import create_engine, insert, select

from backend import clock, seed
from backend.crm.tables import activities, deals, organizations
from backend.tests.conftest import sqlite_url


@pytest.fixture
def database(monkeypatch, tmp_path: Path) -> Path:
    path = tmp_path / "data" / "accountable.db"
    monkeypatch.setenv("ACCOUNTABLE_DB", str(path))
    return path


def run(*args: str, answer: str | None = None) -> tuple[int, list[str], list[str]]:
    asked: list[str] = []
    said: list[str] = []

    def ask(question: str) -> str:
        asked.append(question)
        if answer is None:
            raise AssertionError("seed asked a question it shouldn't have")
        return answer

    code = seed.run(list(args), ask=ask, say=said.append)
    return code, asked, said


def rows(path: Path, query) -> list[dict]:
    engine = create_engine(sqlite_url(path))
    try:
        with engine.connect() as conn:
            return [dict(r) for r in conn.execute(query).mappings()]
    finally:
        engine.dispose()


def add_org(path: Path, name: str) -> None:
    engine = create_engine(sqlite_url(path))
    with engine.begin() as conn:
        conn.execute(
            insert(organizations).values(name=name, created_at=clock.now(), updated_at=clock.now())
        )
    engine.dispose()


@pytest.mark.parametrize("answer", ["n", "", "no", "maybe"])
def test_without_yes_it_asks_and_anything_but_yes_changes_nothing(database, answer):
    run("--yes")
    add_org(database, "Mine")
    before = database.read_bytes()
    code, asked, said = run(answer=answer)
    assert code == 0
    assert asked == ["Replace all data with fresh sample data? (y/N) "]
    assert said[-1] == "Nothing changed."
    assert database.read_bytes() == before
    assert not (database.parent / "backups").exists()


@pytest.mark.parametrize("no_answer", [EOFError, KeyboardInterrupt])
def test_no_answer_at_all_changes_nothing(database, no_answer):
    # Input closed (EOFError) or Ctrl+C at the question: a plain no, not a traceback.
    run("--yes")
    add_org(database, "Mine")
    before = database.read_bytes()
    said: list[str] = []

    def ask(_question: str) -> str:
        raise no_answer

    assert seed.run([], ask=ask, say=said.append) == 0
    assert said[-1] == "Nothing changed."
    assert database.read_bytes() == before
    assert not (database.parent / "backups").exists()


@pytest.mark.parametrize("answer", ["y", "yes", " Yes "])
def test_yes_saves_a_backup_says_where_and_replaces_the_data(database, answer):
    run("--yes")
    add_org(database, "Mine")
    clock.set_now(datetime(2026, 11, 16, 14, 5, 9))
    code, asked, said = run(answer=answer)
    assert code == 0 and asked
    backups = list((database.parent / "backups").iterdir())
    assert [b.name for b in backups] == ["accountable-20261116-140509.db"]
    assert any(str(backups[0]) in line for line in said)
    assert "Mine" in [o["name"] for o in rows(backups[0], select(organizations))]
    assert "Mine" not in [o["name"] for o in rows(database, select(organizations))]
    assert len(rows(database, select(deals))) == 40


def test_yes_flag_skips_the_question(database):
    run("--yes")
    add_org(database, "Mine")
    code, asked, _said = run("--yes")
    assert code == 0 and asked == []
    assert "Mine" not in [o["name"] for o in rows(database, select(organizations))]
    assert re.fullmatch(
        r"accountable-\d{8}-\d{6}\.db", next((database.parent / "backups").iterdir()).name
    )


def test_with_no_database_it_creates_one_and_makes_no_backup(database):
    assert not database.exists()
    code, asked, _said = run(answer="n")
    assert code == 0 and asked == []
    assert database.exists()
    assert len(rows(database, select(deals))) == 40
    assert not (database.parent / "backups").exists()


def test_seeding_on_two_days_shifts_the_dates_by_the_same_number_of_days(database):
    def dates() -> list[date]:
        open_closes = [
            d["close_date"]
            for d in rows(database, select(deals).order_by(deals.c.name))
            if d["stage"] not in ("won", "lost")
        ]
        lost_closes = [
            d["close_date"]
            for d in rows(database, select(deals).order_by(deals.c.name))
            if d["stage"] == "lost"
        ]
        follow_ups = [
            a["follow_up_date"]
            for a in rows(database, select(activities).order_by(activities.c.description))
            if a["follow_up_date"]
        ]
        return open_closes + lost_closes + follow_ups

    clock.set_now(datetime(2026, 11, 16, 12, 0))
    run("--yes")
    first = dates()
    clock.set_now(datetime(2026, 11, 26, 12, 0))
    run("--yes")
    second = dates()
    assert len(first) == len(second) > 20
    assert {(b - a).days for a, b in zip(first, second, strict=True)} == {10}
