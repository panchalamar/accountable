"""Dashboard figures against known data, with today fixed at Mon Nov 16, 2026."""

from datetime import datetime

from backend import clock
from backend.tests.crm.conftest import Make


def dashboard(make: Make) -> dict:
    return make.get("/api/dashboard")


def won_on(make: Make, contact: dict, close_date: str, value: int = 100_000) -> dict:
    """A won deal with its close date edited by hand, as the spec allows."""
    deal = make.deal(contact, stage="won", value=value)
    response = make.edit_deal(deal, close_date=close_date)
    assert response.status_code == 200, response.text
    return response.json()


def test_open_pipeline_is_the_value_and_count_of_open_deals(make: Make):
    contact = make.contact()
    make.deal(contact, stage="new", value=200_000)
    make.deal(contact, stage="negotiation", value=300_000)
    make.deal(contact, stage="won", value=999_000)
    make.deal(contact, stage="lost", value=888_000)
    figures = dashboard(make)["figures"]
    assert (figures["open_pipeline"]["value"], figures["open_pipeline"]["count"]) == (500_000, 2)


def test_expected_revenue_rounds_each_deal_then_adds(make: Make):
    contact = make.contact()
    # $2.50 each: rounded per deal to $3, so $6 in all, not $5.
    make.deal(contact, stage="proposal", value=5)
    make.deal(contact, stage="proposal", value=5)
    make.deal(contact, stage="qualified", value=760_000)
    data = dashboard(make)
    assert data["figures"]["expected_revenue"] == 6 + 190_000
    assert sum(s["expected"] for s in data["stages"]) == data["figures"]["expected_revenue"]


def test_won_this_month_counts_the_1st_and_not_last_months_last_day(make: Make):
    contact = make.contact()
    won_on(make, contact, "2026-11-01", 300_000)
    won_on(make, contact, "2026-10-31", 50_000)
    figures = dashboard(make)["figures"]
    assert figures["won_this_month"] == {"value": 300_000, "count": 1}
    assert figures["won_last_month"] == {"value": 50_000, "count": 1}


def test_won_in_the_last_12_months_is_this_month_and_the_11_before(make: Make):
    contact = make.contact()
    won_on(make, contact, "2025-12-01", 10_000)  # 11 months back: counts
    won_on(make, contact, "2025-11-30", 20_000)  # 12 months back: doesn't
    won_on(make, contact, "2026-11-16", 40_000)
    figures = dashboard(make)["figures"]
    assert figures["won_12_months"]["value"] == 50_000
    assert figures["won_12_months"]["count"] == 2
    assert figures["won_12_months"]["months_with_wins"] == 2


def test_twelve_months_of_wins_ending_with_this_month(make: Make):
    contact = make.contact()
    won_on(make, contact, "2026-03-10", 70_000)
    won_on(make, contact, "2026-03-20", 30_000)
    months = dashboard(make)["months"]
    assert [m["month"] for m in months] == [
        "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05",
        "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11",
    ]  # fmt: skip
    assert months[3] == {"month": "2026-03", "label": "Mar", "year": 2026, "won_value": 100_000, "won_count": 2}
    assert all(m["won_value"] == 0 and m["won_count"] == 0 for i, m in enumerate(months) if i != 3)


def test_open_pipeline_by_stage(make: Make):
    contact = make.contact()
    make.deal(contact, stage="new", value=100_000)
    make.deal(contact, stage="new", value=50_000)
    make.deal(contact, stage="negotiation", value=200_000)
    stages = {s["stage"]: s for s in dashboard(make)["stages"]}
    assert list(stages) == ["new", "qualified", "proposal", "negotiation"]
    assert stages["new"] == {"stage": "new", "count": 2, "value": 150_000, "expected": 15_000}
    assert stages["qualified"] == {"stage": "qualified", "count": 0, "value": 0, "expected": 0}
    assert stages["negotiation"]["expected"] == 150_000


def test_funnel(make: Make):
    contact = make.contact()
    make.deal(contact, stage="new", value=1)
    proposal = make.deal(contact, stage="new", value=10)
    make.move(proposal, "proposal")
    lost_at_negotiation = make.deal(contact, stage="new", value=100)
    make.move(lost_at_negotiation, "negotiation")
    make.move(lost_at_negotiation, "lost")
    won_then_back = make.deal(contact, stage="new", value=1000)
    make.move(won_then_back, "won")
    make.move(won_then_back, "qualified", close_date="2026-12-31")
    old = won_on(make, contact, "2025-11-30", 10_000)  # closed 12 months back: left out
    assert old["stage"] == "won"

    funnel = {f["stage"]: (f["count"], f["value"]) for f in dashboard(make)["funnel"]}
    assert funnel == {
        "new": (4, 1111),
        "qualified": (3, 1110),
        "proposal": (3, 1110),
        "negotiation": (2, 1100),
        "won": (1, 1000),
    }


def test_follow_ups(make: Make):
    contact = make.contact()
    for days, description in [
        (-3, "three days late"),
        (-10, "ten days late"),
        (0, "due today"),
        (7, "due in seven"),
        (2, "due in two"),
        (8, "due in eight"),
    ]:
        date = f"2026-11-{16 + days:02d}"
        make.activity(contact, description=description, follow_up_date=date)
    done = make.activity(contact, description="done already", follow_up_date="2026-11-15")
    make.client.patch(f"/api/activities/{done['id']}", json={"done": True})
    make.activity(contact, description="no follow-up")

    follow_ups = dashboard(make)["follow_ups"]
    assert [(f["description"], f["days"]) for f in follow_ups["overdue"]] == [
        ("ten days late", -10),
        ("three days late", -3),
    ]
    assert [(f["description"], f["days"]) for f in follow_ups["upcoming"]] == [
        ("due today", 0),
        ("due in two", 2),
        ("due in seven", 7),
    ]
    assert follow_ups["overdue"][0]["contact"]["id"] == contact["id"]


def test_recent_activity_is_the_10_latest_newest_first_without_the_future(make: Make):
    contact = make.contact()
    deal = make.deal(contact, stage="new")
    for day in range(1, 11):
        make.activity(contact, description=f"Day {day}", occurred_at=f"2026-11-{day:02d}T09:00:00")
    clock.set_now(datetime(2026, 11, 15, 16, 0))
    make.move(deal, "qualified")
    clock.set_now(datetime(2026, 11, 16, 12, 0))
    make.activity(contact, description="Tomorrow", occurred_at="2026-11-17T09:00:00")
    make.activity(contact, description="Later today", occurred_at="2026-11-16T15:00:00")

    recent = dashboard(make)["recent"]
    assert len(recent) == 10
    assert recent[0]["kind"] == "stage_change"
    assert (recent[0]["from_stage"], recent[0]["to_stage"]) == ("new", "qualified")
    assert [r["description"] for r in recent[1:]] == [f"Day {d}" for d in range(10, 1, -1)]


def test_a_deal_due_today_isnt_late(make: Make):
    contact = make.contact()
    make.deal(contact, stage="proposal", close_date="2026-11-16", value=10)
    make.deal(contact, stage="proposal", close_date="2026-11-15", value=20)
    pipeline = dashboard(make)["figures"]["open_pipeline"]
    assert (pipeline["late_count"], pipeline["late_value"]) == (1, 20)
