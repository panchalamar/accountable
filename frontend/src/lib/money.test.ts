import { describe, expect, it } from "vitest";

import { formatMoney, formatMoneyAxis, formatMoneyShort } from "./money";

describe("money", () => {
  it("shows full amounts with the currency", () => {
    expect(formatMoney(250000)).toBe("$250,000");
    expect(formatMoney(0)).toBe("$0");
    expect(formatMoney(9040000)).toBe("$9,040,000");
  });

  it("shows short amounts where space is short", () => {
    expect(formatMoneyShort(520000)).toBe("$520K");
    expect(formatMoneyShort(250000)).toBe("$250K");
    expect(formatMoneyShort(1200000)).toBe("$1.2M");
    expect(formatMoneyShort(9040000)).toBe("$9.0M");
    expect(formatMoneyShort(1980000)).toBe("$2.0M");
    expect(formatMoneyShort(999_600)).toBe("$1.0M");
    expect(formatMoneyShort(0)).toBe("$0");
  });

  it("drops a trailing .0 on chart axes", () => {
    expect(formatMoneyAxis(1000000)).toBe("$1M");
    expect(formatMoneyAxis(1500000)).toBe("$1.5M");
    expect(formatMoneyAxis(500000)).toBe("$500K");
  });
});
