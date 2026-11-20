import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "../../test/render";
import { OrganizationForm } from "./OrganizationForm";

const saved = {
  id: 5,
  name: "Acme Ltd",
  website: "acme.com",
  industry: "Energy",
  notes: "",
  contact_count: 0,
  open_deal_count: 0,
};

const others = [
  { id: 1, name: "Beta", website: null, industry: "Retail", contact_count: 0, open_deal_count: 0 },
  { id: 2, name: "Gamma", website: null, industry: "Energy", contact_count: 0, open_deal_count: 0 },
  { id: 3, name: "Delta", website: null, industry: null, contact_count: 0, open_deal_count: 0 },
];

function setup(routes: Record<string, unknown>, organization?: typeof saved) {
  const calls = mockApi({ "GET /organizations": others, ...routes });
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  renderWithProviders(
    <OrganizationForm
      open
      onOpenChange={onOpenChange}
      organization={organization}
      onSaved={onSaved}
    />,
  );
  return { calls, onOpenChange, onSaved, user: userEvent.setup() };
}

describe("OrganizationForm", () => {
  it("adds an organization and closes", async () => {
    const { calls, onOpenChange, onSaved, user } = setup({ "POST /organizations": saved });
    expect(screen.getByRole("heading", { name: "Add organization" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), "Acme Ltd");
    await user.type(screen.getByLabelText(/^Website/), "acme.com");
    await user.type(screen.getByLabelText(/^Industry/), "Energy");
    await user.click(screen.getByRole("button", { name: "Add organization" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(calls).toContainEqual({
      method: "POST",
      path: "/organizations",
      body: { name: "Acme Ltd", website: "acme.com", industry: "Energy", notes: "" },
    });
  });

  it("suggests the industries already in use", async () => {
    setup({});
    await waitFor(() =>
      expect(
        [...document.querySelectorAll("#industries-in-use option")].map((o) =>
          o.getAttribute("value"),
        ),
      ).toEqual(["Energy", "Retail"]),
    );
  });

  it("asks for a name before sending anything", async () => {
    const { calls, user } = setup({});
    await user.click(screen.getByRole("button", { name: "Add organization" }));
    expect(await screen.findByText("Enter a name.")).toBeInTheDocument();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("edits an existing organization", async () => {
    const { calls, user } = setup({ "PUT /organizations/5": saved }, saved);
    expect(screen.getByRole("heading", { name: "Edit Acme Ltd" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Acme Ltd");
    await user.type(screen.getByLabelText(/^Notes/), "Big one");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "PUT",
        path: "/organizations/5",
        body: { name: "Acme Ltd", website: "acme.com", industry: "Energy", notes: "Big one" },
      }),
    );
  });

  it("shows the server's field error on its field and focuses it", async () => {
    const { onOpenChange, user } = setup({
      "POST /organizations": {
        status: 422,
        body: {
          message: "Check the form.",
          errors: { name: "An organization called Beta already exists." },
        },
      },
    });
    await user.type(screen.getByLabelText("Name"), "Beta");
    await user.click(screen.getByRole("button", { name: "Add organization" }));
    expect(
      await screen.findByText("An organization called Beta already exists."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("shows any other failure above the form", async () => {
    const { user } = setup({
      "POST /organizations": { status: 409, body: { message: "That can't be saved now." } },
    });
    await user.type(screen.getByLabelText("Name"), "Acme");
    await user.click(screen.getByRole("button", { name: "Add organization" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That can't be saved now.");
  });
});
