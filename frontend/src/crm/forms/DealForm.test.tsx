import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";

import { toISODate, today } from "../../lib/dates";
import { mockApi, renderWithProviders } from "../../test/render";
import type { Deal } from "../api";
import { DealForm } from "./DealForm";

const organizations = [
  { id: 1, name: "Acme Ltd", website: null, industry: null, contact_count: 2, open_deal_count: 1 },
  { id: 2, name: "Beta Inc", website: null, industry: null, contact_count: 1, open_deal_count: 0 },
];
const contacts = [
  { id: 10, name: "Ann Acme", organization: { id: 1, name: "Acme Ltd" }, job_title: null, email: null, phone: null, status: "lead" },
  { id: 11, name: "Al Acme", organization: { id: 1, name: "Acme Ltd" }, job_title: null, email: null, phone: null, status: "lead" },
  { id: 20, name: "Bea Beta", organization: { id: 2, name: "Beta Inc" }, job_title: null, email: null, phone: null, status: "lead" },
];

function dealAt(stage: Deal["stage"], probability: number): Deal {
  return {
    id: 7,
    name: "Big deal",
    organization: { id: 1, name: "Acme Ltd" },
    main_contact: { id: 10, name: "Ann Acme" },
    stage,
    value: 500000,
    probability,
    close_date: "2027-03-01",
    furthest_stage: stage,
    position: 0,
    created_at: "2026-10-01T09:00:00",
    updated_at: "2026-10-01T09:00:00",
  };
}

function editing(deal: Deal) {
  mockApi({ "GET /organizations": organizations, "GET /contacts": contacts });
  renderWithProviders(<DealForm open onOpenChange={() => {}} deal={deal} />);
}

describe("DealForm", () => {
  it('shows "Probability will be set to 50%" when another stage is chosen', async () => {
    const user = userEvent.setup();
    editing(dealAt("new", 15));
    const stage = await screen.findByLabelText("Stage");
    await user.selectOptions(stage, "proposal");
    expect(screen.getByText("Probability will be set to 50%")).toBeInTheDocument();
    expect(screen.getByLabelText("Probability (%)")).toHaveValue("50");
    expect(screen.getByLabelText("Probability (%)")).toHaveAttribute("readonly");
    await user.selectOptions(stage, "won");
    expect(screen.getByText("Probability will be set to 100%")).toBeInTheDocument();
    // Back to where it started: its own probability, editable again.
    await user.selectOptions(stage, "new");
    expect(screen.queryByText(/Probability will be set/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Probability (%)")).toHaveValue("15");
  });

  it("locks the close date to today for Won and Lost", async () => {
    const user = userEvent.setup();
    editing(dealAt("negotiation", 75));
    await user.selectOptions(await screen.findByLabelText("Stage"), "lost");
    const close = screen.getByLabelText("Close date");
    expect(close).toHaveValue(toISODate(today()));
    expect(close).toHaveAttribute("readonly");
    expect(screen.getByText(/The close date will be set to today\./)).toBeInTheDocument();
  });

  it('asks for a "New expected close date" when reopening, 30 days from today', async () => {
    const user = userEvent.setup();
    editing(dealAt("won", 100));
    await user.selectOptions(await screen.findByLabelText("Stage"), "proposal");
    const close = screen.getByLabelText("New expected close date");
    expect(close).toHaveValue(toISODate(addDays(today(), 30)));
    expect(close).not.toHaveAttribute("readonly");
  });

  it("clears the main contact when the organization changes, and lists only its contacts", async () => {
    const user = userEvent.setup();
    editing(dealAt("new", 10));
    const contact = await screen.findByLabelText("Main contact");
    await screen.findByRole("option", { name: "Ann Acme" });
    expect(contact).toHaveValue("10");
    expect(within(contact).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Choose a main contact",
      "Ann Acme",
      "Al Acme",
    ]);
    await user.selectOptions(screen.getByLabelText("Organization"), "2");
    expect(contact).toHaveValue("");
    expect(within(contact).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Choose a main contact",
      "Bea Beta",
    ]);
  });
});
