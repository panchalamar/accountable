import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { mockApi } from "../test/render";
import {
  deleteRecord,
  fetchDeleteCheck,
  keys,
  refreshAfterSave,
  useContact,
  useContactTimeline,
  useContacts,
  useDashboard,
  useDeal,
  useDealTimeline,
  useDeals,
  useOrganization,
  useOrganizations,
  useSaveActivity,
  useSaveContact,
  useSaveDeal,
  useSaveOrganization,
  useSetDone,
} from "./api";

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("CRM api", () => {
  it("reads each list, record and timeline from its path", async () => {
    const calls = mockApi({
      "GET /organizations": [],
      "GET /organizations/1": { id: 1 },
      "GET /contacts": [],
      "GET /contacts/2": { id: 2 },
      "GET /contacts/2/timeline": [],
      "GET /deals": [],
      "GET /deals/3": { id: 3 },
      "GET /deals/3/timeline": [],
      "GET /dashboard": {},
    });
    const { wrapper } = setup();
    const hooks: (() => { isSuccess: boolean })[] = [
      () => useOrganizations(),
      () => useOrganization(1),
      () => useContacts(),
      () => useContact(2),
      () => useContactTimeline(2),
      () => useDeals(),
      () => useDeal(3),
      () => useDealTimeline(3),
      () => useDashboard(),
    ];
    for (const hook of hooks) {
      const { result } = renderHook(hook, { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    }
    expect(calls.map((c) => c.path)).toEqual([
      "/organizations",
      "/organizations/1",
      "/contacts",
      "/contacts/2",
      "/contacts/2/timeline",
      "/deals",
      "/deals/3",
      "/deals/3/timeline",
      "/dashboard",
    ]);
  });

  it("creates with POST and edits with PUT", async () => {
    const calls = mockApi({
      "POST /organizations": { id: 1 },
      "PUT /organizations/1": { id: 1 },
      "POST /contacts": { id: 2 },
      "PUT /contacts/2": { id: 2 },
      "POST /deals": { id: 3 },
      "PUT /deals/3": { id: 3 },
      "POST /activities": { id: 4 },
      "PUT /activities/4": { id: 4 },
      "PATCH /activities/4": { id: 4 },
    });
    const { wrapper } = setup();
    const saves: (() => { mutateAsync: (input: never) => Promise<unknown> })[] = [
      () => useSaveOrganization(),
      () => useSaveOrganization(1),
      () => useSaveContact(),
      () => useSaveContact(2),
      () => useSaveDeal(),
      () => useSaveDeal(3),
      () => useSaveActivity(),
      () => useSaveActivity(4),
    ];
    for (const save of saves) {
      const { result } = renderHook(save, { wrapper });
      await act(() => (result.current.mutateAsync as (input: unknown) => Promise<unknown>)({}));
    }
    const { result } = renderHook(() => useSetDone(), { wrapper });
    await act(() => result.current.mutateAsync({ id: 4, done: true }));
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "POST /organizations",
      "PUT /organizations/1",
      "POST /contacts",
      "PUT /contacts/2",
      "POST /deals",
      "PUT /deals/3",
      "POST /activities",
      "PUT /activities/4",
      "PATCH /activities/4",
    ]);
    expect(calls.at(-1)?.body).toEqual({ done: true });
  });

  it("checks and deletes records", async () => {
    const calls = mockApi({
      "GET /deals/3/delete-check": { can_delete: true, message: "ok" },
      "DELETE /activities/4": { status: 204 },
    });
    expect(await fetchDeleteCheck("deal", 3)).toEqual({ can_delete: true, message: "ok" });
    await deleteRecord("activity", 4);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "GET /deals/3/delete-check",
      "DELETE /activities/4",
    ]);
  });

  it("refreshes everything after a save except delete checks", async () => {
    const { client } = setup();
    client.setQueryData(keys.deals, []);
    client.setQueryData(keys.deleteCheck("deal", 3), { can_delete: true });
    await refreshAfterSave(client);
    expect(client.getQueryState(keys.deals)?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys.deleteCheck("deal", 3))?.isInvalidated).toBe(false);
  });
});
