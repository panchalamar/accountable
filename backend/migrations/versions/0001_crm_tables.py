"""The CRM's tables: organizations, contacts, deals, activities and stage changes.

Made with autogenerate from backend/crm/tables.py and checked by hand. Added by
hand: the unique index on organizations' trimmed, lower-case names, which
autogenerate can't compare on SQLite.

Revision ID: 0001
Revises:
Create Date: 2026-11-17
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STAGES = "'new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'"


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("website", sa.String(length=200), nullable=True),
        sa.Column("industry", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_organizations")),
    )
    op.create_index(
        "uq_organizations_name_key",
        "organizations",
        [sa.text("lower(trim(name))")],
        unique=True,
    )

    op.create_table(
        "contacts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("job_title", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "status IN ('lead', 'qualified', 'customer')", name=op.f("ck_contacts_status")
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_contacts_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_contacts")),
        sa.UniqueConstraint("email", name=op.f("uq_contacts_email")),
    )
    with op.batch_alter_table("contacts", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_contacts_organization_id"), ["organization_id"], unique=False
        )

    op.create_table(
        "deals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("main_contact_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("stage", sa.String(length=20), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.Column("probability", sa.Integer(), nullable=False),
        sa.Column("close_date", sa.Date(), nullable=False),
        sa.Column("furthest_stage", sa.String(length=20), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "furthest_stage IN ('new', 'qualified', 'proposal', 'negotiation', 'won')",
            name=op.f("ck_deals_furthest_stage"),
        ),
        sa.CheckConstraint(f"stage IN ({STAGES})", name=op.f("ck_deals_stage")),
        sa.CheckConstraint(
            "probability >= 0 AND probability <= 100", name=op.f("ck_deals_probability")
        ),
        sa.CheckConstraint("value >= 0", name=op.f("ck_deals_value")),
        sa.ForeignKeyConstraint(
            ["main_contact_id"],
            ["contacts.id"],
            name=op.f("fk_deals_main_contact_id_contacts"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_deals_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_deals")),
    )
    with op.batch_alter_table("deals", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_deals_main_contact_id"), ["main_contact_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_deals_organization_id"), ["organization_id"], unique=False
        )
        batch_op.create_index("ix_deals_stage_position", ["stage", "position"], unique=False)

    op.create_table(
        "activities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=10), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.Column("follow_up_date", sa.Date(), nullable=True),
        sa.Column("done", sa.Boolean(), nullable=False),
        sa.Column("contact_id", sa.Integer(), nullable=True),
        sa.Column("deal_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("type IN ('note', 'call', 'email')", name=op.f("ck_activities_type")),
        sa.CheckConstraint(
            "contact_id IS NOT NULL OR deal_id IS NOT NULL", name=op.f("ck_activities_linked")
        ),
        sa.ForeignKeyConstraint(
            ["contact_id"], ["contacts.id"], name=op.f("fk_activities_contact_id_contacts")
        ),
        sa.ForeignKeyConstraint(
            ["deal_id"], ["deals.id"], name=op.f("fk_activities_deal_id_deals")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_activities")),
    )
    with op.batch_alter_table("activities", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_activities_contact_id"), ["contact_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_activities_deal_id"), ["deal_id"], unique=False)
        batch_op.create_index(
            batch_op.f("ix_activities_follow_up_date"), ["follow_up_date"], unique=False
        )

    op.create_table(
        "stage_changes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("deal_id", sa.Integer(), nullable=False),
        sa.Column("from_stage", sa.String(length=20), nullable=False),
        sa.Column("to_stage", sa.String(length=20), nullable=False),
        sa.Column("changed_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            f"from_stage IN ({STAGES})", name=op.f("ck_stage_changes_from_stage")
        ),
        sa.CheckConstraint(f"to_stage IN ({STAGES})", name=op.f("ck_stage_changes_to_stage")),
        sa.ForeignKeyConstraint(
            ["deal_id"],
            ["deals.id"],
            name=op.f("fk_stage_changes_deal_id_deals"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_stage_changes")),
    )
    with op.batch_alter_table("stage_changes", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_stage_changes_deal_id"), ["deal_id"], unique=False)


def downgrade() -> None:
    op.drop_table("stage_changes")
    op.drop_table("activities")
    op.drop_table("deals")
    op.drop_table("contacts")
    op.drop_index("uq_organizations_name_key", table_name="organizations")
    op.drop_table("organizations")
