import re
from datetime import date, datetime
from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from fastapi.testclient import TestClient
from sqlalchemy import CheckConstraint, Index, inspect, insert, select
from sqlalchemy.exc import IntegrityError

from backend import db
from backend.crm import tables
from backend.main import create_app
from backend.tests.conftest import sqlite_url

STAMP = datetime(2026, 11, 16, 12, 0)


def _normalise(sql: str) -> str:
    return re.sub(r"\s+", " ", str(sql)).strip().lower()


def _dump(url: str) -> list[str]:
    engine = db.make_engine(url)
    try:
        with engine.connect() as conn:
            return list(conn.connection.dbapi_connection.iterdump())
    finally:
        engine.dispose()


def _add_deal(conn, **overrides) -> int:
    org = conn.execute(
        insert(tables.organizations).values(name="Acme Ltd", created_at=STAMP, updated_at=STAMP)
    ).inserted_primary_key[0]
    contact = conn.execute(
        insert(tables.contacts).values(
            organization_id=org, name="Ann", status="lead", created_at=STAMP, updated_at=STAMP
        )
    ).inserted_primary_key[0]
    values = dict(
        organization_id=org,
        main_contact_id=contact,
        name="Big deal",
        stage="new",
        value=100_000,
        probability=10,
        close_date=date(2026, 11, 16),
        furthest_stage="new",
        position=0,
        created_at=STAMP,
        updated_at=STAMP,
    )
    values.update(overrides)
    return conn.execute(insert(tables.deals).values(**values)).inserted_primary_key[0]


def test_migrations_match_the_tables_exactly(tmp_path: Path):
    url = sqlite_url(tmp_path / "empty.db")
    db.upgrade(url)
    engine = db.make_engine(url)
    try:
        with engine.connect() as conn:
            context = MigrationContext.configure(
                conn, opts={"compare_type": True, "include_object": db.include_object}
            )
            assert compare_metadata(context, db.metadata) == []

        # Alembic's compare leaves out check constraints and expression
        # indexes, so compare those here by name and by text.
        inspector = inspect(engine)
        for table in db.metadata.sorted_tables:
            expected = {
                c.name: _normalise(c.sqltext)
                for c in table.constraints
                if isinstance(c, CheckConstraint)
            }
            found = {
                c["name"]: _normalise(c["sqltext"])
                for c in inspector.get_check_constraints(table.name)
            }
            assert found == expected, table.name

        expression_indexes = [
            ix
            for table in db.metadata.sorted_tables
            for ix in table.indexes
            if db.is_expression_index(ix)
        ]
        assert [ix.name for ix in expression_indexes] == ["uq_organizations_name_key"]
        with engine.connect() as conn:
            rows = conn.exec_driver_sql(
                "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL"
            ).all()
        created = {name: _normalise(sql) for name, sql in rows}
        for ix in expression_indexes:
            assert ix.name in created
            assert "unique" in created[ix.name]
            assert "lower(trim(name))" in created[ix.name]
            assert isinstance(ix, Index) and ix.unique
    finally:
        engine.dispose()


def test_starting_on_an_up_to_date_database_changes_nothing(db_url: str):
    engine = db.make_engine(db_url)
    with engine.begin() as conn:
        _add_deal(conn)
    engine.dispose()
    before = _dump(db_url)

    with TestClient(create_app(db_url)):
        pass

    assert _dump(db_url) == before


def test_date_columns_are_python_dates_stored_as_iso_text(engine):
    with engine.begin() as conn:
        deal_id = _add_deal(conn, close_date=date(2026, 11, 16))
    with engine.connect() as conn:
        value = conn.execute(
            select(tables.deals.c.close_date).where(tables.deals.c.id == deal_id)
        ).scalar_one()
        raw = conn.exec_driver_sql("SELECT close_date FROM deals WHERE id = ?", (deal_id,)).scalar_one()
    assert value == date(2026, 11, 16)
    assert type(value) is date
    assert raw == "2026-11-16"


def test_check_constraints_are_enforced_by_the_database(engine):
    with pytest.raises(IntegrityError, match="ck_deals_value"), engine.begin() as conn:
        _add_deal(conn, value=-1)
