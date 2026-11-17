// The deal rules the browser repeats to show results at once: late deals,
// the board's 30-day window, expected revenue and totals, and how soon a deal
// is due. The server's answer is final. shared/crm-rule-cases.json holds the
// cases both sides are tested against.

import { addDays } from "date-fns";

import { type DateInput, daysBetween, parseDate } from "../../lib/dates";
import { OPEN_STAGES, STAGES, type Stage, isClosed, isOpen } from "./stages";

type Money = { value: number; probability: number };
type Dated = { stage: Stage; close_date: DateInput };

/**
 * value x probability / 100, in whole dollars with halves rounding up.
 * Worked out in whole numbers (BigInt), so large values pick up no
 * floating-point errors, exactly as the backend does.
 */
export function expectedRevenue(value: number, probability: number): number {
  return Number((BigInt(value) * BigInt(probability) + 50n) / 100n);
}

/** Totals add each deal's rounded amount, so they equal the sum of the parts. */
export function totalExpected(deals: Money[]): number {
  return deals.reduce((sum, d) => sum + expectedRevenue(d.value, d.probability), 0);
}

export function totalValue(deals: { value: number }[]): number {
  return deals.reduce((sum, d) => sum + d.value, 0);
}

/** An open deal whose close date is before today. Due today isn't late. */
export function isLate(deal: Dated, today: Date): boolean {
  return isOpen(deal.stage) && parseDate(deal.close_date) < parseDate(today);
}

/** Open deals always; Won and Lost only when closed in the last 30 days. */
export function onBoard(deal: Dated, today: Date): boolean {
  if (!isClosed(deal.stage)) return true;
  return parseDate(deal.close_date) >= addDays(parseDate(today), -30);
}

export type ColumnTotals = { count: number; value: number; expected: number };

export type BoardTotals = {
  /** The board's figures count open deals only. */
  open: ColumnTotals & { late: number };
  columns: Record<Stage, ColumnTotals>;
};

/** Totals for the deals on the board, which should already be in the 30-day window. */
export function boardTotals<T extends Dated & Money>(deals: T[], today: Date): BoardTotals {
  const columns = Object.fromEntries(
    STAGES.map((stage) => {
      const inColumn = deals.filter((d) => d.stage === stage);
      return [stage, { count: inColumn.length, value: totalValue(inColumn), expected: totalExpected(inColumn) }];
    }),
  ) as Record<Stage, ColumnTotals>;
  const open = deals.filter((d) => OPEN_STAGES.includes(d.stage));
  return {
    open: {
      count: open.length,
      value: totalValue(open),
      expected: totalExpected(open),
      late: open.filter((d) => isLate(d, today)).length,
    },
    columns,
  };
}

/** "in 25 days" under 45 days, then "in 3 months", rounded to whole months. */
export function dueIn(closeDate: DateInput, today: Date): string {
  const days = daysBetween(today, closeDate);
  if (days <= 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days < 45) return `in ${days} days`;
  const months = Math.round(days / 30.44);
  return months === 1 ? "in 1 month" : `in ${months} months`;
}
