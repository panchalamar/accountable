import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { InitialEntry } from "react-router";
import { mockApi } from "../../test/render";
import {
  makeContact,
  makeContactRow,
  makeDeal,
  makeOrganization,
  makeOrganizationRow,
  renderPage,
} from "../test/pages";
import { ContactPage } from "./ContactPage";
import { DealPage } from "./DealPage";
import { OrganizationPage } from "./OrganizationPage";

const canDelete = {
  can_delete: true,
  message: "",
  blocking_deals: [],
  activities_to_delete: 0,
  activities_to_keep: 0,
};
const gone = { status: 404, body: { message: "That record doesn't exist." } };

describe("ContactPage", () => {
  const visit = () => renderPage("/contacts/:id", <ContactPage />, "/contacts/10");

  it("shows the contact's details and the deals they're main contact on", async () => {
    mockApi({
      "GET /contacts/10": makeContact({
        deals: [
          {
            id: 7,
            name: "Old deal",
            stage: "proposal",
            value: 1000,
            probability: 50,
            close_date: "2020-01-01",
          },
        ],
      }),
      "GET /contacts/10/timeline": [],
    });
    visit();
    expect(screen.getByText("Loading the contact...")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Ann Acme" })).toBeInTheDocument();
    expect(screen.getByText("Buyer at")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ann@acme.test" })).toHaveAttribute(
      "href",
      "mailto:ann@acme.test",
    );
    expect(screen.getByRole("link", { name: "Old deal" })).toHaveAttribute("href", "/deals/7");
    expect(screen.getByText("Late")).toBeInTheDocument();
  });

  it("fills gaps with Not given and says when there are no deals", async () => {
    mockApi({
      "GET /contacts/10": makeContact({ job_title: null, email: null, phone: null }),
      "GET /contacts/10/timeline": [],
    });
    visit();
    expect(await screen.findByText("Not the main contact on any deal.")).toBeInTheDocument();
    expect(screen.getAllByText("Not given")).toHaveLength(3);
  });

  it("goes back to the contacts list after a delete", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /contacts/10": makeContact(),
      "GET /contacts/10/timeline": [],
      "GET /organizations": [makeOrganizationRow()],
      "GET /contacts/10/delete-check": canDelete,
      "DELETE /contacts/10": { status: 204 },
    });
    visit();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("dialog", { name: "Edit Ann Acme" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Delete contact" }));
    expect(await screen.findByText("Somewhere else")).toBeInTheDocument();
  });

  it("says Not found for a missing contact", async () => {
    mockApi({ "GET /contacts/10": gone, "GET /contacts/10/timeline": [] });
    visit();
    expect(await screen.findByRole("heading", { name: "Not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Contacts" })).toBeInTheDocument();
  });
});

describe("DealPage", () => {
  const visit = () => renderPage("/deals/:id", <DealPage />, "/deals/7");
  const base = {
    "GET /deals/7/timeline": [],
    "GET /deals": [makeDeal()],
  };

  it("shows the deal's figures and when it's due", async () => {
    mockApi({ ...base, "GET /deals/7": makeDeal() });
    visit();
    expect(screen.getByText("Loading the deal...")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Big deal" })).toBeInTheDocument();
    expect(screen.getByText("Expected close date")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.queryByText("Late")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Acme Ltd" })[0]).toHaveAttribute(
      "href",
      "/organizations/1",
    );
  });

  it("marks an open deal past its close date as late", async () => {
    mockApi({ ...base, "GET /deals/7": makeDeal({ close_date: "2020-01-01" }) });
    visit();
    await screen.findByRole("heading", { name: "Big deal" });
    expect(screen.getAllByText("Late").length).toBeGreaterThan(0);
  });

  it("shows a closed deal's close date as Closed", async () => {
    mockApi({ ...base, "GET /deals/7": makeDeal({ stage: "won", probability: 100 }) });
    visit();
    expect(await screen.findByText("Closed")).toBeInTheDocument();
  });

  it("moves the deal when a stage is chosen", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...base,
      "GET /deals/7": makeDeal(),
      "POST /deals/7/move": makeDeal({ stage: "negotiation" }),
    });
    visit();
    await user.click(await screen.findByRole("button", { name: /Change stage of Big deal/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Negotiation" }));
    await waitFor(() =>
      expect(calls.find((c) => c.path === "/deals/7/move")?.body).toMatchObject({
        stage: "negotiation",
      }),
    );
  });

  it("asks for a close date before reopening a closed deal", async () => {
    const user = userEvent.setup();
    mockApi({ ...base, "GET /deals/7": makeDeal({ stage: "lost", probability: 0 }) });
    visit();
    await user.click(await screen.findByRole("button", { name: /Change stage of Big deal/ }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Proposal" }));
    expect(await screen.findByRole("dialog", { name: "Reopen Big deal" })).toBeInTheDocument();
  });

  it("goes back to the deals list after a delete", async () => {
    const user = userEvent.setup();
    mockApi({
      ...base,
      "GET /deals/7": makeDeal(),
      "GET /organizations": [makeOrganizationRow()],
      "GET /contacts": [makeContactRow()],
      "GET /deals/7/delete-check": canDelete,
      "DELETE /deals/7": { status: 204 },
    });
    visit();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("dialog", { name: "Edit Big deal" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Delete deal" }));
    expect(await screen.findByText("Somewhere else")).toBeInTheDocument();
  });

  it("says Not found for a missing deal", async () => {
    mockApi({ ...base, "GET /deals/7": gone });
    visit();
    expect(await screen.findByRole("heading", { name: "Not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Deals" })).toBeInTheDocument();
  });
});

describe("OrganizationPage", () => {
  const visit = (url: InitialEntry = "/organizations/1") =>
    renderPage("/organizations/:id", <OrganizationPage />, url);

  it("shows the organization's details, contacts and deals", async () => {
    mockApi({
      "GET /organizations/1": makeOrganization({
        contacts: [
          { id: 10, name: "Ann Acme", job_title: "Buyer", email: null, status: "customer" },
        ],
        deals: [
          {
            id: 7,
            name: "Old deal",
            stage: "proposal",
            value: 1000,
            probability: 50,
            close_date: "2020-01-01",
            main_contact: { id: 10, name: "Ann Acme" },
          },
        ],
      }),
    });
    visit();
    expect(screen.getByText("Loading the organization...")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Acme Ltd" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "acme.test" })).toHaveAttribute("target", "_blank");
    expect(screen.getByText("Pays on time")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ann Acme" })).toHaveAttribute("href", "/contacts/10");
    expect(screen.getByRole("link", { name: "Old deal" })).toHaveAttribute("href", "/deals/7");
    expect(screen.getByText("Late")).toBeInTheDocument();
  });

  it("copes with an organization that has little filled in", async () => {
    mockApi({
      "GET /organizations/1": makeOrganization({ website: null, industry: null, notes: null }),
    });
    visit();
    expect(
      await screen.findByText("No contacts yet. Add the people you deal with here."),
    ).toBeInTheDocument();
    expect(screen.getByText("No deals yet.")).toBeInTheDocument();
    expect(screen.getAllByText("Not given")).toHaveLength(3);
  });

  it("shows a website that isn't a link as plain text", async () => {
    mockApi({ "GET /organizations/1": makeOrganization({ website: "not a website" }) });
    visit();
    expect(await screen.findByText("not a website")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "not a website" })).not.toBeInTheDocument();
  });

  it("opens the add-contact form when the deal form's link asks for it", async () => {
    mockApi({
      "GET /organizations/1": makeOrganization(),
      "GET /organizations": [makeOrganizationRow()],
    });
    visit({ pathname: "/organizations/1", state: { addContact: true } });
    expect(await screen.findByRole("dialog", { name: "Add contact" })).toBeInTheDocument();
  });

  it("opens the edit, add contact and add deal forms", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /organizations/1": makeOrganization(),
      "GET /organizations": [makeOrganizationRow()],
      "GET /contacts": [makeContactRow()],
    });
    visit();
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("dialog", { name: "Edit Acme Ltd" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Add contact" }));
    expect(await screen.findByRole("dialog", { name: "Add contact" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Add deal" }));
    expect(await screen.findByRole("dialog", { name: "Add deal" })).toBeInTheDocument();
  });

  it("goes back to the organizations list after a delete", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /organizations/1": makeOrganization(),
      "GET /organizations/1/delete-check": canDelete,
      "DELETE /organizations/1": { status: 204 },
    });
    visit();
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Delete organization" }));
    expect(await screen.findByText("Somewhere else")).toBeInTheDocument();
  });

  it("says Not found for a missing organization", async () => {
    mockApi({ "GET /organizations/1": gone });
    visit();
    expect(await screen.findByRole("heading", { name: "Not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Organizations" })).toBeInTheDocument();
  });
});
