// Every case in shared/crm-rule-cases.json, which pytest checks too, so the
// browser and the server can't drift apart.

import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";

import cases from "../../../../shared/crm-rule-cases.json";
import { toISODate } from "../../lib/dates";
import { expectedRevenue, isLate, totalExpected, totalValue } from "./deals";
import { STAGES, STAGE_LABEL, STAGE_PROBABILITY, type Stage, isOpen } from "./stages";

const TODAY = new Date(2026, 10, 16);

describe("shared rule cases", () => {
  it.each(cases.expectedRevenue)("expected revenue: $why", (c) => {
    expect(expectedRevenue(c.value, c.probability)).toBe(c.expected);
  });

  it.each(cases.totals)("totals: $why", (c) => {
    expect(totalValue(c.deals)).toBe(c.value);
    expect(totalExpected(c.deals)).toBe(c.expected);
  });

  it.each(cases.late)("late: $why", (c) => {
    const close = toISODate(addDays(TODAY, c.closeInDays));
    expect(isLate({ stage: c.stage as Stage, close_date: close }, TODAY)).toBe(c.late);
  });

  it("stage order, labels, probabilities and open or closed match the file", () => {
    expect(cases.stages.map((s) => s.stage)).toEqual(STAGES);
    for (const s of cases.stages) {
      const stage = s.stage as Stage;
      expect(STAGE_PROBABILITY[stage]).toBe(s.probability);
      expect(STAGE_LABEL[stage]).toBe(s.label);
      expect(isOpen(stage)).toBe(s.open);
    }
  });
});
