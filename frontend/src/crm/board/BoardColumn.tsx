import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import { formatMoney } from "../../lib/money";
import type { Deal } from "../api";
import type { ColumnTotals } from "../lib/deals";
import { STAGES, STAGE_LABEL, STAGE_STYLE, type Stage, isOpen } from "../lib/stages";
import { DealCard } from "./DealCard";

type Props = {
  stage: Stage;
  deals: Deal[];
  totals: ColumnTotals;
  today: Date;
  onAdd: (stage: Stage) => void;
  onStage: (deal: Deal, stage: Stage) => void;
  focusId: number | null;
  onFocusTaken: () => void;
};

export const columnId = (stage: Stage) => `column:${stage}`;

// One column: an arrow-shaped header in the stage color, an outlined Add
// deal button, then the cards.
export function BoardColumn({
  stage,
  deals,
  totals,
  today,
  onAdd,
  onStage,
  focusId,
  onFocusTaken,
}: Props) {
  const { setNodeRef } = useDroppable({ id: columnId(stage) });
  const style = STAGE_STYLE[stage];
  const first = STAGES.indexOf(stage) === 0;
  const label = STAGE_LABEL[stage];
  return (
    <section
      className="min-w-0"
      aria-label={`${label}, ${totals.count} ${totals.count === 1 ? "deal" : "deals"}`}
    >
      <header
        className={`py-3 pb-[13px] ${first ? "rounded-l-[12px] pl-4 pr-[26px]" : "pl-6 pr-[26px]"}`}
        style={{
          background: style.chip,
          color: style.chipText,
          clipPath: first
            ? "polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%)"
            : "polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%, 16px 50%)",
        }}
      >
        <h2 className="flex items-center justify-between gap-2 text-[15px] font-semibold">
          {label}
          <span className="num text-[12.5px] font-semibold">
            {totals.count}
            <span className="sr-only"> {totals.count === 1 ? "deal" : "deals"}</span>
          </span>
        </h2>
        <p className="num mt-0.5 text-[17px] font-semibold tracking-[-0.01em]">
          {formatMoney(totals.value)}
        </p>
        <p className="whitespace-nowrap text-[12.5px]">
          {isOpen(stage) ? (
            <>
              Expected <span className="num">{formatMoney(totals.expected)}</span>
            </>
          ) : (
            "Closed in the last 30 days"
          )}
        </p>
      </header>
      <button
        type="button"
        onClick={() => onAdd(stage)}
        aria-label={`Add deal to ${label}`}
        className="mb-2 mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] text-[13.5px] font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--outline-soft)] transition-colors hover:bg-panel hover:shadow-none"
      >
        <Plus size={16} aria-hidden="true" className="text-ink-muted" />
        Add deal
      </button>
      <SortableContext
        id={columnId(stage)}
        items={deals.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <ol
          ref={setNodeRef}
          className="flex min-h-[120px] flex-col gap-2 pb-6"
          aria-label={`${label} deals`}
        >
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              today={today}
              onStage={onStage}
              takeFocus={focusId === deal.id}
              onFocusTaken={onFocusTaken}
            />
          ))}
        </ol>
      </SortableContext>
    </section>
  );
}
