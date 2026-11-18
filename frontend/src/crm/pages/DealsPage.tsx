import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { PageHeader } from "../../components/layout/PageHeader";
import { DataTable, type TableColumn } from "../../components/table/DataTable";
import { SearchBox } from "../../components/table/SearchBox";
import { formatDate, parseDate, toISODate, today } from "../../lib/dates";
import { formatMoney } from "../../lib/money";
import { countLabel } from "../../lib/table";
import { type Deal, useDeals } from "../api";
import { DeleteDialog } from "../components/DeleteDialog";
import { RowActions } from "../components/RowActions";
import { LateChip, StageChip } from "../components/chips";
import { DealForm } from "../forms/DealForm";
import { isLate } from "../lib/deals";
import { STAGES, STAGE_LABEL } from "../lib/stages";
import { Loading, LoadFailed, Page } from "./layout";

export function DealsPage() {
  const deals = useDeals();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [deleting, setDeleting] = useState<Deal | null>(null);
  // The columns are worked out again when the day changes, so a page left
  // open past midnight shows today's Late chips after its next refresh.
  const day = toISODate(today());

  const columns = useMemo<TableColumn<Deal>[]>(() => {
    const now = parseDate(day);
    return [
      {
        id: "name",
        header: "Name",
        text: (d) => d.name,
        render: (d) => (
          <Link to={`/deals/${d.id}`} className="font-semibold text-ink hover:underline">
            {d.name}
          </Link>
        ),
      },
      {
        id: "organization",
        header: "Organization",
        text: (d) => d.organization.name,
        render: (d) => (
          <Link to={`/organizations/${d.organization.id}`} className="link">
            {d.organization.name}
          </Link>
        ),
      },
      {
        id: "main_contact",
        header: "Main contact",
        text: (d) => d.main_contact.name,
        render: (d) => (
          <Link to={`/contacts/${d.main_contact.id}`} className="link">
            {d.main_contact.name}
          </Link>
        ),
      },
      {
        id: "stage",
        header: "Stage",
        text: (d) => STAGE_LABEL[d.stage],
        sortValue: (d) => STAGES.indexOf(d.stage),
        render: (d) => <StageChip stage={d.stage} />,
      },
      { id: "value", header: "Value", text: (d) => formatMoney(d.value), sortValue: (d) => d.value, mono: true, descFirst: true },
      {
        id: "probability",
        header: "Probability",
        text: (d) => `${d.probability}%`,
        sortValue: (d) => d.probability,
        mono: true,
        descFirst: true,
      },
      {
        id: "close_date",
        header: "Close date",
        text: (d) => formatDate(d.close_date) + (isLate(d, now) ? " Late" : ""),
        sortValue: (d) => d.close_date,
        mono: true,
        descFirst: true,
        render: (d) => (
          <span className="inline-flex items-center gap-2">
            {isLate(d, now) ? <LateChip /> : null}
            {formatDate(d.close_date)}
          </span>
        ),
      },
    ];
  }, [day]);

  if (deals.isError) {
    return <LoadFailed error={deals.error} title="Deals" backTo="/" backLabel="Go to the dashboard" />;
  }
  const rows = deals.data ?? [];

  return (
    <Page>
      <PageHeader
        title="Deals"
        context={deals.data ? countLabel(rows.length, rows.length, "deal", "deals") : null}
        actions={
          <button type="button" className="btn btn-primary h-[42px]" onClick={() => setAdding(true)}>
            <Plus size={18} aria-hidden="true" />
            Add deal
          </button>
        }
      />
      {!deals.data ? (
        <Loading what="deals" />
      ) : (
        <section className="panel px-7 pb-4 pt-5" aria-label="Deals table">
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(d) => d.id}
            search={search}
            defaultSort={{ id: "close_date", desc: true }}
            caption="Deals"
            noun={{ one: "deal", many: "deals" }}
            toolbar={<SearchBox value={search} onChange={setSearch} label="Search deals" />}
            emptyMessage="No deals yet. Add one to start the pipeline."
            rowActions={(d) => <RowActions name={d.name} onEdit={() => setEditing(d)} onDelete={() => setDeleting(d)} />}
          />
        </section>
      )}
      <DealForm open={adding} onOpenChange={setAdding} />
      {editing ? <DealForm open onOpenChange={(open) => !open && setEditing(null)} deal={editing} /> : null}
      {deleting ? (
        <DeleteDialog kind="deal" id={deleting.id} name={deleting.name} open onOpenChange={(open) => !open && setDeleting(null)} />
      ) : null}
    </Page>
  );
}
