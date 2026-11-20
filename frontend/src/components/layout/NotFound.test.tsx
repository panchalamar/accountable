import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "../../test/render";
import { NotFound } from "./NotFound";

describe("NotFound", () => {
  it("says nothing is here and links to the dashboard", () => {
    renderWithProviders(<NotFound />);
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText(/There's nothing at this address/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the dashboard" })).toHaveAttribute("href", "/");
  });

  it("shows a given message", () => {
    renderWithProviders(<NotFound message="That deal was deleted." />);
    expect(screen.getByText("That deal was deleted.")).toBeInTheDocument();
  });
});
