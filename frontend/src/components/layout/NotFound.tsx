import { Link } from "react-router";

import { PageHeader } from "./PageHeader";

export function NotFound({ message }: { message?: string }) {
  return (
    <div className="px-8 pb-12 pt-7">
      <PageHeader title="Page not found" />
      <div className="panel max-w-[640px] p-7">
        <p>
          {message ??
            "There's nothing at this address. The link may be wrong, or the record may have been deleted."}
        </p>
        <Link to="/" className="btn btn-primary mt-5">
          Go to the dashboard
        </Link>
      </div>
    </div>
  );
}
