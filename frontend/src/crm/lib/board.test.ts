import { describe, expect, it } from "vitest";

import type { Deal } from "../api";
import { applyMove, topCardId } from "./board";
import type { Stage } from "./stages";

const TODAY = new Date(2026, 10, 16);

function deal(id: number, stage: Stage, position: number, extra: Partial<Deal> = {}): Deal {
  return {
    id,
    name: `Deal ${id}`,
    organization: { id: 1, name: "Acme" },
    main_contact: { id: 1, name: "Ann" },
    stage,
    value: 100_000,
    probability: { new: 10, qualified: 25, proposal: 50, negotiation: 75, won: 100, lost: 0 }[stage],
    close_date: "2027-01-31",
    furthest_stage: stage === "lost" ? "new" : stage,
    position,
    created_at: "2026-10-01T09:00:00",
    updated_at: "2026-10-01T09:00:00",
    ...extra,
  };
}

const board = [
  deal(1, "new", 0),
  deal(2, "new", 1),
  deal(3, "proposal", 0),
  deal(4, "negotiation", 0),
  deal(5, "negotiation", 1),
  deal(6, "won", 0, { close_date: "2026-11-01" }),
];

const order = (deals: Deal[], stage: Stage) => deals.filter((d) => d.stage === stage).map((d) => d.id);

describe("applying a move to the cached deals", () => {
  it("puts the card above before_id in another column and sets the stage and probability", () => {
    const next = applyMove(board, { dealId: 1, stage: "negotiation", beforeId: 5 }, TODAY);
    expect(order(next, "negotiation")).toEqual([4, 1, 5]);
    expect(order(next, "new")).toEqual([2]);
    const moved = next.find((d) => d.id === 1)!;
    expect([moved.stage, moved.probability, moved.furthest_stage]).toEqual(["negotiation", 75, "negotiation"]);
    expect(next.filter((d) => d.stage === "negotiation").map((d) => d.position)).toEqual([0, 1, 2]);
    expect(next.find((d) => d.id === 2)!.position).toBe(0);
  });

  it("sets today's close date on a move into Won", () => {
    const moved = applyMove(board, { dealId: 4, stage: "won", beforeId: 6 }, TODAY).find((d) => d.id === 4)!;
    expect([moved.stage, moved.close_date, moved.probability]).toEqual(["won", "2026-11-16", 100]);
  });

  it("uses the new close date when reopening, and keeps the furthest stage", () => {
    const moved = applyMove(board, { dealId: 6, stage: "proposal", beforeId: null, closeDate: "2026-12-16" }, TODAY).find(
      (d) => d.id === 6,
    )!;
    expect([moved.stage, moved.close_date, moved.furthest_stage]).toEqual(["proposal", "2026-12-16", "won"]);
  });

  it("changes only the order for a move within a column", () => {
    const next = applyMove(board, { dealId: 5, stage: "negotiation", beforeId: 4 }, TODAY);
    expect(order(next, "negotiation")).toEqual([5, 4]);
    const before = board.find((d) => d.id === 5)!;
    const after = next.find((d) => d.id === 5)!;
    expect({ ...after, position: before.position }).toEqual(before);
  });

  it("leaves the original list untouched, so undoing restores the cache exactly", () => {
    const snapshot = structuredClone(board);
    const next = applyMove(board, { dealId: 3, stage: "lost", beforeId: null }, TODAY);
    expect(next).not.toEqual(board);
    expect(board).toEqual(snapshot);
  });

  it("finds a column's top card for the stage menu", () => {
    expect(topCardId(board, "negotiation")).toBe(4);
    expect(topCardId(board, "negotiation", 4)).toBe(5);
    expect(topCardId(board, "qualified")).toBeNull();
  });
});
