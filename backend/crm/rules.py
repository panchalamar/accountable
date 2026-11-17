"""Every CRM rule: validation, stage changes, placement, delete checks,
contact moves and activity links. Each write is one transaction.

Read clock.today() and clock.now() through the module, so tests can fix them.
"""

from collections.abc import Iterable, Mapping
from datetime import date, datetime
from typing import Any, Literal

from email_validator import EmailNotValidError, validate_email
from sqlalchemy import Connection, Engine, bindparam, delete, func, insert, select, update

from backend import clock
from backend.crm import schemas
from backend.crm.tables import (
    ACTIVITY_TYPES,
    REACHABLE_STAGES,
    STAGES,
    STATUSES,
    activities,
    contacts,
    deals,
    organizations,
    stage_changes,
)
from backend.errors import Invalid, NotFound, Refused

# Stages

OPEN_STAGES = ("new", "qualified", "proposal", "negotiation")
CLOSED_STAGES = ("won", "lost")
STAGE_PROBABILITY = {
    "new": 10,
    "qualified": 25,
    "proposal": 50,
    "negotiation": 75,
    "won": 100,
    "lost": 0,
}
STAGE_LABEL = {
    "new": "New",
    "qualified": "Qualified",
    "proposal": "Proposal",
    "negotiation": "Negotiation",
    "won": "Won",
    "lost": "Lost",
}

# Messages, word for word from the spec where it gives them

ENTER_NAME = "Enter a name."
EMAIL_INVALID = "Enter a valid email address, like name@company.com."
EMAIL_TAKEN = "Another contact already uses this email."
CHOOSE_ORGANIZATION = "Choose an organization."
CHOOSE_MAIN_CONTACT = "Choose a main contact."
CHOOSE_STAGE = "Choose a stage."
CHOOSE_STATUS = "Choose a status."
ENTER_CLOSE_DATE = "Enter a close date."
CHOOSE_TYPE = "Choose a type."
ENTER_DESCRIPTION = "Enter a description."
ENTER_OCCURRED_AT = "Enter when it happened."
LINK_REQUIRED = "Link the activity to a contact or a deal."
REOPEN_NEEDS_DATE = "Choose a new expected close date to reopen this deal."


def organization_taken(name: str) -> str:
    return f"An organization called {name} already exists."


def main_contact_at(organization_name: str) -> str:
    return f"Choose a main contact at {organization_name}."


# Figures shared with the frontend (see shared/crm-rule-cases.json)


def expected_revenue(value: int, probability: int) -> int:
    """value x probability / 100, in whole dollars with halves rounding up.

    Worked out in whole numbers, so large values pick up no floating-point
    errors. Totals add these whole-dollar amounts, so every total equals the
    sum of the figures shown under it.
    """
    return (value * probability + 50) // 100


def total_expected(rows: Iterable[Mapping[str, Any]]) -> int:
    return sum(expected_revenue(r["value"], r["probability"]) for r in rows)


def is_late(stage: str, close_date: date, today: date) -> bool:
    """An open deal whose close date is before today. Due today isn't late."""
    return stage in OPEN_STAGES and close_date < today


def further_stage(furthest: str, stage: str) -> str:
    """The latest stage reached. Lost doesn't count as a stage reached."""
    if stage not in REACHABLE_STAGES:
        return furthest
    return max(furthest, stage, key=REACHABLE_STAGES.index)


# Small helpers


def _clean(text: str | None) -> str | None:
    if text is None:
        return None
    text = text.strip()
    return text or None


def plural(count: int, one: str, many: str | None = None) -> str:
    return f"{count} {one if count == 1 else (many or one + 's')}"


def join_names(names: list[str]) -> str:
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + " and " + names[-1]


def _local(value: datetime) -> datetime:
    """Times are stored as local time with no time zone, to the second."""
    if value.tzinfo is not None:
        value = value.astimezone().replace(tzinfo=None)
    return value.replace(microsecond=0)


def _one(conn: Connection, table, record_id: int | None):
    if record_id is None:
        return None
    return conn.execute(select(table).where(table.c.id == record_id)).mappings().first()


def _must(conn: Connection, table, record_id: int, kind: str):
    row = _one(conn, table, record_id)
    if row is None:
        raise NotFound(kind)
    return row


# Organizations


def _organization_name_owner(conn: Connection, name: str, exclude_id: int | None) -> str | None:
    """The existing organization with this name, ignoring case and outer spaces."""
    query = select(organizations.c.name).where(
        func.lower(func.trim(organizations.c.name)) == func.lower(func.trim(name))
    )
    if exclude_id is not None:
        query = query.where(organizations.c.id != exclude_id)
    return conn.execute(query).scalars().first()


def _check_organization(conn: Connection, body: schemas.OrganizationIn, org_id: int | None) -> dict:
    errors: dict[str, str] = {}
    name = _clean(body.name)
    if not name:
        errors["name"] = ENTER_NAME
    else:
        owner = _organization_name_owner(conn, name, org_id)
        if owner:
            errors["name"] = organization_taken(owner)
    if errors:
        raise Invalid(errors)
    return {
        "name": name,
        "website": _clean(body.website),
        "industry": _clean(body.industry),
        "notes": _clean(body.notes),
    }


def add_organization(engine: Engine, body: schemas.OrganizationIn) -> int:
    with engine.begin() as conn:
        values = _check_organization(conn, body, None)
        now = clock.now()
        result = conn.execute(insert(organizations).values(**values, created_at=now, updated_at=now))
        return result.inserted_primary_key[0]


def edit_organization(engine: Engine, org_id: int, body: schemas.OrganizationIn) -> None:
    with engine.begin() as conn:
        _must(conn, organizations, org_id, "organization")
        values = _check_organization(conn, body, org_id)
        conn.execute(
            update(organizations)
            .where(organizations.c.id == org_id)
            .values(**values, updated_at=clock.now())
        )


def organization_delete_check(conn: Connection, org_id: int) -> dict:
    org = _must(conn, organizations, org_id, "organization")
    contact_count = conn.execute(
        select(func.count()).where(contacts.c.organization_id == org_id)
    ).scalar_one()
    deal_count = conn.execute(select(func.count()).where(deals.c.organization_id == org_id)).scalar_one()
    if contact_count or deal_count:
        parts = [
            plural(n, word)
            for n, word in ((contact_count, "contact"), (deal_count, "deal"))
            if n
        ]
        them = "it" if contact_count + deal_count == 1 else "them"
        message = (
            f"{org['name']} can't be deleted while it has {' and '.join(parts)}. "
            f"Delete {them} or move {them} to another organization first."
        )
        can_delete = False
    else:
        message = f"{org['name']} has no contacts or deals, so nothing else will be deleted."
        can_delete = True
    return {
        "can_delete": can_delete,
        "message": message,
        "contacts": contact_count,
        "deals": deal_count,
    }


def delete_organization(engine: Engine, org_id: int) -> None:
    with engine.begin() as conn:
        check = organization_delete_check(conn, org_id)
        if not check["can_delete"]:
            raise Refused(check["message"], {"contacts": check["contacts"], "deals": check["deals"]})
        conn.execute(delete(organizations).where(organizations.c.id == org_id))


# Contacts


def _normal_email(raw: str | None) -> str | None:
    email = _clean(raw)
    return email.lower() if email else None


def _check_contact(conn: Connection, body: schemas.ContactIn, contact_id: int | None) -> dict:
    errors: dict[str, str] = {}
    name = _clean(body.name)
    if not name:
        errors["name"] = ENTER_NAME

    if body.organization_id is None or _one(conn, organizations, body.organization_id) is None:
        errors["organization_id"] = CHOOSE_ORGANIZATION

    email = _normal_email(body.email)
    if email:
        try:
            validate_email(email, check_deliverability=False)
        except EmailNotValidError:
            errors["email"] = EMAIL_INVALID
        else:
            query = select(contacts.c.id).where(contacts.c.email == email)
            if contact_id is not None:
                query = query.where(contacts.c.id != contact_id)
            if conn.execute(query).first():
                errors["email"] = EMAIL_TAKEN

    status = body.status or "lead"
    if status not in STATUSES:
        errors["status"] = CHOOSE_STATUS

    if errors:
        raise Invalid(errors)
    return {
        "name": name,
        "organization_id": body.organization_id,
        "email": email,
        "phone": _clean(body.phone),
        "job_title": _clean(body.job_title),
        "status": status,
    }


def _deals_led_by(conn: Connection, contact_id: int) -> list[dict]:
    rows = conn.execute(
        select(deals.c.id, deals.c.name)
        .where(deals.c.main_contact_id == contact_id)
        .order_by(func.lower(deals.c.name))
    ).mappings()
    return [dict(r) for r in rows]


def add_contact(engine: Engine, body: schemas.ContactIn) -> int:
    with engine.begin() as conn:
        values = _check_contact(conn, body, None)
        now = clock.now()
        result = conn.execute(insert(contacts).values(**values, created_at=now, updated_at=now))
        return result.inserted_primary_key[0]


def edit_contact(engine: Engine, contact_id: int, body: schemas.ContactIn) -> None:
    with engine.begin() as conn:
        current = _must(conn, contacts, contact_id, "contact")
        values = _check_contact(conn, body, contact_id)
        if values["organization_id"] != current["organization_id"]:
            led = _deals_led_by(conn, contact_id)
            if led:
                each = "that deal" if len(led) == 1 else "each deal"
                raise Refused(
                    f"{current['name']} can't move to another organization while they're the main "
                    f"contact on {plural(len(led), 'deal')}: {join_names([d['name'] for d in led])}. "
                    f"Choose a different main contact for {each} first.",
                    {"deals": led},
                )
        conn.execute(
            update(contacts).where(contacts.c.id == contact_id).values(**values, updated_at=clock.now())
        )


def contact_delete_check(conn: Connection, contact_id: int) -> dict:
    contact = _must(conn, contacts, contact_id, "contact")
    led = _deals_led_by(conn, contact_id)
    only_theirs = conn.execute(
        select(func.count()).where(activities.c.contact_id == contact_id, activities.c.deal_id.is_(None))
    ).scalar_one()
    shared = conn.execute(
        select(func.count()).where(
            activities.c.contact_id == contact_id, activities.c.deal_id.is_not(None)
        )
    ).scalar_one()
    name = contact["name"]
    if led:
        each = "that deal" if len(led) == 1 else "each deal"
        message = (
            f"{name} can't be deleted while they're the main contact on "
            f"{plural(len(led), 'deal')}: {join_names([d['name'] for d in led])}. "
            f"Choose a different main contact for {each} first."
        )
    else:
        sentences = []
        if only_theirs:
            sentences.append(
                f"{plural(only_theirs, 'activity', 'activities')} linked only to {name} will be deleted."
            )
        if shared:
            sentences.append(
                f"{plural(shared, 'activity', 'activities')} also linked to a deal "
                "will stay on the deal's timeline."
            )
        message = " ".join(sentences) or f"{name} has no activities, so nothing else will be deleted."
    return {
        "can_delete": not led,
        "message": message,
        "blocking_deals": led,
        "activities_to_delete": only_theirs,
        "activities_to_keep": shared,
    }


def delete_contact(engine: Engine, contact_id: int) -> None:
    with engine.begin() as conn:
        check = contact_delete_check(conn, contact_id)
        if not check["can_delete"]:
            raise Refused(check["message"], {"deals": check["blocking_deals"]})
        conn.execute(
            delete(activities).where(
                activities.c.contact_id == contact_id, activities.c.deal_id.is_(None)
            )
        )
        conn.execute(
            update(activities)
            .where(activities.c.contact_id == contact_id)
            .values(contact_id=None, updated_at=clock.now())
        )
        conn.execute(delete(contacts).where(contacts.c.id == contact_id))


# Deals: placement

Place = Literal["top", "bottom"] | int


def _column(conn: Connection, stage: str, without: int | None = None) -> list[int]:
    ids = conn.execute(
        select(deals.c.id).where(deals.c.stage == stage).order_by(deals.c.position, deals.c.id)
    ).scalars()
    return [i for i in ids if i != without]


def _renumber(conn: Connection, ids: list[int]) -> None:
    """Positions from 0 with no gaps, smallest at the top."""
    if not ids:
        return
    conn.execute(
        update(deals).where(deals.c.id == bindparam("deal_id")).values(position=bindparam("pos")),
        [{"deal_id": deal_id, "pos": pos} for pos, deal_id in enumerate(ids)],
    )


def _place(conn: Connection, deal_id: int, stage: str, where: Place) -> None:
    ids = _column(conn, stage, without=deal_id)
    if where == "top":
        ids.insert(0, deal_id)
    elif where == "bottom":
        ids.append(deal_id)
    else:
        ids.insert(ids.index(where), deal_id)
    _renumber(conn, ids)


# Deals: the one stage-change function


def _change_stage(
    conn: Connection,
    current: Mapping[str, Any],
    new_stage: str,
    close_date: date | None,
    where: Place,
) -> None:
    """Moves a deal to another stage, for the board's move and the edit form alike.

    - The probability becomes the new stage's usual one.
    - Into Won or Lost, including from one to the other, the close date becomes today.
    - From Won or Lost to an open stage, the close date given is required.
    - The furthest stage moves forward, and a stage change row is added.
    - The deal goes where it's placed in its new column, and its old column closes the gap.
    """
    old_stage = current["stage"]
    values: dict[str, Any] = {
        "stage": new_stage,
        "probability": STAGE_PROBABILITY[new_stage],
        "furthest_stage": further_stage(current["furthest_stage"], new_stage),
        "updated_at": clock.now(),
    }
    if new_stage in CLOSED_STAGES:
        values["close_date"] = clock.today()
    elif old_stage in CLOSED_STAGES:
        if close_date is None:
            raise Refused(REOPEN_NEEDS_DATE, {"needs": "close_date"})
        values["close_date"] = close_date

    conn.execute(update(deals).where(deals.c.id == current["id"]).values(**values))
    conn.execute(
        insert(stage_changes).values(
            deal_id=current["id"], from_stage=old_stage, to_stage=new_stage, changed_at=clock.now()
        )
    )
    _renumber(conn, _column(conn, old_stage, without=current["id"]))
    _place(conn, current["id"], new_stage, where)


# Deals: records


def _check_deal(conn: Connection, body: schemas.DealIn) -> dict:
    errors: dict[str, str] = {}
    name = _clean(body.name)
    if not name:
        errors["name"] = ENTER_NAME

    org = _one(conn, organizations, body.organization_id)
    if org is None:
        errors["organization_id"] = CHOOSE_ORGANIZATION

    contact = _one(conn, contacts, body.main_contact_id)
    if org is not None:
        if contact is None or contact["organization_id"] != org["id"]:
            errors["main_contact_id"] = main_contact_at(org["name"])
    elif contact is None:
        errors["main_contact_id"] = CHOOSE_MAIN_CONTACT

    if body.stage not in STAGES:
        errors["stage"] = CHOOSE_STAGE
    if body.value is None:
        errors["value"] = schemas.VALUE_MESSAGE
    if body.close_date is None:
        errors["close_date"] = ENTER_CLOSE_DATE

    if errors:
        raise Invalid(errors)
    return {
        "name": name,
        "organization_id": org["id"],
        "main_contact_id": contact["id"],
        "stage": body.stage,
        "value": body.value,
        "probability": body.probability,
        "close_date": body.close_date,
    }


def add_deal(engine: Engine, body: schemas.DealIn) -> int:
    """Adding a deal isn't a stage change: no stage change row. It goes to the top."""
    with engine.begin() as conn:
        values = _check_deal(conn, body)
        stage = values["stage"]
        if values["probability"] is None:
            values["probability"] = STAGE_PROBABILITY[stage]
        if stage in CLOSED_STAGES:
            values["close_date"] = clock.today()
        # A deal added at Lost reached New; one added at Won reached Won.
        values["furthest_stage"] = stage if stage in REACHABLE_STAGES else "new"
        now = clock.now()
        deal_id = conn.execute(
            insert(deals).values(**values, position=0, created_at=now, updated_at=now)
        ).inserted_primary_key[0]
        _place(conn, deal_id, stage, "top")
        return deal_id


def edit_deal(engine: Engine, deal_id: int, body: schemas.DealIn) -> None:
    with engine.begin() as conn:
        current = _must(conn, deals, deal_id, "deal")
        values = _check_deal(conn, body)
        new_stage = values.pop("stage")
        if values["probability"] is None:
            values["probability"] = current["probability"]
        conn.execute(
            update(deals).where(deals.c.id == deal_id).values(**values, updated_at=clock.now())
        )
        if new_stage != current["stage"]:
            updated = _must(conn, deals, deal_id, "deal")
            _change_stage(conn, updated, new_stage, values["close_date"], "top")


def move_deal(engine: Engine, deal_id: int, body: schemas.DealMove) -> None:
    """The board's move. `before_id` is the card it now sits above, or none for the bottom."""
    with engine.begin() as conn:
        current = _must(conn, deals, deal_id, "deal")
        stage = body.stage
        if stage not in STAGES:
            raise Invalid({"stage": CHOOSE_STAGE})

        where: Place = "bottom"
        if body.before_id is not None:
            before = _one(conn, deals, body.before_id)
            if before is None or before["id"] == deal_id or before["stage"] != stage:
                raise Refused(
                    f"That card is no longer in the {STAGE_LABEL[stage]} column. "
                    "Refresh the page and try again.",
                    {"before_id": body.before_id},
                )
            where = before["id"]

        if stage == current["stage"]:
            # A new place in the same column isn't a stage change.
            _place(conn, deal_id, stage, where)
            conn.execute(update(deals).where(deals.c.id == deal_id).values(updated_at=clock.now()))
        else:
            _change_stage(conn, current, stage, body.close_date, where)


def deal_delete_check(conn: Connection, deal_id: int) -> dict:
    _must(conn, deals, deal_id, "deal")
    only_this = conn.execute(
        select(func.count()).where(activities.c.deal_id == deal_id, activities.c.contact_id.is_(None))
    ).scalar_one()
    shared = conn.execute(
        select(func.count()).where(activities.c.deal_id == deal_id, activities.c.contact_id.is_not(None))
    ).scalar_one()
    history = conn.execute(
        select(func.count()).where(stage_changes.c.deal_id == deal_id)
    ).scalar_one()
    sentences = []
    if only_this:
        sentences.append(
            f"{plural(only_this, 'activity', 'activities')} linked only to this deal will be deleted."
        )
    if shared:
        sentences.append(
            f"{plural(shared, 'activity', 'activities')} also linked to a contact "
            "will stay on the contact's timeline."
        )
    if history:
        sentences.append("The deal's stage history will be deleted too.")
    return {
        "can_delete": True,
        "message": " ".join(sentences) or "Nothing else is linked to this deal.",
        "activities_to_delete": only_this,
        "activities_to_keep": shared,
        "stage_changes": history,
    }


def delete_deal(engine: Engine, deal_id: int) -> None:
    with engine.begin() as conn:
        current = _must(conn, deals, deal_id, "deal")
        conn.execute(
            delete(activities).where(activities.c.deal_id == deal_id, activities.c.contact_id.is_(None))
        )
        conn.execute(
            update(activities)
            .where(activities.c.deal_id == deal_id)
            .values(deal_id=None, updated_at=clock.now())
        )
        conn.execute(delete(stage_changes).where(stage_changes.c.deal_id == deal_id))
        conn.execute(delete(deals).where(deals.c.id == deal_id))
        _renumber(conn, _column(conn, current["stage"]))


# Activities


def _check_activity(conn: Connection, body: schemas.ActivityIn, current: Mapping | None) -> dict:
    errors: dict[str, str] = {}
    if body.type not in ACTIVITY_TYPES:
        errors["type"] = CHOOSE_TYPE
    description = _clean(body.description)
    if not description:
        errors["description"] = ENTER_DESCRIPTION
    if body.occurred_at is None:
        errors["occurred_at"] = ENTER_OCCURRED_AT

    contact = _one(conn, contacts, body.contact_id)
    deal = _one(conn, deals, body.deal_id)
    if body.contact_id is not None and contact is None:
        errors["contact_id"] = "That contact no longer exists."
    if body.deal_id is not None and deal is None:
        errors["deal_id"] = "That deal no longer exists."
    if body.contact_id is None and body.deal_id is None:
        errors["link"] = LINK_REQUIRED

    # The organization match is checked only when a link is added or changed,
    # so editing keeps links made before a contact or deal moved.
    links_changed = current is None or (body.contact_id, body.deal_id) != (
        current["contact_id"],
        current["deal_id"],
    )
    if contact is not None and deal is not None and links_changed:
        if contact["organization_id"] != deal["organization_id"]:
            contact_org = _one(conn, organizations, contact["organization_id"])
            deal_org = _one(conn, organizations, deal["organization_id"])
            errors["deal_id"] = f"Choose a deal at {contact_org['name']}."
            errors["contact_id"] = f"Choose a contact at {deal_org['name']}."

    if errors:
        raise Invalid(errors)
    return {
        "type": body.type,
        "description": description,
        "occurred_at": _local(body.occurred_at),
        "follow_up_date": body.follow_up_date,
        "done": body.done,
        "contact_id": body.contact_id,
        "deal_id": body.deal_id,
    }


def add_activity(engine: Engine, body: schemas.ActivityIn) -> int:
    with engine.begin() as conn:
        values = _check_activity(conn, body, None)
        now = clock.now()
        result = conn.execute(insert(activities).values(**values, created_at=now, updated_at=now))
        return result.inserted_primary_key[0]


def edit_activity(engine: Engine, activity_id: int, body: schemas.ActivityIn) -> None:
    with engine.begin() as conn:
        current = _must(conn, activities, activity_id, "activity")
        values = _check_activity(conn, body, current)
        conn.execute(
            update(activities)
            .where(activities.c.id == activity_id)
            .values(**values, updated_at=clock.now())
        )


def set_activity_done(engine: Engine, activity_id: int, done: bool) -> None:
    with engine.begin() as conn:
        _must(conn, activities, activity_id, "activity")
        conn.execute(
            update(activities)
            .where(activities.c.id == activity_id)
            .values(done=done, updated_at=clock.now())
        )


def delete_activity(engine: Engine, activity_id: int) -> None:
    with engine.begin() as conn:
        _must(conn, activities, activity_id, "activity")
        conn.execute(delete(activities).where(activities.c.id == activity_id))
