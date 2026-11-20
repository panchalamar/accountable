import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "../../test/render";
import type { RecentItem } from "../api";
import { RecentActivity } from "./RecentActivity";

const items: RecentItem[] = [
  {
    kind: "stage_change",
    id: 1,
    deal: { id: 7, name: "Turbine contract" },
    from_stage: "qualified",
    to_stage: "proposal",
    at: "2026-11-20T09:30:00",
  },
  {
    kind: "activity",
    id: 1,
    type: "call",
    description: "Talked pricing",
    at: "2026-11-19T15:00:00",
    contact: { id: 3, name: "Marcus Hale" },
    deal: { id: 7, name: "Turbine contract" },
  },
  {
    kind: "activity",
    id: 2,
    type: "note",
    description: "A note on nothing",
    at: "2026-11-18T15:00:00",
    contact: null,
    deal: null,
  },
];

describe("RecentActivity", () => {
  it("says so when there's nothing yet", () => {
    renderWithProviders(<RecentActivity items={[]} />);
    expect(
      screen.getByText("Nothing yet. Activities and stage changes show here."),
    ).toBeInTheDocument();
  });

  it("lists stage changes and activities, linking to their records", () => {
    renderWithProviders(<RecentActivity items={items} />);
    const [move, call, note] = screen.getAllByRole("listitem");

    expect(move).toHaveTextContent(/Turbine contract\s*Moved from\s*Qualified\s*to\s*Proposal/);
    expect(within(move).getByRole("link", { name: "Turbine contract" })).toHaveAttribute(
      "href",
      "/deals/7",
    );

    expect(call).toHaveTextContent("Call with Marcus Hale about Turbine contract");
    expect(within(call).getByRole("link", { name: "Marcus Hale" })).toHaveAttribute(
      "href",
      "/contacts/3",
    );

    expect(note).toHaveTextContent(/^Note/);
    expect(within(note).queryByRole("link")).not.toBeInTheDocument();
  });
});
