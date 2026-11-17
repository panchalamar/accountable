from backend.tests.crm.conftest import Make


def positions(make: Make, stage: str) -> list[int]:
    return [d["position"] for d in make.get("/api/deals") if d["stage"] == stage]


def test_a_new_deal_goes_to_the_top_of_its_column(make: Make):
    contact = make.contact()
    make.deal(contact, stage="qualified", name="Older")
    make.deal(contact, stage="qualified", name="Newer")
    assert make.column("qualified")[:2] == ["Newer", "Older"]


def test_a_move_with_before_id_lands_just_above_that_card(make: Make):
    contact = make.contact()
    c = make.deal(contact, stage="proposal", name="C")
    b = make.deal(contact, stage="proposal", name="B")
    make.deal(contact, stage="proposal", name="A")
    mover = make.deal(contact, stage="new", name="Mover")
    assert make.move(mover, "proposal", before_id=b["id"]).status_code == 200
    assert make.column("proposal") == ["A", "Mover", "B", "C"]
    # Within its own column, higher up.
    assert make.move(c, "proposal", before_id=b["id"]).status_code == 200
    assert make.column("proposal") == ["A", "Mover", "C", "B"]


def test_a_move_with_no_before_id_lands_at_the_bottom(make: Make):
    contact = make.contact()
    make.deal(contact, stage="negotiation", name="Second")
    make.deal(contact, stage="negotiation", name="First")
    mover = make.deal(contact, stage="proposal", name="Mover")
    make.move(mover, "negotiation")
    assert make.column("negotiation") == ["First", "Second", "Mover"]


def test_a_stage_change_in_the_edit_form_goes_to_the_top(make: Make):
    contact = make.contact()
    make.deal(contact, stage="qualified", name="Q1")
    make.deal(contact, stage="qualified", name="Q2")
    mover = make.deal(contact, stage="new", name="Edited")
    assert make.edit_deal(mover, stage="qualified").status_code == 200
    assert make.column("qualified") == ["Edited", "Q2", "Q1"]


def test_positions_are_renumbered_from_0_with_no_gaps(client, make: Make):
    contact = make.contact()
    deals = [make.deal(contact, stage="new", name=f"N{i}") for i in range(4)]
    assert positions(make, "new") == [0, 1, 2, 3]
    make.move(deals[1], "qualified")
    assert positions(make, "new") == [0, 1, 2]
    assert client.delete(f"/api/deals/{deals[3]['id']}").status_code == 204
    assert positions(make, "new") == [0, 1]
    make.move(deals[0], "new", before_id=deals[2]["id"])
    assert positions(make, "new") == [0, 1]
    assert make.column("new") == ["N0", "N2"]


def test_a_before_id_from_a_different_column_is_refused(make: Make):
    contact = make.contact()
    other = make.deal(contact, stage="qualified")
    mover = make.deal(contact, stage="new")
    response = make.move(mover, "proposal", before_id=other["id"])
    assert response.status_code == 409
    assert "no longer in the Proposal column" in response.json()["message"]
    assert make.get(f"/api/deals/{mover['id']}")["stage"] == "new"
