import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";

import { api, errorMessage } from "../../api/client";
import { today } from "../../lib/dates";
import { type Deal, keys, refreshAfterSave } from "../api";
import { ReopenDialog } from "../components/ReopenDialog";
import { applyMove } from "../lib/board";
import { STAGE_LABEL, type Stage, isClosed } from "../lib/stages";

/** For a move that waits for the reopen dialog. */
export type MoveOptions = {
  /** When the dialog closes, by Reopen or Cancel, after a Reopen's move is in the cache. */
  onDialogClose?: () => void;
  /** Puts focus back once the dialog has closed, since the menu item that opened it is gone. */
  refocus?: () => void;
};

type Pending = { deal: Deal; stage: Stage; beforeId: number | null; options: MoveOptions };

/**
 * Moves deals for the board and the deal page. The cached deals change first,
 * so cards and totals move at once; the server's reply then refreshes
 * everything. If the server refuses, the cache goes back and a message says
 * why. A move out of Won or Lost asks for a new close date first.
 */
export function useDealMover() {
  const queryClient = useQueryClient();
  const [reopening, setReopening] = useState<Pending | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // Radix moves focus after the dialog has gone, when `reopening` is already
  // cleared, so the way back is kept here.
  const refocusAfterDialog = useRef<(() => void) | undefined>(undefined);

  function send(deal: Deal, stage: Stage, beforeId: number | null, closeDate: string | null = null) {
    const previous = queryClient.getQueryData<Deal[]>(keys.deals);
    const previousDeal = queryClient.getQueryData<Deal>(keys.deal(deal.id));
    void queryClient.cancelQueries({ queryKey: keys.deals });
    const move = { dealId: deal.id, stage, beforeId, closeDate };
    const next = applyMove(previous ?? [deal], move, today());
    if (previous) queryClient.setQueryData(keys.deals, next);
    if (previousDeal) queryClient.setQueryData(keys.deal(deal.id), next.find((d) => d.id === deal.id));

    const changed = stage !== deal.stage;
    if (changed) setAnnouncement(`Moved ${deal.name} to ${STAGE_LABEL[stage]}`);

    api
      .post<Deal>(`/deals/${deal.id}/move`, { stage, before_id: beforeId, close_date: closeDate })
      .then(() => {
        if (changed && isClosed(stage)) toast.success(`Moved to ${STAGE_LABEL[stage]}. Close date set to today.`);
      })
      .catch((error) => {
        if (previous) queryClient.setQueryData(keys.deals, previous);
        if (previousDeal) queryClient.setQueryData(keys.deal(deal.id), previousDeal);
        setAnnouncement(`${deal.name} wasn't moved. ${errorMessage(error)}`);
        toast.error(`${deal.name} wasn't moved. ${errorMessage(error)}`);
      })
      .finally(() => {
        void refreshAfterSave(queryClient);
      });
  }

  /** Returns false when it's waiting for the reopen dialog. */
  function request(deal: Deal, stage: Stage, beforeId: number | null, options: MoveOptions = {}): boolean {
    if (isClosed(deal.stage) && !isClosed(stage)) {
      refocusAfterDialog.current = options.refocus;
      setReopening({ deal, stage, beforeId, options });
      return false;
    }
    send(deal, stage, beforeId);
    return true;
  }

  /** Reopen with the date given, or cancel with null. Either way the dialog closes. */
  function finish(closeDate: string | null) {
    if (!reopening) return;
    if (closeDate) send(reopening.deal, reopening.stage, reopening.beforeId, closeDate);
    reopening.options.onDialogClose?.();
    setReopening(null);
  }

  const dialog: ReactNode = (
    <ReopenDialog
      open={reopening !== null}
      dealName={reopening?.deal.name ?? ""}
      stage={reopening?.stage ?? "new"}
      onReopen={(closeDate) => finish(closeDate)}
      onCancel={() => finish(null)}
      onCloseAutoFocus={(event) => {
        const refocus = refocusAfterDialog.current;
        refocusAfterDialog.current = undefined;
        if (refocus) {
          event.preventDefault();
          refocus();
        }
      }}
    />
  );

  return { request, dialog, announcement };
}
