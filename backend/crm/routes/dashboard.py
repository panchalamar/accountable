from fastapi import APIRouter, Depends
from sqlalchemy import Engine

from backend.crm import dashboard, schemas
from backend.db import get_engine

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=schemas.Dashboard)
def get_dashboard(engine: Engine = Depends(get_engine)):
    return dashboard.dashboard(engine)
