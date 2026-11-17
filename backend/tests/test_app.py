from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, insert, text
from sqlalchemy.exc import IntegrityError

from backend import db, settings
from backend.crm import tables
from backend.main import create_app
from backend.tests.conftest import sqlite_url

EXPECTED_TABLES = {"organizations", "contacts", "deals", "activities", "stage_changes"}

EXPECTED_INDEXES = {
    "contacts": {"ix_contacts_organization_id"},
    "deals": {"ix_deals_organization_id", "ix_deals_main_contact_id", "ix_deals_stage_position"},
    "activities": {
        "ix_activities_contact_id",
        "ix_activities_deal_id",
        "ix_activities_follow_up_date",
    },
    "stage_changes": {"ix_stage_changes_deal_id"},
}

EXPECTED_CHECKS = {
    "contacts": {"ck_contacts_status"},
    "deals": {
        "ck_deals_stage",
        "ck_deals_furthest_stage",
        "ck_deals_value",
        "ck_deals_probability",
    },
    "activities": {"ck_activities_type", "ck_activities_linked"},
    "stage_changes": {"ck_stage_changes_from_stage", "ck_stage_changes_to_stage"},
}


def test_health_answers_ok(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_new_database_gets_every_table_index_and_check(tmp_path: Path):
    url = sqlite_url(tmp_path / "fresh" / "accountable.db")
    with TestClient(create_app(url)):
        pass

    engine = db.make_engine(url)
    try:
        inspector = inspect(engine)
        assert EXPECTED_TABLES <= set(inspector.get_table_names())
        for table, names in EXPECTED_INDEXES.items():
            assert names <= {ix["name"] for ix in inspector.get_indexes(table)}, table
        for table, names in EXPECTED_CHECKS.items():
            assert names <= {ck["name"] for ck in inspector.get_check_constraints(table)}, table
        with engine.connect() as conn:
            name_index = conn.execute(
                text("SELECT sql FROM sqlite_master WHERE name = 'uq_organizations_name_key'")
            ).scalar_one()
        assert "UNIQUE INDEX" in name_index.upper()
        assert "lower(trim(name))" in name_index
    finally:
        engine.dispose()


def test_foreign_keys_are_on_for_every_connection(engine):
    stamp = datetime(2026, 11, 16, 12, 0)
    for _ in range(3):  # several connections from the pool
        with pytest.raises(IntegrityError), engine.begin() as conn:
            conn.execute(
                insert(tables.contacts).values(
                    organization_id=999,
                    name="Nobody",
                    status="lead",
                    created_at=stamp,
                    updated_at=stamp,
                )
            )
        with engine.connect() as conn:
            assert conn.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1


def test_accountable_db_chooses_the_file(monkeypatch, tmp_path: Path):
    monkeypatch.delenv("ACCOUNTABLE_DB", raising=False)
    assert settings.database_path() == settings.ROOT / "data" / "accountable.db"

    monkeypatch.setenv("ACCOUNTABLE_DB", str(tmp_path / "mine.db"))
    assert settings.database_path() == tmp_path / "mine.db"
    assert settings.database_url() == sqlite_url(tmp_path / "mine.db")

    monkeypatch.setenv("ACCOUNTABLE_DB", "data/test/other.db")
    assert settings.database_path() == settings.ROOT / "data" / "test" / "other.db"
