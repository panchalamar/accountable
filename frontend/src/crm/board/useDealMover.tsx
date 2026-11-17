import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { api, errorMessage } from "../../api/client";
import { today } from "../../lib/dates";
import { type Deal, keys, refreshAfterSave } from "../api";
import { ReopenDialog } from "../components/ReopenDialog";
import { applyMove } from "../lib/board";
import { STAGE_LABEL, type Stage, isClosed } from "../lib/stages";

type Pending = { deal: Deal; stage: Stage; beforeId: number | null; onCancel?: () => void };

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
  function request(deal: Deal, stage: Stage, beforeId: number | null, onCancel?: () => void): boolean {
    if (isClosed(deal.stage) && !isClosed(stage)) {
      setReopening({ deal, stage, beforeId, onCancel });
      return false;
    }
    send(deal, stage, beforeId);
    return true;
  }

  const dialog: ReactNode = (
    <ReopenDialog
      open={reopening !== null}
      dealName={reopening?.deal.name ?? ""}
      stage={reopening?.stage ?? "new"}
      onReopen={(closeDate) => {
        if (reopening) send(reopening.deal, reopening.stage, reopening.beforeId, closeDate);
        setReopening(null);
      }}
      onCancel={() => {
        reopening?.onCancel?.();
        setReopening(null);
      }}
    />
  );

  return { request, dialog, announcement };
}
