import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "../../test/render";
import type { ContactRow } from "../api";
import { ContactForm } from "./ContactForm";

const organizations = [
  { id: 1, name: "Acme Ltd", website: null, industry: null, contact_count: 1, open_deal_count: 0 },
  { id: 2, name: "Beta Inc", website: null, industry: null, contact_count: 0, open_deal_count: 0 },
];

const ann: ContactRow = {
  id: 10,
  name: "Ann Acme",
  organization: { id: 1, name: "Acme Ltd" },
  job_title: "Buyer",
  email: "ann@acme.com",
  phone: null,
  status: "lead",
};

function setup(
  routes: Record<string, unknown>,
  props: { contact?: ContactRow; organizationId?: number } = {},
) {
  const calls = mockApi({ "GET /organizations": organizations, ...routes });
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  renderWithProviders(
    <ContactForm open onOpenChange={onOpenChange} onSaved={onSaved} {...props} />,
  );
  return { calls, onOpenChange, onSaved, user: userEvent.setup() };
}

describe("ContactForm", () => {
  it("adds a contact at the chosen organization", async () => {
    const saved = { ...ann, id: 11, name: "Bo Beta" };
    const { calls, onOpenChange, onSaved, user } = setup({ "POST /contacts": saved });
    await user.type(await screen.findByLabelText("Name"), "Bo Beta");
    await user.selectOptions(screen.getByLabelText("Organization"), "Beta Inc");
    await user.type(screen.getByLabelText(/^Email/), "bo@beta.com");
    await user.type(screen.getByLabelText(/^Phone/), "555 0100");
    await user.selectOptions(screen.getByLabelText("Status"), "Customer");
    await user.click(screen.getByRole("button", { name: "Add contact" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(calls).toContainEqual({
      method: "POST",
      path: "/contacts",
      body: {
        name: "Bo Beta",
        organization_id: 2,
        email: "bo@beta.com",
        phone: "555 0100",
        job_title: "",
        status: "customer",
      },
    });
  });

  it("starts at the organization it's added from", async () => {
    setup({}, { organizationId: 2 });
    expect(await screen.findByLabelText("Organization")).toHaveValue("2");
  });

  it("checks the fields before sending anything", async () => {
    const { calls, user } = setup({});
    await user.type(await screen.findByLabelText(/^Email/), "not an email");
    await user.click(screen.getByRole("button", { name: "Add contact" }));
    expect(await screen.findByText("Enter a name.")).toBeInTheDocument();
    expect(screen.getByText("Choose an organization.")).toBeInTheDocument();
    expect(
      screen.getByText("Enter a valid email address, like name@company.com."),
    ).toBeInTheDocument();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("edits a contact, and puts the server's field error on its field", async () => {
    const { calls, onSaved, user } = setup(
      {
        "PUT /contacts/10": {
          status: 422,
          body: {
            message: "Check the form.",
            errors: { email: "Another contact already uses this email." },
          },
        },
      },
      { contact: ann },
    );
    expect(screen.getByRole("heading", { name: "Edit Ann Acme" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Name")).toHaveValue("Ann Acme");
    expect(screen.getByLabelText("Organization")).toHaveValue("1");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Another contact already uses this email.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/)).toHaveFocus();
    expect(calls).toContainEqual({
      method: "PUT",
      path: "/contacts/10",
      body: {
        name: "Ann Acme",
        organization_id: 1,
        email: "ann@acme.com",
        phone: "",
        job_title: "Buyer",
        status: "lead",
      },
    });
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("says when the server can't be reached", async () => {
    const { user } = setup({ "PUT /contacts/10": { status: 500 } }, { contact: ann });
    await user.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach Accountable's server.");
  });
});
