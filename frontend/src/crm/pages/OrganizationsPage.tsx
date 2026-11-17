import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { PageHeader } from "../../components/layout/PageHeader";
import { DataTable, type TableColumn } from "../../components/table/DataTable";
import { SearchBox } from "../../components/table/SearchBox";
import { websiteHref, websiteLabel } from "../../lib/links";
import { countLabel } from "../../lib/table";
import { type OrganizationRow, useOrganizations } from "../api";
import { DeleteDialog } from "../components/DeleteDialog";
import { RowActions } from "../components/RowActions";
import { OrganizationForm } from "../forms/OrganizationForm";
import { Loading, LoadFailed, Page } from "./layout";

export function OrganizationsPage() {
  const organizations = useOrganizations();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<OrganizationRow | null>(null);
  const [deleting, setDeleting] = useState<OrganizationRow | null>(null);

  const columns = useMemo<TableColumn<OrganizationRow>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        text: (o) => o.name,
        render: (o) => (
          <Link to={`/organizations/${o.id}`} className="font-semibold text-ink hover:underline">
            {o.name}
          </Link>
        ),
      },
      { id: "industry", header: "Industry", text: (o) => o.industry ?? "" },
      {
        id: "website",
        header: "Website",
        text: (o) => (o.website ? websiteLabel(o.website) : ""),
        render: (o) => {
          if (!o.website) return null;
          const href = websiteHref(o.website);
          return href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="link">
              {websiteLabel(o.website)}
            </a>
          ) : (
            o.website
          );
        },
      },
      {
        id: "contacts",
        header: "Contacts",
        text: (o) => String(o.contact_count),
        sortValue: (o) => o.contact_count,
        mono: true,
        descFirst: true,
      },
      {
        id: "open_deals",
        header: "Open deals",
        text: (o) => String(o.open_deal_count),
        sortValue: (o) => o.open_deal_count,
        mono: true,
        descFirst: true,
      },
    ],
    [],
  );

  if (organizations.isError) {
    return <LoadFailed error={organizations.error} title="Organizations" backTo="/" backLabel="Go to the dashboard" />;
  }
  const rows = organizations.data ?? [];

  return (
    <Page>
      <PageHeader
        title="Organizations"
        context={organizations.data ? countLabel(rows.length, rows.length, "organization", "organizations") : null}
        actions={
          <button type="button" className="btn btn-primary h-[42px]" onClick={() => setAdding(true)}>
            <Plus size={18} aria-hidden="true" />
            Add organization
          </button>
        }
      />
      {!organizations.data ? (
        <Loading what="organizations" />
      ) : (
        <section className="panel px-7 pb-4 pt-5" aria-label="Organizations table">
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(o) => o.id}
            search={search}
            defaultSort={{ id: "name", desc: false }}
            caption="Organizations"
            noun={{ one: "organization", many: "organizations" }}
            toolbar={<SearchBox value={search} onChange={setSearch} label="Search organizations" />}
            emptyMessage="No organizations yet. Add the companies you do business with."
            rowActions={(o) => (
              <RowActions name={o.name} onEdit={() => setEditing(o)} onDelete={() => setDeleting(o)} />
            )}
          />
        </section>
      )}
      <OrganizationForm open={adding} onOpenChange={setAdding} />
      {editing ? (
        <OrganizationForm open onOpenChange={(open) => !open && setEditing(null)} organization={editing} />
      ) : null}
      {deleting ? (
        <DeleteDialog
          kind="organization"
          id={deleting.id}
          name={deleting.name}
          open
          onOpenChange={(open) => !open && setDeleting(null)}
        />
      ) : null}
    </Page>
  );
}
