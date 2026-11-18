"""The sample data, made on several days through the year."""

import shutil
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from backend import clock, db
from backend.crm import sample_data
from backend.crm.rules import OPEN_STAGES
from backend.crm.tables import REACHABLE_STAGES, activities, contacts, deals, organizations, stage_changes
from backend.main import create_app
from backend.tests.conftest import sqlite_url

DAYS = [
    datetime(2027, 1, 1, 12, 0),
    datetime(2028, 2, 28, 12, 0),
    datetime(2028, 2, 29, 12, 0),
    datetime(2026, 11, 16, 12, 0),
    datetime(2026, 12, 31, 12, 0),
]


@pytest.fixture(params=DAYS, ids=lambda d: d.date().isoformat())
def seeded(request, template_db: Path, tmp_path: Path):
    now = request.param
    clock.set_now(now)
    path = tmp_path / "sample.db"
    shutil.copyfile(template_db, path)
    engine = db.make_engine(sqlite_url(path))
    sample_data.add(engine)
    with TestClient(create_app(sqlite_url(path)), base_url="http://localhost") as client:
        yield now, engine, client
    engine.dispose()


def _rows(engine, query) -> list[dict]:
    with engine.connect() as conn:
        return [dict(r) for r in conn.execute(query).mappings()]


def _months_back(today: date, months: int) -> date:
    index = today.year * 12 + today.month - 1 - months
    return date(index // 12, index % 12 + 1, 1)


def test_organizations_and_contacts(seeded):
    _now, engine, _client = seeded
    orgs = _rows(engine, select(organizations))
    people = _rows(engine, select(contacts))
    assert 10 <= len(orgs) <= 14
    assert len({o["industry"] for o in orgs}) >= 6
    assert all(o["website"] and o["notes"] for o in orgs)
    assert 32 <= len(people) <= 40
    statuses = Counter(c["status"] for c in people)
    assert set(statuses) == {"lead", "qualified", "customer"}
    assert min(statuses.values()) >= 8
    per_org = Counter(c["organization_id"] for c in people)
    assert all(2 <= n <= 4 for n in per_org.values())
    assert all(c["job_title"] and c["phone"] for c in people)


def test_deals(seeded):
    now, engine, _client = seeded
    today = now.date()
    rows = _rows(engine, select(deals))
    assert len(rows) == 40
    window = _months_back(today, 11)
    won = [d for d in rows if d["stage"] == "won"]
    lost = [d for d in rows if d["stage"] == "lost"]
    open_ = [d for d in rows if d["stage"] in OPEN_STAGES]
    assert len(won) == 16 and all(window <= d["close_date"] <= today for d in won)
    assert len({(d["close_date"].year, d["close_date"].month) for d in won}) >= 10
    assert len(lost) == 7
    recent = today - timedelta(days=30)
    assert sum(d["close_date"] >= recent for d in won) >= 2
    assert sum(d["close_date"] >= recent for d in lost) >= 2
    assert len(open_) == 17
    assert set(Counter(d["stage"] for d in open_)) == set(OPEN_STAGES)
    assert sum(d["close_date"] < today for d in open_) == 3
    assert all(100_000 <= d["value"] <= 1_000_000 for d in rows)


def test_open_close_dates_fall_within_9_months(seeded):
    _now, _engine, client = seeded
    slots = client.get("/api/dashboard").json()["forecast"]["slots"]
    assert "later" not in [s["kind"] for s in slots]


def test_a_deal_is_won_this_month_on_every_date(seeded):
    _now, _engine, client = seeded
    assert client.get("/api/dashboard").json()["figures"]["won_this_month"]["count"] >= 1


def test_follow_ups(seeded):
    now, engine, client = seeded
    today = now.date()
    follow_ups = _rows(engine, select(activities).where(activities.c.follow_up_date.is_not(None)))
    pending = [a for a in follow_ups if not a["done"]]
    assert sum(a["follow_up_date"] < today for a in pending) == 4
    upcoming = [a for a in pending if today <= a["follow_up_date"] <= today + timedelta(days=7)]
    assert len(upcoming) == 5
    assert sum(a["follow_up_date"] == today for a in upcoming) == 1
    assert sum(a["follow_up_date"] > today + timedelta(days=7) for a in pending) == 4
    assert any(a["done"] for a in follow_ups)
    data = client.get("/api/dashboard").json()["follow_ups"]
    assert (len(data["overdue"]), len(data["upcoming"])) == (4, 5)


def test_links_follow_the_rules(seeded):
    _now, engine, _client = seeded
    people = {c["id"]: c for c in _rows(engine, select(contacts))}
    all_deals = {d["id"]: d for d in _rows(engine, select(deals))}
    for d in all_deals.values():
        assert people[d["main_contact_id"]]["organization_id"] == d["organization_id"], d["name"]
    for a in _rows(engine, select(activities)):
        assert a["contact_id"] or a["deal_id"]
        if a["contact_id"] and a["deal_id"]:
            assert people[a["contact_id"]]["organization_id"] == all_deals[a["deal_id"]]["organization_id"]
    with engine.connect() as conn:
        assert 100 <= conn.execute(select(func.count()).select_from(activities)).scalar_one() <= 160


def test_stage_history(seeded):
    now, engine, _client = seeded
    changes = _rows(engine, select(stage_changes).order_by(stage_changes.c.id))
    by_deal: dict[int, list[dict]] = {}
    for c in changes:
        by_deal.setdefault(c["deal_id"], []).append(c)
    for d in _rows(engine, select(deals)):
        history = by_deal.get(d["id"], [])
        if d["stage"] != "new":
            assert history, d["name"]
        times = [c["changed_at"] for c in history]
        assert times == sorted(times), d["name"]
        end = datetime.combine(d["close_date"], datetime.max.time()) if d["stage"] in ("won", "lost") else now
        assert all(d["created_at"] <= t <= min(end, now) for t in times), d["name"]
        stage = "new"
        for c in history:
            assert c["from_stage"] == stage, d["name"]
            stage = c["to_stage"]
        assert stage == d["stage"], d["name"]
        reached = ["new"] + [c["to_stage"] for c in history if c["to_stage"] != "lost"]
        assert max(reached, key=REACHABLE_STAGES.index) == d["furthest_stage"], d["name"]


def test_every_email_is_under_example_com(seeded):
    _now, engine, _client = seeded
    emails = [c["email"] for c in _rows(engine, select(contacts))]
    assert all(e and e.endswith(".example.com") for e in emails)


def test_figures_equal_the_mockups_on_nov_16_2026(template_db, tmp_path):
    clock.set_now(datetime(2026, 11, 16, 12, 0))
    path = tmp_path / "mockup.db"
    shutil.copyfile(template_db, path)
    with TestClient(create_app(sqlite_url(path)), base_url="http://localhost") as client:
        sample_data.add(client.app.state.engine)
        figures = client.get("/api/dashboard").json()["figures"]
    assert (figures["open_pipeline"]["value"], figures["open_pipeline"]["count"]) == (9_040_000, 17)
    assert figures["expected_revenue"] == 3_481_000
    assert figures["won_this_month"] == {"value": 1_080_000, "count": 2}
    assert (figures["won_12_months"]["value"], figures["won_12_months"]["count"]) == (7_710_000, 16)


def test_recent_activity_matches_the_mockup_and_never_shows_the_future(template_db, tmp_path):
    # Early in the morning, before today's 9:15 call and 11:20 move have happened.
    now = datetime(2026, 11, 16, 7, 30)
    clock.set_now(now)
    path = tmp_path / "early.db"
    shutil.copyfile(template_db, path)
    with TestClient(create_app(sqlite_url(path)), base_url="http://localhost") as client:
        sample_data.add(client.app.state.engine)
        recent = client.get("/api/dashboard").json()["recent"]
    assert all(datetime.fromisoformat(r["at"]) <= now for r in recent)
    assert [r["kind"] for r in recent[:2]] == ["stage_change", "activity"]  # order kept
    named = [r["deal"]["name"] for r in recent]
    assert named == [
        "Steel supply agreement 2027",
        "Steel supply agreement 2027",
        "Branch network upgrade",
        "Branch network upgrade",
        "Patient records system",
        "Turbine maintenance contract",
        "Policy admin migration",
        "Lab automation",
        "Lab automation",
        "ERP rollout",
    ]


def test_a_new_database_gets_the_sample_data_once(tmp_path):
    url = sqlite_url(tmp_path / "first-start.db")
    with TestClient(create_app(url), base_url="http://localhost") as client:
        assert len(client.get("/api/deals").json()) == 40
        client.post("/api/organizations", json={"name": "Added after the first start"})
    with TestClient(create_app(url), base_url="http://localhost") as client:
        assert len(client.get("/api/deals").json()) == 40
        assert len(client.get("/api/organizations").json()) == 13
