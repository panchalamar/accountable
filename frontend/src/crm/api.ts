// The CRM's types, TanStack Query hooks and query keys, and what each save
// refreshes. Every key starts with "crm", so one call refreshes them all.

import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../api/client";
import type { Stage, Status } from "./lib/stages";

export type Link = { id: number; name: string };
export type ActivityType = "note" | "call" | "email";

export type OrganizationRow = {
  id: number;
  name: string;
  website: string | null;
  industry: string | null;
  contact_count: number;
  open_deal_count: number;
};

export type Organization = {
  id: number;
  name: string;
  website: string | null;
  industry: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contacts: {
    id: number;
    name: string;
    job_title: string | null;
    email: string | null;
    status: Status;
  }[];
  deals: {
    id: number;
    name: string;
    stage: Stage;
    value: number;
    probability: number;
    close_date: string;
    main_contact: Link;
  }[];
};

export type ContactRow = {
  id: number;
  name: string;
  organization: Link;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  status: Status;
};

export type Contact = ContactRow & {
  created_at: string;
  updated_at: string;
  deals: {
    id: number;
    name: string;
    stage: Stage;
    value: number;
    probability: number;
    close_date: string;
  }[];
};

export type Deal = {
  id: number;
  name: string;
  organization: Link;
  main_contact: Link;
  stage: Stage;
  value: number;
  probability: number;
  close_date: string;
  furthest_stage: Stage;
  position: number;
  created_at: string;
  updated_at: string;
};

export type Activity = {
  id: number;
  type: ActivityType;
  description: string;
  occurred_at: string;
  follow_up_date: string | null;
  done: boolean;
  contact: Link | null;
  deal: Link | null;
};

export type TimelineItem =
  | (Activity & { kind: "activity"; at: string })
  | {
      kind: "stage_change";
      id: number;
      deal: Link;
      from_stage: Stage;
      to_stage: Stage;
      at: string;
    };

export type OrganizationDeleteCheck = {
  can_delete: boolean;
  message: string;
  contacts: number;
  deals: number;
};
export type ContactDeleteCheck = {
  can_delete: boolean;
  message: string;
  blocking_deals: Link[];
  activities_to_delete: number;
  activities_to_keep: number;
};
export type DealDeleteCheck = {
  can_delete: boolean;
  message: string;
  activities_to_delete: number;
  activities_to_keep: number;
  stage_changes: number;
};
export type DeleteCheck = { can_delete: boolean; message: string; blocking_deals?: Link[] };

export type OrganizationInput = {
  name: string;
  website?: string;
  industry?: string;
  notes?: string;
};
export type ContactInput = {
  name: string;
  organization_id: number | null;
  email?: string;
  phone?: string;
  job_title?: string;
  status: Status;
};
export type DealInput = {
  name: string;
  organization_id: number | null;
  main_contact_id: number | null;
  stage: Stage;
  value: number | null;
  probability: number | null;
  close_date: string;
};
export type ActivityInput = {
  type: ActivityType;
  description: string;
  occurred_at: string;
  follow_up_date: string | null;
  done: boolean;
  contact_id: number | null;
  deal_id: number | null;
};
export type MoveInput = { stage: Stage; before_id: number | null; close_date?: string | null };

// Dashboard

export type Slot = {
  key: string;
  kind: "late" | "rest" | "month" | "later";
  label: string;
  month: string | null;
  count: number;
  value: number;
  expected: number;
  by_stage: Record<string, number>;
  deals: { id: number; name: string; stage: Stage; value: number; close_date: string }[];
};

export type FollowUp = {
  id: number;
  type: ActivityType;
  description: string;
  follow_up_date: string;
  days: number;
  contact: Link | null;
  deal: Link | null;
};

export type RecentItem =
  | {
      kind: "activity";
      id: number;
      type: ActivityType;
      description: string;
      at: string;
      contact: Link | null;
      deal: Link | null;
    }
  | {
      kind: "stage_change";
      id: number;
      deal: Link;
      from_stage: Stage;
      to_stage: Stage;
      at: string;
    };

export type Dashboard = {
  today: string;
  figures: {
    open_pipeline: { value: number; count: number; late_count: number; late_value: number };
    expected_revenue: number;
    won_this_month: { value: number; count: number };
    won_last_month: { value: number; count: number };
    won_12_months: { value: number; count: number; months_with_wins: number };
  };
  months: { month: string; label: string; year: number; won_value: number; won_count: number }[];
  forecast: { slots: Slot[]; none_open: boolean };
  stages: { stage: Stage; count: number; value: number; expected: number }[];
  funnel: { stage: Stage; count: number; value: number }[];
  follow_ups: { overdue: FollowUp[]; upcoming: FollowUp[] };
  recent: RecentItem[];
};

// Keys

export const keys = {
  all: ["crm"] as const,
  organizations: ["crm", "organizations"] as const,
  organization: (id: number) => ["crm", "organization", id] as const,
  contacts: ["crm", "contacts"] as const,
  contact: (id: number) => ["crm", "contact", id] as const,
  contactTimeline: (id: number) => ["crm", "contact", id, "timeline"] as const,
  deals: ["crm", "deals"] as const,
  deal: (id: number) => ["crm", "deal", id] as const,
  dealTimeline: (id: number) => ["crm", "deal", id, "timeline"] as const,
  dashboard: ["crm", "dashboard"] as const,
  deleteCheck: (kind: string, id: number) => ["crm", "delete-check", kind, id] as const,
};

/**
 * After any save, every list, record page, timeline and the dashboard is
 * refreshed. A save can touch any of them (a stage change shows on the deal's
 * timeline, the board, the dashboard and the organization's page), and at a
 * few hundred records refreshing the ones on screen is cheap.
 */
export function refreshAfterSave(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: keys.all,
    // Delete checks are read fresh each time a dialog opens. Refreshing one
    // after its record was deleted would only ask for something that's gone.
    predicate: (query) => query.queryKey[1] !== "delete-check",
  });
}

// Queries

export const useOrganizations = () =>
  useQuery({
    queryKey: keys.organizations,
    queryFn: () => api.get<OrganizationRow[]>("/organizations"),
  });

export const useOrganization = (id: number) =>
  useQuery({
    queryKey: keys.organization(id),
    queryFn: () => api.get<Organization>(`/organizations/${id}`),
    retry: false,
  });

export const useContacts = () =>
  useQuery({ queryKey: keys.contacts, queryFn: () => api.get<ContactRow[]>("/contacts") });

export const useContact = (id: number) =>
  useQuery({
    queryKey: keys.contact(id),
    queryFn: () => api.get<Contact>(`/contacts/${id}`),
    retry: false,
  });

export const useContactTimeline = (id: number) =>
  useQuery({
    queryKey: keys.contactTimeline(id),
    queryFn: () => api.get<TimelineItem[]>(`/contacts/${id}/timeline`),
  });

export const useDeals = () =>
  useQuery({ queryKey: keys.deals, queryFn: () => api.get<Deal[]>("/deals") });

export const useDeal = (id: number) =>
  useQuery({ queryKey: keys.deal(id), queryFn: () => api.get<Deal>(`/deals/${id}`), retry: false });

export const useDealTimeline = (id: number) =>
  useQuery({
    queryKey: keys.dealTimeline(id),
    queryFn: () => api.get<TimelineItem[]>(`/deals/${id}/timeline`),
  });

export const useDashboard = () =>
  useQuery({ queryKey: keys.dashboard, queryFn: () => api.get<Dashboard>("/dashboard") });

// Saves

function useSave<TInput, TResult>(save: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: save,
    onSuccess: () => refreshAfterSave(queryClient),
  });
}

export const useSaveOrganization = (id?: number) =>
  useSave((input: OrganizationInput) =>
    id
      ? api.put<Organization>(`/organizations/${id}`, input)
      : api.post<Organization>("/organizations", input),
  );

export const useSaveContact = (id?: number) =>
  useSave((input: ContactInput) =>
    id ? api.put<Contact>(`/contacts/${id}`, input) : api.post<Contact>("/contacts", input),
  );

export const useSaveDeal = (id?: number) =>
  useSave((input: DealInput) =>
    id ? api.put<Deal>(`/deals/${id}`, input) : api.post<Deal>("/deals", input),
  );

export const useSaveActivity = (id?: number) =>
  useSave((input: ActivityInput) =>
    id ? api.put<Activity>(`/activities/${id}`, input) : api.post<Activity>("/activities", input),
  );

export const useSetDone = () =>
  useSave(({ id, done }: { id: number; done: boolean }) =>
    api.patch<Activity>(`/activities/${id}`, { done }),
  );

export type RecordKind = "organization" | "contact" | "deal" | "activity";

export const PATHS: Record<RecordKind, string> = {
  organization: "/organizations",
  contact: "/contacts",
  deal: "/deals",
  activity: "/activities",
};

export const fetchDeleteCheck = (kind: Exclude<RecordKind, "activity">, id: number) =>
  api.get<DeleteCheck>(`${PATHS[kind]}/${id}/delete-check`);

export const deleteRecord = (kind: RecordKind, id: number) => api.delete(`${PATHS[kind]}/${id}`);
