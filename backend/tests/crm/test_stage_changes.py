from datetime import datetime

import pytest
from sqlalchemy import select

from backend import clock
from backend.crm.tables import stage_changes
from backend.tests.conftest import FIXED_NOW
from backend.tests.crm.conftest import Make

TODAY = "2026-11-16"
USUAL = {"new": 10, "qualified": 25, "proposal": 50, "negotiation": 75, "won": 100, "lost": 0}


def history(client, deal_id: int) -> list[tuple[str, str]]:
    engine = client.app.state.engine
    with engine.connect() as conn:
        rows = conn.execute(
            select(stage_changes.c.from_stage, stage_changes.c.to_stage)
            .where(stage_changes.c.deal_id == deal_id)
            .order_by(stage_changes.c.id)
        ).all()
    return [tuple(r) for r in rows]


@pytest.mark.parametrize("stage", list(USUAL))
def test_each_stage_sets_its_usual_probability(make: Make, stage):
    start = "proposal" if stage == "new" else "new"
    deal = make.deal(stage=start)
    response = make.move(deal, stage, close_date="2027-01-31")
    assert response.status_code == 200, response.text
    assert response.json()["probability"] == USUAL[stage]


def test_a_probability_typed_with_a_stage_change_is_replaced(make: Make):
    deal = make.deal(stage="new")
    saved = make.edit_deal(deal, stage="proposal", probability=90).json()
    assert saved["probability"] == 50


def test_a_probability_set_by_hand_is_kept_until_the_next_stage_change(make: Make):
    deal = make.deal(stage="qualified")
    saved = make.edit_deal(deal, probability=40).json()
    assert saved["probability"] == 40
    # A new place in the same column keeps it.
    assert make.move(saved, "qualified").json()["probability"] == 40
    assert make.move(saved, "proposal").json()["probability"] == 50


@pytest.mark.parametrize("stage", ["won", "lost"])
def test_a_move_into_won_or_lost_sets_the_close_date_to_today(make: Make, stage):
    deal = make.deal(stage="negotiation", close_date="2027-02-01")
    moved = make.move(deal, stage, close_date="2027-05-05").json()
    assert moved["close_date"] == TODAY
    deal = make.deal(stage="negotiation", close_date="2027-02-01")
    edited = make.edit_deal(deal, stage=stage, close_date="2027-05-05").json()
    assert edited["close_date"] == TODAY


def test_a_move_from_won_to_lost_resets_the_close_date_to_today(make: Make):
    deal = make.deal(stage="won")
    clock.set_now(datetime(2026, 11, 20, 9, 0))
    moved = make.move(deal, "lost").json()
    assert moved["close_date"] == "2026-11-20"


def test_reopening_without_a_close_date_is_refused(make: Make):
    for stage in ("won", "lost"):
        deal = make.deal(stage=stage)
        response = make.move(deal, "proposal")
        assert response.status_code == 409
        assert response.json()["message"] == "Choose a new expected close date to reopen this deal."
        assert make.get(f"/api/deals/{deal['id']}")["stage"] == stage


def test_reopening_with_a_date_sets_it(make: Make):
    deal = make.deal(stage="won")
    moved = make.move(deal, "proposal", close_date="2026-12-16").json()
    assert (moved["stage"], moved["close_date"], moved["probability"]) == ("proposal", "2026-12-16", 50)
    deal = make.deal(stage="lost")
    edited = make.edit_deal(deal, stage="qualified", close_date="2026-12-20").json()
    assert (edited["stage"], edited["close_date"]) == ("qualified", "2026-12-20")


def test_every_stage_change_adds_a_row_with_from_to_and_the_time(client, make: Make):
    deal = make.deal(stage="new")
    make.move(deal, "qualified")
    make.edit_deal(make.get(f"/api/deals/{deal['id']}"), stage="proposal")
    assert history(client, deal["id"]) == [("new", "qualified"), ("qualified", "proposal")]
    with client.app.state.engine.connect() as conn:
        times = conn.execute(
            select(stage_changes.c.changed_at).where(stage_changes.c.deal_id == deal["id"])
        ).scalars().all()
    assert times == [FIXED_NOW, FIXED_NOW]


def test_a_new_place_in_the_same_column_adds_no_row(client, make: Make):
    contact = make.contact()
    a = make.deal(contact, stage="proposal")
    b = make.deal(contact, stage="proposal")
    assert make.move(a, "proposal", before_id=b["id"]).status_code == 200
    assert history(client, a["id"]) == []


def test_the_furthest_stage_moves_forward_and_stays_at_won(make: Make):
    deal = make.deal(stage="new")
    assert make.move(deal, "proposal").json()["furthest_stage"] == "proposal"
    assert make.move(deal, "qualified").json()["furthest_stage"] == "proposal"
    assert make.move(deal, "won").json()["furthest_stage"] == "won"
    back = make.move(deal, "negotiation", close_date="2026-12-31").json()
    assert back["furthest_stage"] == "won"
    assert make.move(deal, "lost").json()["furthest_stage"] == "won"


def test_a_deal_added_at_won(client, make: Make):
    deal = make.deal(stage="won", close_date="2027-04-01")
    assert (deal["close_date"], deal["furthest_stage"], deal["probability"]) == (TODAY, "won", 100)
    assert history(client, deal["id"]) == []


def test_a_deal_added_at_lost_has_new_as_its_furthest_stage(client, make: Make):
    deal = make.deal(stage="lost", close_date="2027-04-01")
    assert (deal["close_date"], deal["furthest_stage"]) == (TODAY, "new")
    assert history(client, deal["id"]) == []


def test_winning_a_deal_leaves_the_main_contacts_status_alone(make: Make):
    contact = make.contact(status="lead")
    deal = make.deal(contact, stage="negotiation")
    make.move(deal, "won")
    assert make.get(f"/api/contacts/{contact['id']}")["status"] == "lead"


@pytest.mark.parametrize(
    "start,target,close_date",
    [
        ("new", "proposal", None),
        ("negotiation", "won", "2027-06-01"),
        ("negotiation", "lost", None),
        ("won", "lost", None),
        ("won", "qualified", "2026-12-24"),
        ("lost", "negotiation", "2027-01-15"),
    ],
)
def test_the_edit_and_the_move_follow_the_same_rules(client, make: Make, start, target, close_date):
    contact = make.contact()
    by_move = make.deal(contact, stage=start, close_date="2026-12-31")
    by_edit = make.deal(contact, stage=start, close_date="2026-12-31")

    moved = make.move(by_move, target, close_date=close_date).json()
    # The edit form always sends a close date. When it doesn't matter, it's the deal's own.
    edited = make.edit_deal(by_edit, stage=target, close_date=close_date or "2026-12-31").json()

    fields = ("stage", "probability", "close_date", "furthest_stage", "position")
    assert {k: moved[k] for k in fields if k != "position"} == {k: edited[k] for k in fields if k != "position"}
    assert history(client, by_move["id"]) == history(client, by_edit["id"]) == [(start, target)]
