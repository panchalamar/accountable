from fastapi import APIRouter, Response

from backend.crm import queries, rules, schemas
from backend.db import EngineDep

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=list[schemas.OrganizationRow])
def list_organizations(engine: EngineDep):
    return queries.list_organizations(engine)


@router.post("", status_code=201, response_model=schemas.Organization)
def add_organization(body: schemas.OrganizationIn, engine: EngineDep):
    return queries.organization(engine, rules.add_organization(engine, body))


@router.get("/{org_id}", response_model=schemas.Organization)
def get_organization(org_id: int, engine: EngineDep):
    return queries.organization(engine, org_id)


@router.put("/{org_id}", response_model=schemas.Organization)
def edit_organization(org_id: int, body: schemas.OrganizationIn, engine: EngineDep):
    rules.edit_organization(engine, org_id, body)
    return queries.organization(engine, org_id)


@router.get("/{org_id}/delete-check", response_model=schemas.OrganizationDeleteCheck)
def organization_delete_check(org_id: int, engine: EngineDep):
    return queries.organization_check(engine, org_id)


@router.delete("/{org_id}", status_code=204)
def delete_organization(org_id: int, engine: EngineDep):
    rules.delete_organization(engine, org_id)
    return Response(status_code=204)
