import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { mockApi, renderWithProviders } from "../../test/render";
import { DeleteDialog } from "./DeleteDialog";

const CHECK = {
  can_delete: true,
  message:
    "4 activities linked only to Priya Shah will be deleted. 2 activities also linked to a deal will stay on the deal's timeline.",
  blocking_deals: [],
  activities_to_delete: 4,
  activities_to_keep: 2,
};

function open() {
  renderWithProviders(<DeleteDialog kind="contact" id={5} name="Priya Shah" open onOpenChange={() => {}} />);
}

describe("DeleteDialog", () => {
  it("shows the counts from the delete check", async () => {
    mockApi({ "GET /contacts/5/delete-check": CHECK });
    open();
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Priya Shah?" });
    expect(dialog).toHaveTextContent("4 activities linked only to Priya Shah will be deleted.");
    expect(dialog).toHaveTextContent("2 activities also linked to a deal will stay on the deal's timeline.");
    expect(screen.getByRole("button", { name: "Delete contact" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("offers only Close when the check says no", async () => {
    mockApi({
      "GET /contacts/5/delete-check": {
        can_delete: false,
        message: "Priya Shah can't be deleted while they're the main contact on 1 deal: Steel supply agreement 2027.",
        blocking_deals: [{ id: 15, name: "Steel supply agreement 2027" }],
        activities_to_delete: 0,
        activities_to_keep: 0,
      },
    });
    open();
    await screen.findByRole("alertdialog", { name: "Priya Shah can't be deleted" });
    expect(screen.getByRole("link", { name: "Steel supply agreement 2027" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete contact" })).not.toBeInTheDocument();
  });

  it("offers only Close when the server refuses the delete", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /contacts/5/delete-check": CHECK,
      "DELETE /contacts/5": {
        status: 409,
        body: {
          message: "Priya Shah can't be deleted while they're the main contact on 1 deal: Furnace relining.",
          details: { deals: [{ id: 21, name: "Furnace relining" }] },
        },
      },
    });
    open();
    await user.click(await screen.findByRole("button", { name: "Delete contact" }));
    expect(await screen.findByText(/main contact on 1 deal: Furnace relining/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete contact" })).not.toBeInTheDocument();
  });
});
