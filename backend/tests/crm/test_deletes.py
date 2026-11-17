from sqlalchemy import func, select

from backend.crm.tables import activities, stage_changes
from backend.tests.crm.conftest import Make


def count(client, table, *where) -> int:
    with client.app.state.engine.connect() as conn:
        return conn.execute(select(func.count()).select_from(table).where(*where)).scalar_one()


def test_organization_delete_check_counts_contacts_and_deals(make: Make):
    org = make.org("Northwind Metals")
    people = [make.contact(org) for _ in range(3)]
    make.deal(people[0])
    make.deal(people[1])
    check = make.get(f"/api/organizations/{org['id']}/delete-check")
    assert check == {
        "can_delete": False,
        "message": "Northwind Metals can't be deleted while it has 3 contacts and 2 deals. "
        "Delete them or move them to another organization first.",
        "contacts": 3,
        "deals": 2,
    }


def test_organization_delete_is_refused_while_it_has_any(client, make: Make):
    org = make.org("Busy Org")
    make.contact(org)
    response = client.delete(f"/api/organizations/{org['id']}")
    assert response.status_code == 409
    assert response.json()["message"].startswith("Busy Org can't be deleted while it has 1 contact.")
    assert response.json()["details"] == {"contacts": 1, "deals": 0}

    empty = make.org("Empty Org")
    assert make.get(f"/api/organizations/{empty['id']}/delete-check")["can_delete"] is True
    assert client.delete(f"/api/organizations/{empty['id']}").status_code == 204
    assert client.get(f"/api/organizations/{empty['id']}").status_code == 404


def test_contact_delete_check_lists_deals_where_theyre_main_contact(client, make: Make):
    priya = make.contact(name="Priya Shah")
    make.deal(priya, name="Steel supply agreement 2027")
    check = make.get(f"/api/contacts/{priya['id']}/delete-check")
    assert check["can_delete"] is False
    assert [d["name"] for d in check["blocking_deals"]] == ["Steel supply agreement 2027"]
    assert "Steel supply agreement 2027" in check["message"]
    response = client.delete(f"/api/contacts/{priya['id']}")
    assert response.status_code == 409
    assert response.json()["details"]["deals"][0]["name"] == "Steel supply agreement 2027"


def _contact_with_activities(make: Make):
    org = make.org()
    lead = make.contact(org)
    priya = make.contact(org, name="Priya Shah")
    deal = make.deal(lead)
    only = [make.activity(priya) for _ in range(4)]
    shared = [make.activity(priya, deal) for _ in range(2)]
    return priya, deal, only, shared


def test_contact_delete_check_counts_both_kinds_of_activity(make: Make):
    priya, _deal, _only, _shared = _contact_with_activities(make)
    check = make.get(f"/api/contacts/{priya['id']}/delete-check")
    assert check["can_delete"] is True
    assert (check["activities_to_delete"], check["activities_to_keep"]) == (4, 2)
    assert check["message"] == (
        "4 activities linked only to Priya Shah will be deleted. "
        "2 activities also linked to a deal will stay on the deal's timeline."
    )


def test_deleting_a_contact(client, make: Make):
    priya, deal, only, shared = _contact_with_activities(make)
    assert client.delete(f"/api/contacts/{priya['id']}").status_code == 204
    for activity in only:
        assert client.get(f"/api/activities/{activity['id']}").status_code == 404
    for activity in shared:
        kept = make.get(f"/api/activities/{activity['id']}")
        assert kept["contact"] is None
        assert kept["deal"]["id"] == deal["id"]
    timeline = make.get(f"/api/deals/{deal['id']}/timeline")
    assert {i["id"] for i in timeline if i["kind"] == "activity"} == {a["id"] for a in shared}


def _deal_with_activities(make: Make):
    contact = make.contact()
    deal = make.deal(contact, stage="new")
    make.move(deal, "qualified")
    only = [make.activity(deal=deal) for _ in range(3)]
    shared = [make.activity(contact, deal)]
    return contact, deal, only, shared


def test_deal_delete_check_counts_the_same_way(make: Make):
    _contact, deal, _only, _shared = _deal_with_activities(make)
    check = make.get(f"/api/deals/{deal['id']}/delete-check")
    assert check == {
        "can_delete": True,
        "message": "3 activities linked only to this deal will be deleted. "
        "1 activity also linked to a contact will stay on the contact's timeline. "
        "The deal's stage history will be deleted too.",
        "activities_to_delete": 3,
        "activities_to_keep": 1,
        "stage_changes": 1,
    }


def test_deleting_a_deal(client, make: Make):
    contact, deal, only, shared = _deal_with_activities(make)
    assert client.delete(f"/api/deals/{deal['id']}").status_code == 204
    for activity in only:
        assert client.get(f"/api/activities/{activity['id']}").status_code == 404
    kept = make.get(f"/api/activities/{shared[0]['id']}")
    assert kept["deal"] is None and kept["contact"]["id"] == contact["id"]
    assert count(client, stage_changes, stage_changes.c.deal_id == deal["id"]) == 0
    assert [i["id"] for i in make.get(f"/api/contacts/{contact['id']}/timeline")] == [shared[0]["id"]]


def test_deleting_an_activity(client, make: Make):
    activity = make.activity(make.contact())
    assert client.delete(f"/api/activities/{activity['id']}").status_code == 204
    assert client.get(f"/api/activities/{activity['id']}").status_code == 404


def test_no_delete_ever_leaves_an_activity_with_no_link(client, make: Make):
    priya, deal, _only, _shared = _contact_with_activities(make)
    contact, other_deal, _o, _s = _deal_with_activities(make)
    client.delete(f"/api/contacts/{priya['id']}")
    client.delete(f"/api/deals/{other_deal['id']}")
    # Deleting the deal the kept activities now hang on removes them too.
    client.delete(f"/api/deals/{deal['id']}")
    unlinked = count(client, activities, activities.c.contact_id.is_(None), activities.c.deal_id.is_(None))
    assert unlinked == 0
    assert count(client, activities) == 1  # the one still linked to `contact`
