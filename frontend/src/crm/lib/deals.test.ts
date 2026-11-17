import { describe, expect, it } from "vitest";

import { boardTotals, dueIn, isLate, onBoard, totalExpected } from "./deals";
import type { Stage } from "./stages";

const TODAY = new Date(2026, 10, 16);

function deal(stage: Stage, close: string, value = 100_000, probability = 50) {
  return { stage, close_date: close, value, probability };
}

describe("late deals", () => {
  it("an open deal due yesterday is late, one due today isn't, closed deals never are", () => {
    expect(isLate(deal("proposal", "2026-11-15"), TODAY)).toBe(true);
    expect(isLate(deal("proposal", "2026-11-16"), TODAY)).toBe(false);
    expect(isLate(deal("won", "2026-01-01"), TODAY)).toBe(false);
    expect(isLate(deal("lost", "2026-11-15"), TODAY)).toBe(false);
  });
});

describe("the board window", () => {
  it("shows open deals always, and closed deals for 30 days", () => {
    expect(onBoard(deal("new", "2020-01-01"), TODAY)).toBe(true);
    expect(onBoard(deal("won", "2026-10-17"), TODAY)).toBe(true); // 30 days ago
    expect(onBoard(deal("lost", "2026-10-17"), TODAY)).toBe(true);
    expect(onBoard(deal("won", "2026-10-16"), TODAY)).toBe(false); // 31 days ago
  });
});

describe("column and board expected revenue", () => {
  it("adds each deal's rounded amount, so the columns add up to the board", () => {
    const deals = [
      deal("new", "2027-01-01", 5, 50),
      deal("new", "2027-01-01", 5, 50),
      deal("qualified", "2027-01-01", 1, 50),
      deal("proposal", "2027-01-01", 1_000_010, 35),
    ];
    const totals = boardTotals(deals, TODAY);
    expect(totals.columns.new.expected).toBe(6);
    expect(totals.columns.qualified.expected).toBe(1);
    expect(totals.columns.proposal.expected).toBe(350_004);
    const columnsSum = (["new", "qualified", "proposal", "negotiation"] as Stage[]).reduce(
      (sum, s) => sum + totals.columns[s].expected,
      0,
    );
    expect(totals.open.expected).toBe(columnsSum);
    expect(totals.open.expected).toBe(totalExpected(deals));
  });
});

describe("board totals", () => {
  const deals = [
    deal("new", "2027-01-01", 520_000, 10),
    deal("new", "2027-02-01", 340_000, 10),
    deal("proposal", "2026-11-04", 880_000, 50),
    deal("negotiation", "2026-12-11", 950_000, 75),
    deal("won", "2026-11-12", 640_000, 100),
    deal("lost", "2026-11-09", 720_000, 0),
  ];
  const totals = boardTotals(deals, TODAY);

  it("counts open deals only for the board", () => {
    expect(totals.open).toEqual({ count: 4, value: 2_690_000, expected: 52_000 + 34_000 + 440_000 + 712_500, late: 1 });
  });

  it("gives each column its count and value, and open columns their expected revenue", () => {
    expect(totals.columns.new).toEqual({ count: 2, value: 860_000, expected: 86_000 });
    expect(totals.columns.qualified).toEqual({ count: 0, value: 0, expected: 0 });
    expect(totals.columns.negotiation.expected).toBe(712_500);
    expect(totals.columns.won.count).toBe(1);
    expect(totals.columns.won.value).toBe(640_000);
    expect(totals.columns.lost.value).toBe(720_000);
  });
});

describe("how soon a deal is due", () => {
  it('says "in 25 days" under 45 days, then whole months', () => {
    expect(dueIn("2026-12-11", TODAY)).toBe("in 25 days");
    expect(dueIn("2026-12-18", TODAY)).toBe("in 32 days");
    expect(dueIn("2026-12-30", TODAY)).toBe("in 44 days");
    expect(dueIn("2026-12-31", TODAY)).toBe("in 1 month");
    expect(dueIn("2027-01-22", TODAY)).toBe("in 2 months");
    expect(dueIn("2027-02-12", TODAY)).toBe("in 3 months");
    expect(dueIn("2027-07-30", TODAY)).toBe("in 8 months");
  });
});
