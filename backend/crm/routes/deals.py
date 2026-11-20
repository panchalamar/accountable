from fastapi import APIRouter, Response

from backend.crm import queries, rules, schemas
from backend.db import EngineDep

router = APIRouter(prefix="/deals", tags=["deals"])


@router.get("", response_model=list[schemas.Deal])
def list_deals(engine: EngineDep):
    return queries.list_deals(engine)


@router.post("", status_code=201, response_model=schemas.Deal)
def add_deal(body: schemas.DealIn, engine: EngineDep):
    return queries.deal(engine, rules.add_deal(engine, body))


@router.get("/{deal_id}", response_model=schemas.Deal)
def get_deal(deal_id: int, engine: EngineDep):
    return queries.deal(engine, deal_id)


@router.put("/{deal_id}", response_model=schemas.Deal)
def edit_deal(deal_id: int, body: schemas.DealIn, engine: EngineDep):
    rules.edit_deal(engine, deal_id, body)
    return queries.deal(engine, deal_id)


@router.post("/{deal_id}/move", response_model=schemas.Deal)
def move_deal(deal_id: int, body: schemas.DealMove, engine: EngineDep):
    rules.move_deal(engine, deal_id, body)
    return queries.deal(engine, deal_id)


@router.get("/{deal_id}/delete-check", response_model=schemas.DealDeleteCheck)
def deal_delete_check(deal_id: int, engine: EngineDep):
    return queries.deal_check(engine, deal_id)


@router.get("/{deal_id}/timeline", response_model=list[schemas.TimelineItem])
def deal_timeline(deal_id: int, engine: EngineDep):
    return queries.deal_timeline(engine, deal_id)


@router.delete("/{deal_id}", status_code=204)
def delete_deal(deal_id: int, engine: EngineDep):
    rules.delete_deal(engine, deal_id)
    return Response(status_code=204)
