import type { ReactNode } from "react";
import { Link } from "react-router";

import { ApiError, errorMessage } from "../../api/client";
import { PageHeader } from "../../components/layout/PageHeader";

export function Page({ children }: { children: ReactNode }) {
  return <div className="px-8 pb-12 pt-7">{children}</div>;
}

export function Loading({ what }: { what: string }) {
  return <p className="panel p-7 text-ink-muted">Loading {what}...</p>;
}

/** A record page whose record is gone, or a page that couldn't load. */
export function LoadFailed({
  error,
  title,
  backTo,
  backLabel,
}: {
  error: unknown;
  title: string;
  backTo: string;
  backLabel: string;
}) {
  const gone = error instanceof ApiError && error.status === 404;
  return (
    <Page>
      <PageHeader title={gone ? "Not found" : title} />
      <div className="panel max-w-[640px] p-7">
        <p>{errorMessage(error)}</p>
        <Link to={backTo} className="btn btn-primary mt-5">
          {backLabel}
        </Link>
      </div>
    </Page>
  );
}

export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-divider py-3 first:border-t-0 first:pt-0">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-[15px]">
        {children ?? <span className="text-ink-muted">Not given</span>}
      </dd>
    </div>
  );
}
