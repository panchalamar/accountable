import { describe, expect, it } from "vitest";

import { followUpTiming } from "./followups";

describe("follow-up timing", () => {
  it("says how late or how soon", () => {
    expect(followUpTiming(-9)).toEqual({ text: "9 days overdue", tone: "overdue" });
    expect(followUpTiming(-1)).toEqual({ text: "1 day overdue", tone: "overdue" });
    expect(followUpTiming(0)).toEqual({ text: "Due today", tone: "today" });
    expect(followUpTiming(1)).toEqual({ text: "Due tomorrow", tone: "soon" });
    expect(followUpTiming(3)).toEqual({ text: "Due in 3 days", tone: "soon" });
  });
});
