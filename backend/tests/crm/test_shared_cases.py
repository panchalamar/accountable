"""Every case in shared/crm-rule-cases.json, which Vitest checks too."""

import json
from datetime import date, timedelta

import pytest

from backend import settings
from backend.crm import rules

CASES = json.loads((settings.ROOT / "shared" / "crm-rule-cases.json").read_text())
TODAY = date(2026, 11, 16)


@pytest.mark.parametrize("case", CASES["expectedRevenue"], ids=lambda c: c["why"])
def test_expected_revenue(case):
    assert rules.expected_revenue(case["value"], case["probability"]) == case["expected"]


@pytest.mark.parametrize("case", CASES["totals"], ids=lambda c: c["why"])
def test_totals_add_the_rounded_parts(case):
    assert sum(d["value"] for d in case["deals"]) == case["value"]
    assert rules.total_expected(case["deals"]) == case["expected"]
    assert rules.total_expected(case["deals"]) == sum(
        rules.expected_revenue(d["value"], d["probability"]) for d in case["deals"]
    )


@pytest.mark.parametrize("case", CASES["late"], ids=lambda c: c["why"])
def test_late(case):
    close_date = TODAY + timedelta(days=case["closeInDays"])
    assert rules.is_late(case["stage"], close_date, TODAY) is case["late"]


def test_stage_probabilities_and_order_match_the_file():
    assert [s["stage"] for s in CASES["stages"]] == list(rules.STAGE_PROBABILITY)
    for stage in CASES["stages"]:
        assert rules.STAGE_PROBABILITY[stage["stage"]] == stage["probability"]
        assert rules.STAGE_LABEL[stage["stage"]] == stage["label"]
        assert (stage["stage"] in rules.OPEN_STAGES) is stage["open"]
