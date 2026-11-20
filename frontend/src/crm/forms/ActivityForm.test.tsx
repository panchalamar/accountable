import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "../../test/render";
import type { Activity, ContactRow, Deal } from "../api";
import { ActivityForm, type LoggedOn } from "./ActivityForm";

const acme = { id: 1, name: "Acme Ltd" };
const beta = { id: 2, name: "Beta Inc" };

function contact(id: number, name: string, organization = acme): ContactRow {
  return { id, name, organization, job_title: null, email: null, phone: null, status: "lead" };
}

function deal(id: number, name: string, organization = acme): Deal {
  return {
    id,
    name,
    organization,
    main_contact: { id: 10, name: "Ann Acme" },
    stage: "new",
    value: 1000,
    probability: 10,
    close_date: "2027-01-01",
    furthest_stage: "new",
    position: 0,
    created_at: "2026-10-01T09:00:00",
    updated_at: "2026-10-01T09:00:00",
  };
}

const contacts = [contact(10, "Ann Acme"), contact(11, "Al Acme"), contact(20, "Bea Beta", beta)];
const deals = [deal(7, "Big deal"), deal(8, "Beta deal", beta)];

const onAnn: LoggedOn = { kind: "contact", id: 10, name: "Ann Acme", organization: acme };
const onBigDeal: LoggedOn = { kind: "deal", id: 7, name: "Big deal", organization: acme };

const existing: Activity = {
  id: 3,
  type: "email",
  description: "Sent the quote",
  occurred_at: "2026-11-10T09:30:00",
  follow_up_date: "2026-11-24",
  done: true,
  contact: { id: 10, name: "Ann Acme" },
  deal: { id: 9, name: "Moved deal" },
};

function setup(
  on: LoggedOn,
  routes: Record<string, unknown> = {},
  activity?: Activity,
  lists = { deals, contacts },
) {
  const calls = mockApi({ "GET /deals": lists.deals, "GET /contacts": lists.contacts, ...routes });
  const onOpenChange = vi.fn();
  renderWithProviders(
    <ActivityForm open onOpenChange={onOpenChange} on={on} activity={activity} />,
  );
  return { calls, onOpenChange, user: userEvent.setup() };
}

const options = (label: RegExp) =>
  [...(screen.getByLabelText(label) as HTMLSelectElement).options].map((o) => o.textContent);

describe("ActivityForm", () => {
  it("logs an activity on a contact, linked to one of its organization's deals", async () => {
    const { calls, onOpenChange, user } = setup(onAnn, { "POST /activities": existing });
    expect(screen.getByText("On Ann Acme")).toBeInTheDocument();
    await screen.findByLabelText(/^Also link to a deal/);
    expect(options(/^Also link to a deal/)).toEqual(["None", "Big deal"]);
    await user.click(screen.getByLabelText("Note"));
    await user.type(screen.getByLabelText("Description"), "Met for coffee");
    await user.type(screen.getByLabelText(/^Follow-up date/), "2026-12-01");
    await user.selectOptions(screen.getByLabelText(/^Also link to a deal/), "Big deal");
    await user.click(screen.getByRole("button", { name: "Log activity" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(calls).toContainEqual({
      method: "POST",
      path: "/activities",
      body: {
        type: "note",
        description: "Met for coffee",
        occurred_at: expect.any(String),
        follow_up_date: "2026-12-01",
        done: false,
        contact_id: 10,
        deal_id: 7,
      },
    });
  });

  it("logs an activity on a deal, with no second link", async () => {
    const { calls, user } = setup(onBigDeal, { "POST /activities": existing });
    await screen.findByLabelText(/^Also link to a contact/);
    expect(options(/^Also link to a contact/)).toEqual(["None", "Ann Acme", "Al Acme"]);
    await user.type(screen.getByLabelText("Description"), "Called");
    await user.click(screen.getByRole("button", { name: "Log activity" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "POST",
        path: "/activities",
        body: expect.objectContaining({
          type: "call",
          follow_up_date: null,
          contact_id: null,
          deal_id: 7,
        }),
      }),
    );
  });

  it("says when there's nothing to link", async () => {
    setup(onAnn, {}, undefined, { deals: [], contacts });
    expect(await screen.findByText("Acme Ltd has no deals to link.")).toBeInTheDocument();
    renderWithProviders(
      <ActivityForm
        open
        onOpenChange={() => {}}
        on={{ ...onBigDeal, organization: { id: 3, name: "Gamma" } }}
      />,
    );
    expect(await screen.findByText("Gamma has no other contacts to link.")).toBeInTheDocument();
  });

  it("asks for a description before sending anything", async () => {
    const { calls, user } = setup(onAnn);
    await user.click(await screen.findByRole("button", { name: "Log activity" }));
    expect(await screen.findByText("Enter a description.")).toBeInTheDocument();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("edits an activity, keeping a linked deal that has since moved organization", async () => {
    const { calls, user } = setup(onAnn, { "PUT /activities/3": existing }, existing);
    expect(screen.getByRole("heading", { name: "Edit activity" })).toBeInTheDocument();
    const link = await screen.findByLabelText(/^Also link to a deal/);
    expect(options(/^Also link to a deal/)).toEqual(["None", "Moved deal", "Big deal"]);
    expect(link).toHaveValue("9");
    expect(screen.getByLabelText("Email")).toBeChecked();
    expect(screen.getByLabelText("Description")).toHaveValue("Sent the quote");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "PUT",
        path: "/activities/3",
        body: {
          type: "email",
          description: "Sent the quote",
          occurred_at: expect.stringMatching(/^2026-11-10T09:30/),
          follow_up_date: "2026-11-24",
          done: true,
          contact_id: 10,
          deal_id: 9,
        },
      }),
    );
  });

  it("puts the server's error about the link on the link's field", async () => {
    const { onOpenChange, user } = setup(onAnn, {
      "POST /activities": {
        status: 422,
        body: { message: "Check the form.", errors: { deal_id: "Choose a deal at Acme Ltd." } },
      },
    });
    await user.type(await screen.findByLabelText("Description"), "Hello");
    await user.click(screen.getByRole("button", { name: "Log activity" }));
    expect(await screen.findByText("Choose a deal at Acme Ltd.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("shows any other failure above the form", async () => {
    const { user } = setup(onAnn, {
      "POST /activities": { status: 404, body: { message: "That contact no longer exists." } },
    });
    await user.type(await screen.findByLabelText("Description"), "Hello");
    await user.click(screen.getByRole("button", { name: "Log activity" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That contact no longer exists.");
  });
});
