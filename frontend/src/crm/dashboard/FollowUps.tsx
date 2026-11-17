import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router";

import type { FollowUp } from "../api";
import { DoneCheckbox } from "../components/DoneCheckbox";
import { followUpTiming } from "../lib/followups";

type Props = { overdue: FollowUp[]; upcoming: FollowUp[] };

const boxId = (id: number) => `follow-up-${id}`;

/** "9 days" over "overdue", "Due" over "in 3 days", as the mockup breaks them. */
function Timing({ days }: { days: number }) {
  const timing = followUpTiming(days);
  const tone =
    timing.tone === "overdue"
      ? "font-semibold text-alert-on-dark"
      : timing.tone === "today"
        ? "font-semibold text-secondary"
        : "text-sea-mist";
  let lines: string[];
  if (timing.tone === "overdue") lines = [timing.text.replace(" overdue", ""), "overdue"];
  else if (timing.tone === "today") lines = [timing.text];
  else lines = ["Due", timing.text.replace("Due ", "")];
  return (
    <p className={`whitespace-nowrap pt-0.5 text-right text-[12.5px] leading-[1.35] ${tone}`}>
      {lines.map((line, i) => (
        <Fragment key={line}>
          {i ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </p>
  );
}

// Follow-ups on the dashboard's dark column: overdue first, oldest first,
// then the next 7 days, soonest first. Ticking one saves at once and takes it
// off the list; focus moves to the next one, so a keyboard user isn't lost.
export function FollowUps({ overdue, upcoming }: Props) {
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [focusTarget, setFocusTarget] = useState<string | null>(null);

  // Once the server's list no longer has a ticked item, forget it.
  useEffect(() => {
    const present = new Set([...overdue, ...upcoming].map((f) => f.id));
    setHidden((current) => {
      const kept = [...current].filter((id) => present.has(id));
      return kept.length === current.size ? current : new Set(kept);
    });
  }, [overdue, upcoming]);

  useEffect(() => {
    if (focusTarget) {
      document.getElementById(focusTarget)?.focus();
      setFocusTarget(null);
    }
  }, [focusTarget]);

  const groups = [
    { key: "overdue", title: "Overdue", items: overdue.filter((f) => !hidden.has(f.id)), empty: "Nothing overdue." },
    {
      key: "upcoming",
      title: "Next 7 days",
      items: upcoming.filter((f) => !hidden.has(f.id)),
      empty: "No follow-ups due in the next 7 days",
    },
  ];
  const left = groups[0].items.length + groups[1].items.length;

  function tick(item: FollowUp, group: (typeof groups)[number]) {
    const at = group.items.findIndex((f) => f.id === item.id);
    const next = group.items[at + 1] ?? group.items[at - 1];
    setHidden((current) => new Set(current).add(item.id));
    setFocusTarget(next ? boxId(next.id) : `follow-ups-${group.key}`);
  }

  return (
    <section aria-labelledby="follow-ups-h">
      <h2 id="follow-ups-h" className="text-[19px] font-semibold text-white">
        Follow-ups
      </h2>
      <p className="mt-0.5 text-[13.5px] text-sea-mist" aria-live="polite">
        {left === 0 ? "Nothing to do right now." : `${left} to do. Tick one when it's done.`}
      </p>
      {groups.map((group) => (
        <div key={group.key} className="mt-[22px]">
          <h3
            id={`follow-ups-${group.key}`}
            tabIndex={-1}
            className={`mb-1.5 flex items-center gap-2 text-[14px] font-semibold ${group.key === "overdue" ? "text-alert-on-dark" : "text-white"}`}
          >
            {group.title}
            <span
              className={`num inline-grid h-5 min-w-[22px] place-items-center rounded-full px-1.5 text-[12px] font-semibold ${
                group.key === "overdue" ? "bg-alert-on-dark text-ink" : "bg-sea-mist/20 text-white"
              }`}
            >
              {group.items.length}
            </span>
          </h3>
          {group.items.length === 0 ? (
            <p className="py-1.5 text-[13.5px] text-sea-mist">{group.empty}</p>
          ) : (
            <ol>
              {group.items.map((item, i) => (
                <li
                  key={item.id}
                  className={`grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-3 py-3 ${i ? "shadow-[inset_0_1px_0_rgba(205,216,219,0.16)]" : ""}`}
                >
                  <span className="pt-px">
                    <DoneCheckbox
                      id={item.id}
                      elementId={boxId(item.id)}
                      done={false}
                      description={item.description}
                      onDark
                      onChange={(done) => done && tick(item, group)}
                      onError={() =>
                        setHidden((current) => {
                          const next = new Set(current);
                          next.delete(item.id);
                          return next;
                        })
                      }
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-medium leading-[1.4] text-white">{item.description}</p>
                    <p className="mt-0.5 text-[13px] leading-[1.4]">
                      {item.contact ? (
                        <Link to={`/contacts/${item.contact.id}`} className="text-primary hover:underline">
                          {item.contact.name}
                        </Link>
                      ) : null}
                      {item.contact && item.deal ? <span className="text-sea-mist">, </span> : null}
                      {item.deal ? (
                        <Link to={`/deals/${item.deal.id}`} className="text-primary hover:underline">
                          {item.deal.name}
                        </Link>
                      ) : null}
                    </p>
                  </div>
                  <Timing days={item.days} />
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </section>
  );
}
