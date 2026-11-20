import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SkipLink } from "./SkipLink";

Element.prototype.scrollIntoView = vi.fn();

describe("SkipLink", () => {
  it("moves focus to the main content", async () => {
    render(
      <>
        <SkipLink />
        <main id="main" tabIndex={-1}>
          Content
        </main>
      </>,
    );
    const link = screen.getByRole("link", { name: "Skip to content" });
    expect(link).toHaveAttribute("href", "#main");
    await userEvent.click(link);
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("does nothing when the target is missing", async () => {
    render(<SkipLink target="nowhere" />);
    const link = screen.getByRole("link", { name: "Skip to content" });
    await userEvent.click(link);
    expect(link).toHaveAttribute("href", "#nowhere");
  });
});
