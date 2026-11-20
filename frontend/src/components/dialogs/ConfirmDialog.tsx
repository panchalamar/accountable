import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";

import { useReturnFocus } from "./returnFocus";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  /** The danger button, such as "Delete contact". Leave out to offer only Close. */
  confirmLabel?: string;
  onConfirm?: () => void;
  busy?: boolean;
};

// Asks before something that can't be undone. When the action isn't allowed,
// it offers only Close.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  onConfirm,
  busy,
}: Props) {
  const focus = useReturnFocus();
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <AlertDialog.Content
          {...focus}
          className="fixed left-1/2 top-[18vh] z-50 w-[calc(100vw-48px)] max-w-[520px] -translate-x-1/2 rounded-[16px] bg-panel p-7 shadow-[0_20px_60px_rgba(7,59,76,0.25)]"
        >
          <AlertDialog.Title className="text-[20px] font-semibold tracking-[-0.01em]">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="mt-3 text-[15px] text-ink">{children}</div>
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            {confirmLabel ? (
              <>
                <AlertDialog.Cancel className="btn btn-secondary">Cancel</AlertDialog.Cancel>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={(event) => {
                    event.preventDefault();
                    onConfirm?.();
                  }}
                >
                  {busy ? "Deleting..." : confirmLabel}
                </button>
              </>
            ) : (
              <AlertDialog.Cancel className="btn btn-primary">Close</AlertDialog.Cancel>
            )}
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
