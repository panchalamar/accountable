import type { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;
  background: string;
  color: string;
  size?: ChipSize;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

/** "sm" for board cards and timelines, "mid" for the dashboard's Recent activity, as in the mockup. */
export type ChipSize = "sm" | "mid" | "md";

const SIZING: Record<ChipSize, string> = {
  sm: "h-[18px] px-[7px] text-[11px]",
  mid: "h-5 px-2 text-[11.5px]",
  md: "h-[22px] px-[9px] text-[12px]",
};

/** The fully rounded chip that the CRM's stage, status and Late chips use. */
export function Chip({ children, background, color, size = "md", className = "", style, title }: Props) {
  const sizing = SIZING[size];
  return (
    <span className={`chip ${sizing} ${className}`} style={{ background, color, ...style }} title={title}>
      {children}
    </span>
  );
}
