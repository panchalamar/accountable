"""Turns the offsets in sample_data.json into dates on the day the data is
made, and adds the records. See the file's `dates` section for each kind of
offset.
"""

import calendar
import json
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import Connection, Engine, insert

from backend import clock
from backend.crm.rules import STAGE_PROBABILITY
from backend.crm.tables import activities, contacts, deals, organizations, stage_changes

SAMPLE_FILE = Path(__file__).with_name("sample_data.json")


def load() -> dict[str, Any]:
    return json.loads(SAMPLE_FILE.read_text())


def _months_ago(today: date, months_ago: int, day: int) -> date:
    """That day of the month, months_ago calendar months back, clamped to the
    month's last day and to today."""
    month_index = today.year * 12 + (today.month - 1) - months_ago
    year, month = divmod(month_index, 12)
    month += 1
    last = calendar.monthrange(year, month)[1]
    return min(date(year, month, min(day, last)), today)


def _close_date(spec: dict, today: date) -> date:
    if "daysFromToday" in spec:
        return today + timedelta(days=spec["daysFromToday"])
    return _months_ago(today, spec["monthsAgo"], spec["day"])


class _Moments:
    """Collects every moment first, so the ones later today than now can be
    moved to just before now, in their original order."""

    def __init__(self, now: datetime):
        self.now = now
        self.items: list[tuple[datetime, dict, str]] = []

    def add(self, day: date, hhmm: str, target: dict, key: str) -> None:
        hours, minutes = (int(p) for p in hhmm.split(":"))
        self.items.append((datetime.combine(day, time(hours, minutes)), target, key))

    def settle(self) -> None:
        start_of_today = datetime.combine(self.now.date(), time(0, 0))
        future = sorted((i for i in self.items if i[0] > self.now), key=lambda i: i[0], reverse=True)
        for rank, (_moment, target, key) in enumerate(future, start=1):
            target[key] = max(self.now - timedelta(minutes=rank), start_of_today)
        for moment, target, key in self.items:
            if moment <= self.now:
                target[key] = moment


def _day(spec: dict, today: date, close: date | None) -> date:
    if spec.get("onCloseDate"):
        assert close is not None
        return close
    if "daysBeforeClose" in spec:
        assert close is not None
        return close - timedelta(days=spec["daysBeforeClose"])
    return today + timedelta(days=spec["daysFromToday"])


def build(now: datetime) -> dict[str, list[dict]]:
    """The sample records as rows, with real dates for `now`."""
    data = load()
    today = now.date()
    moments = _Moments(now)
    long_ago = now - timedelta(days=400)

    org_rows = [
        {
            "name": o["name"],
            "website": o.get("website"),
            "industry": o.get("industry"),
            "notes": o.get("notes"),
            "created_at": long_ago,
            "updated_at": long_ago,
        }
        for o in data["organizations"]
    ]

    contact_rows = [
        {
            "name": c["name"],
            "organization": c["organization"],
            "email": c.get("email"),
            "phone": c.get("phone"),
            "job_title": c.get("jobTitle"),
            "status": c.get("status", "lead"),
            "created_at": long_ago,
            "updated_at": long_ago,
        }
        for c in data["contacts"]
    ]

    deal_rows: list[dict] = []
    change_rows: list[dict] = []
    close_by_deal: dict[str, date] = {}
    positions: dict[str, int] = {}
    for d in data["deals"]:
        close = _close_date(d["close"], today)
        close_by_deal[d["name"]] = close
        start_day = _day(d["start"], today, close)
        created = datetime.combine(start_day, time(9, 0))
        position = positions.get(d["stage"], 0)
        positions[d["stage"]] = position + 1
        row = {
            "name": d["name"],
            "organization": d["organization"],
            "main_contact": d["mainContact"],
            "stage": d["stage"],
            "value": d["value"],
            "probability": STAGE_PROBABILITY[d["stage"]],
            "close_date": close,
            "furthest_stage": d["furthestStage"],
            "position": position,
            "created_at": created,
            "updated_at": created,
        }
        deal_rows.append(row)
        for h in d.get("history", []):
            change = {"deal": d["name"], "from_stage": h["from"], "to_stage": h["to"]}
            moments.add(_day(h["at"], today, close), h["at"]["time"], change, "changed_at")
            change_rows.append(change)

    activity_rows: list[dict] = []

    def activity(entry: dict, when: dict, **extra) -> None:
        close = close_by_deal.get(entry.get("deal", ""))
        row = {
            "type": entry["type"],
            "description": entry["description"],
            "contact": entry.get("contact"),
            "deal": entry.get("deal"),
            "follow_up_date": None,
            "done": False,
            **extra,
        }
        moments.add(_day(when, today, close), when["time"], row, "occurred_at")
        activity_rows.append(row)

    for entry in data["activities"]:
        activity(entry, entry["at"])
    for entry in data["recentActivity"]:
        if entry["kind"] == "activity":
            activity(entry, entry["at"])
    for entry in data["followUps"]:
        activity(
            entry,
            entry["logged"],
            follow_up_date=today + timedelta(days=entry["dueInDays"]),
            done=entry.get("done", False),
        )

    moments.settle()

    # A deal was last changed at its latest stage change.
    latest: dict[str, datetime] = {}
    for change in change_rows:
        latest[change["deal"]] = max(latest.get(change["deal"], change["changed_at"]), change["changed_at"])
    for row in deal_rows:
        row["updated_at"] = max(row["created_at"], latest.get(row["name"], row["created_at"]))
    for row in activity_rows:
        row["created_at"] = row["updated_at"] = row["occurred_at"]

    return {
        "organizations": org_rows,
        "contacts": contact_rows,
        "deals": deal_rows,
        "stage_changes": change_rows,
        "activities": activity_rows,
    }


def add_to(conn: Connection, now: datetime | None = None) -> None:
    rows = build(now or clock.now())

    org_ids: dict[str, int] = {}
    for row in rows["organizations"]:
        org_ids[row["name"]] = conn.execute(insert(organizations).values(**row)).inserted_primary_key[0]

    contact_ids: dict[str, int] = {}
    for row in rows["contacts"]:
        values = {k: v for k, v in row.items() if k != "organization"}
        values["organization_id"] = org_ids[row["organization"]]
        contact_ids[row["name"]] = conn.execute(insert(contacts).values(**values)).inserted_primary_key[0]

    deal_ids: dict[str, int] = {}
    for row in rows["deals"]:
        values = {k: v for k, v in row.items() if k not in ("organization", "main_contact")}
        values["organization_id"] = org_ids[row["organization"]]
        values["main_contact_id"] = contact_ids[row["main_contact"]]
        deal_ids[row["name"]] = conn.execute(insert(deals).values(**values)).inserted_primary_key[0]

    conn.execute(
        insert(stage_changes),
        [
            {
                "deal_id": deal_ids[c["deal"]],
                "from_stage": c["from_stage"],
                "to_stage": c["to_stage"],
                "changed_at": c["changed_at"],
            }
            for c in rows["stage_changes"]
        ],
    )

    conn.execute(
        insert(activities),
        [
            {
                **{k: v for k, v in row.items() if k not in ("contact", "deal")},
                "contact_id": contact_ids[row["contact"]] if row["contact"] else None,
                "deal_id": deal_ids[row["deal"]] if row["deal"] else None,
            }
            for row in rows["activities"]
        ],
    )


def add(engine: Engine, now: datetime | None = None) -> None:
    """Adds the sample data to an empty database, in one transaction."""
    with engine.begin() as conn:
        add_to(conn, now)
