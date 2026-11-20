import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App, { sections } from "./App";
import { makeQueryClient } from "./api/queryClient";
import { mockApi } from "./test/render";

afterEach(() => {
  window.history.pushState({}, "", "/");
});

Element.prototype.scrollIntoView = vi.fn();

describe("App", () => {
  it("shows Page not found inside the shell for an unknown address", async () => {
    mockApi({ "GET /health": { ok: true } });
    window.history.pushState({}, "", "/no-such-page");
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <App />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Skip to content" }));
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("lists the CRM's sections", () => {
    expect(sections.length).toBeGreaterThan(0);
  });
});
