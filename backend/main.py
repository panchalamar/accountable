"""Puts the app together: migrations, sample data, error handlers and each area's routes.

Run it with:
    uv run uvicorn backend.main:create_app --factory --host 127.0.0.1 --port 8000
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend import db, errors, settings
from backend.crm import sample_data as crm_sample_data
from backend.crm.routes import router as crm_router


def add_sample_data(engine) -> None:
    """Each area's sample data, in one transaction. Also used by seed.py."""
    with engine.begin() as conn:
        crm_sample_data.add_to(conn)


def create_app(url: str | None = None) -> FastAPI:
    url = url or settings.database_url()
    new = db.is_new(url)
    db.upgrade(url)
    engine = db.make_engine(url)
    if new:
        add_sample_data(engine)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        yield
        engine.dispose()

    app = FastAPI(title="Accountable", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.state.engine = engine
    errors.install(app)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(crm_router)
    return app
