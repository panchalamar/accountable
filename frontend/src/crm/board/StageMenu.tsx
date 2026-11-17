import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { type ReactNode, type Ref, forwardRef } from "react";

import { STAGES, STAGE_LABEL, STAGE_STYLE, type Stage } from "../lib/stages";

type Props = {
  dealName: string;
  stage: Stage;
  onChoose: (stage: Stage) => void;
  /** The trigger's look. The board's cards use a small "Stage" button. */
  trigger?: ReactNode;
  triggerClassName?: string;
};

// The way to change a deal's stage without dragging. Radix's menu works with
// the arrow keys, Enter and Escape. Focus is handled by whoever moves the
// card, since the card may land in another column.
export const StageMenu = forwardRef(function StageMenu(
  { dealName, stage, onChoose, trigger, triggerClassName }: Props,
  ref: Ref<HTMLButtonElement>,
) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        ref={ref}
        aria-label={`Stage: ${STAGE_LABEL[stage]}. Change stage of ${dealName}`}
        className={triggerClassName}
        // A press here never starts dragging the card.
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {trigger ?? (
          <>
            Stage
            <ChevronDown size={14} aria-hidden="true" />
          </>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="z-50 min-w-[190px] rounded-[12px] bg-panel p-1.5 shadow-[0_12px_32px_rgba(7,59,76,0.2)]"
        >
          <DropdownMenu.Label className="px-2.5 pb-1 pt-1.5 text-[12.5px] font-medium text-ink-muted">
            Move to
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={stage} onValueChange={(value) => value !== stage && onChoose(value as Stage)}>
            {STAGES.map((s) => (
              <DropdownMenu.RadioItem
                key={s}
                value={s}
                className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[14px] text-ink outline-none data-[highlighted]:bg-bg data-[state=checked]:font-semibold"
              >
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px]" style={{ background: STAGE_STYLE[s].fill }} />
                {STAGE_LABEL[s]}
                <DropdownMenu.ItemIndicator className="ml-auto">
                  <Check size={15} aria-hidden="true" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
});
