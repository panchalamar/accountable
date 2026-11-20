from backend.tests.crm.conftest import Make


def test_an_activity_on_a_contact_can_link_a_deal_at_their_organization(make: Make):
    contact = make.contact()
    deal = make.deal(make.contact(make.get(f"/api/organizations/{contact['organization']['id']}")))
    activity = make.activity(contact, deal)
    assert activity["contact"]["id"] == contact["id"]
    assert activity["deal"]["id"] == deal["id"]


def test_a_deal_at_another_organization_is_refused(client, make: Make):
    contact = make.contact(make.org("Home Org"))
    deal = make.deal(make.contact(make.org("Away Org")))
    response = client.post(
        "/api/activities",
        json={
            "type": "call",
            "description": "Mismatch",
            "occurred_at": "2026-11-16T09:00",
            "contact_id": contact["id"],
            "deal_id": deal["id"],
        },
    )
    assert response.status_code == 422
    assert response.json()["errors"]["deal_id"] == "Choose a deal at Home Org."


def test_the_same_holds_for_an_activity_logged_on_a_deal(client, make: Make):
    deal = make.deal(make.contact(make.org("Deal Org")))
    stranger = make.contact(make.org("Stranger Org"))
    response = client.post(
        "/api/activities",
        json={
            "type": "email",
            "description": "Mismatch",
            "occurred_at": "2026-11-16T09:00",
            "deal_id": deal["id"],
            "contact_id": stranger["id"],
        },
    )
    assert response.status_code == 422
    assert response.json()["errors"]["contact_id"] == "Choose a contact at Deal Org."

    colleague = make.contact(make.get(f"/api/organizations/{deal['organization']['id']}"))
    assert make.activity(colleague, deal)["contact"]["id"] == colleague["id"]


def test_an_activity_must_keep_at_least_one_link(client, make: Make):
    contact = make.contact()
    response = client.post(
        "/api/activities",
        json={"type": "note", "description": "Loose", "occurred_at": "2026-11-16T09:00"},
    )
    assert response.status_code == 422
    assert response.json()["errors"] == {"link": "Link the activity to a contact or a deal."}

    activity = make.activity(contact)
    response = client.put(
        f"/api/activities/{activity['id']}",
        json={"type": "note", "description": "Loose", "occurred_at": "2026-11-16T09:00"},
    )
    assert response.status_code == 422


def test_editing_keeps_links_after_the_contact_moves_organization(client, make: Make):
    org = make.org()
    lead = make.contact(org)
    helper = make.contact(org)
    deal = make.deal(lead)
    activity = make.activity(helper, deal, description="Before the move")
    client.put(
        f"/api/contacts/{helper['id']}",
        json={"name": helper["name"], "organization_id": make.org()["id"]},
    )
    response = client.put(
        f"/api/activities/{activity['id']}",
        json={
            "type": "call",
            "description": "Edited after the move",
            "occurred_at": "2026-11-16T09:00",
            "contact_id": helper["id"],
            "deal_id": deal["id"],
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["description"] == "Edited after the move"
    assert (response.json()["contact"]["id"], response.json()["deal"]["id"]) == (
        helper["id"],
        deal["id"],
    )


def test_patch_sets_done_and_unsets_it(client, make: Make):
    activity = make.activity(make.contact(), follow_up_date="2026-11-18")
    assert activity["done"] is False
    response = client.patch(f"/api/activities/{activity['id']}", json={"done": True})
    assert response.status_code == 200 and response.json()["done"] is True
    response = client.patch(f"/api/activities/{activity['id']}", json={"done": False})
    assert response.json()["done"] is False
    assert response.json()["follow_up_date"] == "2026-11-18"


def test_an_activity_can_be_dated_in_the_future(make: Make):
    activity = make.activity(make.contact(), occurred_at="2027-01-10T15:00:00")
    assert activity["occurred_at"] == "2027-01-10T15:00:00"
