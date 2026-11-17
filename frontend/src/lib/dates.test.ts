import { describe, expect, it } from "vitest";

import { formatDate, formatLongDate, formatWhen, parseDate, parseDateTime, toISODate } from "./dates";

describe("dates", () => {
  it('formats as "Nov 16, 2026"', () => {
    expect(formatDate("2026-11-16")).toBe("Nov 16, 2026");
    expect(formatLongDate("2026-11-16")).toBe("Monday, Nov 16, 2026");
  });

  it("keeps 2026-11-16 on Nov 16 in Los Angeles, where UTC midnight is the day before", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/Los_Angeles");
    // The mistake this guards against:
    expect(new Date("2026-11-16").getDate()).toBe(15);
    const day = parseDate("2026-11-16");
    expect([day.getFullYear(), day.getMonth(), day.getDate()]).toEqual([2026, 10, 16]);
    expect(toISODate(day)).toBe("2026-11-16");
    expect(formatDate("2026-11-16")).toBe("Nov 16, 2026");
  });

  it("reads times as local times", () => {
    const when = parseDateTime("2026-11-16T11:20:00");
    expect([when.getDate(), when.getHours(), when.getMinutes()]).toEqual([16, 11, 20]);
    expect(formatWhen("2026-11-16T11:20:00", new Date(2026, 10, 16, 15))).toBe("Today, 11:20 AM");
    expect(formatWhen("2026-11-12T15:05:00", new Date(2026, 10, 16, 15))).toBe("Nov 12, 3:05 PM");
  });
});
