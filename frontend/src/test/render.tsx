import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";

type Reply = unknown | ((body: unknown) => { status: number; body?: unknown } | unknown);
export type Routes = Record<string, Reply>;

/**
 * Fakes the API. Keys are "GET /contacts" and so on. A function reply gets the
 * request body; return { status, body } for an error.
 */
export function mockApi(routes: Routes) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace(/^.*\/api/, "");
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    const key = `${method} ${path}`;
    if (!(key in routes)) return new Response(JSON.stringify({ message: `No mock for ${key}` }), { status: 404 });
    let reply = routes[key];
    if (typeof reply === "function") reply = (reply as (b: unknown) => unknown)(body);
    if (reply && typeof reply === "object" && "status" in reply && typeof (reply as { status: unknown }).status === "number") {
      const { status, body: replyBody } = reply as { status: number; body?: unknown };
      return new Response(status === 204 ? null : JSON.stringify(replyBody ?? {}), { status });
    }
    return new Response(JSON.stringify(reply), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

export function renderWithProviders(ui: ReactElement, { route = "/" } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
