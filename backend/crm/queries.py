"""Read queries: lists with counts and names, record pages and timelines."""

from typing import Any

from sqlalchemy import Connection, Engine, case, func, select

from backend.crm.rules import (
    OPEN_STAGES,
    contact_delete_check,
    deal_delete_check,
    organization_delete_check,
)
from backend.crm.tables import STAGES, activities, contacts, deals, organizations, stage_changes
from backend.errors import NotFound

BOARD_ORDER = case({stage: index for index, stage in enumerate(STAGES)}, value=deals.c.stage)


def _link(record_id: int | None, name: str | None) -> dict | None:
    if record_id is None:
        return None
    return {"id": record_id, "name": name}


# Organizations


def list_organizations(engine: Engine) -> list[dict]:
    contact_count = (
        select(func.count())
        .where(contacts.c.organization_id == organizations.c.id)
        .scalar_subquery()
    )
    open_deal_count = (
        select(func.count())
        .where(deals.c.organization_id == organizations.c.id, deals.c.stage.in_(OPEN_STAGES))
        .scalar_subquery()
    )
    query = select(
        organizations.c.id,
        organizations.c.name,
        organizations.c.website,
        organizations.c.industry,
        contact_count.label("contact_count"),
        open_deal_count.label("open_deal_count"),
    ).order_by(func.lower(organizations.c.name), organizations.c.id)
    with engine.connect() as conn:
        return [dict(r) for r in conn.execute(query).mappings()]


def organization(engine: Engine, org_id: int) -> dict:
    with engine.connect() as conn:
        org = conn.execute(select(organizations).where(organizations.c.id == org_id)).mappings().first()
        if org is None:
            raise NotFound("organization")
        people = conn.execute(
            select(contacts.c.id, contacts.c.name, contacts.c.job_title, contacts.c.email, contacts.c.status)
            .where(contacts.c.organization_id == org_id)
            .order_by(func.lower(contacts.c.name), contacts.c.id)
        ).mappings()
        their_deals = conn.execute(
            select(
                deals.c.id,
                deals.c.name,
                deals.c.stage,
                deals.c.value,
                deals.c.probability,
                deals.c.close_date,
                contacts.c.id.label("contact_id"),
                contacts.c.name.label("contact_name"),
            )
            .join(contacts, contacts.c.id == deals.c.main_contact_id)
            .where(deals.c.organization_id == org_id)
            .order_by(deals.c.close_date.desc(), deals.c.id)
        ).mappings()
        return {
            **dict(org),
            "contacts": [dict(c) for c in people],
            "deals": [
                {
                    **{k: d[k] for k in ("id", "name", "stage", "value", "probability", "close_date")},
                    "main_contact": _link(d["contact_id"], d["contact_name"]),
                }
                for d in their_deals
            ],
        }


def organization_check(engine: Engine, org_id: int) -> dict:
    with engine.connect() as conn:
        return organization_delete_check(conn, org_id)


# Contacts


def _contact_query():
    return select(
        contacts.c.id,
        contacts.c.name,
        contacts.c.job_title,
        contacts.c.email,
        contacts.c.phone,
        contacts.c.status,
        contacts.c.created_at,
        contacts.c.updated_at,
        organizations.c.id.label("org_id"),
        organizations.c.name.label("org_name"),
    ).join(organizations, organizations.c.id == contacts.c.organization_id)


def _contact_row(row: Any) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "job_title": row["job_title"],
        "email": row["email"],
        "phone": row["phone"],
        "status": row["status"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "organization": _link(row["org_id"], row["org_name"]),
    }


def list_contacts(engine: Engine) -> list[dict]:
    query = _contact_query().order_by(func.lower(contacts.c.name), contacts.c.id)
    with engine.connect() as conn:
        return [_contact_row(r) for r in conn.execute(query).mappings()]


def contact(engine: Engine, contact_id: int) -> dict:
    with engine.connect() as conn:
        row = conn.execute(_contact_query().where(contacts.c.id == contact_id)).mappings().first()
        if row is None:
            raise NotFound("contact")
        led = conn.execute(
            select(
                deals.c.id, deals.c.name, deals.c.stage, deals.c.value, deals.c.probability, deals.c.close_date
            )
            .where(deals.c.main_contact_id == contact_id)
            .order_by(deals.c.close_date.desc(), deals.c.id)
        ).mappings()
        return {**_contact_row(row), "deals": [dict(d) for d in led]}


def contact_check(engine: Engine, contact_id: int) -> dict:
    with engine.connect() as conn:
        return contact_delete_check(conn, contact_id)


# Deals


def _deal_query():
    return select(
        deals,
        organizations.c.name.label("org_name"),
        contacts.c.name.label("contact_name"),
    ).join(organizations, organizations.c.id == deals.c.organization_id).join(
        contacts, contacts.c.id == deals.c.main_contact_id
    )


def _deal_row(row: Any) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "organization": _link(row["organization_id"], row["org_name"]),
        "main_contact": _link(row["main_contact_id"], row["contact_name"]),
        "stage": row["stage"],
        "value": row["value"],
        "probability": row["probability"],
        "close_date": row["close_date"],
        "furthest_stage": row["furthest_stage"],
        "position": row["position"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_deals(engine: Engine) -> list[dict]:
    """In board order: by stage, then each card's place in its column."""
    query = _deal_query().order_by(BOARD_ORDER, deals.c.position, deals.c.id)
    with engine.connect() as conn:
        return [_deal_row(r) for r in conn.execute(query).mappings()]


def deal(engine: Engine, deal_id: int) -> dict:
    with engine.connect() as conn:
        row = conn.execute(_deal_query().where(deals.c.id == deal_id)).mappings().first()
        if row is None:
            raise NotFound("deal")
        return _deal_row(row)


def deal_check(engine: Engine, deal_id: int) -> dict:
    with engine.connect() as conn:
        return deal_delete_check(conn, deal_id)


# Activities and timelines

_linked_contact = contacts.alias("linked_contact")
_linked_deal = deals.alias("linked_deal")


def activity_query():
    return (
        select(
            activities,
            _linked_contact.c.name.label("contact_name"),
            _linked_deal.c.name.label("deal_name"),
        )
        .outerjoin(_linked_contact, _linked_contact.c.id == activities.c.contact_id)
        .outerjoin(_linked_deal, _linked_deal.c.id == activities.c.deal_id)
    )


def activity_row(row: Any) -> dict:
    return {
        "id": row["id"],
        "type": row["type"],
        "description": row["description"],
        "occurred_at": row["occurred_at"],
        "follow_up_date": row["follow_up_date"],
        "done": row["done"],
        "contact": _link(row["contact_id"], row["contact_name"]),
        "deal": _link(row["deal_id"], row["deal_name"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def activity(engine: Engine, activity_id: int) -> dict:
    with engine.connect() as conn:
        row = conn.execute(activity_query().where(activities.c.id == activity_id)).mappings().first()
        if row is None:
            raise NotFound("activity")
        return activity_row(row)


def _timeline_activity(row: Any) -> dict:
    return {**activity_row(row), "kind": "activity", "at": row["occurred_at"]}


def _exists(conn: Connection, table, record_id: int, kind: str) -> None:
    if conn.execute(select(table.c.id).where(table.c.id == record_id)).first() is None:
        raise NotFound(kind)


def contact_timeline(engine: Engine, contact_id: int) -> list[dict]:
    """The contact's activities, newest first by when they happened."""
    with engine.connect() as conn:
        _exists(conn, contacts, contact_id, "contact")
        rows = conn.execute(
            activity_query()
            .where(activities.c.contact_id == contact_id)
            .order_by(activities.c.occurred_at.desc(), activities.c.id.desc())
        ).mappings()
        return [_timeline_activity(r) for r in rows]


def deal_timeline(engine: Engine, deal_id: int) -> list[dict]:
    """The deal's activities and stage changes together, newest first."""
    with engine.connect() as conn:
        _exists(conn, deals, deal_id, "deal")
        name = conn.execute(select(deals.c.name).where(deals.c.id == deal_id)).scalar_one()
        items = [
            _timeline_activity(r)
            for r in conn.execute(activity_query().where(activities.c.deal_id == deal_id)).mappings()
        ]
        for change in conn.execute(
            select(stage_changes).where(stage_changes.c.deal_id == deal_id)
        ).mappings():
            items.append(
                {
                    "kind": "stage_change",
                    "id": change["id"],
                    "deal": _link(deal_id, name),
                    "from_stage": change["from_stage"],
                    "to_stage": change["to_stage"],
                    "at": change["changed_at"],
                }
            )
    # Newest first. At the same moment, a stage change sits above an activity.
    items.sort(key=lambda i: (i["at"], i["kind"] == "stage_change", i["id"]), reverse=True)
    return items
