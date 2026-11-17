import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { PageHeader } from "../../components/layout/PageHeader";
import { DataTable, type TableColumn } from "../../components/table/DataTable";
import { SearchBox } from "../../components/table/SearchBox";
import { countLabel } from "../../lib/table";
import { type ContactRow, useContacts } from "../api";
import { DeleteDialog } from "../components/DeleteDialog";
import { RowActions } from "../components/RowActions";
import { StatusChip } from "../components/chips";
import { type StatusChoice, StatusFilter } from "../components/StatusFilter";
import { ContactForm } from "../forms/ContactForm";
import { STATUS_LABEL } from "../lib/stages";
import { Loading, LoadFailed, Page } from "./layout";

export function ContactsPage() {
  const contacts = useContacts();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusChoice>("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [deleting, setDeleting] = useState<ContactRow | null>(null);

  const columns = useMemo<TableColumn<ContactRow>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        text: (c) => c.name,
        render: (c) => (
          <Link to={`/contacts/${c.id}`} className="font-semibold text-ink hover:underline">
            {c.name}
          </Link>
        ),
      },
      {
        id: "organization",
        header: "Organization",
        text: (c) => c.organization.name,
        render: (c) => (
          <Link to={`/organizations/${c.organization.id}`} className="link">
            {c.organization.name}
          </Link>
        ),
      },
      { id: "job_title", header: "Job title", text: (c) => c.job_title ?? "" },
      {
        id: "email",
        header: "Email",
        text: (c) => c.email ?? "",
        render: (c) =>
          c.email ? (
            <a href={`mailto:${c.email}`} className="link">
              {c.email}
            </a>
          ) : null,
      },
      { id: "phone", header: "Phone", text: (c) => c.phone ?? "", render: (c) => <span className="whitespace-nowrap">{c.phone}</span> },
      {
        id: "status",
        header: "Status",
        text: (c) => STATUS_LABEL[c.status],
        sortValue: (c) => ["lead", "qualified", "customer"].indexOf(c.status),
        render: (c) => <StatusChip status={c.status} />,
      },
    ],
    [],
  );

  if (contacts.isError) {
    return <LoadFailed error={contacts.error} title="Contacts" backTo="/" backLabel="Go to the dashboard" />;
  }
  const all = contacts.data ?? [];
  const counts: Record<StatusChoice, number> = {
    all: all.length,
    lead: all.filter((c) => c.status === "lead").length,
    qualified: all.filter((c) => c.status === "qualified").length,
    customer: all.filter((c) => c.status === "customer").length,
  };
  const rows = status === "all" ? all : all.filter((c) => c.status === status);

  return (
    <Page>
      <PageHeader
        title="Contacts"
        context={contacts.data ? countLabel(all.length, all.length, "contact", "contacts") : null}
        actions={
          <button type="button" className="btn btn-primary h-[42px]" onClick={() => setAdding(true)}>
            <Plus size={18} aria-hidden="true" />
            Add contact
          </button>
        }
      />
      {!contacts.data ? (
        <Loading what="contacts" />
      ) : (
        <section className="panel px-7 pb-4 pt-5" aria-label="Contacts table">
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(c) => c.id}
            search={search}
            defaultSort={{ id: "name", desc: false }}
            caption="Contacts"
            noun={{ one: "contact", many: "contacts" }}
            total={all.length}
            toolbar={
              <>
                <SearchBox value={search} onChange={setSearch} label="Search contacts" />
                <StatusFilter value={status} onChange={setStatus} counts={counts} />
              </>
            }
            emptyMessage={
              status === "all"
                ? "No contacts yet. Add the people you deal with."
                : `No contacts with the status ${STATUS_LABEL[status]}.`
            }
            rowActions={(c) => <RowActions name={c.name} onEdit={() => setEditing(c)} onDelete={() => setDeleting(c)} />}
          />
        </section>
      )}
      <ContactForm open={adding} onOpenChange={setAdding} />
      {editing ? <ContactForm open onOpenChange={(open) => !open && setEditing(null)} contact={editing} /> : null}
      {deleting ? (
        <DeleteDialog
          kind="contact"
          id={deleting.id}
          name={deleting.name}
          open
          onOpenChange={(open) => !open && setDeleting(null)}
        />
      ) : null}
    </Page>
  );
}
