import { STATUSES, STATUS_LABEL, type Status } from "../lib/stages";

export type StatusChoice = "all" | Status;

type Props = {
  value: StatusChoice;
  onChange: (value: StatusChoice) => void;
  counts: Record<StatusChoice, number>;
};

// All, Lead, Qualified and Customer, each with its count. Buttons with
// aria-pressed, so each works with Tab and Enter or Space.
export function StatusFilter({ value, onChange, counts }: Props) {
  const choices: StatusChoice[] = ["all", ...STATUSES];
  return (
    <div
      role="group"
      aria-label="Filter by status"
      className="flex items-center gap-1 rounded-[12px] bg-bg p-1"
    >
      {choices.map((choice) => {
        const label = choice === "all" ? "All" : STATUS_LABEL[choice];
        const pressed = value === choice;
        return (
          <button
            key={choice}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(choice)}
            className={`flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[14px] font-medium transition-colors ${
              pressed
                ? "bg-panel text-ink shadow-[0_1px_2px_rgba(7,59,76,0.12)]"
                : "text-ink hover:bg-panel/60"
            }`}
          >
            {label}
            <span className="num text-[12.5px] text-ink-muted">{counts[choice]}</span>
          </button>
        );
      })}
    </div>
  );
}
