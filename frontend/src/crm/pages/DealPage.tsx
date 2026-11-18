import { Pencil, Trash } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { PageHeader } from "../../components/layout/PageHeader";
import { formatDate, today } from "../../lib/dates";
import { formatMoney } from "../../lib/money";
import { useDeal, useDealTimeline, useDeals } from "../api";
import { StageMenu } from "../board/StageMenu";
import { useDealMover } from "../board/useDealMover";
import { topCardId } from "../lib/board";
import { ChevronDown } from "lucide-react";
import { DeleteDialog } from "../components/DeleteDialog";
import { LateChip, StageChip } from "../components/chips";
import { DealForm } from "../forms/DealForm";
import { dueIn, expectedRevenue, isLate } from "../lib/deals";
import { isOpen } from "../lib/stages";
import { Timeline } from "../timeline/Timeline";
import { Detail, Loading, LoadFailed, Page } from "./layout";

export function DealPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const deal = useDeal(id);
  const timeline = useDealTimeline(id);
  const allDeals = useDeals();
  const mover = useDealMover();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The stage menu doesn't hand focus back (on the board its card may move),
  // so after a stage change focus goes back to its button here.
  const stageButton = useRef<HTMLButtonElement>(null);
  const refocus = () => stageButton.current?.focus();

  if (deal.isError) {
    return <LoadFailed error={deal.error} title="Deal" backTo="/deals" backLabel="Go to Deals" />;
  }
  const d = deal.data;
  if (!d) {
    return (
      <Page>
        <PageHeader title="Deal" />
        <Loading what="the deal" />
      </Page>
    );
  }
  const now = today();
  const late = isLate(d, now);

  return (
    <Page>
      <PageHeader
        title={d.name}
        badges={
          <>
            <StageMenu
              ref={stageButton}
              dealName={d.name}
              stage={d.stage}
              // The same menu as on the board: the deal goes to the top of the chosen column.
              onChoose={(stage) => {
                const sent = mover.request(d, stage, topCardId(allDeals.data ?? [], stage, d.id), { refocus });
                if (sent) refocus();
              }}
              triggerClassName="inline-flex items-center gap-0.5 rounded-full"
              trigger={
                <>
                  <StageChip stage={d.stage} />
                  <ChevronDown size={16} aria-hidden="true" className="text-ink-muted" />
                </>
              }
            />
            {late ? <LateChip /> : null}
          </>
        }
        context={
          <>
            <Link to={`/organizations/${d.organization.id}`} className="link">
              {d.organization.name}
            </Link>
            <span>, </span>
            <Link to={`/contacts/${d.main_contact.id}`} className="link">
              {d.main_contact.name}
            </Link>
          </>
        }
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
              <Pencil size={16} aria-hidden="true" />
              Edit
            </button>
            <button type="button" className="btn btn-secondary text-alert-strong" onClick={() => setDeleting(true)}>
              <Trash size={16} aria-hidden="true" />
              Delete
            </button>
          </>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-6">
        <section className="panel p-6" aria-labelledby="details-h">
          <h2 id="details-h" className="mb-4 text-[17px] font-semibold">
            Details
          </h2>
          <dl>
            <Detail label="Value">
              <span className="num">{formatMoney(d.value)}</span>
            </Detail>
            <Detail label="Probability">
              <span className="num">{d.probability}%</span>
            </Detail>
            <Detail label="Expected revenue">
              <span className="num">{formatMoney(expectedRevenue(d.value, d.probability))}</span>
            </Detail>
            <Detail label={isOpen(d.stage) ? "Expected close date" : "Closed"}>
              <span className="flex items-center gap-2">
                <span className="num">{formatDate(d.close_date)}</span>
                {late ? <LateChip /> : isOpen(d.stage) ? <span className="text-[13.5px] text-ink-muted">{dueIn(d.close_date, now)}</span> : null}
              </span>
            </Detail>
            <Detail label="Organization">
              <Link to={`/organizations/${d.organization.id}`} className="link">
                {d.organization.name}
              </Link>
            </Detail>
            <Detail label="Main contact">
              <Link to={`/contacts/${d.main_contact.id}`} className="link">
                {d.main_contact.name}
              </Link>
            </Detail>
          </dl>
        </section>
        <Timeline
          on={{ kind: "deal", id: d.id, name: d.name, organization: d.organization }}
          items={timeline.data}
          loading={timeline.isLoading}
        />
      </div>
      <DealForm open={editing} onOpenChange={setEditing} deal={d} />
      <p className="sr-only" role="status" aria-live="polite">
        {mover.announcement}
      </p>
      {mover.dialog}
      <DeleteDialog
        kind="deal"
        id={d.id}
        name={d.name}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => navigate("/deals")}
      />
    </Page>
  );
}
