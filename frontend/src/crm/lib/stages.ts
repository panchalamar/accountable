// Stage order, open or closed, usual probabilities, and the colors from the
// spec's "Stage, status and chart colors". Hex values for the charts, since
// SVG fills don't read CSS variables reliably; they match styles/tokens.css.

export type Stage = "new" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
export type Status = "lead" | "qualified" | "customer";

export const STAGES: Stage[] = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
export const OPEN_STAGES: Stage[] = ["new", "qualified", "proposal", "negotiation"];
export const CLOSED_STAGES: Stage[] = ["won", "lost"];
export const FUNNEL_STAGES: Stage[] = ["new", "qualified", "proposal", "negotiation", "won"];

export const STAGE_LABEL: Record<Stage, string> = {
  new: "New",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export const STAGE_PROBABILITY: Record<Stage, number> = {
  new: 10,
  qualified: 25,
  proposal: 50,
  negotiation: 75,
  won: 100,
  lost: 0,
};

export function isOpen(stage: Stage): boolean {
  return OPEN_STAGES.includes(stage);
}

export function isClosed(stage: Stage): boolean {
  return CLOSED_STAGES.includes(stage);
}

export const COLORS = {
  midnight: "#073B4C",
  seaGreen: "#06D6A0",
  seaGreenText: "#047A5C",
  marigold: "#FFC145",
  coral: "#F78C6B",
  cerulean: "#118AB2",
  ceruleanStrong: "#0B6E8E",
  raspberryStrong: "#C9184A",
  inkMuted: "#56717A",
  divider: "#E3EAEC",
  forecastBg: "#F3F7F8",
  white: "#FFFFFF",
};

type StageStyle = {
  /** Charts, keys and large fills */
  fill: string;
  /** Chips and column headers, with their text color */
  chip: string;
  chipText: string;
  /** Board cards */
  tint: string;
};

export const STAGE_STYLE: Record<Stage, StageStyle> = {
  new: { fill: COLORS.cerulean, chip: COLORS.ceruleanStrong, chipText: COLORS.white, tint: "var(--tint-new)" },
  qualified: { fill: COLORS.marigold, chip: COLORS.marigold, chipText: COLORS.midnight, tint: "var(--tint-qualified)" },
  proposal: { fill: COLORS.coral, chip: COLORS.coral, chipText: COLORS.midnight, tint: "var(--tint-proposal)" },
  negotiation: { fill: COLORS.midnight, chip: COLORS.midnight, chipText: COLORS.white, tint: "var(--tint-negotiation)" },
  won: { fill: COLORS.seaGreen, chip: COLORS.seaGreen, chipText: COLORS.midnight, tint: "var(--tint-won)" },
  lost: { fill: COLORS.inkMuted, chip: COLORS.inkMuted, chipText: COLORS.white, tint: "var(--tint-lost)" },
};

export const STATUSES: Status[] = ["lead", "qualified", "customer"];

export const STATUS_LABEL: Record<Status, string> = {
  lead: "Lead",
  qualified: "Qualified",
  customer: "Customer",
};

export const STATUS_STYLE: Record<Status, { chip: string; chipText: string }> = {
  lead: { chip: COLORS.ceruleanStrong, chipText: COLORS.white },
  qualified: { chip: COLORS.marigold, chipText: COLORS.midnight },
  customer: { chip: COLORS.seaGreen, chipText: COLORS.midnight },
};
