import { describe, expect, it } from "vitest";

import { CLOSED_STAGES, OPEN_STAGES, STAGES, STAGE_PROBABILITY, isClosed, isOpen } from "./stages";

describe("stages", () => {
  it("has the order, open or closed, and the usual probabilities", () => {
    expect(STAGES).toEqual(["new", "qualified", "proposal", "negotiation", "won", "lost"]);
    expect(OPEN_STAGES).toEqual(["new", "qualified", "proposal", "negotiation"]);
    expect(CLOSED_STAGES).toEqual(["won", "lost"]);
    expect(STAGES.map((s) => STAGE_PROBABILITY[s])).toEqual([10, 25, 50, 75, 100, 0]);
    expect(isOpen("negotiation") && !isOpen("won")).toBe(true);
    expect(isClosed("lost") && !isClosed("new")).toBe(true);
  });
});
