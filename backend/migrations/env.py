"""Alembic's setup.

The database URL comes from `backend.db.upgrade()` when the app runs the
migrations, or from `backend/settings.py` when Alembic runs from the command
line. The tables come from each area's tables.py.
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

import backend.crm.tables  # noqa: F401  registers the CRM's tables on the metadata
from backend import settings
from backend.db import include_object, metadata

config = context.config

# Logging only when run from the command line, so the app's own logs keep working.
if config.config_file_name and not config.attributes.get("from_app"):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = metadata


def _url() -> str:
    return config.attributes.get("url") or settings.database_url()


def _configure(**kwargs) -> None:
    context.configure(
        target_metadata=target_metadata,
        render_as_batch=True,  # SQLite can't change a column in place
        compare_type=True,
        include_object=include_object,
        **kwargs,
    )


def run_migrations_offline() -> None:
    _configure(url=_url(), literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Foreign keys stay off while migrating, as SQLite's batch mode needs when
    # it rebuilds a table. The app's own connections turn them on.
    engine = create_engine(_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        _configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
