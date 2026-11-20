import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { mockApi, renderWithProviders } from "../../test/render";
import type { FollowUp } from "../api";
import { FollowUps } from "./FollowUps";

function followUp(id: number, description: string, days: number): FollowUp {
  return {
    id,
    type: "call",
    description,
    follow_up_date: "2026-11-16",
    days,
    contact: { id: 1, name: "Marcus Hale" },
    deal: { id: 2, name: "Turbine maintenance contract" },
  };
}

const overdue = [
  followUp(1, "Send revised pricing for year two", -9),
  followUp(2, "Book a site visit", -1),
];
const upcoming = [
  followUp(3, "Confirm the legal review date", 0),
  followUp(4, "Send the records migration case study", 1),
  followUp(5, "Demo for the operations team", 3),
];

describe("FollowUps", () => {
  it('puts overdue first under "Overdue" with a count, then "Next 7 days" with a count', () => {
    renderWithProviders(<FollowUps overdue={overdue} upcoming={upcoming} />);
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(["Overdue2", "Next 7 days3"]);
    const lists = screen.getAllByRole("list");
    expect(
      within(lists[0])
        .getAllByRole("listitem")
        .map((li) => li.querySelector("p")?.textContent),
    ).toEqual(["Send revised pricing for year two", "Book a site visit"]);
    expect(within(lists[0]).getAllByRole("listitem")[0]).toHaveTextContent("9 daysoverdue");
    expect(
      within(lists[1])
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      expect.stringContaining("Due today"),
      expect.stringContaining("Duetomorrow"),
      expect.stringContaining("Duein 3 days"),
    ]);
    expect(screen.getByText("5 to do. Tick one when it's done.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Marcus Hale" })[0]).toHaveAttribute(
      "href",
      "/contacts/1",
    );
  });

  it('says "No follow-ups due in the next 7 days" when none are due', () => {
    renderWithProviders(<FollowUps overdue={[]} upcoming={[]} />);
    expect(screen.getByText("No follow-ups due in the next 7 days")).toBeInTheDocument();
    expect(screen.getByText("Nothing overdue.")).toBeInTheDocument();
  });

  it("saves a ticked follow-up as done, takes it off the list and moves focus to the next", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ "PATCH /activities/3": { ...upcoming[0], done: true } });
    renderWithProviders(<FollowUps overdue={overdue} upcoming={upcoming} />);
    await user.click(screen.getByRole("checkbox", { name: "Done: Confirm the legal review date" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "PATCH",
        path: "/activities/3",
        body: { done: true },
      }),
    );
    expect(screen.queryByText("Confirm the legal review date")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Next 7 days/ })).toHaveTextContent("Next 7 days2");
    expect(
      screen.getByRole("checkbox", { name: "Done: Send the records migration case study" }),
    ).toHaveFocus();
  });

  it("moves focus to the group's heading when its last follow-up is ticked", async () => {
    const user = userEvent.setup();
    mockApi({ "PATCH /activities/2": { ...overdue[1], done: true } });
    renderWithProviders(<FollowUps overdue={[overdue[1]]} upcoming={[]} />);
    await user.click(screen.getByRole("checkbox", { name: "Done: Book a site visit" }));
    expect(screen.getByRole("heading", { name: /Overdue/ })).toHaveFocus();
    expect(screen.getByText("Nothing to do right now.")).toBeInTheDocument();
  });

  it("keeps a ticked follow-up hidden until the server's list drops it", async () => {
    const user = userEvent.setup();
    mockApi({ "PATCH /activities/1": { ...overdue[0], done: true } });
    function Refreshing() {
      const [lists, setLists] = useState({ overdue, upcoming });
      return (
        <>
          <button onClick={() => setLists({ overdue: [...overdue], upcoming: [...upcoming] })}>
            Same again
          </button>
          <button onClick={() => setLists({ overdue: [overdue[1]], upcoming: [...upcoming] })}>
            Without it
          </button>
          <button onClick={() => setLists({ overdue: [...overdue], upcoming: [...upcoming] })}>
            Back again
          </button>
          <FollowUps overdue={lists.overdue} upcoming={lists.upcoming} />
        </>
      );
    }
    renderWithProviders(<Refreshing />);
    await user.click(
      screen.getByRole("checkbox", { name: "Done: Send revised pricing for year two" }),
    );
    await user.click(screen.getByRole("button", { name: "Same again" }));
    expect(screen.queryByText("Send revised pricing for year two")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Without it" }));
    await user.click(screen.getByRole("button", { name: "Back again" }));
    expect(screen.getByText("Send revised pricing for year two")).toBeInTheDocument();
  });

  it("links only what a follow-up is about", () => {
    renderWithProviders(
      <FollowUps
        overdue={[{ ...overdue[0], deal: null }]}
        upcoming={[{ ...upcoming[0], contact: null }]}
      />,
    );
    const [first, second] = screen.getAllByRole("listitem");
    expect(
      within(first)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Marcus Hale"]);
    expect(
      within(second)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Turbine maintenance contract"]);
  });
});
