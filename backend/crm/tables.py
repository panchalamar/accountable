"""The CRM's five tables. Migrations create them; change them with a new migration."""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    func,
)

from backend.db import metadata

STAGES = ("new", "qualified", "proposal", "negotiation", "won", "lost")
REACHABLE_STAGES = ("new", "qualified", "proposal", "negotiation", "won")
STATUSES = ("lead", "qualified", "customer")
ACTIVITY_TYPES = ("note", "call", "email")


def _one_of(column: str, values: tuple[str, ...]) -> str:
    listed = ", ".join(f"'{v}'" for v in values)
    return f"{column} IN ({listed})"


organizations = Table(
    "organizations",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String(200), nullable=False),
    Column("website", String(200)),
    Column("industry", String(100)),
    Column("notes", Text),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
)

# Names are unique ignoring case and spaces at either end.
Index(
    "uq_organizations_name_key",
    func.lower(func.trim(organizations.c.name)),
    unique=True,
)

contacts = Table(
    "contacts",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("organization_id", Integer, ForeignKey("organizations.id"), nullable=False, index=True),
    Column("name", String(200), nullable=False),
    # Stored trimmed and in lower case, or NULL when there's none.
    Column("email", String(200), unique=True),
    Column("phone", String(50)),
    Column("job_title", String(100)),
    Column("status", String(20), nullable=False),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
    CheckConstraint(_one_of("status", STATUSES), name="status"),
)

deals = Table(
    "deals",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("organization_id", Integer, ForeignKey("organizations.id"), nullable=False, index=True),
    Column("main_contact_id", Integer, ForeignKey("contacts.id"), nullable=False, index=True),
    Column("name", String(200), nullable=False),
    Column("stage", String(20), nullable=False),
    Column("value", Integer, nullable=False),
    Column("probability", Integer, nullable=False),
    Column("close_date", Date, nullable=False),
    Column("furthest_stage", String(20), nullable=False),
    Column("position", Integer, nullable=False),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
    CheckConstraint(_one_of("stage", STAGES), name="stage"),
    CheckConstraint(_one_of("furthest_stage", REACHABLE_STAGES), name="furthest_stage"),
    CheckConstraint("value >= 0", name="value"),
    CheckConstraint("probability >= 0 AND probability <= 100", name="probability"),
    Index("ix_deals_stage_position", "stage", "position"),
)

activities = Table(
    "activities",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("type", String(10), nullable=False),
    Column("description", Text, nullable=False),
    Column("occurred_at", DateTime, nullable=False),
    Column("follow_up_date", Date, index=True),
    Column("done", Boolean, nullable=False),
    Column("contact_id", Integer, ForeignKey("contacts.id"), index=True),
    Column("deal_id", Integer, ForeignKey("deals.id"), index=True),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
    CheckConstraint(_one_of("type", ACTIVITY_TYPES), name="type"),
    CheckConstraint("contact_id IS NOT NULL OR deal_id IS NOT NULL", name="linked"),
)

stage_changes = Table(
    "stage_changes",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "deal_id",
        Integer,
        ForeignKey("deals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("from_stage", String(20), nullable=False),
    Column("to_stage", String(20), nullable=False),
    Column("changed_at", DateTime, nullable=False),
    CheckConstraint(_one_of("from_stage", STAGES), name="from_stage"),
    CheckConstraint(_one_of("to_stage", STAGES), name="to_stage"),
)
