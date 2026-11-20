import { describe, expect, it } from "vitest";

import { formatDate } from "./dates";
import { formatMoney } from "./money";
import { countLabel, matchesSearch, sortRows } from "./table";

describe("table search", () => {
  it("ignores case and matches any shown text, such as the organization or a formatted amount", () => {
    const shown = [
      "Steel supply agreement 2027",
      "Northwind Metals",
      formatMoney(950000),
      formatDate("2026-12-11"),
    ];
    expect(matchesSearch(shown, "NORTHWIND")).toBe(true);
    expect(matchesSearch(shown, "$950,000")).toBe(true);
    expect(matchesSearch(shown, "dec 11")).toBe(true);
    expect(matchesSearch(shown, "acme")).toBe(false);
    expect(matchesSearch(shown, "   ")).toBe(true);
    expect(matchesSearch([null, undefined, "x"], "x")).toBe(true);
  });

  it("counts the rows shown", () => {
    expect(countLabel(12, 36, "contact", "contacts")).toBe("12 of 36 contacts");
    expect(countLabel(36, 36, "contact", "contacts")).toBe("36 contacts");
  });
});

describe("table sort", () => {
  const deals = [
    { name: "a", value: 90000, close: "2026-12-01" },
    { name: "b", value: 1000000, close: "2027-01-15" },
    { name: "c", value: 250000, close: "2026-02-28" },
  ];

  it("sorts money as numbers, not text", () => {
    expect(sortRows(deals, (d) => d.value).map((d) => d.value)).toEqual([90000, 250000, 1000000]);
    // As text, "$90,000" would come after "$250,000".
    expect(sortRows(deals, (d) => formatMoney(d.value)).map((d) => d.name)).not.toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(sortRows(deals, (d) => d.value, true).map((d) => d.name)).toEqual(["b", "c", "a"]);
  });

  it("sorts dates as dates", () => {
    expect(sortRows(deals, (d) => d.close).map((d) => d.name)).toEqual(["c", "a", "b"]);
    // As shown text, "Dec 1, 2026" would sort before "Feb 28, 2026".
    expect(sortRows(deals, (d) => d.close, true).map((d) => d.name)).toEqual(["b", "a", "c"]);
  });

  it("keeps blanks last both ways", () => {
    const rows = [{ v: "b" }, { v: "" }, { v: "a" }];
    expect(sortRows(rows, (r) => r.v).map((r) => r.v)).toEqual(["a", "b", ""]);
    expect(sortRows(rows, (r) => r.v, true).map((r) => r.v)).toEqual(["b", "a", ""]);
  });
});
