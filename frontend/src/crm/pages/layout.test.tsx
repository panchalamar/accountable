import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApiError } from "../../api/client";
import { renderWithProviders } from "../../test/render";
import { Detail, LoadFailed, Loading } from "./layout";

describe("page layout", () => {
  it("says what is loading", () => {
    renderWithProviders(<Loading what="contacts" />);
    expect(screen.getByText("Loading contacts...")).toBeInTheDocument();
  });

  it("says Not found for a missing record", () => {
    renderWithProviders(
      <LoadFailed
        error={new ApiError(404, "That contact doesn't exist.")}
        title="Couldn't load the contact"
        backTo="/contacts"
        backLabel="Back to contacts"
      />,
    );
    expect(screen.getByRole("heading", { name: "Not found" })).toBeInTheDocument();
    expect(screen.getByText("That contact doesn't exist.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to contacts" })).toHaveAttribute(
      "href",
      "/contacts",
    );
  });

  it("uses the given title for other failures", () => {
    renderWithProviders(
      <LoadFailed
        error={new Error("boom")}
        title="Couldn't load the contact"
        backTo="/contacts"
        backLabel="Back to contacts"
      />,
    );
    expect(screen.getByRole("heading", { name: "Couldn't load the contact" })).toBeInTheDocument();
    expect(screen.getByText("Something went wrong. Try again.")).toBeInTheDocument();
  });

  it("shows a detail, or Not given", () => {
    renderWithProviders(
      <dl>
        <Detail label="Email">priya@example.com</Detail>
        <Detail label="Phone">{null}</Detail>
      </dl>,
    );
    expect(screen.getByText("priya@example.com")).toBeInTheDocument();
    expect(screen.getByText("Not given")).toBeInTheDocument();
  });
});
