import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

import { formatWhen } from "../../lib/dates";
import type { RecentItem } from "../api";
import { StageChip } from "../components/chips";
import { TYPE_ICON, TYPE_LABEL } from "../timeline/Timeline";

const LINK = "text-primary hover:underline";

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="grid h-7 w-7 place-items-center rounded-full bg-sea-mist/12 text-sea-mist"
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

// The 10 latest activities and stage changes, newest first.
export function RecentActivity({ items }: { items: RecentItem[] }) {
  return (
    <section className="mt-[30px]" aria-labelledby="recent-h">
      <h2 id="recent-h" className="text-[19px] font-semibold text-white">
        Recent activity
      </h2>
      {items.length === 0 ? (
        <p className="mt-2.5 text-[13.5px] text-sea-mist">
          Nothing yet. Activities and stage changes show here.
        </p>
      ) : (
        <ol className="mt-2.5">
          {items.map((item, i) => {
            const divider = i ? "shadow-[inset_0_1px_0_rgba(205,216,219,0.16)]" : "";
            if (item.kind === "stage_change") {
              return (
                <li
                  key={`s${item.id}`}
                  className={`grid grid-cols-[28px_minmax(0,1fr)] gap-3 py-[9px] ${divider}`}
                >
                  <Icon>
                    <ArrowRight size={14} />
                  </Icon>
                  <div className="min-w-0 text-[13.5px] leading-[1.45]">
                    <p>
                      <Link to={`/deals/${item.deal.id}`} className={LINK}>
                        {item.deal.name}
                      </Link>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sea-mist">
                      <span className="whitespace-nowrap">Moved from</span>
                      <StageChip stage={item.from_stage} size="mid" onDark />
                      <span>to</span>
                      <StageChip stage={item.to_stage} size="mid" onDark />
                    </p>
                    <p className="mt-[3px] text-[12px] text-muted-on-dark">{formatWhen(item.at)}</p>
                  </div>
                </li>
              );
            }
            const TypeIcon = TYPE_ICON[item.type];
            return (
              <li
                key={`a${item.id}`}
                className={`grid grid-cols-[28px_minmax(0,1fr)] gap-3 py-[9px] ${divider}`}
              >
                <Icon>
                  <TypeIcon size={14} />
                </Icon>
                <div className="min-w-0 text-[13.5px] leading-[1.45] text-white">
                  <p>
                    {TYPE_LABEL[item.type]}
                    {item.contact ? (
                      <>
                        {" with "}
                        <Link to={`/contacts/${item.contact.id}`} className={LINK}>
                          {item.contact.name}
                        </Link>
                      </>
                    ) : null}
                    {item.deal ? (
                      <>
                        {" about "}
                        <Link to={`/deals/${item.deal.id}`} className={LINK}>
                          {item.deal.name}
                        </Link>
                      </>
                    ) : null}
                  </p>
                  <p className="text-[12px] text-muted-on-dark">{formatWhen(item.at)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
