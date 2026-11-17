import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { ApiError, errorMessage } from "../../api/client";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import { type DeleteCheck, type RecordKind, deleteRecord, fetchDeleteCheck, keys, refreshAfterSave } from "../api";

type Props = {
  kind: Exclude<RecordKind, "activity">;
  id: number;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After a delete, before the lists refresh. A record's own page goes back to its table here. */
  onDeleted?: () => void;
};

const NOUN = { organization: "organization", contact: "contact", deal: "deal" } as const;

// Reads the delete check from the server just before opening, and says what
// will happen. When the rules don't allow the delete, it offers only Close.
export function DeleteDialog({ kind, id, name, open, onOpenChange, onDeleted }: Props) {
  const queryClient = useQueryClient();
  const [refusal, setRefusal] = useState<DeleteCheck | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useQuery({
    queryKey: keys.deleteCheck(kind, id),
    queryFn: () => fetchDeleteCheck(kind, id),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const shown = refusal ?? check.data;

  function close(next: boolean) {
    if (!next) setRefusal(null);
    onOpenChange(next);
  }

  async function confirm() {
    setBusy(true);
    try {
      await deleteRecord(kind, id);
      close(false);
      onDeleted?.();
      queryClient.removeQueries({ queryKey: [...keys.all, kind, id] });
      toast.success(`Deleted ${name}.`);
      await refreshAfterSave(queryClient);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const deals = (error.details.deals as DeleteCheck["blocking_deals"]) ?? [];
        setRefusal({ can_delete: false, message: error.message, blocking_deals: deals });
      } else {
        toast.error(errorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  let body;
  if (check.isError) {
    body = <p>{errorMessage(check.error)}</p>;
  } else if (!shown) {
    body = null;
  } else {
    body = (
      <>
        <p>{shown.message}</p>
        {shown.blocking_deals && shown.blocking_deals.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {shown.blocking_deals.map((deal) => (
              <li key={deal.id}>
                <Link to={`/deals/${deal.id}`} className="link" onClick={() => close(false)}>
                  {deal.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </>
    );
  }

  const allowed = Boolean(shown?.can_delete) && !check.isError;
  return (
    <ConfirmDialog
      // Opens once the check has arrived, so it never shows half a message.
      open={open && Boolean(shown || check.isError)}
      onOpenChange={close}
      title={allowed || !shown ? `Delete ${name}?` : `${name} can't be deleted`}
      confirmLabel={allowed ? `Delete ${NOUN[kind]}` : undefined}
      onConfirm={confirm}
      busy={busy}
    >
      {body}
    </ConfirmDialog>
  );
}
