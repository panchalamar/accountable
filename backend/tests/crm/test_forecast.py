"""The forecast slots after Today, with today fixed at Mon Nov 16, 2026."""

from datetime import date

from backend.crm.dashboard import forecast
from backend.tests.crm.conftest import Make

TODAY = date(2026, 11, 16)
_ids = iter(range(1, 10_000))


def deal(close: str, stage: str = "proposal", value: int = 100_000, probability: int = 50) -> dict:
    n = next(_ids)
    return {
        "id": n,
        "name": f"Deal {n}",
        "stage": stage,
        "value": value,
        "probability": probability,
        "close_date": date.fromisoformat(close),
    }


def labels(result: dict) -> list[str]:
    return [s["label"] for s in result["slots"]]


def test_late_deals_form_one_late_slot_first():
    result = forecast([deal("2026-12-05"), deal("2026-11-01"), deal("2026-10-20")], TODAY)
    assert labels(result) == ["Late", "Dec"]
    assert result["slots"][0]["count"] == 2
    assert labels(forecast([deal("2026-12-05")], TODAY)) == ["Dec"]


def test_rest_of_the_month():
    result = forecast([deal("2026-11-16"), deal("2026-11-30"), deal("2026-11-15")], TODAY)
    assert labels(result) == ["Late", "Rest of Nov"]
    assert result["slots"][1]["count"] == 2  # due today goes here, not in Late
    assert result["slots"][1]["kind"] == "rest"
    assert "Rest of Nov" not in labels(forecast([deal("2026-12-01")], TODAY))


def test_monthly_slots_run_to_the_latest_close_date_with_empty_months_in_between():
    result = forecast([deal("2026-12-10"), deal("2027-03-02")], TODAY)
    assert labels(result) == ["Dec", "Jan", "Feb", "Mar"]
    assert [s["month"] for s in result["slots"]] == ["2026-12", "2027-01", "2027-02", "2027-03"]
    assert [s["count"] for s in result["slots"]] == [1, 0, 0, 1]


def test_more_than_9_months_ahead_goes_into_later():
    result = forecast([deal("2027-08-31"), deal("2027-09-01"), deal("2028-01-15")], TODAY)
    months = [s["month"] for s in result["slots"] if s["kind"] == "month"]
    assert months[-1] == "2027-08"  # 9 months ahead, no further
    assert len(months) == 9
    assert result["slots"][-1]["label"] == "Later"
    assert result["slots"][-1]["count"] == 2


def test_no_open_deals_means_no_slots_and_says_so():
    assert forecast([], TODAY) == {"slots": [], "none_open": True}


def test_each_slot_gives_its_value_by_stage_and_lists_its_deals():
    result = forecast(
        [
            deal("2026-12-01", "negotiation", 950_000),
            deal("2026-12-18", "proposal", 400_000),
            deal("2026-12-20", "proposal", 100_000),
        ],
        TODAY,
    )
    (dec,) = result["slots"]
    assert dec["by_stage"] == {"new": 0, "qualified": 0, "proposal": 500_000, "negotiation": 950_000}
    assert [d["value"] for d in dec["deals"]] == [950_000, 400_000, 100_000]
    assert set(dec["deals"][0]) == {"id", "name", "stage", "value", "close_date"}


def test_the_slots_add_up_to_the_open_pipeline(make: Make):
    contact = make.contact()
    for close, value, stage in [
        ("2026-11-01", 5, "proposal"),
        ("2026-11-20", 5, "proposal"),
        ("2027-01-10", 760_000, "qualified"),
        ("2028-06-01", 1_000_010, "new"),
    ]:
        make.deal(contact, stage=stage, close_date=close, value=value)
    data = make.get("/api/dashboard")
    slots = data["forecast"]["slots"]
    assert sum(s["value"] for s in slots) == data["figures"]["open_pipeline"]["value"]
    assert sum(s["expected"] for s in slots) == data["figures"]["expected_revenue"]
    assert sum(s["count"] for s in slots) == data["figures"]["open_pipeline"]["count"]
