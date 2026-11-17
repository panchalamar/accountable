from fastapi import APIRouter, Depends, Response
from sqlalchemy import Engine

from backend.crm import queries, rules, schemas
from backend.db import get_engine

router = APIRouter(prefix="/activities", tags=["activities"])


@router.post("", status_code=201, response_model=schemas.Activity)
def add_activity(body: schemas.ActivityIn, engine: Engine = Depends(get_engine)):
    return queries.activity(engine, rules.add_activity(engine, body))


@router.get("/{activity_id}", response_model=schemas.Activity)
def get_activity(activity_id: int, engine: Engine = Depends(get_engine)):
    return queries.activity(engine, activity_id)


@router.put("/{activity_id}", response_model=schemas.Activity)
def edit_activity(activity_id: int, body: schemas.ActivityIn, engine: Engine = Depends(get_engine)):
    rules.edit_activity(engine, activity_id, body)
    return queries.activity(engine, activity_id)


@router.patch("/{activity_id}", response_model=schemas.Activity)
def set_done(activity_id: int, body: schemas.ActivityDone, engine: Engine = Depends(get_engine)):
    rules.set_activity_done(engine, activity_id, body.done)
    return queries.activity(engine, activity_id)


@router.delete("/{activity_id}", status_code=204)
def delete_activity(activity_id: int, engine: Engine = Depends(get_engine)):
    rules.delete_activity(engine, activity_id)
    return Response(status_code=204)
