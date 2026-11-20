import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderWithProviders } from "../../test/render";
import { makeContactRow, makeDeal, makeOrganizationRow } from "../test/pages";
import { ContactsPage } from "./ContactsPage";
import { DealsPage } from "./DealsPage";
import { OrganizationsPage } from "./OrganizationsPage";

/** The first-column links in table order. */
function names() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("link")[0].textContent);
}

async function sortBy(user: ReturnType<typeof userEvent.setup>, heading: string) {
  await user.click(
    within(screen.getByRole("columnheader", { name: new RegExp(heading) })).getByRole("button"),
  );
}

const failing = { status: 500, body: { message: "The server fell over." } };

describe("ContactsPage", () => {
  const contacts = [
    makeContactRow(),
    makeContactRow({
      id: 11,
      name: "Bob Brick",
      status: "customer",
      email: null,
      job_title: null,
      phone: null,
    }),
  ];

  it("lists contacts and filters them by status", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /contacts": contacts, "GET /organizations": [makeOrganizationRow()] });
    renderWithProviders(<ContactsPage />);
    expect(screen.getByText("Loading contacts...")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Ann Acme" })).toHaveAttribute(
      "href",
      "/contacts/10",
    );
    expect(screen.getByRole("link", { name: "ann@acme.test" })).toHaveAttribute(
      "href",
      "mailto:ann@acme.test",
    );
    expect(screen.getByRole("link", { name: "Bob Brick" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Lead/ }));
    expect(screen.queryByRole("link", { name: "Bob Brick" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Qualified/ }));
    expect(screen.getByText("No contacts with the status Qualified.")).toBeInTheDocument();
  });

  it("searches every column and sorts by each", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /contacts": contacts });
    renderWithProviders(<ContactsPage />);
    await screen.findByRole("link", { name: "Ann Acme" });
    for (const heading of ["Organization", "Job title", "Email", "Phone", "Name"])
      await sortBy(user, heading);
    await sortBy(user, "Status");
    expect(names()).toEqual(["Ann Acme", "Bob Brick"]); // lead before customer
    await user.type(screen.getByLabelText("Search contacts"), "buyer");
    expect(names()).toEqual(["Ann Acme"]);
  });

  it("says so when there are no contacts yet", async () => {
    mockApi({ "GET /contacts": [] });
    renderWithProviders(<ContactsPage />);
    expect(
      await screen.findByText("No contacts yet. Add the people you deal with."),
    ).toBeInTheDocument();
  });

  it("opens the add, edit and delete dialogs", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /contacts": contacts,
      "GET /organizations": [makeOrganizationRow()],
      "GET /contacts/10/delete-check": {
        can_delete: true,
        message: "",
        blocking_deals: [],
        activities_to_delete: 0,
        activities_to_keep: 0,
      },
    });
    renderWithProviders(<ContactsPage />);
    await screen.findByRole("link", { name: "Ann Acme" });

    await user.click(screen.getByRole("button", { name: "Add contact" }));
    expect(await screen.findByRole("dialog", { name: "Add contact" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Edit Ann Acme" }));
    expect(await screen.findByRole("dialog", { name: "Edit Ann Acme" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Edit Ann Acme" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete Ann Acme" }));
    expect(
      await screen.findByRole("alertdialog", { name: "Delete Ann Acme?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("explains when the contacts can't load", async () => {
    mockApi({ "GET /contacts": failing });
    renderWithProviders(<ContactsPage />);
    expect(await screen.findByText("The server fell over.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the dashboard" })).toBeInTheDocument();
  });
});

describe("OrganizationsPage", () => {
  const orgs = [
    makeOrganizationRow(),
    makeOrganizationRow({ id: 2, name: "Bare Co", website: null, industry: null }),
    makeOrganizationRow({ id: 3, name: "Odd Co", website: "not a website" }),
  ];

  it("lists organizations with their websites", async () => {
    mockApi({ "GET /organizations": orgs });
    renderWithProviders(<OrganizationsPage />);
    expect(screen.getByText("Loading organizations...")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Acme Ltd" })).toHaveAttribute(
      "href",
      "/organizations/1",
    );
    const site = screen.getByRole("link", { name: "acme.test" });
    expect(site).toHaveAttribute("target", "_blank");
    const odd = screen.getByRole("link", { name: "Odd Co" }).closest("tr") as HTMLElement;
    expect(within(odd).getByText("not a website")).toBeInTheDocument();
  });

  it("searches every column and sorts by each", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /organizations": [
        makeOrganizationRow({ open_deal_count: 0 }),
        makeOrganizationRow({ id: 2, name: "Bare Co", website: null, open_deal_count: 3 }),
      ],
    });
    renderWithProviders(<OrganizationsPage />);
    await screen.findByRole("link", { name: "Acme Ltd" });
    for (const heading of ["Industry", "Website", "Contacts"]) await sortBy(user, heading);
    await sortBy(user, "Open deals");
    expect(names()).toEqual(["Bare Co", "Acme Ltd"]); // most open deals first
    await user.type(screen.getByLabelText("Search organizations"), "acme.test");
    expect(names()).toEqual(["Acme Ltd"]);
  });

  it("says so when there are none", async () => {
    mockApi({ "GET /organizations": [] });
    renderWithProviders(<OrganizationsPage />);
    expect(
      await screen.findByText("No organizations yet. Add the companies you do business with."),
    ).toBeInTheDocument();
  });

  it("opens the add, edit and delete dialogs", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /organizations": orgs,
      "GET /organizations/1/delete-check": {
        can_delete: true,
        message: "",
        blocking_deals: [],
        activities_to_delete: 0,
        activities_to_keep: 0,
      },
    });
    renderWithProviders(<OrganizationsPage />);
    await screen.findByRole("link", { name: "Acme Ltd" });

    await user.click(screen.getByRole("button", { name: "Add organization" }));
    expect(await screen.findByRole("dialog", { name: "Add organization" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Edit Acme Ltd" }));
    expect(await screen.findByRole("dialog", { name: "Edit Acme Ltd" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete Acme Ltd" }));
    expect(
      await screen.findByRole("alertdialog", { name: "Delete Acme Ltd?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("explains when the organizations can't load", async () => {
    mockApi({ "GET /organizations": failing });
    renderWithProviders(<OrganizationsPage />);
    expect(await screen.findByText("The server fell over.")).toBeInTheDocument();
  });
});

describe("DealsPage list", () => {
  it("lists deals with links to their organization and contact", async () => {
    mockApi({ "GET /deals": [makeDeal()] });
    renderWithProviders(<DealsPage />);
    expect(screen.getByText("Loading deals...")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Big deal" })).toHaveAttribute(
      "href",
      "/deals/7",
    );
    expect(screen.getByRole("link", { name: "Acme Ltd" })).toHaveAttribute(
      "href",
      "/organizations/1",
    );
    expect(screen.getByRole("link", { name: "Ann Acme" })).toHaveAttribute("href", "/contacts/10");
  });

  it("searches every column and sorts by each", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /deals": [
        makeDeal(),
        makeDeal({
          id: 8,
          name: "Small deal",
          stage: "new",
          value: 1000,
          probability: 10,
          main_contact: { id: 11, name: "Bob Brick" },
        }),
      ],
    });
    renderWithProviders(<DealsPage />);
    await screen.findByRole("link", { name: "Big deal" });
    for (const heading of ["Name", "Organization", "Main contact", "Probability", "Close date"])
      await sortBy(user, heading);
    await sortBy(user, "Stage");
    expect(names()).toEqual(["Small deal", "Big deal"]); // New before Proposal
    await sortBy(user, "Value");
    expect(names()).toEqual(["Big deal", "Small deal"]); // biggest first
    await user.type(screen.getByLabelText("Search deals"), "bob");
    expect(names()).toEqual(["Small deal"]);
  });

  it("says so when there are no deals", async () => {
    mockApi({ "GET /deals": [] });
    renderWithProviders(<DealsPage />);
    expect(
      await screen.findByText("No deals yet. Add one to start the pipeline."),
    ).toBeInTheDocument();
  });

  it("opens the add, edit and delete dialogs", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /deals": [makeDeal()],
      "GET /organizations": [makeOrganizationRow()],
      "GET /contacts": [makeContactRow()],
      "GET /deals/7/delete-check": {
        can_delete: true,
        message: "",
        blocking_deals: [],
        activities_to_delete: 0,
        activities_to_keep: 0,
      },
    });
    renderWithProviders(<DealsPage />);
    await screen.findByRole("link", { name: "Big deal" });

    await user.click(screen.getByRole("button", { name: "Add deal" }));
    expect(await screen.findByRole("dialog", { name: "Add deal" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Edit Big deal" }));
    expect(await screen.findByRole("dialog", { name: "Edit Big deal" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete Big deal" }));
    expect(
      await screen.findByRole("alertdialog", { name: "Delete Big deal?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("explains when the deals can't load", async () => {
    mockApi({ "GET /deals": failing });
    renderWithProviders(<DealsPage />);
    expect(await screen.findByText("The server fell over.")).toBeInTheDocument();
  });
});
