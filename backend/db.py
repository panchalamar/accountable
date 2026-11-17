"""The database: shared metadata, the engine and migrations."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import Request
from sqlalchemy import Column, Engine, Index, MetaData, create_engine, event, inspect
from sqlalchemy.engine import make_url

from backend import settings

# Named constraints, so Alembic's batch mode can rebuild SQLite tables and the
# migration test can compare constraints by name.
metadata = MetaData(
    naming_convention={
        "ix": "ix_%(table_name)s_%(column_0_N_name)s",
        "uq": "uq_%(table_name)s_%(column_0_N_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    }
)

MIGRATIONS = settings.ROOT / "backend" / "migrations"


def include_object(obj, name, type_, reflected, compare_to) -> bool:
    """Alembic's filter for autogenerate and compare.

    SQLite can't reflect expression indexes, such as the one on organizations'
    lower-case names, so autogenerate can't compare them. Add them to a
    migration by hand. test_migrations.py checks they exist.
    """
    if type_ == "index" and not reflected and is_expression_index(obj):
        return False
    return True


def is_expression_index(index: Index) -> bool:
    return any(not isinstance(expr, Column) for expr in index.expressions)


def _ensure_folder(url: str) -> None:
    parsed = make_url(url)
    if parsed.get_backend_name() == "sqlite" and parsed.database:
        Path(parsed.database).parent.mkdir(parents=True, exist_ok=True)


def make_engine(url: str | None = None) -> Engine:
    """An engine with foreign keys on for every SQLite connection.

    Each transaction starts with BEGIN IMMEDIATE, so two requests writing at
    once wait their turn instead of failing with "database is locked".
    """
    url = url or settings.database_url()
    _ensure_folder(url)
    engine = create_engine(url, connect_args={"check_same_thread": False, "timeout": 15})

    @event.listens_for(engine, "connect")
    def _on_connect(dbapi_connection, _record):
        # Let SQLAlchemy's "begin" event start transactions, not the driver.
        dbapi_connection.isolation_level = None
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.close()

    @event.listens_for(engine, "begin")
    def _on_begin(connection):
        connection.exec_driver_sql("BEGIN IMMEDIATE")

    return engine


def alembic_config(url: str | None = None) -> Config:
    config = Config(str(settings.ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(MIGRATIONS))
    config.attributes["url"] = url or settings.database_url()
    config.attributes["from_app"] = True
    return config


def is_new(url: str) -> bool:
    """True when migrations have never run on this database."""
    _ensure_folder(url)
    engine = create_engine(url)
    try:
        return not inspect(engine).has_table("alembic_version")
    finally:
        engine.dispose()


def upgrade(url: str | None = None) -> None:
    """Run every migration not yet applied."""
    url = url or settings.database_url()
    _ensure_folder(url)
    command.upgrade(alembic_config(url), "head")


def get_engine(request: Request) -> Engine:
    """FastAPI dependency: the app's engine."""
    return request.app.state.engine
