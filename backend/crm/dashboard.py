"""Every dashboard figure: the headline figures, 12 months of wins, the
forecast slots, open pipeline by stage, the funnel, follow-ups and recent
activity. All from the data at the moment it's asked for."""

import calendar
from datetime import date, timedelta

from sqlalchemy import Engine, select

from backend import clock
from backend.crm.queries import BOARD_ORDER, activity_query, activity_row
from backend.crm.rules import CLOSED_STAGES, OPEN_STAGES, is_late, total_expected
from backend.crm.tables import REACHABLE_STAGES, activities, deals, stage_changes

FORECAST_MONTHS = 9  # monthly slots go at most this far ahead; the rest is "Later"
FOLLOW_UP_DAYS = 7
RECENT_ITEMS = 10
MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _month_start(day: date) -> date:
    return day.replace(day=1)


def _add_months(first_of_month: date, months: int) -> date:
    index = first_of_month.year * 12 + first_of_month.month - 1 + months
    year, month = divmod(index, 12)
    return date(year, month + 1, 1)


def _month_end(day: date) -> date:
    return day.replace(day=calendar.monthrange(day.year, day.month)[1])


def _months_between(earlier: date, later: date) -> int:
    return (later.year - earlier.year) * 12 + later.month - earlier.month


def _sum(rows) -> dict:
    rows = list(rows)
    return {
        "count": len(rows),
        "value": sum(r["value"] for r in rows),
        "expected": total_expected(rows),
    }


def _slot(key: str, kind: str, label: str, rows: list, month: date | None = None) -> dict:
    by_stage = {stage: 0 for stage in OPEN_STAGES}
    for r in rows:
        by_stage[r["stage"]] += r["value"]
    ordered = sorted(rows, key=lambda r: (-r["value"], r["close_date"], r["id"]))
    return {
        "key": key,
        "kind": kind,
        "label": label,
        "month": month.strftime("%Y-%m") if month else None,
        **_sum(rows),
        "by_stage": by_stage,
        "deals": [
            {
                "id": r["id"],
                "name": r["name"],
                "stage": r["stage"],
                "value": r["value"],
                "close_date": r["close_date"],
            }
            for r in ordered
        ],
    }


def forecast(open_deals: list, today: date) -> dict:
    """The slots after Today: Late, the rest of this month, one per month up
    to 9 months ahead, then Later. Each only when it has deals, except that
    the months between next month and the latest one all appear."""
    if not open_deals:
        return {"slots": [], "none_open": True}
    this_month = _month_start(today)
    month_end = _month_end(today)
    slots = []

    late = [d for d in open_deals if d["close_date"] < today]
    if late:
        slots.append(_slot("late", "late", "Late", late))

    rest = [d for d in open_deals if today <= d["close_date"] <= month_end]
    if rest:
        slots.append(
            _slot("rest", "rest", f"Rest of {MONTH_LABELS[today.month - 1]}", rest, this_month)
        )

    ahead = [d for d in open_deals if d["close_date"] > month_end]
    if ahead:
        last = min(
            max(_months_between(this_month, d["close_date"]) for d in ahead), FORECAST_MONTHS
        )
        for offset in range(1, last + 1):
            month = _add_months(this_month, offset)
            rows = [d for d in ahead if _month_start(d["close_date"]) == month]
            slots.append(
                _slot(month.strftime("%Y-%m"), "month", MONTH_LABELS[month.month - 1], rows, month)
            )
        later = [d for d in ahead if _months_between(this_month, d["close_date"]) > FORECAST_MONTHS]
        if later:
            slots.append(_slot("later", "later", "Later", later))

    return {"slots": slots, "none_open": False}


def dashboard(engine: Engine) -> dict:
    today = clock.today()
    now = clock.now()
    this_month = _month_start(today)
    window_start = _add_months(this_month, -11)  # the last 12 months: this one and the 11 before

    with engine.connect() as conn:
        all_deals = (
            conn.execute(
                select(
                    deals.c.id,
                    deals.c.name,
                    deals.c.stage,
                    deals.c.value,
                    deals.c.probability,
                    deals.c.close_date,
                    deals.c.furthest_stage,
                ).order_by(BOARD_ORDER, deals.c.position, deals.c.id)
            )
            .mappings()
            .all()
        )

        follow_up_rows = (
            conn.execute(
                activity_query()
                .where(
                    activities.c.follow_up_date.is_not(None),
                    activities.c.done.is_(False),
                    activities.c.follow_up_date <= today + timedelta(days=FOLLOW_UP_DAYS),
                )
                .order_by(activities.c.follow_up_date, activities.c.id)
            )
            .mappings()
            .all()
        )

        recent_activities = (
            conn.execute(
                activity_query()
                .where(activities.c.occurred_at <= now)
                .order_by(activities.c.occurred_at.desc(), activities.c.id.desc())
                .limit(RECENT_ITEMS)
            )
            .mappings()
            .all()
        )

        recent_changes = (
            conn.execute(
                select(stage_changes, deals.c.name.label("deal_name"))
                .join(deals, deals.c.id == stage_changes.c.deal_id)
                .where(stage_changes.c.changed_at <= now)
                .order_by(stage_changes.c.changed_at.desc(), stage_changes.c.id.desc())
                .limit(RECENT_ITEMS)
            )
            .mappings()
            .all()
        )

    open_deals = [d for d in all_deals if d["stage"] in OPEN_STAGES]
    late = [d for d in open_deals if is_late(d["stage"], d["close_date"], today)]
    won = [d for d in all_deals if d["stage"] == "won"]

    months = []
    for offset in range(-11, 1):
        month = _add_months(this_month, offset)
        rows = [d for d in won if _month_start(d["close_date"]) == month]
        months.append(
            {
                "month": month.strftime("%Y-%m"),
                "label": MONTH_LABELS[month.month - 1],
                "year": month.year,
                "won_value": sum(d["value"] for d in rows),
                "won_count": len(rows),
            }
        )
    won_12 = [d for d in won if window_start <= d["close_date"] <= _month_end(today)]

    stages = [
        {"stage": stage, **_sum(d for d in open_deals if d["stage"] == stage)}
        for stage in OPEN_STAGES
    ]

    in_funnel = [
        d
        for d in all_deals
        if d["stage"] in OPEN_STAGES
        or (d["stage"] in CLOSED_STAGES and d["close_date"] >= window_start)
    ]
    funnel = []
    for index, stage in enumerate(REACHABLE_STAGES):
        reached = [d for d in in_funnel if REACHABLE_STAGES.index(d["furthest_stage"]) >= index]
        funnel.append(
            {"stage": stage, "count": len(reached), "value": sum(d["value"] for d in reached)}
        )

    def follow_up(row) -> dict:
        item = activity_row(row)
        return {
            "id": item["id"],
            "type": item["type"],
            "description": item["description"],
            "follow_up_date": item["follow_up_date"],
            "days": (item["follow_up_date"] - today).days,
            "contact": item["contact"],
            "deal": item["deal"],
        }

    overdue = [follow_up(r) for r in follow_up_rows if r["follow_up_date"] < today]
    upcoming = [follow_up(r) for r in follow_up_rows if r["follow_up_date"] >= today]

    recent = [
        {
            "kind": "activity",
            "id": r["id"],
            "type": r["type"],
            "description": r["description"],
            "at": r["occurred_at"],
            "contact": activity_row(r)["contact"],
            "deal": activity_row(r)["deal"],
        }
        for r in recent_activities
    ] + [
        {
            "kind": "stage_change",
            "id": r["id"],
            "deal": {"id": r["deal_id"], "name": r["deal_name"]},
            "from_stage": r["from_stage"],
            "to_stage": r["to_stage"],
            "at": r["changed_at"],
        }
        for r in recent_changes
    ]
    recent.sort(key=lambda i: (i["at"], i["kind"] == "stage_change", i["id"]), reverse=True)

    return {
        "today": today,
        "figures": {
            "open_pipeline": {
                "value": sum(d["value"] for d in open_deals),
                "count": len(open_deals),
                "late_count": len(late),
                "late_value": sum(d["value"] for d in late),
            },
            "expected_revenue": total_expected(open_deals),
            "won_this_month": {"value": months[-1]["won_value"], "count": months[-1]["won_count"]},
            "won_last_month": {"value": months[-2]["won_value"], "count": months[-2]["won_count"]},
            "won_12_months": {
                "value": sum(d["value"] for d in won_12),
                "count": len(won_12),
                "months_with_wins": sum(1 for m in months if m["won_count"]),
            },
        },
        "months": months,
        "forecast": forecast(open_deals, today),
        "stages": stages,
        "funnel": funnel,
        "follow_ups": {"overdue": overdue, "upcoming": upcoming},
        "recent": recent[:RECENT_ITEMS],
    }
