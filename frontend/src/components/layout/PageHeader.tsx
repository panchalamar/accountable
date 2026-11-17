import { type ReactNode, useEffect } from "react";

type Props = {
  title: string;
  /** A short line of context under the title, such as "36 contacts". */
  context?: ReactNode;
  /** Chips beside the title, on record pages. */
  badges?: ReactNode;
  actions?: ReactNode;
  /** The browser tab's title, when it should differ from the heading. */
  documentTitle?: string;
};

export function PageHeader({ title, context, badges, actions, documentTitle }: Props) {
  useEffect(() => {
    document.title = `${documentTitle ?? title} - Accountable`;
  }, [title, documentTitle]);

  return (
    <div className="mb-[22px] flex items-end justify-between gap-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-semibold leading-[1.2] tracking-[-0.015em]">{title}</h1>
          {badges}
        </div>
        {context ? <div className="mt-0.5 text-[14.5px] text-ink-muted">{context}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
