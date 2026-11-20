"""Puts the app together: migrations, sample data, error handlers and each area's routes.

Run it with:
    uv run uvicorn backend.main:create_app --factory --host 127.0.0.1 --port 8000
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.trustedhost import TrustedHostMiddleware

from backend import db, errors, settings
from backend.crm import sample_data as crm_sample_data
from backend.crm.routes import router as crm_router

# The only host names the backend answers to. Listening on 127.0.0.1 keeps
# other computers out, but a web page could still point its own domain at
# this computer (DNS rebinding) and reach the API; its requests carry that
# domain as their Host, so they're refused. Vite's proxy keeps "localhost".
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]


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
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
        yield
        engine.dispose()

    # No docs pages: they're not part of the API, and they load from the internet.
    app = FastAPI(
        title="Accountable", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None
    )
    app.state.engine = engine
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=ALLOWED_HOSTS)
    errors.install(app)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(crm_router)
    return app
