from backend.tests.crm.conftest import Make


def test_organizations_list_with_contact_and_open_deal_counts(make: Make):
    org = make.org("Counted Ltd")
    ann = make.contact(org)
    make.contact(org)
    make.deal(ann, stage="proposal")
    make.deal(ann, stage="won")
    make.deal(ann, stage="lost")
    rows = {o["name"]: o for o in make.get("/api/organizations")}
    assert rows["Counted Ltd"]["contact_count"] == 2
    assert rows["Counted Ltd"]["open_deal_count"] == 1


def test_organization_page_lists_its_contacts_and_deals(make: Make):
    org = make.org(
        "Paged Ltd", website="https://paged.example.com", industry="Energy", notes="Big account"
    )
    ann = make.contact(org, name="Ann Page", job_title="Buyer", status="customer")
    make.contact(org, name="Bob Page")
    deal = make.deal(ann, name="Paged deal")
    page = make.get(f"/api/organizations/{org['id']}")
    assert page["website"] == "https://paged.example.com"
    assert page["industry"] == "Energy"
    assert page["notes"] == "Big account"
    assert [c["name"] for c in page["contacts"]] == ["Ann Page", "Bob Page"]
    assert page["contacts"][0]["job_title"] == "Buyer"
    assert page["contacts"][0]["status"] == "customer"
    assert [d["id"] for d in page["deals"]] == [deal["id"]]
    assert page["deals"][0]["main_contact"] == {"id": ann["id"], "name": "Ann Page"}


def test_contacts_list_with_their_organization_name(make: Make):
    org = make.org("Named Org")
    make.contact(org, name="Zed Named")
    rows = [c for c in make.get("/api/contacts") if c["name"] == "Zed Named"]
    assert rows[0]["organization"] == {"id": org["id"], "name": "Named Org"}


def test_deals_list_in_board_order_with_names(make: Make):
    contact = make.contact(name="Lister")
    first = make.deal(contact, stage="qualified", name="Q first added")
    second = make.deal(contact, stage="qualified", name="Q second added")
    new = make.deal(contact, stage="new", name="N one")
    rows = make.get("/api/deals")
    ids = [d["id"] for d in rows]
    # New comes before Qualified, and the newest Qualified deal is on top.
    assert ids.index(new["id"]) < ids.index(second["id"]) < ids.index(first["id"])
    row = rows[ids.index(new["id"])]
    assert row["organization"]["id"] == contact["organization"]["id"]
    assert row["main_contact"] == {"id": contact["id"], "name": "Lister"}


def test_editing_each_kind_of_record_saves_every_field(client, make: Make):
    org = make.org()
    response = client.put(
        f"/api/organizations/{org['id']}",
        json={
            "name": "Edited Org",
            "website": "edited.example.com",
            "industry": "Healthcare",
            "notes": "N",
        },
    )
    assert response.status_code == 200
    assert {k: response.json()[k] for k in ("name", "website", "industry", "notes")} == {
        "name": "Edited Org",
        "website": "edited.example.com",
        "industry": "Healthcare",
        "notes": "N",
    }

    contact = make.contact(org)
    body = {
        "name": "Edited Person",
        "organization_id": org["id"],
        "email": "edited@org.example.com",
        "phone": "+1 555 0100",
        "job_title": "CFO",
        "status": "qualified",
    }
    saved = client.put(f"/api/contacts/{contact['id']}", json=body).json()
    assert {k: saved[k] for k in ("name", "email", "phone", "job_title", "status")} == {
        k: body[k] for k in ("name", "email", "phone", "job_title", "status")
    }

    other = make.contact(org)
    deal = make.deal(contact)
    saved = client.put(
        f"/api/deals/{deal['id']}",
        json={
            "name": "Edited deal",
            "organization_id": org["id"],
            "main_contact_id": other["id"],
            "stage": "new",
            "value": 123456,
            "probability": 33,
            "close_date": "2027-03-04",
        },
    ).json()
    assert saved["name"] == "Edited deal"
    assert saved["main_contact"]["id"] == other["id"]
    assert (saved["value"], saved["probability"], saved["close_date"]) == (123456, 33, "2027-03-04")

    activity = make.activity(contact, deal)
    saved = client.put(
        f"/api/activities/{activity['id']}",
        json={
            "type": "email",
            "description": "Edited activity",
            "occurred_at": "2026-11-10T08:30:00",
            "follow_up_date": "2026-11-20",
            "done": True,
            "contact_id": contact["id"],
            "deal_id": deal["id"],
        },
    ).json()
    assert (saved["type"], saved["description"], saved["occurred_at"]) == (
        "email",
        "Edited activity",
        "2026-11-10T08:30:00",
    )
    assert (saved["follow_up_date"], saved["done"]) == ("2026-11-20", True)


def test_a_missing_record_gives_404_with_a_message(client):
    for path, kind in [
        ("/api/organizations/9999", "organization"),
        ("/api/contacts/9999", "contact"),
        ("/api/deals/9999", "deal"),
        ("/api/activities/9999", "activity"),
    ]:
        response = client.get(path)
        assert response.status_code == 404
        assert response.json() == {"message": f"That {kind} no longer exists."}


def test_moving_a_main_contact_to_another_organization_is_refused(client, make: Make):
    priya = make.contact(name="Priya Move")
    deal_a = make.deal(priya, name="Steel A")
    deal_b = make.deal(priya, name="Steel B")
    elsewhere = make.org()
    response = client.put(
        f"/api/contacts/{priya['id']}",
        json={"name": "Priya Move", "organization_id": elsewhere["id"]},
    )
    assert response.status_code == 409
    body = response.json()
    assert body["details"]["deals"] == [
        {"id": deal_a["id"], "name": "Steel A"},
        {"id": deal_b["id"], "name": "Steel B"},
    ]
    assert "Steel A and Steel B" in body["message"]
    assert "different main contact" in body["message"]


def test_moving_a_contact_who_isnt_a_main_contact_keeps_activity_links(client, make: Make):
    org = make.org()
    lead = make.contact(org)
    helper = make.contact(org, name="Helper")
    deal = make.deal(lead)
    activity = make.activity(helper, deal)
    elsewhere = make.org()
    response = client.put(
        f"/api/contacts/{helper['id']}", json={"name": "Helper", "organization_id": elsewhere["id"]}
    )
    assert response.status_code == 200
    assert response.json()["organization"]["id"] == elsewhere["id"]
    kept = make.get(f"/api/activities/{activity['id']}")
    assert kept["contact"]["id"] == helper["id"]
    assert kept["deal"]["id"] == deal["id"]


def test_changing_a_deals_organization_needs_a_main_contact_there(make: Make):
    deal = make.deal()
    other = make.org("Other Org")
    response = make.edit_deal(deal, organization_id=other["id"])
    assert response.status_code == 422
    assert response.json()["errors"] == {"main_contact_id": "Choose a main contact at Other Org."}

    there = make.contact(other)
    response = make.edit_deal(deal, organization_id=other["id"], main_contact_id=there["id"])
    assert response.status_code == 200
    assert response.json()["organization"]["id"] == other["id"]
