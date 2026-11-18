import { addDays } from "date-fns";
import { useEffect, useRef, useState } from "react";

import { DialogBody, DialogFooter, FormDialog } from "../../components/dialogs/FormDialog";
import { TextField } from "../../components/fields/Field";
import { toISODate, today } from "../../lib/dates";
import { STAGE_LABEL, type Stage } from "../lib/stages";

type Props = {
  open: boolean;
  dealName: string;
  stage: Stage;
  onReopen: (closeDate: string) => void;
  onCancel: () => void;
  /** See FormDialog: for putting focus back when the menu that opened this is gone. */
  onCloseAutoFocus?: (event: Event) => void;
};

// Moving a Won or Lost deal back to an open stage asks for a new expected
// close date, 30 days from today by default, so it doesn't show as late.
export function ReopenDialog({ open, dealName, stage, onReopen, onCancel, onCloseAutoFocus }: Props) {
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !next && onCancel()}
      title={`Reopen ${dealName}`}
      description={`It moves to ${STAGE_LABEL[stage]}. Choose when you now expect it to close.`}
      width={460}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <ReopenFields onReopen={onReopen} />
    </FormDialog>
  );
}

function ReopenFields({ onReopen }: { onReopen: (closeDate: string) => void }) {
  const [value, setValue] = useState(toISODate(addDays(today(), 30)));
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  return (
    <form
      noValidate
      className="flex min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (!value) {
          setError("Enter a close date.");
          input.current?.focus();
          return;
        }
        onReopen(value);
      }}
    >
      <DialogBody>
        <TextField
          ref={input}
          label="New expected close date"
          type="date"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          error={error ?? undefined}
        />
      </DialogBody>
      <DialogFooter submitLabel="Reopen" />
    </form>
  );
}
