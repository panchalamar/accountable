import pytest

from backend.tests.crm.conftest import Make


def errors(response) -> dict:
    assert response.status_code == 422, response.text
    return response.json()["errors"]


@pytest.mark.parametrize("name", ["", "   ", None])
def test_organization_needs_a_name(client, name):
    response = client.post("/api/organizations", json={"name": name})
    assert errors(response) == {"name": "Enter a name."}


def test_duplicate_organization_name_ignores_case_and_spaces(client, make: Make):
    make.org("Acme Ltd")
    response = client.post("/api/organizations", json={"name": " acme ltd "})
    assert errors(response) == {"name": "An organization called Acme Ltd already exists."}


def test_saving_an_organization_unchanged_keeps_its_own_name(client, make: Make):
    org = make.org("Acme Ltd", industry="Logistics")
    response = client.put(
        f"/api/organizations/{org['id']}", json={"name": "Acme Ltd", "industry": "Logistics"}
    )
    assert response.status_code == 200
    # Changing only the case of its own name is allowed too.
    response = client.put(f"/api/organizations/{org['id']}", json={"name": "ACME LTD"})
    assert response.status_code == 200
    assert response.json()["name"] == "ACME LTD"


LIMITS = [
    ("organization", "name", 200),
    ("organization", "website", 200),
    ("organization", "industry", 100),
    ("organization", "notes", 5000),
    ("contact", "name", 200),
    ("contact", "job_title", 100),
    ("contact", "phone", 50),
    ("deal", "name", 200),
    ("activity", "description", 5000),
]


@pytest.mark.parametrize("kind,field,limit", LIMITS)
def test_length_limits(client, make: Make, kind, field, limit):
    contact = make.contact()
    deal = make.deal(contact)
    base = {
        "organization": ("/api/organizations", {"name": "Limit test org"}),
        "contact": (
            "/api/contacts",
            {"name": "Limit test", "organization_id": contact["organization"]["id"]},
        ),
        "deal": (
            "/api/deals",
            {
                "name": "Limit test deal",
                "organization_id": contact["organization"]["id"],
                "main_contact_id": contact["id"],
                "stage": "new",
                "value": 1,
                "close_date": "2026-12-01",
            },
        ),
        "activity": (
            "/api/activities",
            {
                "type": "note",
                "description": "x",
                "occurred_at": "2026-11-16T10:00",
                "deal_id": deal["id"],
            },
        ),
    }
    path, body = base[kind]

    too_long = client.post(path, json={**body, field: "x" * (limit + 1)})
    assert errors(too_long) == {field: f"Use {limit} characters or fewer."}

    just_right = client.post(path, json={**body, field: "y" * limit})
    assert just_right.status_code == 201, just_right.text


def test_contact_needs_an_organization_that_exists(client):
    response = client.post("/api/contacts", json={"name": "Ann", "organization_id": 9999})
    assert errors(response) == {"organization_id": "Choose an organization."}
    response = client.post("/api/contacts", json={"name": "Ann"})
    assert errors(response) == {"organization_id": "Choose an organization."}


@pytest.mark.parametrize("email", ["ann", "ann@", "ann@acme", "@acme.com", "ann smith@acme.com"])
def test_badly_formed_email_is_refused(client, make: Make, email):
    org = make.org()
    response = client.post(
        "/api/contacts", json={"name": "Ann", "organization_id": org["id"], "email": email}
    )
    assert errors(response) == {"email": "Enter a valid email address, like name@company.com."}


def test_used_email_in_different_case_is_refused(client, make: Make):
    make.contact(email="ann@acme.example.com")
    org = make.org()
    response = client.post(
        "/api/contacts",
        json={"name": "Ann 2", "organization_id": org["id"], "email": " ANN@Acme.Example.com "},
    )
    assert errors(response) == {"email": "Another contact already uses this email."}


def test_emails_are_stored_trimmed_and_lower_case_and_many_can_be_blank(client, make: Make):
    contact = make.contact(email="  Ben.Adler@Summit.Example.com ")
    assert contact["email"] == "ben.adler@summit.example.com"
    # A contact keeps its own email when saved again.
    response = client.put(
        f"/api/contacts/{contact['id']}",
        json={
            "name": contact["name"],
            "organization_id": contact["organization"]["id"],
            "email": contact["email"],
        },
    )
    assert response.status_code == 200
    no_email = [make.contact(), make.contact(email=""), make.contact(email="   ")]
    assert [c["email"] for c in no_email] == [None, None, None]


@pytest.mark.parametrize("value", [-1, 1.5, "abc", "", None])
def test_deal_value_must_be_whole_dollars_of_zero_or_more(client, make: Make, value):
    contact = make.contact()
    response = client.post(
        "/api/deals",
        json={
            "name": "Bad value",
            "organization_id": contact["organization"]["id"],
            "main_contact_id": contact["id"],
            "stage": "new",
            "value": value,
            "close_date": "2026-12-01",
        },
    )
    assert errors(response) == {"value": "Enter a value of $0 or more, in whole dollars."}


def test_deal_value_of_zero_and_whole_numbers_as_decimals_are_allowed(make: Make):
    assert make.deal(value=0)["value"] == 0
    assert make.deal(value=250000.0)["value"] == 250000


@pytest.mark.parametrize("probability", [-1, 101, 50.5])
def test_probability_outside_0_to_100_is_refused(client, make: Make, probability):
    contact = make.contact()
    response = client.post(
        "/api/deals",
        json={
            "name": "Bad probability",
            "organization_id": contact["organization"]["id"],
            "main_contact_id": contact["id"],
            "stage": "new",
            "value": 1000,
            "probability": probability,
            "close_date": "2026-12-01",
        },
    )
    assert errors(response) == {"probability": "Enter a probability from 0 to 100."}


def test_main_contact_must_be_at_the_deals_organization(client, make: Make):
    acme = make.org("Acme Ltd")
    elsewhere = make.contact()
    response = client.post(
        "/api/deals",
        json={
            "name": "Mismatch",
            "organization_id": acme["id"],
            "main_contact_id": elsewhere["id"],
            "stage": "new",
            "value": 1000,
            "close_date": "2026-12-01",
        },
    )
    assert errors(response) == {"main_contact_id": "Choose a main contact at Acme Ltd."}


def test_deal_needs_a_close_date_and_a_known_stage(client, make: Make):
    contact = make.contact()
    body = {
        "name": "Missing bits",
        "organization_id": contact["organization"]["id"],
        "main_contact_id": contact["id"],
        "value": 1000,
    }
    response = client.post("/api/deals", json={**body, "stage": "new"})
    assert errors(response) == {"close_date": "Enter a close date."}
    response = client.post(
        "/api/deals", json={**body, "stage": "maybe", "close_date": "2026-12-01"}
    )
    assert errors(response) == {"stage": "Choose a stage."}


def test_activity_needs_a_type_a_description_and_when_it_happened(client, make: Make):
    contact = make.contact()
    response = client.post(
        "/api/activities", json={"contact_id": contact["id"], "description": "  "}
    )
    assert errors(response) == {
        "type": "Choose a type.",
        "description": "Enter a description.",
        "occurred_at": "Enter when it happened.",
    }
    response = client.post(
        "/api/activities",
        json={
            "contact_id": contact["id"],
            "type": "meeting",
            "description": "x",
            "occurred_at": "2026-11-16T10:00",
        },
    )
    assert errors(response) == {"type": "Choose a type."}
