import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import { toISODate, today } from "../../lib/dates";
import { renderWithProviders } from "../../test/render";
import { ReopenDialog } from "./ReopenDialog";

function open() {
  const onReopen = vi.fn();
  const onCancel = vi.fn();
  renderWithProviders(
    <ReopenDialog
      open
      dealName="Atlas Freight renewal"
      stage="proposal"
      onReopen={onReopen}
      onCancel={onCancel}
    />,
  );
  return { onReopen, onCancel };
}

describe("ReopenDialog", () => {
  it("suggests a close date 30 days out and reopens with it", async () => {
    const { onReopen } = open();
    expect(
      screen.getByRole("dialog", { name: "Reopen Atlas Freight renewal" }),
    ).toHaveAccessibleDescription(/It moves to Proposal/);
    const field = screen.getByLabelText("New expected close date");
    expect(field).toHaveValue(toISODate(addDays(today(), 30)));
    expect(field).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Reopen" }));
    expect(onReopen).toHaveBeenCalledWith(toISODate(addDays(today(), 30)));
  });

  it("asks for a date when the field is empty", async () => {
    const { onReopen } = open();
    await userEvent.clear(screen.getByLabelText("New expected close date"));
    await userEvent.click(screen.getByRole("button", { name: "Reopen" }));
    expect(screen.getByText("Enter a close date.")).toBeInTheDocument();
    expect(onReopen).not.toHaveBeenCalled();
  });

  it("cancels", async () => {
    const { onCancel } = open();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
