from fastapi import APIRouter, Response

from backend.crm import queries, rules, schemas
from backend.db import EngineDep

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=list[schemas.ContactRow])
def list_contacts(engine: EngineDep):
    return queries.list_contacts(engine)


@router.post("", status_code=201, response_model=schemas.Contact)
def add_contact(body: schemas.ContactIn, engine: EngineDep):
    return queries.contact(engine, rules.add_contact(engine, body))


@router.get("/{contact_id}", response_model=schemas.Contact)
def get_contact(contact_id: int, engine: EngineDep):
    return queries.contact(engine, contact_id)


@router.put("/{contact_id}", response_model=schemas.Contact)
def edit_contact(contact_id: int, body: schemas.ContactIn, engine: EngineDep):
    rules.edit_contact(engine, contact_id, body)
    return queries.contact(engine, contact_id)


@router.get("/{contact_id}/delete-check", response_model=schemas.ContactDeleteCheck)
def contact_delete_check(contact_id: int, engine: EngineDep):
    return queries.contact_check(engine, contact_id)


@router.get("/{contact_id}/timeline", response_model=list[schemas.TimelineItem])
def contact_timeline(contact_id: int, engine: EngineDep):
    return queries.contact_timeline(engine, contact_id)


@router.delete("/{contact_id}", status_code=204)
def delete_contact(contact_id: int, engine: EngineDep):
    rules.delete_contact(engine, contact_id)
    return Response(status_code=204)
