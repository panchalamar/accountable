import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "sonner";
import { describe, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "../../test/render";
import { type Deal, useDeal, useDeals } from "../api";
import type { Stage } from "../lib/stages";
import { useDealMover } from "./useDealMover";

function deal(id: number, name: string, stage: Stage): Deal {
  return {
    id,
    name,
    organization: { id: 1, name: "Atlas Freight" },
    main_contact: { id: 1, name: "Dana Ortiz" },
    stage,
    value: 100_000,
    probability: 50,
    close_date: "2030-01-31",
    furthest_stage: stage,
    position: 0,
    created_at: "2026-10-01T09:00:00",
    updated_at: "2026-10-01T09:00:00",
  };
}

const OPEN = deal(1, "Atlas Freight renewal", "proposal");
const WON = deal(2, "Steel supply", "won");

// A small page that moves deals the way the board and the deal page do.
function Mover({ refocus }: { refocus?: () => void }) {
  const deals = useDeals().data ?? [];
  useDeal(1);
  const mover = useDealMover();
  const onDialogClose = vi.fn();
  return (
    <>
      <ul aria-label="Deals">
        {deals.map((d) => (
          <li key={d.id}>
            {d.name}: {d.stage}
          </li>
        ))}
      </ul>
      {deals.map((d) => (
        <div key={d.id}>
          <button type="button" onClick={() => mover.request(d, "won", null)}>
            Win {d.name}
          </button>
          <button
            type="button"
            onClick={() => mover.request(d, "negotiation", null, { onDialogClose, refocus })}
          >
            Negotiate {d.name}
          </button>
        </div>
      ))}
      <p aria-live="polite">{mover.announcement}</p>
      {mover.dialog}
      <Toaster />
    </>
  );
}

describe("useDealMover", () => {
  it("moves at once and says when a deal is closed", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /deals": [OPEN, WON],
      "GET /deals/1": OPEN,
      "POST /deals/1/move": { ...OPEN, stage: "won" },
    });
    renderWithProviders(<Mover />);
    await user.click(await screen.findByRole("button", { name: "Win Atlas Freight renewal" }));
    expect(screen.getByText("Moved Atlas Freight renewal to Won")).toBeInTheDocument();
    expect(await screen.findByText("Moved to Won. Close date set to today.")).toBeInTheDocument();
    expect(calls).toContainEqual({
      method: "POST",
      path: "/deals/1/move",
      body: { stage: "won", before_id: null, close_date: null },
    });
  });

  it("puts the deal back and says why when the server refuses", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /deals": [OPEN],
      "GET /deals/1": OPEN,
      "POST /deals/1/move": { status: 422, body: { message: "Closed deals are locked." } },
    });
    renderWithProviders(<Mover />);
    await user.click(
      await screen.findByRole("button", { name: "Negotiate Atlas Freight renewal" }),
    );
    expect(
      await screen.findByText("Atlas Freight renewal wasn't moved. Closed deals are locked.", {
        selector: "p",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Atlas Freight renewal: proposal")).toBeInTheDocument();
  });

  it("asks for a new close date before reopening a closed deal", async () => {
    const user = userEvent.setup();
    const refocus = vi.fn();
    const calls = mockApi({
      "GET /deals": [WON],
      "GET /deals/1": OPEN,
      "POST /deals/2/move": { ...WON, stage: "negotiation" },
    });
    renderWithProviders(<Mover refocus={refocus} />);
    await user.click(await screen.findByRole("button", { name: "Negotiate Steel supply" }));
    expect(await screen.findByRole("dialog", { name: "Reopen Steel supply" })).toBeInTheDocument();
    await user.clear(screen.getByLabelText("New expected close date"));
    await user.type(screen.getByLabelText("New expected close date"), "2031-03-01");
    await user.click(screen.getByRole("button", { name: "Reopen" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "POST",
        path: "/deals/2/move",
        body: { stage: "negotiation", before_id: null, close_date: "2031-03-01" },
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(refocus).toHaveBeenCalled());
  });

  it("leaves a closed deal alone when the reopen is cancelled", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ "GET /deals": [WON], "GET /deals/1": OPEN });
    renderWithProviders(<Mover />);
    await user.click(await screen.findByRole("button", { name: "Negotiate Steel supply" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    expect(screen.getByText("Steel supply: won")).toBeInTheDocument();
  });
});

// Moves a deal the cache doesn't hold, as the deal page can before its list loads.
function BareMover({ stage }: { stage: Stage }) {
  const mover = useDealMover();
  return (
    <>
      <button type="button" onClick={() => mover.request(OPEN, stage, 5)}>
        Move
      </button>
      <p aria-live="polite">{mover.announcement}</p>
      <Toaster />
    </>
  );
}

describe("useDealMover, with nothing cached", () => {
  it("still sends a move within the same stage, quietly", async () => {
    const user = userEvent.setup();
    const calls = mockApi({ "POST /deals/1/move": OPEN });
    renderWithProviders(<BareMover stage="proposal" />);
    await user.click(screen.getByRole("button", { name: "Move" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "POST",
        path: "/deals/1/move",
        body: { stage: "proposal", before_id: 5, close_date: null },
      }),
    );
    expect(screen.queryByText(/^Moved Atlas Freight renewal to/)).not.toBeInTheDocument();
  });

  it("says why a move failed", async () => {
    const user = userEvent.setup();
    mockApi({ "POST /deals/1/move": { status: 400, body: { message: "No." } } });
    renderWithProviders(<BareMover stage="new" />);
    await user.click(screen.getByRole("button", { name: "Move" }));
    expect(
      await screen.findByText("Atlas Freight renewal wasn't moved. No.", { selector: "p" }),
    ).toBeInTheDocument();
  });
});
