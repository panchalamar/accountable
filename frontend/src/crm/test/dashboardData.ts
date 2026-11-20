import type { Dashboard, Slot } from "../api";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 12 past months ending November 2026, each with the given wins. */
export function pastMonths(won: [value: number, count: number][]): Dashboard["months"] {
  return won.map(([value, count], i) => {
    const date = new Date(2025, 11 + i, 1);
    const month = date.getMonth();
    return {
      month: `${date.getFullYear()}-${String(month + 1).padStart(2, "0")}`,
      label: MONTHS[month],
      year: date.getFullYear(),
      won_value: value,
      won_count: count,
    };
  });
}

export function slot(overrides: Partial<Slot> & Pick<Slot, "key" | "kind" | "label">): Slot {
  return {
    month: null,
    count: 0,
    value: 0,
    expected: 0,
    by_stage: {},
    deals: [],
    ...overrides,
  };
}

/** A dashboard with a year of wins and a few open deals. Override any part. */
export function dashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  const months = pastMonths([
    [100000, 1],
    [0, 0],
    [250000, 2],
    [300000, 1],
    [0, 0],
    [120000, 1],
    [400000, 3],
    [90000, 1],
    [0, 0],
    [210000, 2],
    [150000, 1],
    [180000, 2],
  ]);
  return {
    today: "2026-11-20",
    figures: {
      open_pipeline: { value: 900000, count: 4, late_count: 1, late_value: 200000 },
      expected_revenue: 400000,
      won_this_month: { value: 180000, count: 2 },
      won_last_month: { value: 150000, count: 1 },
      won_12_months: { value: 1800000, count: 14, months_with_wins: 9 },
    },
    months,
    forecast: {
      none_open: false,
      slots: [
        slot({
          key: "late",
          kind: "late",
          label: "Late",
          count: 1,
          value: 200000,
          by_stage: { negotiation: 200000 },
          deals: [
            {
              id: 1,
              name: "Late deal",
              stage: "negotiation",
              value: 200000,
              close_date: "2026-10-01",
            },
          ],
        }),
        slot({
          key: "rest",
          kind: "rest",
          label: "Rest of Nov",
          count: 1,
          value: 300000,
          by_stage: { proposal: 300000 },
          deals: [
            {
              id: 2,
              name: "Soon deal",
              stage: "proposal",
              value: 300000,
              close_date: "2026-11-28",
            },
          ],
        }),
        slot({
          key: "2027-01",
          kind: "month",
          label: "Jan",
          month: "2027-01",
          count: 2,
          value: 400000,
          by_stage: { new: 150000, qualified: 250000 },
          deals: [
            { id: 3, name: "New deal", stage: "new", value: 150000, close_date: "2027-01-10" },
            {
              id: 4,
              name: "Qual deal",
              stage: "qualified",
              value: 250000,
              close_date: "2027-01-20",
            },
          ],
        }),
      ],
    },
    stages: [
      { stage: "new", count: 1, value: 150000, expected: 15000 },
      { stage: "qualified", count: 1, value: 250000, expected: 50000 },
      { stage: "proposal", count: 1, value: 300000, expected: 150000 },
      { stage: "negotiation", count: 1, value: 200000, expected: 185000 },
    ],
    funnel: [
      { stage: "new", count: 10, value: 1000000 },
      { stage: "qualified", count: 8, value: 800000 },
      { stage: "proposal", count: 5, value: 500000 },
      { stage: "negotiation", count: 3, value: 300000 },
      { stage: "won", count: 1, value: 100000 },
    ],
    follow_ups: { overdue: [], upcoming: [] },
    recent: [],
    ...overrides,
  };
}
