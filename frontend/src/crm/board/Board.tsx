import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  type UniqueIdentifier,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useCallback, useMemo, useState } from "react";

import type { Deal } from "../api";
import type { BoardTotals } from "../lib/deals";
import { topCardId } from "../lib/board";
import { STAGES, STAGE_LABEL, type Stage } from "../lib/stages";
import { BoardColumn } from "./BoardColumn";
import { DealCardBody } from "./DealCard";

type Columns = Record<Stage, number[]>;

type Props = {
  /** The deals on the board, in board order. */
  deals: Deal[];
  totals: BoardTotals;
  today: Date;
  onAdd: (stage: Stage) => void;
  /** Moves a deal. Returns false when it waits for the reopen dialog, whose Cancel calls onCancel. */
  onMove: (deal: Deal, stage: Stage, beforeId: number | null, onCancel?: () => void) => boolean;
};

function columnsOf(deals: Deal[]): Columns {
  return Object.fromEntries(STAGES.map((s) => [s, deals.filter((d) => d.stage === s).map((d) => d.id)])) as Columns;
}

// The board: six columns with dnd-kit's sortable pattern for several
// containers. While a card is dragged, a local copy of the columns moves it,
// so a gap opens where it will land; on drop, the move goes to the cache and
// the server.
export function Board({ deals, totals, today, onAdd, onMove }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [dragging, setDragging] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);

  const byId = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);
  const columns = dragging ?? columnsOf(deals);

  const findStage = useCallback(
    (id: UniqueIdentifier | undefined): Stage | null => {
      if (id === undefined) return null;
      if (typeof id === "string" && id.startsWith("column:")) return id.slice(7) as Stage;
      return (STAGES.find((s) => columns[s].includes(Number(id))) as Stage) ?? null;
    },
    [columns],
  );

  function onDragStart(event: DragStartEvent) {
    setActiveId(Number(event.active.id));
    setDragging(columnsOf(deals));
  }

  function onDragOver({ active, over }: DragOverEvent) {
    const from = findStage(active.id);
    const to = findStage(over?.id);
    if (!from || !to || from === to || !over) return;
    setDragging((current) => {
      const prev = current ?? columnsOf(deals);
      const target = prev[to].filter((id) => id !== Number(active.id));
      const overIndex = target.indexOf(Number(over.id));
      let index = target.length;
      if (overIndex >= 0) {
        const below =
          active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
        index = overIndex + (below ? 1 : 0);
      }
      target.splice(index, 0, Number(active.id));
      return { ...prev, [from]: prev[from].filter((id) => id !== Number(active.id)), [to]: target };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const deal = byId.get(Number(active.id));
    const to = findStage(over?.id);
    setActiveId(null);
    if (!deal || !to || !dragging || !over) {
      setDragging(null);
      return;
    }
    let column = dragging[to];
    const oldIndex = column.indexOf(deal.id);
    const overIndex = column.indexOf(Number(over.id));
    if (overIndex >= 0 && oldIndex !== overIndex) column = arrayMove(column, oldIndex, overIndex);
    const at = column.indexOf(deal.id);
    const beforeId = column[at + 1] ?? null;

    const original = columnsOf(deals)[deal.stage];
    const unchanged = to === deal.stage && original[original.indexOf(deal.id) + 1] === (beforeId ?? undefined);
    if (unchanged) {
      setDragging(null);
      return;
    }
    // Show the card where it was dropped while the reopen dialog asks; Cancel puts it back.
    setDragging({ ...dragging, [to]: column });
    const sent = onMove(deal, to, beforeId, () => setDragging(null));
    if (sent) setDragging(null);
  }

  // The stage menu moves a card to the top of the chosen column, and keeps focus on it.
  function onStage(deal: Deal, stage: Stage) {
    const sent = onMove(deal, stage, topCardId(deals, stage, deal.id));
    if (sent) setFocusId(deal.id);
  }

  const nameOf = (id: UniqueIdentifier) => byId.get(Number(id))?.name ?? "the deal";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) => {
      const stage = findStage(over?.id);
      return stage ? `${nameOf(active.id)} is over ${STAGE_LABEL[stage]}.` : `${nameOf(active.id)} is no longer over a column.`;
    },
    onDragEnd: ({ active, over }) => {
      const stage = findStage(over?.id);
      return stage ? `Dropped ${nameOf(active.id)} in ${STAGE_LABEL[stage]}.` : `Dropped ${nameOf(active.id)}.`;
    },
    onDragCancel: ({ active }) => `Stopped dragging ${nameOf(active.id)}. It's back where it was.`,
  };

  const active = activeId !== null ? byId.get(activeId) : undefined;
  const visible = (stage: Stage) => columns[stage].map((id) => byId.get(id)).filter(Boolean) as Deal[];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setDragging(null);
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "Drag with a pointer, or use the card's Stage button to move it with the keyboard.",
        },
      }}
    >
      <div className="grid grid-cols-6 items-start gap-2.5">
        {STAGES.map((stage) => (
          <BoardColumn
            key={stage}
            stage={stage}
            deals={visible(stage)}
            totals={totals.columns[stage]}
            today={today}
            onAdd={onAdd}
            onStage={onStage}
            focusId={focusId}
            onFocusTaken={() => setFocusId(null)}
          />
        ))}
      </div>
      <DragOverlay>{active ? <DealCardBody deal={active} today={today} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

