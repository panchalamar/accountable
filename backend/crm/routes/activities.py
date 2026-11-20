from fastapi import APIRouter, Response

from backend.crm import queries, rules, schemas
from backend.db import EngineDep

router = APIRouter(prefix="/activities", tags=["activities"])


@router.post("", status_code=201, response_model=schemas.Activity)
def add_activity(body: schemas.ActivityIn, engine: EngineDep):
    return queries.activity(engine, rules.add_activity(engine, body))


@router.get("/{activity_id}", response_model=schemas.Activity)
def get_activity(activity_id: int, engine: EngineDep):
    return queries.activity(engine, activity_id)


@router.put("/{activity_id}", response_model=schemas.Activity)
def edit_activity(activity_id: int, body: schemas.ActivityIn, engine: EngineDep):
    rules.edit_activity(engine, activity_id, body)
    return queries.activity(engine, activity_id)


@router.patch("/{activity_id}", response_model=schemas.Activity)
def set_done(activity_id: int, body: schemas.ActivityDone, engine: EngineDep):
    rules.set_activity_done(engine, activity_id, body.done)
    return queries.activity(engine, activity_id)


@router.delete("/{activity_id}", status_code=204)
def delete_activity(activity_id: int, engine: EngineDep):
    rules.delete_activity(engine, activity_id)
    return Response(status_code=204)
