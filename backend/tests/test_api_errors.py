"""The error shapes, through the CRM's routes."""

import pytest

from backend.tests.crm.conftest import Make


@pytest.fixture
def make(client) -> Make:
    return Make(client)


def test_a_malformed_request_gives_422_in_plain_words(client, make: Make):
    contact = make.contact()
    response = client.post(
        "/api/deals",
        json={
            "name": "Malformed",
            "organization_id": contact["organization"]["id"],
            "main_contact_id": contact["id"],
            "stage": "new",
            "value": "lots",
            "close_date": "next week",
        },
    )
    assert response.status_code == 422
    assert response.json() == {
        "message": "Check the highlighted fields.",
        "errors": {
            "value": "Enter a value of $0 or more, in whole dollars.",
            "close_date": "Enter a date.",
        },
    }

    response = client.post(
        "/api/contacts", content="{not json", headers={"content-type": "application/json"}
    )
    assert response.status_code == 422
    assert response.json()["message"] == "Check the highlighted fields."
    assert all(
        "Value error" not in m and "Input should" not in m
        for m in response.json()["errors"].values()
    )

    response = client.post("/api/contacts", json={"name": "Ann", "organization_id": "first"})
    assert response.json()["errors"] == {"organization_id": "Enter a whole number."}


def test_refusals_give_409_with_a_message_and_details(client, make: Make):
    org = make.org("Refusing Org")
    make.contact(org)
    response = client.delete(f"/api/organizations/{org['id']}")
    assert response.status_code == 409
    body = response.json()
    assert set(body) == {"message", "details"}
    assert body["message"].startswith("Refusing Org can't be deleted")
    assert body["details"] == {"contacts": 1, "deals": 0}


def test_a_missing_record_gives_404_with_a_message(client):
    for method, path in [
        ("get", "/api/deals/4040"),
        ("put", "/api/organizations/4040"),
        ("delete", "/api/contacts/4040"),
        ("patch", "/api/activities/4040"),
        ("post", "/api/deals/4040/move"),
        ("get", "/api/deals/4040/timeline"),
        ("get", "/api/contacts/4040/delete-check"),
    ]:
        body = {"done": True} if method == "patch" else {"name": "x", "stage": "new"}
        kwargs = {} if method in ("get", "delete") else {"json": body}
        response = getattr(client, method)(path, **kwargs)
        assert response.status_code == 404, (method, path, response.text)
        assert set(response.json()) == {"message"}
        assert response.json()["message"].endswith("no longer exists.")


def test_a_body_over_the_length_limits_is_refused(client):
    response = client.post("/api/organizations", json={"name": "N" * 201, "notes": "x" * 5001})
    assert response.status_code == 422
    assert response.json()["errors"] == {
        "name": "Use 200 characters or fewer.",
        "notes": "Use 5000 characters or fewer.",
    }
