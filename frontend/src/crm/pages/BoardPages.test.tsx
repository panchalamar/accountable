import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderWithProviders } from "../../test/render";
import { makeContactRow, makeDashboard, makeDeal, makeOrganizationRow } from "../test/pages";
import { DashboardPage } from "./DashboardPage";
import { PipelinePage } from "./PipelinePage";

const failing = { status: 500, body: { message: "The server fell over." } };
const formData = {
  "GET /organizations": [makeOrganizationRow()],
  "GET /contacts": [makeContactRow()],
};

describe("DashboardPage", () => {
  it("shows the date the figures are as of, and opens the add-deal form", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /dashboard": makeDashboard(), ...formData });
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText("Loading the dashboard...")).toBeInTheDocument();
    expect(await screen.findByText(/Figures as of/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add deal" }));
    expect(await screen.findByRole("dialog", { name: "Add deal" })).toBeInTheDocument();
  });

  it("explains when the dashboard can't load", async () => {
    mockApi({ "GET /dashboard": failing });
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByText("The server fell over.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Deals" })).toBeInTheDocument();
  });
});

describe("PipelinePage", () => {
  it("sums up the open deals, with none late", async () => {
    mockApi({ "GET /deals": [makeDeal()] });
    renderWithProviders(<PipelinePage />);
    expect(screen.getByText("Loading the pipeline...")).toBeInTheDocument();
    expect(await screen.findByText(/open across 1 deal,/)).toHaveTextContent("None are late.");
  });

  it("counts one late deal", async () => {
    mockApi({ "GET /deals": [makeDeal({ close_date: "2020-01-01" })] });
    renderWithProviders(<PipelinePage />);
    expect(await screen.findByText(/open across 1 deal,/)).toHaveTextContent("1 is late.");
  });

  it("counts several late deals", async () => {
    mockApi({
      "GET /deals": [
        makeDeal({ close_date: "2020-01-01" }),
        makeDeal({ id: 8, name: "Other deal", close_date: "2020-01-01", position: 1 }),
      ],
    });
    renderWithProviders(<PipelinePage />);
    expect(await screen.findByText(/open across 2 deals,/)).toHaveTextContent("2 are late.");
  });

  it("opens the add-deal form from the header and from a column", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /deals": [makeDeal()], ...formData });
    renderWithProviders(<PipelinePage />);
    await screen.findByText(/open across/);
    await user.click(screen.getByRole("button", { name: "Add deal" }));
    expect(await screen.findByRole("dialog", { name: "Add deal" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add deal to New" }));
    expect(await screen.findByRole("dialog", { name: "Add deal" })).toBeInTheDocument();
  });

  it("explains when the deals can't load", async () => {
    mockApi({ "GET /deals": failing });
    renderWithProviders(<PipelinePage />);
    expect(await screen.findByText("The server fell over.")).toBeInTheDocument();
  });
});
