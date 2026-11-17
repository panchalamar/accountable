"""Request and response shapes for the CRM's API.

Requests check types and length limits. The rules that need the database, or
that have their own wording in the spec, are in rules.py.
"""

from datetime import date, datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

NAME = 200
SHORT = 100  # job title, industry
PHONE = 50
WEBSITE = 200
EMAIL = 200
LONG = 5000  # notes, activity descriptions

VALUE_MESSAGE = "Enter a value of $0 or more, in whole dollars."
VALUE_LIMIT = 999_999_999_999
VALUE_LIMIT_MESSAGE = "Enter a value under $1,000,000,000,000."
PROBABILITY_MESSAGE = "Enter a probability from 0 to 100."

Stage = Literal["new", "qualified", "proposal", "negotiation", "won", "lost"]
Status = Literal["lead", "qualified", "customer"]
ActivityType = Literal["note", "call", "email"]


def _whole_number(raw: Any, message: str) -> int | None:
    if raw is None or raw == "":
        return None
    if isinstance(raw, bool):
        raise ValueError(message)
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float):
        if raw.is_integer():
            return int(raw)
        raise ValueError(message)
    if isinstance(raw, str):
        text = raw.strip().replace(",", "")
        if text.lstrip("-").isdigit():
            return int(text)
    raise ValueError(message)


def _money(raw: Any) -> int | None:
    value = _whole_number(raw, VALUE_MESSAGE)
    if value is not None and value < 0:
        raise ValueError(VALUE_MESSAGE)
    if value is not None and value > VALUE_LIMIT:
        raise ValueError(VALUE_LIMIT_MESSAGE)
    return value


def _percent(raw: Any) -> int | None:
    value = _whole_number(raw, PROBABILITY_MESSAGE)
    if value is not None and not 0 <= value <= 100:
        raise ValueError(PROBABILITY_MESSAGE)
    return value


Money = Annotated[int | None, BeforeValidator(_money)]
Percent = Annotated[int | None, BeforeValidator(_percent)]


class Request(BaseModel):
    model_config = ConfigDict(extra="ignore")


# Organizations


class OrganizationIn(Request):
    name: str | None = Field(None, max_length=NAME)
    website: str | None = Field(None, max_length=WEBSITE)
    industry: str | None = Field(None, max_length=SHORT)
    notes: str | None = Field(None, max_length=LONG)


class OrganizationRow(BaseModel):
    id: int
    name: str
    website: str | None
    industry: str | None
    contact_count: int
    open_deal_count: int


class Link(BaseModel):
    id: int
    name: str


class OrganizationContact(BaseModel):
    id: int
    name: str
    job_title: str | None
    email: str | None
    status: Status


class OrganizationDeal(BaseModel):
    id: int
    name: str
    stage: Stage
    value: int
    probability: int
    close_date: date
    main_contact: Link


class Organization(BaseModel):
    id: int
    name: str
    website: str | None
    industry: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    contacts: list[OrganizationContact]
    deals: list[OrganizationDeal]


class OrganizationDeleteCheck(BaseModel):
    can_delete: bool
    message: str
    contacts: int
    deals: int


# Contacts


class ContactIn(Request):
    name: str | None = Field(None, max_length=NAME)
    organization_id: int | None = None
    email: str | None = Field(None, max_length=EMAIL)
    phone: str | None = Field(None, max_length=PHONE)
    job_title: str | None = Field(None, max_length=SHORT)
    status: str | None = Field(None, max_length=20)


class ContactRow(BaseModel):
    id: int
    name: str
    organization: Link
    job_title: str | None
    email: str | None
    phone: str | None
    status: Status


class ContactDeal(BaseModel):
    id: int
    name: str
    stage: Stage
    value: int
    probability: int
    close_date: date


class Contact(ContactRow):
    created_at: datetime
    updated_at: datetime
    deals: list[ContactDeal]


class ContactDeleteCheck(BaseModel):
    can_delete: bool
    message: str
    blocking_deals: list[Link]
    activities_to_delete: int
    activities_to_keep: int


# Deals


class DealIn(Request):
    name: str | None = Field(None, max_length=NAME)
    organization_id: int | None = None
    main_contact_id: int | None = None
    stage: str | None = Field(None, max_length=20)
    value: Money = None
    probability: Percent = None
    close_date: date | None = None


class DealMove(Request):
    stage: str | None = Field(None, max_length=20)
    before_id: int | None = None
    close_date: date | None = None


class Deal(BaseModel):
    id: int
    name: str
    organization: Link
    main_contact: Link
    stage: Stage
    value: int
    probability: int
    close_date: date
    furthest_stage: Stage
    position: int
    created_at: datetime
    updated_at: datetime


class DealDeleteCheck(BaseModel):
    can_delete: bool
    message: str
    activities_to_delete: int
    activities_to_keep: int
    stage_changes: int


# Activities


class ActivityIn(Request):
    type: str | None = Field(None, max_length=10)
    description: str | None = Field(None, max_length=LONG)
    occurred_at: datetime | None = None
    follow_up_date: date | None = None
    done: bool = False
    contact_id: int | None = None
    deal_id: int | None = None


class ActivityDone(Request):
    done: bool


class Activity(BaseModel):
    id: int
    type: ActivityType
    description: str
    occurred_at: datetime
    follow_up_date: date | None
    done: bool
    contact: Link | None
    deal: Link | None
    created_at: datetime
    updated_at: datetime


class TimelineActivity(Activity):
    kind: Literal["activity"] = "activity"
    at: datetime


class TimelineStageChange(BaseModel):
    kind: Literal["stage_change"] = "stage_change"
    id: int
    deal: Link
    from_stage: Stage
    to_stage: Stage
    at: datetime


TimelineItem = Annotated[TimelineActivity | TimelineStageChange, Field(discriminator="kind")]


# Dashboard


class Amount(BaseModel):
    value: int
    count: int


class OpenPipeline(Amount):
    late_count: int
    late_value: int


class WonInTwelveMonths(Amount):
    months_with_wins: int


class Figures(BaseModel):
    open_pipeline: OpenPipeline
    expected_revenue: int
    won_this_month: Amount
    won_last_month: Amount
    won_12_months: WonInTwelveMonths


class Month(BaseModel):
    month: str
    label: str
    year: int
    won_value: int
    won_count: int


class SlotDeal(BaseModel):
    id: int
    name: str
    stage: Stage
    value: int
    close_date: date


class Slot(BaseModel):
    key: str
    kind: Literal["late", "rest", "month", "later"]
    label: str
    month: str | None
    count: int
    value: int
    expected: int
    by_stage: dict[str, int]
    deals: list[SlotDeal]


class Forecast(BaseModel):
    slots: list[Slot]
    none_open: bool


class StageTotal(BaseModel):
    stage: Stage
    count: int
    value: int
    expected: int


class FunnelStage(BaseModel):
    stage: Stage
    count: int
    value: int


class FollowUp(BaseModel):
    id: int
    type: ActivityType
    description: str
    follow_up_date: date
    days: int
    contact: Link | None
    deal: Link | None


class FollowUps(BaseModel):
    overdue: list[FollowUp]
    upcoming: list[FollowUp]


class RecentActivity(BaseModel):
    kind: Literal["activity"] = "activity"
    id: int
    type: ActivityType
    description: str
    at: datetime
    contact: Link | None
    deal: Link | None


class RecentStageChange(BaseModel):
    kind: Literal["stage_change"] = "stage_change"
    id: int
    deal: Link
    from_stage: Stage
    to_stage: Stage
    at: datetime


class Dashboard(BaseModel):
    today: date
    figures: Figures
    months: list[Month]
    forecast: Forecast
    stages: list[StageTotal]
    funnel: list[FunnelStage]
    follow_ups: FollowUps
    recent: list[Annotated[RecentActivity | RecentStageChange, Field(discriminator="kind")]]
