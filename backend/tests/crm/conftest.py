"""Helpers that add CRM records through the API, with unique names."""

import itertools

import pytest
from fastapi.testclient import TestClient

_numbers = itertools.count(1)


def _n() -> int:
    return next(_numbers)


class Make:
    def __init__(self, client: TestClient):
        self.client = client

    def _post(self, path: str, body: dict) -> dict:
        response = self.client.post(path, json=body)
        assert response.status_code == 201, response.text
        return response.json()

    def org(self, name: str | None = None, **fields) -> dict:
        return self._post("/api/organizations", {"name": name or f"Org {_n()}", **fields})

    def contact(self, org: dict | None = None, name: str | None = None, **fields) -> dict:
        org = org or self.org()
        body = {"name": name or f"Person {_n()}", "organization_id": org["id"], **fields}
        return self._post("/api/contacts", body)

    def deal(
        self,
        contact: dict | None = None,
        stage: str = "new",
        value: int = 100_000,
        close_date: str = "2026-12-31",
        name: str | None = None,
        **fields,
    ) -> dict:
        contact = contact or self.contact()
        body = {
            "name": name or f"Deal {_n()}",
            "organization_id": contact["organization"]["id"],
            "main_contact_id": contact["id"],
            "stage": stage,
            "value": value,
            "close_date": close_date,
            **fields,
        }
        return self._post("/api/deals", body)

    def activity(
        self,
        contact: dict | None = None,
        deal: dict | None = None,
        type: str = "call",
        description: str | None = None,
        occurred_at: str = "2026-11-16T09:00:00",
        **fields,
    ) -> dict:
        body = {
            "type": type,
            "description": description or f"Activity {_n()}",
            "occurred_at": occurred_at,
            "contact_id": contact["id"] if contact else None,
            "deal_id": deal["id"] if deal else None,
            **fields,
        }
        return self._post("/api/activities", body)

    def move(self, deal: dict, stage: str, before_id: int | None = None, close_date: str | None = None):
        body = {"stage": stage, "before_id": before_id, "close_date": close_date}
        return self.client.post(f"/api/deals/{deal['id']}/move", json=body)

    def edit_deal(self, deal: dict, **changes):
        body = {
            "name": deal["name"],
            "organization_id": deal["organization"]["id"],
            "main_contact_id": deal["main_contact"]["id"],
            "stage": deal["stage"],
            "value": deal["value"],
            "probability": deal["probability"],
            "close_date": deal["close_date"],
            **changes,
        }
        return self.client.put(f"/api/deals/{deal['id']}", json=body)

    def get(self, path: str) -> dict:
        response = self.client.get(path)
        assert response.status_code == 200, response.text
        return response.json()

    def column(self, stage: str) -> list[str]:
        """Deal names in a board column, top first."""
        return [d["name"] for d in self.get("/api/deals") if d["stage"] == stage]


@pytest.fixture
def make(client: TestClient) -> Make:
    return Make(client)
