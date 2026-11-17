// A move applied to the cached deals, so the board changes at once while the
// server catches up. It follows the server's rules (rules.py's _change_stage
// and placement). The cached list is in board order: by stage, then position.

import { toISODate } from "../../lib/dates";
import type { Deal } from "../api";
import { FUNNEL_STAGES, STAGES, STAGE_PROBABILITY, type Stage, isClosed } from "./stages";

export type Move = {
  dealId: number;
  stage: Stage;
  /** The card it now sits above, or null for the bottom of the column. */
  beforeId: number | null;
  /** Required when reopening from Won or Lost. */
  closeDate?: string | null;
};

function furtherStage(furthest: Stage, stage: Stage): Stage {
  if (!FUNNEL_STAGES.includes(stage)) return furthest;
  return FUNNEL_STAGES.indexOf(stage) > FUNNEL_STAGES.indexOf(furthest) ? stage : furthest;
}

/** The deals after the move. The list passed in is left as it was, for undoing. */
export function applyMove(deals: Deal[], move: Move, today: Date): Deal[] {
  const deal = deals.find((d) => d.id === move.dealId);
  if (!deal) return deals;

  let moved: Deal = deal;
  if (move.stage !== deal.stage) {
    moved = {
      ...deal,
      stage: move.stage,
      probability: STAGE_PROBABILITY[move.stage],
      furthest_stage: furtherStage(deal.furthest_stage, move.stage),
    };
    if (isClosed(move.stage)) moved.close_date = toISODate(today);
    else if (isClosed(deal.stage) && move.closeDate) moved.close_date = move.closeDate;
  }

  const columns = STAGES.map((stage) => deals.filter((d) => d.stage === stage && d.id !== deal.id));
  const target = columns[STAGES.indexOf(move.stage)];
  const at = move.beforeId === null ? -1 : target.findIndex((d) => d.id === move.beforeId);
  target.splice(at === -1 ? target.length : at, 0, moved);

  // Positions from 0 with no gaps, as the server renumbers them.
  return columns.flatMap((column) =>
    column.map((d, position) => (d.position === position ? d : { ...d, position })),
  );
}

/** The top card of a column, which the stage menu moves a card above. */
export function topCardId(deals: Deal[], stage: Stage, except?: number): number | null {
  return deals.find((d) => d.stage === stage && d.id !== except)?.id ?? null;
}
