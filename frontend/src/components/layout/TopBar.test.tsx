import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { sections } from "../../App";
import { TopBar } from "./TopBar";

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <TopBar sections={sections} today={new Date(2026, 10, 16)} />
    </MemoryRouter>,
  );
  return within(screen.getByRole("navigation", { name: "Sections" }));
}

describe("TopBar", () => {
  it("lists the five sections in order, each with its label", () => {
    const nav = renderAt("/");
    const names = nav.getAllByRole("link").map((link) => link.textContent);
    expect(names).toEqual(["Dashboard", "Organizations", "Contacts", "Deals", "Pipeline"]);
    expect(screen.getByText("Monday, Nov 16, 2026")).toBeInTheDocument();
  });

  it("marks the current section with aria-current", () => {
    let nav = renderAt("/contacts");
    expect(nav.getByRole("link", { name: "Contacts" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    expect(nav.getByRole("link", { name: "Deals" })).not.toHaveAttribute("aria-current");

    // A record page marks its section, and the dashboard stays unmarked.
    cleanup();
    nav = renderAt("/deals/12");
    expect(nav.getByRole("link", { name: "Deals" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });
});
