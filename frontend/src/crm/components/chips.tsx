import { Chip } from "../../components/Chip";
import { STAGE_LABEL, STAGE_STYLE, STATUS_LABEL, STATUS_STYLE, type Stage, type Status } from "../lib/stages";

type Size = { size?: "sm" | "md"; className?: string };

export function StageChip({ stage, size, className, onDark }: { stage: Stage; onDark?: boolean } & Size) {
  const style = STAGE_STYLE[stage];
  return (
    <Chip
      background={style.chip}
      color={style.chipText}
      size={size}
      className={className}
      // Negotiation's Midnight chip gets a thin Sea Mist outline on the Midnight column.
      style={onDark && stage === "negotiation" ? { boxShadow: "inset 0 0 0 1.5px var(--sea-mist)" } : undefined}
    >
      {STAGE_LABEL[stage]}
    </Chip>
  );
}

export function StatusChip({ status, size, className }: { status: Status } & Size) {
  const style = STATUS_STYLE[status];
  return (
    <Chip background={style.chip} color={style.chipText} size={size} className={className}>
      {STATUS_LABEL[status]}
    </Chip>
  );
}

export function LateChip({ size, className }: Size) {
  return (
    <Chip background="var(--alert-strong)" color="#fff" size={size} className={className}>
      Late
    </Chip>
  );
}
