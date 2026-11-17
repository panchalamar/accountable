import type { LucideIcon } from "lucide-react";
import { Link, NavLink } from "react-router";

import { formatLongDate } from "../../lib/dates";

export type NavSection = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Only mark this section current on its exact address, as for the dashboard at "/". */
  end?: boolean;
};

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
      <rect width="30" height="30" rx="9" fill="#073B4C" />
      <path
        d="M8.5 15.5l4.5 4.5 8.5-9.5"
        fill="none"
        stroke="#06D6A0"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TopBar({ sections, today = new Date() }: { sections: NavSection[]; today?: Date }) {
  return (
    <header className="flex h-[68px] items-center gap-9 bg-panel px-8">
      <Link
        to="/"
        className="flex items-center gap-2.5 rounded-[10px] text-[18px] font-[650] tracking-[-0.01em] text-ink no-underline"
        aria-label="Accountable, go to the dashboard"
      >
        <Logo />
        <span>Accountable</span>
      </Link>
      <nav aria-label="Sections">
        <ul className="flex gap-1">
          {sections.map((section) => (
            <li key={section.to}>
              <NavLink
                to={section.to}
                end={section.end}
                className={({ isActive }) =>
                  [
                    "flex h-10 items-center gap-2 rounded-[10px] px-3.5 text-[14.5px] text-ink no-underline transition-colors",
                    isActive ? "bg-nav-current font-semibold" : "font-medium hover:bg-bg",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <section.icon
                      size={18}
                      aria-hidden="true"
                      className={isActive ? "text-primary-text" : "text-ink-muted"}
                    />
                    {section.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <p className="ml-auto text-[14px] text-ink-muted">{formatLongDate(today)}</p>
    </header>
  );
}
