import type { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;
  background: string;
  color: string;
  size?: "sm" | "md";
  className?: string;
  style?: CSSProperties;
  title?: string;
};

/** The fully rounded chip that the CRM's stage, status and Late chips use. */
export function Chip({ children, background, color, size = "md", className = "", style, title }: Props) {
  const sizing = size === "sm" ? "h-[18px] px-[7px] text-[11px]" : "h-[22px] px-[9px] text-[12px]";
  return (
    <span className={`chip ${sizing} ${className}`} style={{ background, color, ...style }} title={title}>
      {children}
    </span>
  );
}
