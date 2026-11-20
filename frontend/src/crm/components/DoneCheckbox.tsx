import * as Checkbox from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { errorMessage } from "../../api/client";
import { useSetDone } from "../api";

type Props = {
  id: number;
  done: boolean;
  description: string;
  /** On the dashboard's Midnight column. */
  onDark?: boolean;
  onChange?: (done: boolean) => void;
  /** When the save fails, after its message shows. */
  onError?: () => void;
  elementId?: string;
};

// A follow-up's Done checkbox. Ticking saves at once.
export function DoneCheckbox({
  id,
  done,
  description,
  onDark,
  onChange,
  onError,
  elementId,
}: Props) {
  const setDone = useSetDone();
  const base = onDark
    ? "border-sea-mist bg-transparent hover:border-primary data-[state=checked]:border-primary data-[state=checked]:bg-primary text-ink"
    : "border-ink-muted bg-panel hover:border-primary-text data-[state=checked]:border-primary-text data-[state=checked]:bg-primary-text text-white";
  return (
    <Checkbox.Root
      id={elementId}
      checked={done}
      aria-label={`Done: ${description}`}
      // Never disabled while saving: a disabled checkbox would lose the keyboard's focus.
      aria-busy={setDone.isPending || undefined}
      onCheckedChange={(checked) => {
        if (setDone.isPending) return;
        const next = checked === true;
        onChange?.(next);
        setDone.mutate(
          { id, done: next },
          {
            onError: (error) => {
              toast.error(errorMessage(error));
              onError?.();
            },
          },
        );
      }}
      className={`grid h-5 w-5 flex-none place-items-center rounded-[6px] border-2 transition-colors ${base}`}
    >
      <Checkbox.Indicator>
        <Check size={13} strokeWidth={3.5} aria-hidden="true" />
      </Checkbox.Indicator>
    </Checkbox.Root>
  );
}
