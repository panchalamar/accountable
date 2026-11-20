// Turns the dashboard's figures into rows for the "Revenue won, and what's
// due to close" chart: 12 past months, then the forecast slots, on one
// category axis keyed by each row's unique key ("2025-12", "late", "2026-12").

import type { Dashboard, Slot } from "../api";
import { OPEN_STAGES, type Stage } from "../lib/stages";

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]; // fmt: skip

export type PastRow = {
  kind: "past";
  key: string;
  label: string;
  year: number;
  showYear: boolean;
  won: number;
  wonCount: number;
};

export type FutureRow = {
  kind: Slot["kind"] | "none";
  key: string;
  label: string;
  year: number | null;
  showYear: boolean;
  total: number;
  count: number;
  deals: Slot["deals"];
} & Record<Stage, number>;

export type ChartRow = PastRow | FutureRow;

export function chartRows(data: Dashboard): ChartRow[] {
  const past: PastRow[] = data.months.map((m, i) => ({
    kind: "past",
    key: m.month,
    label: m.label,
    year: m.year,
    showYear: i === 0 || m.label === "Jan",
    won: m.won_value,
    wonCount: m.won_count,
  }));
  const future: FutureRow[] = data.forecast.slots.map((s) => {
    const year = s.month ? Number(s.month.slice(0, 4)) : null;
    const row = {
      kind: s.kind,
      key: s.key,
      label: s.label,
      year,
      showYear: s.kind === "month" && s.label === "Jan",
      total: s.value,
      count: s.count,
      deals: s.deals,
    } as FutureRow;
    for (const stage of OPEN_STAGES) row[stage] = s.by_stage[stage] ?? 0;
    return row;
  });
  // With no open deals, one empty slot holds the "No open deals" note.
  if (future.length === 0) {
    const empty = {
      kind: "none",
      key: "none",
      label: "",
      year: null,
      showYear: false,
      total: 0,
      count: 0,
      deals: [],
    } as unknown as FutureRow;
    for (const stage of OPEN_STAGES) empty[stage] = 0;
    future.push(empty);
  }
  return [...past, ...future];
}

/** Round axis steps, with the top tick above the biggest value. */
export function moneyTicks(max: number): number[] {
  const steps = [
    100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000,
  ];
  const step = steps.find((s) => max / s <= 4) ?? Math.ceil(max / 4 / 10_000_000) * 10_000_000;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return ticks;
}

/** Which rows get a value label: the best and latest months, the Late bar and the biggest month ahead. */
export function labelledKeys(rows: ChartRow[]): Set<string> {
  const keys = new Set<string>();
  const past = rows.filter((r): r is PastRow => r.kind === "past");
  const best = past.reduce((a, b) => (b.won > a.won ? b : a), past[0]);
  if (best && best.won > 0) keys.add(best.key);
  const latest = past[past.length - 1];
  if (latest && latest.won > 0) keys.add(latest.key);
  const future = rows.filter((r): r is FutureRow => r.kind !== "past" && r.kind !== "none");
  const late = future.find((r) => r.kind === "late");
  if (late) keys.add(late.key);
  const ahead = future.filter((r) => r.kind !== "late");
  const biggest = ahead.reduce<FutureRow | null>((a, b) => (!a || b.total > a.total ? b : a), null);
  if (biggest && biggest.total > 0) keys.add(biggest.key);
  return keys;
}

/** "December 2025", or the slot's own name. */
export function longLabel(row: ChartRow): string {
  if (row.kind === "past" || row.kind === "month") {
    const [y, m] = row.key.split("-").map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  }
  return row.label;
}
