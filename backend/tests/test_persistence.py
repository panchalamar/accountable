from fastapi.testclient import TestClient

from backend.main import create_app


def test_a_change_is_there_when_a_new_instance_opens_the_same_file(db_url):
    with TestClient(create_app(db_url)) as first:
        org = first.post("/api/organizations", json={"name": "Kept Ltd"}).json()
        first.put(f"/api/organizations/{org['id']}", json={"name": "Kept Ltd", "industry": "Logistics"})

    with TestClient(create_app(db_url)) as second:
        response = second.get(f"/api/organizations/{org['id']}")
        assert response.status_code == 200
        assert response.json()["industry"] == "Logistics"
