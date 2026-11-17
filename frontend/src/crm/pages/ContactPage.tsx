import { Pencil, Trash } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { PageHeader } from "../../components/layout/PageHeader";
import { formatDate, today } from "../../lib/dates";
import { formatMoney } from "../../lib/money";
import { useContact, useContactTimeline } from "../api";
import { DeleteDialog } from "../components/DeleteDialog";
import { LateChip, StageChip, StatusChip } from "../components/chips";
import { ContactForm } from "../forms/ContactForm";
import { isLate } from "../lib/deals";
import { Timeline } from "../timeline/Timeline";
import { Detail, Loading, LoadFailed, Page } from "./layout";

export function ContactPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const contact = useContact(id);
  const timeline = useContactTimeline(id);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (contact.isError) {
    return <LoadFailed error={contact.error} title="Contact" backTo="/contacts" backLabel="Go to Contacts" />;
  }
  const person = contact.data;
  if (!person) {
    return (
      <Page>
        <PageHeader title="Contact" />
        <Loading what="the contact" />
      </Page>
    );
  }
  const now = today();

  return (
    <Page>
      <PageHeader
        title={person.name}
        badges={<StatusChip status={person.status} />}
        context={
          <>
            {person.job_title ? <span>{person.job_title} at </span> : null}
            <Link to={`/organizations/${person.organization.id}`} className="link">
              {person.organization.name}
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
        <div className="flex flex-col gap-6">
          <section className="panel p-6" aria-labelledby="details-h">
            <h2 id="details-h" className="mb-4 text-[17px] font-semibold">
              Details
            </h2>
            <dl>
              <Detail label="Organization">
                <Link to={`/organizations/${person.organization.id}`} className="link">
                  {person.organization.name}
                </Link>
              </Detail>
              <Detail label="Job title">{person.job_title}</Detail>
              <Detail label="Email">
                {person.email ? (
                  <a href={`mailto:${person.email}`} className="link">
                    {person.email}
                  </a>
                ) : null}
              </Detail>
              <Detail label="Phone">{person.phone}</Detail>
            </dl>
          </section>
          <section className="panel p-6" aria-labelledby="deals-h">
            <h2 id="deals-h" className="mb-3 text-[17px] font-semibold">
              Main contact on <span className="num text-[14px] font-medium text-ink-muted">{person.deals.length}</span>
            </h2>
            {person.deals.length === 0 ? (
              <p className="text-ink-muted">Not the main contact on any deal.</p>
            ) : (
              <ul>
                {person.deals.map((d) => (
                  <li key={d.id} className="border-t border-divider py-2.5 first:border-t-0">
                    <div className="flex items-center justify-between gap-3">
                      <Link to={`/deals/${d.id}`} className="font-semibold text-ink hover:underline">
                        {d.name}
                      </Link>
                      <StageChip stage={d.stage} />
                    </div>
                    <p className="num mt-1 flex items-center gap-2 text-[13px] text-ink-muted">
                      {formatMoney(d.value)} · {formatDate(d.close_date)}
                      {isLate(d, now) ? <LateChip size="sm" /> : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <Timeline
          on={{ kind: "contact", id: person.id, name: person.name, organization: person.organization }}
          items={timeline.data}
          loading={timeline.isLoading}
        />
      </div>
      <ContactForm open={editing} onOpenChange={setEditing} contact={person} />
      <DeleteDialog
        kind="contact"
        id={person.id}
        name={person.name}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => navigate("/contacts")}
      />
    </Page>
  );
}
