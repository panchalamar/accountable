from fastapi import APIRouter

from backend.crm import dashboard, schemas
from backend.db import EngineDep

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=schemas.Dashboard)
def get_dashboard(engine: EngineDep):
    return dashboard.dashboard(engine)
