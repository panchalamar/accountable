import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { useReturnFocus } from "./returnFocus";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  /** The form, with a DialogFooter at its end. It mounts each time the dialog opens. */
  children: ReactNode;
  width?: number;
  /**
   * Where focus goes on closing, when the opener may be gone, such as a menu
   * item. Call `event.preventDefault()` and move focus yourself; otherwise it
   * goes back to whatever had focus when the dialog opened.
   */
  onCloseAutoFocus?: (event: Event) => void;
};

// A form in a dialog. Radix keeps focus inside, closes on Escape and returns
// focus to the button that opened it.
export function FormDialog({ open, onOpenChange, title, description, children, width = 560, onCloseAutoFocus }: Props) {
  const focus = useReturnFocus();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          className="fixed left-1/2 top-[5vh] z-50 flex max-h-[90vh] w-[calc(100vw-48px)] -translate-x-1/2 flex-col rounded-[16px] bg-panel shadow-[0_20px_60px_rgba(7,59,76,0.25)]"
          style={{ maxWidth: width }}
          onOpenAutoFocus={(event) => {
            focus.onOpenAutoFocus();
            // Start on the first field rather than the Close button.
            const first = (event.currentTarget as HTMLElement).querySelector<HTMLElement>(
              "form input:not([type=hidden]):not([readonly]), form select, form textarea",
            );
            if (first) {
              event.preventDefault();
              first.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            if (!event.defaultPrevented) focus.onCloseAutoFocus(event);
          }}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div className="flex items-start justify-between gap-4 px-7 pt-6">
            <div>
              <Dialog.Title className="text-[20px] font-semibold tracking-[-0.01em]">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-[14px] text-ink-muted">{description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close className="btn btn-quiet -mr-2 -mt-1 h-9 w-9 p-0" aria-label="Close">
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The form's body: fields in one column, with a message for the whole form above them. */
export function DialogBody({ children, error }: { children: ReactNode; error?: string | null }) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-7 pb-2 pt-5">
      {error ? (
        <p role="alert" className="rounded-[10px] bg-tint-proposal px-4 py-3 text-[14px] font-medium text-ink">
          {error}
        </p>
      ) : null}
      {children}
    </div>
  );
}

/** While a form's lists load. */
export function LoadingBody() {
  return <p className="px-7 pb-8 pt-5 text-ink-muted">Loading...</p>;
}

/** Cancel, then the main button last, at the bottom right. */
export function DialogFooter({ submitLabel, submitting }: { submitLabel: string; submitting?: boolean }) {
  return (
    <div className="flex justify-end gap-2 px-7 pb-6 pt-5">
      <Dialog.Close className="btn btn-secondary" type="button">
        Cancel
      </Dialog.Close>
      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}
