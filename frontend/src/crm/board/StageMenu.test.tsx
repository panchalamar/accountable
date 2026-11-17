import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "../../test/render";
import type { Deal } from "../api";
import { PipelinePage } from "../pages/PipelinePage";
import type { Stage } from "../lib/stages";
import { StageMenu } from "./StageMenu";

function deal(id: number, name: string, stage: Stage, position: number): Deal {
  return {
    id,
    name,
    organization: { id: 1, name: "Atlas Freight" },
    main_contact: { id: 1, name: "Dana Ortiz" },
    stage,
    value: 560_000,
    probability: { new: 10, qualified: 25, proposal: 50, negotiation: 75, won: 100, lost: 0 }[stage],
    close_date: "2030-01-31",
    furthest_stage: stage === "lost" ? "new" : stage,
    position,
    created_at: "2026-10-01T09:00:00",
    updated_at: "2026-10-01T09:00:00",
  };
}

describe("StageMenu", () => {
  it("lists the stages and works with the arrow keys and Enter", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    renderWithProviders(<StageMenu dealName="Atlas Freight renewal" stage="proposal" onChoose={onChoose} />);
    const trigger = screen.getByRole("button", { name: "Stage: Proposal. Change stage of Atlas Freight renewal" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const items = await screen.findAllByRole("menuitemradio");
    expect(items.map((i) => i.textContent)).toEqual(["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]);
    expect(screen.getByRole("menuitemradio", { name: "Proposal" })).toHaveAttribute("aria-checked", "true");
    // Start on the first item, then down three to Negotiation.
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    await waitFor(() => expect(screen.getByRole("menuitemradio", { name: "Negotiation" })).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(onChoose).toHaveBeenCalledWith("negotiation");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("sends the target column's top card as before_id", async () => {
    const user = userEvent.setup();
    const deals = [
      deal(1, "Atlas Freight renewal", "proposal", 0),
      deal(2, "Steel supply agreement 2027", "negotiation", 0),
      deal(3, "Imaging equipment lease", "negotiation", 1),
    ];
    const calls = mockApi({
      "GET /deals": deals,
      "POST /deals/1/move": { ...deals[0], stage: "negotiation", probability: 75 },
    });
    renderWithProviders(<PipelinePage />, { route: "/pipeline" });
    await user.click(await screen.findByRole("button", { name: "Stage: Proposal. Change stage of Atlas Freight renewal" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Negotiation" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST")).toBeTruthy());
    expect(calls.find((c) => c.method === "POST")).toEqual({
      method: "POST",
      path: "/deals/1/move",
      body: { stage: "negotiation", before_id: 2, close_date: null },
    });
    expect(screen.getByText("Moved Atlas Freight renewal to Negotiation")).toHaveAttribute("aria-live", "polite");
  });
});
