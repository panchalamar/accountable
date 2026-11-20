import { Plus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "../../components/layout/PageHeader";
import { today as todayDate } from "../../lib/dates";
import { formatMoney } from "../../lib/money";
import { useDeals } from "../api";
import { Board } from "../board/Board";
import { useDealMover } from "../board/useDealMover";
import { DealForm } from "../forms/DealForm";
import { boardTotals, onBoard } from "../lib/deals";
import type { Stage } from "../lib/stages";
import { LoadFailed, Loading } from "./layout";

export function PipelinePage() {
  const deals = useDeals();
  const mover = useDealMover();
  const [adding, setAdding] = useState<{ stage?: Stage } | null>(null);
  const today = todayDate();

  if (deals.isError) {
    return (
      <LoadFailed error={deals.error} title="Pipeline" backTo="/" backLabel="Go to the dashboard" />
    );
  }
  const onTheBoard = (deals.data ?? []).filter((d) => onBoard(d, today));
  const totals = boardTotals(onTheBoard, today);
  const late = totals.open.late;

  // 24px at the bottom, since each column's cards already leave 24px to drop
  // below the last one: 48px in all, as in the mockup.
  return (
    <div className="px-8 pb-6 pt-7">
      <PageHeader
        title="Pipeline"
        context={
          deals.data ? (
            <p aria-live="polite">
              <span className="num font-semibold text-ink">{formatMoney(totals.open.value)}</span>{" "}
              open across {totals.open.count} {totals.open.count === 1 ? "deal" : "deals"}, with{" "}
              <span className="num font-semibold text-ink">
                {formatMoney(totals.open.expected)}
              </span>{" "}
              expected.{" "}
              {late === 0 ? "None are late." : late === 1 ? "1 is late." : `${late} are late.`}
            </p>
          ) : null
        }
        actions={
          <button type="button" className="btn btn-primary h-[42px]" onClick={() => setAdding({})}>
            <Plus size={18} aria-hidden="true" />
            Add deal
          </button>
        }
      />
      {!deals.data ? (
        <Loading what="the pipeline" />
      ) : (
        <Board
          deals={onTheBoard}
          totals={totals}
          today={today}
          onAdd={(stage) => setAdding({ stage })}
          onMove={mover.request}
        />
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {mover.announcement}
      </p>
      {mover.dialog}
      {adding ? (
        <DealForm open onOpenChange={(open) => !open && setAdding(null)} stage={adding.stage} />
      ) : null}
    </div>
  );
}
