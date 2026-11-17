"""The CRM's API routes, collected into one router for main.py to add."""

from fastapi import APIRouter

from backend.crm.routes import activities, contacts, dashboard, deals, organizations

router = APIRouter(prefix="/api")
router.include_router(organizations.router)
router.include_router(contacts.router)
router.include_router(deals.router)
router.include_router(activities.router)
router.include_router(dashboard.router)
