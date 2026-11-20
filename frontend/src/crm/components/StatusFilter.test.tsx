import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StatusFilter } from "./StatusFilter";

describe("StatusFilter", () => {
  it("shows each status with its count and reports a choice", async () => {
    const onChange = vi.fn();
    render(
      <StatusFilter
        value="all"
        onChange={onChange}
        counts={{ all: 9, lead: 4, qualified: 3, customer: 2 }}
      />,
    );
    const group = screen.getByRole("group", { name: "Filter by status" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^All\s*9$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const lead = screen.getByRole("button", { name: /^Lead\s*4$/ });
    expect(lead).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(lead);
    expect(onChange).toHaveBeenCalledWith("lead");
    expect(screen.getByRole("button", { name: /^Customer\s*2$/ })).toBeInTheDocument();
  });
});
