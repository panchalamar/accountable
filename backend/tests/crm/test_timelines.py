from datetime import datetime

from backend import clock
from backend.tests.crm.conftest import Make


def test_a_contacts_timeline_is_newest_first_by_when_it_happened(make: Make):
    contact = make.contact()
    middle = make.activity(contact, occurred_at="2026-11-10T09:00:00")
    oldest = make.activity(contact, occurred_at="2026-10-01T09:00:00")
    newest = make.activity(contact, occurred_at="2026-11-15T17:30:00")
    timeline = make.get(f"/api/contacts/{contact['id']}/timeline")
    assert [i["id"] for i in timeline] == [newest["id"], middle["id"], oldest["id"]]
    assert all(i["kind"] == "activity" for i in timeline)


def test_a_deals_timeline_mixes_activities_and_stage_changes(make: Make):
    deal = make.deal(stage="proposal")
    early = make.activity(deal=deal, occurred_at="2026-11-10T09:00:00")
    clock.set_now(datetime(2026, 11, 12, 15, 0))
    make.move(deal, "negotiation")
    late = make.activity(deal=deal, occurred_at="2026-11-14T10:00:00")
    timeline = make.get(f"/api/deals/{deal['id']}/timeline")
    assert [(i["kind"], i["at"]) for i in timeline] == [
        ("activity", "2026-11-14T10:00:00"),
        ("stage_change", "2026-11-12T15:00:00"),
        ("activity", "2026-11-10T09:00:00"),
    ]
    assert timeline[0]["id"] == late["id"] and timeline[2]["id"] == early["id"]
    assert (timeline[1]["from_stage"], timeline[1]["to_stage"]) == ("proposal", "negotiation")


def test_an_activity_linked_to_both_is_on_both_timelines(make: Make):
    contact = make.contact()
    deal = make.deal(contact)
    both = make.activity(contact, deal)
    on_contact = make.get(f"/api/contacts/{contact['id']}/timeline")
    on_deal = make.get(f"/api/deals/{deal['id']}/timeline")
    assert [i["id"] for i in on_contact] == [both["id"]]
    assert [i["id"] for i in on_deal if i["kind"] == "activity"] == [both["id"]]
    # Each timeline names the other record, so it can link to it.
    assert on_contact[0]["deal"] == {"id": deal["id"], "name": deal["name"]}
    assert on_deal[0]["contact"] == {"id": contact["id"], "name": contact["name"]}
