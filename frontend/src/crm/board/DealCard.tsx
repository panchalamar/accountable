import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef } from "react";
import { Link } from "react-router";

import { formatDate } from "../../lib/dates";
import { formatMoney, formatMoneyShort } from "../../lib/money";
import type { Deal } from "../api";
import { LateChip } from "../components/chips";
import { dueIn, isLate } from "../lib/deals";
import { STAGE_STYLE, type Stage, isOpen } from "../lib/stages";
import { StageMenu } from "./StageMenu";

type CardProps = {
  deal: Deal;
  today: Date;
  onStage?: (deal: Deal, stage: Stage) => void;
  /** Put focus on this card's Stage button, after it moved by the menu. */
  takeFocus?: boolean;
  onFocusTaken?: () => void;
  /** The lifted copy that follows the pointer. */
  overlay?: boolean;
};

export function DealCardBody({ deal, today, onStage, takeFocus, onFocusTaken, overlay }: CardProps) {
  const stageButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (takeFocus) {
      stageButton.current?.focus();
      onFocusTaken?.();
    }
  }, [takeFocus, onFocusTaken]);

  const late = isLate(deal, today);
  return (
    <div
      className={`flex min-h-full flex-col rounded-[12px] px-3 pb-2.5 pt-3 ${overlay ? "rotate-[1.5deg] shadow-[0_14px_30px_rgba(7,59,76,0.25)]" : ""}`}
      style={{ background: STAGE_STYLE[deal.stage].tint }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <Link to={`/deals/${deal.id}`} className="min-w-0 text-[14.5px] font-semibold leading-[1.3] text-ink hover:underline">
          {deal.name}
        </Link>
        <span className="num whitespace-nowrap text-[14px] font-semibold">
          <span aria-hidden="true">{formatMoneyShort(deal.value)}</span>
          <span className="sr-only">{formatMoney(deal.value)}</span>
        </span>
      </div>
      <p className="mt-[3px] text-[12.5px] leading-[1.4] text-ink-on-tint">
        {deal.organization.name}, {deal.main_contact.name}
      </p>
      <div className="mt-auto flex items-end justify-between gap-1.5 pt-2.5">
        <p className="flex flex-col items-start gap-[3px] text-[12px] text-ink-on-tint">
          <span className="num whitespace-nowrap">
            {isOpen(deal.stage) ? <span className="sr-only">Due </span> : <span className="sr-only">Closed </span>}
            {formatDate(deal.close_date)}
          </span>
          {late ? <LateChip size="sm" /> : isOpen(deal.stage) ? <span>{dueIn(deal.close_date, today)}</span> : null}
        </p>
        {onStage ? (
          <StageMenu
            ref={stageButton}
            dealName={deal.name}
            stage={deal.stage}
            onChoose={(stage) => onStage(deal, stage)}
            triggerClassName="inline-flex h-[26px] flex-none items-center gap-[3px] rounded-[7px] bg-white/75 pl-[9px] pr-1.5 text-[12px] font-semibold text-ink hover:bg-white"
          />
        ) : (
          <span className="inline-flex h-[26px] items-center rounded-[7px] bg-white/75 px-2 text-[12px] font-semibold">Stage</span>
        )}
      </div>
    </div>
  );
}

/** A card on the board: drag it, or change its stage from its menu. */
export function DealCard(props: CardProps) {
  // Only the pointer drags a card, so dnd-kit's handle attributes (a focusable
  // role="button" around the card's own link and button) are left off. By
  // keyboard, the card's stage menu moves it.
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.deal.id,
    data: { stage: props.deal.stage },
  });
  return (
    <li
      ref={setNodeRef}
      {...listeners}
      data-deal-id={props.deal.id}
      className={`touch-none cursor-grab ${isDragging ? "opacity-40" : ""}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <DealCardBody {...props} />
    </li>
  );
}
