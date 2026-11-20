// Search and sort for the tables, which load every record and work in the
// browser.

/** True when any of the row's shown text contains the search, ignoring case. */
export function matchesSearch(
  shownText: Array<string | null | undefined>,
  search: string,
): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return shownText.some((text) => (text ?? "").toLowerCase().includes(needle));
}

export type SortValue = string | number | null | undefined;

/**
 * Compares two sort values. Numbers, money and dates are given as numbers (or
 * ISO dates, which sort as text in date order), so they never sort as words.
 * Blanks go last either way.
 */
export function compareValues(a: SortValue, b: SortValue): number {
  const aBlank = a === null || a === undefined || a === "";
  const bBlank = b === null || b === undefined || b === "";
  if (aBlank || bBlank) return aBlank === bBlank ? 0 : aBlank ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en", { sensitivity: "base", numeric: true });
}

/** Sorts a copy of the rows by one column. Blanks stay last in both directions. */
export function sortRows<T>(rows: T[], value: (row: T) => SortValue, desc = false): T[] {
  return [...rows].sort((x, y) => {
    const a = value(x);
    const b = value(y);
    const aBlank = a === null || a === undefined || a === "";
    const bBlank = b === null || b === undefined || b === "";
    if (aBlank || bBlank) return compareValues(a, b);
    const result = compareValues(a, b);
    return desc ? -result : result;
  });
}

/** "12 of 36 contacts", or "36 contacts" when nothing is filtered out. */
export function countLabel(shown: number, total: number, one: string, many: string): string {
  const noun = total === 1 ? one : many;
  return shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`;
}
