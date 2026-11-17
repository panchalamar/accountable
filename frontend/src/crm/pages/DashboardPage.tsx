import { Plus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "../../components/layout/PageHeader";
import { formatDate } from "../../lib/dates";
import { useDashboard } from "../api";
import { FollowUps } from "../dashboard/FollowUps";
import { ForecastPanel } from "../dashboard/ForecastPanel";
import { FunnelPanel } from "../dashboard/FunnelPanel";
import { RecentActivity } from "../dashboard/RecentActivity";
import { DealForm } from "../forms/DealForm";
import { LoadFailed } from "./layout";

export function DashboardPage() {
  const dashboard = useDashboard();
  const [adding, setAdding] = useState(false);

  if (dashboard.isError) {
    return <LoadFailed error={dashboard.error} title="Dashboard" backTo="/deals" backLabel="Go to Deals" />;
  }
  const data = dashboard.data;

  return (
    <div className="grid min-h-[calc(100vh-68px)] grid-cols-[minmax(0,1fr)_clamp(340px,27.8vw,400px)] gap-x-7">
      <div className="min-w-0 pb-12 pl-8 pt-7">
        <PageHeader
          title="Dashboard"
          context={data ? `Figures as of ${formatDate(data.today)}` : null}
          actions={
            <button type="button" className="btn btn-primary h-[42px]" onClick={() => setAdding(true)}>
              <Plus size={18} aria-hidden="true" />
              Add deal
            </button>
          }
        />
        {data ? (
          <>
            <ForecastPanel data={data} />
            <FunnelPanel data={data} />
          </>
        ) : (
          <p className="panel p-7 text-ink-muted">Loading the dashboard...</p>
        )}
      </div>
      {/* The dark column runs from under the top bar to the bottom of the page. */}
      <aside className="on-dark bg-ink px-[26px] pb-10 pt-7 text-white" aria-label="Follow-ups and recent activity">
        {data ? (
          <>
            <FollowUps overdue={data.follow_ups.overdue} upcoming={data.follow_ups.upcoming} />
            <RecentActivity items={data.recent} />
          </>
        ) : null}
      </aside>
      <DealForm open={adding} onOpenChange={setAdding} />
    </div>
  );
}
