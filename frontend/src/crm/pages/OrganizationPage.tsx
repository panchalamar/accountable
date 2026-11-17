import { Pencil, Plus, Trash } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

import { PageHeader } from "../../components/layout/PageHeader";
import { formatDate, today } from "../../lib/dates";
import { websiteHref, websiteLabel } from "../../lib/links";
import { formatMoney } from "../../lib/money";
import { useOrganization } from "../api";
import { DeleteDialog } from "../components/DeleteDialog";
import { LateChip, StageChip, StatusChip } from "../components/chips";
import { ContactForm } from "../forms/ContactForm";
import { DealForm } from "../forms/DealForm";
import { OrganizationForm } from "../forms/OrganizationForm";
import { isLate } from "../lib/deals";
import { Detail, Loading, LoadFailed, Page } from "./layout";

export function OrganizationPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const organization = useOrganization(id);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [addingDeal, setAddingDeal] = useState(false);

  // The deal form's "Add a contact at ..." link lands here with ?add=contact.
  useEffect(() => {
    if (params.get("add") === "contact") {
      setAddingContact(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  if (organization.isError) {
    return <LoadFailed error={organization.error} title="Organization" backTo="/organizations" backLabel="Go to Organizations" />;
  }
  const org = organization.data;
  if (!org) {
    return (
      <Page>
        <PageHeader title="Organization" />
        <Loading what="the organization" />
      </Page>
    );
  }
  const href = org.website ? websiteHref(org.website) : null;
  const now = today();

  return (
    <Page>
      <PageHeader
        title={org.name}
        context={
          <>
            <Link to="/organizations" className="link">
              Organizations
            </Link>
            {org.industry ? <span> · {org.industry}</span> : null}
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
            <Detail label="Website">
              {org.website ? (
                href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="link">
                    {websiteLabel(org.website)}
                  </a>
                ) : (
                  org.website
                )
              ) : null}
            </Detail>
            <Detail label="Industry">{org.industry}</Detail>
            <Detail label="Notes">{org.notes ? <span className="whitespace-pre-line">{org.notes}</span> : null}</Detail>
          </dl>
        </section>
        <div className="flex flex-col gap-6">
          <section className="panel p-6" aria-labelledby="contacts-h">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="contacts-h" className="text-[17px] font-semibold">
                Contacts <span className="num text-[14px] font-medium text-ink-muted">{org.contacts.length}</span>
              </h2>
              <button type="button" className="btn btn-secondary h-9" onClick={() => setAddingContact(true)}>
                <Plus size={16} aria-hidden="true" />
                Add contact
              </button>
            </div>
            {org.contacts.length === 0 ? (
              <p className="text-ink-muted">No contacts yet. Add the people you deal with here.</p>
            ) : (
              <ul>
                {org.contacts.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 border-t border-divider py-2.5 first:border-t-0">
                    <Link to={`/contacts/${c.id}`} className="font-semibold text-ink hover:underline">
                      {c.name}
                    </Link>
                    <span className="text-[14px] text-ink-muted">{c.job_title}</span>
                    <StatusChip status={c.status} className="ml-auto" />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel p-6" aria-labelledby="deals-h">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="deals-h" className="text-[17px] font-semibold">
                Deals <span className="num text-[14px] font-medium text-ink-muted">{org.deals.length}</span>
              </h2>
              <button type="button" className="btn btn-secondary h-9" onClick={() => setAddingDeal(true)}>
                <Plus size={16} aria-hidden="true" />
                Add deal
              </button>
            </div>
            {org.deals.length === 0 ? (
              <p className="text-ink-muted">No deals yet.</p>
            ) : (
              <ul>
                {org.deals.map((d) => (
                  <li
                    key={d.id}
                    className="grid grid-cols-[minmax(0,1fr)_110px_110px_160px] items-center gap-4 border-t border-divider py-2.5 first:border-t-0"
                  >
                    <Link to={`/deals/${d.id}`} className="truncate font-semibold text-ink hover:underline">
                      {d.name}
                    </Link>
                    <StageChip stage={d.stage} />
                    <span className="num text-right text-[13.5px]">{formatMoney(d.value)}</span>
                    <span className="num flex items-center justify-end gap-2 text-[13.5px]">
                      {isLate(d, now) ? <LateChip /> : null}
                      {formatDate(d.close_date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      <OrganizationForm open={editing} onOpenChange={setEditing} organization={org} />
      <ContactForm open={addingContact} onOpenChange={setAddingContact} organizationId={org.id} />
      <DealForm open={addingDeal} onOpenChange={setAddingDeal} organizationId={org.id} />
      <DeleteDialog
        kind="organization"
        id={org.id}
        name={org.name}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => navigate("/organizations")}
      />
    </Page>
  );
}
