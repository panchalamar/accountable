import type { ReactElement } from "react";
import { Route, Routes, type InitialEntry } from "react-router";
import type { Contact, ContactRow, Dashboard, Deal, Organization, OrganizationRow } from "../api";
import type { Stage } from "../lib/stages";
import { renderWithProviders } from "../../test/render";

/** Renders a page under a route pattern such as "/deals/:id", at the given URL. */
export function renderPage(pattern: string, page: ReactElement, url: InitialEntry) {
  return renderWithProviders(
    <Routes>
      <Route path={pattern} element={page} />
      <Route path="*" element={<p>Somewhere else</p>} />
    </Routes>,
    { route: url },
  );
}

export function makeDeal(over: Partial<Deal> = {}): Deal {
  const stage: Stage = over.stage ?? "proposal";
  return {
    id: 7,
    name: "Big deal",
    organization: { id: 1, name: "Acme Ltd" },
    main_contact: { id: 10, name: "Ann Acme" },
    stage,
    value: 500000,
    probability: 50,
    close_date: "2030-01-31",
    furthest_stage: stage,
    position: 0,
    created_at: "2026-10-01T09:00:00",
    updated_at: "2026-10-01T09:00:00",
    ...over,
  };
}

export function makeContactRow(over: Partial<ContactRow> = {}): ContactRow {
  return {
    id: 10,
    name: "Ann Acme",
    organization: { id: 1, name: "Acme Ltd" },
    job_title: "Buyer",
    email: "ann@acme.test",
    phone: "555 0100",
    status: "lead",
    ...over,
  };
}

export function makeContact(over: Partial<Contact> = {}): Contact {
  return {
    ...makeContactRow(),
    created_at: "2026-10-01T09:00:00",
    updated_at: "2026-10-01T09:00:00",
    deals: [],
    ...over,
  };
}

export function makeOrganizationRow(over: Partial<OrganizationRow> = {}): OrganizationRow {
  return {
    id: 1,
    name: "Acme Ltd",
    website: "acme.test",
    industry: "Steel",
    contact_count: 2,
    open_deal_count: 1,
    ...over,
  };
}

export function makeOrganization(over: Partial<Organization> = {}): Organization {
  return {
    id: 1,
    name: "Acme Ltd",
    website: "acme.test",
    industry: "Steel",
    notes: "Pays on time",
    created_at: "2026-10-01T09:00:00",
    updated_at: "2026-10-01T09:00:00",
    contacts: [],
    deals: [],
    ...over,
  };
}

const OPEN: Stage[] = ["new", "qualified", "proposal", "negotiation"];

/** An empty pipeline: no open deals, no wins. */
export function makeDashboard(over: Partial<Dashboard> = {}): Dashboard {
  return {
    today: "2026-11-20",
    figures: {
      open_pipeline: { value: 0, count: 0, late_count: 0, late_value: 0 },
      expected_revenue: 0,
      won_this_month: { value: 0, count: 0 },
      won_last_month: { value: 0, count: 0 },
      won_12_months: { value: 0, count: 0, months_with_wins: 0 },
    },
    // The twelve months up to and including this one.
    months: Array.from({ length: 12 }, (_, i) => {
      const at = new Date(2025, 11 + i, 1);
      const month = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}`;
      return { month, label: month, year: at.getFullYear(), won_value: 0, won_count: 0 };
    }),
    forecast: { slots: [], none_open: true },
    stages: OPEN.map((stage) => ({ stage, count: 0, value: 0, expected: 0 })),
    funnel: OPEN.map((stage) => ({ stage, count: 0, value: 0 })),
    follow_ups: { overdue: [], upcoming: [] },
    recent: [],
    ...over,
  };
}
