import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import { toISODate, today } from "../../lib/dates";
import { mockApi, renderWithProviders } from "../../test/render";
import type { Deal } from "../api";
import { DealForm } from "./DealForm";

const organizations = [
  { id: 1, name: "Acme Ltd", website: null, industry: null, contact_count: 2, open_deal_count: 1 },
  { id: 2, name: "Beta Inc", website: null, industry: null, contact_count: 1, open_deal_count: 0 },
];
const contacts = [
  {
    id: 10,
    name: "Ann Acme",
    organization: { id: 1, name: "Acme Ltd" },
    job_title: null,
    email: null,
    phone: null,
    status: "lead",
  },
  {
    id: 11,
    name: "Al Acme",
    organization: { id: 1, name: "Acme Ltd" },
    job_title: null,
    email: null,
    phone: null,
    status: "lead",
  },
  {
    id: 20,
    name: "Bea Beta",
    organization: { id: 2, name: "Beta Inc" },
    job_title: null,
    email: null,
    phone: null,
    status: "lead",
  },
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
    expect(
      within(contact)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Choose a main contact", "Ann Acme", "Al Acme"]);
    await user.selectOptions(screen.getByLabelText("Organization"), "2");
    expect(contact).toHaveValue("");
    expect(
      within(contact)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Choose a main contact", "Bea Beta"]);
  });

  it("adds a deal, and says it was added", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const saved = dealAt("new", 10);
    const calls = mockApi({
      "GET /organizations": organizations,
      "GET /contacts": contacts,
      "POST /deals": saved,
    });
    renderWithProviders(<DealForm open onOpenChange={() => {}} onSaved={onSaved} />);
    const contact = await screen.findByLabelText("Main contact");
    expect(contact).toBeDisabled();
    expect(screen.getByText("Choose an organization first.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), "Big deal");
    await user.selectOptions(screen.getByLabelText("Organization"), "1");
    await user.selectOptions(contact, "Al Acme");
    await user.type(screen.getByLabelText("Value ($)"), "250,000");
    await user.type(screen.getByLabelText("Close date"), "2027-02-01");
    await user.click(screen.getByRole("button", { name: "Add deal" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(calls).toContainEqual({
      method: "POST",
      path: "/deals",
      body: {
        name: "Big deal",
        organization_id: 1,
        main_contact_id: 11,
        stage: "new",
        value: 250000,
        probability: 10,
        close_date: "2027-02-01",
      },
    });
  });

  it("checks the fields before sending anything", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ "GET /organizations": organizations, "GET /contacts": contacts });
    renderWithProviders(<DealForm open onOpenChange={() => {}} />);
    await user.type(await screen.findByLabelText("Value ($)"), "lots");
    await user.click(screen.getByRole("button", { name: "Add deal" }));
    expect(await screen.findByText("Enter a name.")).toBeInTheDocument();
    expect(screen.getByText("Choose an organization.")).toBeInTheDocument();
    expect(screen.getByText("Enter a value of $0 or more, in whole dollars.")).toBeInTheDocument();
    expect(screen.getByText("Enter a close date.")).toBeInTheDocument();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("starts a deal added in the Won column closed today", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /organizations": organizations, "GET /contacts": contacts });
    renderWithProviders(<DealForm open onOpenChange={() => {}} stage="won" organizationId={2} />);
    expect(await screen.findByLabelText("Close date")).toHaveValue(toISODate(today()));
    expect(screen.getByLabelText("Organization")).toHaveValue("2");
    expect(screen.getByLabelText("Probability (%)")).toHaveValue("100");
    // Back to an open stage, the date is for the user to choose again.
    await user.selectOptions(screen.getByLabelText("Stage"), "qualified");
    expect(screen.getByLabelText("Close date")).toHaveValue("");
    expect(screen.getByLabelText("Close date")).not.toHaveAttribute("readonly");
  });

  it("offers to add a contact when the organization has none", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    mockApi({
      "GET /organizations": [
        ...organizations,
        {
          id: 3,
          name: "Gamma",
          website: null,
          industry: null,
          contact_count: 0,
          open_deal_count: 0,
        },
      ],
      "GET /contacts": contacts,
    });
    renderWithProviders(<DealForm open onOpenChange={onOpenChange} />);
    await user.selectOptions(await screen.findByLabelText("Organization"), "Gamma");
    expect(screen.getByLabelText("Main contact")).toBeDisabled();
    const link = screen.getByRole("link", { name: "Add a contact at Gamma" });
    expect(link).toHaveAttribute("href", "/organizations/3");
    await user.click(link);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("saves a stage change, and shows a refused move above the form", async () => {
    const user = userEvent.setup();
    let refuse = true;
    const calls = mockApi({
      "GET /organizations": organizations,
      "GET /contacts": contacts,
      "PUT /deals/7": () =>
        refuse
          ? { status: 409, body: { message: "That move isn't allowed." } }
          : dealAt("proposal", 50),
    });
    const onSaved = vi.fn();
    renderWithProviders(
      <DealForm open onOpenChange={() => {}} deal={dealAt("new", 15)} onSaved={onSaved} />,
    );
    await user.selectOptions(await screen.findByLabelText("Stage"), "proposal");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That move isn't allowed.");
    refuse = false;
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls).toContainEqual({
      method: "PUT",
      path: "/deals/7",
      body: expect.objectContaining({ stage: "proposal", probability: 50 }),
    });
  });

  it("saves an edit that leaves the stage alone", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    mockApi({
      "GET /organizations": organizations,
      "GET /contacts": contacts,
      "PUT /deals/7": dealAt("new", 15),
    });
    renderWithProviders(
      <DealForm open onOpenChange={() => {}} deal={dealAt("new", 15)} onSaved={onSaved} />,
    );
    await user.click(await screen.findByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
