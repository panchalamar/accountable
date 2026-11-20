import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "sonner";
import { describe, expect, it, vi } from "vitest";

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
  renderWithProviders(
    <DeleteDialog kind="contact" id={5} name="Priya Shah" open onOpenChange={() => {}} />,
  );
}

describe("DeleteDialog", () => {
  it("shows the counts from the delete check", async () => {
    mockApi({ "GET /contacts/5/delete-check": CHECK });
    open();
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Priya Shah?" });
    expect(dialog).toHaveTextContent("4 activities linked only to Priya Shah will be deleted.");
    expect(dialog).toHaveTextContent(
      "2 activities also linked to a deal will stay on the deal's timeline.",
    );
    expect(screen.getByRole("button", { name: "Delete contact" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("offers only Close when the check says no", async () => {
    mockApi({
      "GET /contacts/5/delete-check": {
        can_delete: false,
        message:
          "Priya Shah can't be deleted while they're the main contact on 1 deal: Steel supply agreement 2027.",
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
          message:
            "Priya Shah can't be deleted while they're the main contact on 1 deal: Furnace relining.",
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

describe("DeleteDialog, after the check", () => {
  it("deletes, says so and reports it", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /deals/9/delete-check": { can_delete: true, message: "It goes for good." },
      "DELETE /deals/9": { status: 204 },
    });
    const onDeleted = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <>
        <DeleteDialog
          kind="deal"
          id={9}
          name="Furnace relining"
          open
          onOpenChange={onOpenChange}
          onDeleted={onDeleted}
        />
        <Toaster />
      </>,
    );
    await user.click(await screen.findByRole("button", { name: "Delete deal" }));
    expect(await screen.findByText("Deleted Furnace relining.")).toBeInTheDocument();
    expect(onDeleted).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(calls).toContainEqual({ method: "DELETE", path: "/deals/9", body: undefined });
  });

  it("shows a toast when the delete fails for another reason", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /deals/9/delete-check": { can_delete: true, message: "It goes for good." },
      "DELETE /deals/9": { status: 400, body: { message: "Try again later." } },
    });
    renderWithProviders(
      <>
        <DeleteDialog kind="deal" id={9} name="Furnace relining" open onOpenChange={() => {}} />
        <Toaster />
      </>,
    );
    await user.click(await screen.findByRole("button", { name: "Delete deal" }));
    expect(await screen.findByText("Try again later.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete deal" })).toBeInTheDocument();
  });

  it("refuses without listing deals when the server gives none", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /organizations/2/delete-check": { can_delete: true, message: "All of it goes." },
      "DELETE /organizations/2": { status: 409, body: { message: "Something changed." } },
    });
    renderWithProviders(
      <DeleteDialog kind="organization" id={2} name="Atlas" open onOpenChange={() => {}} />,
    );
    await user.click(await screen.findByRole("button", { name: "Delete organization" }));
    expect(
      await screen.findByRole("alertdialog", { name: "Atlas can't be deleted" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows why the check couldn't load", async () => {
    mockApi({
      "GET /contacts/5/delete-check": { status: 400, body: { message: "Check failed." } },
    });
    open();
    expect(await screen.findByText("Check failed.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete contact" })).not.toBeInTheDocument();
  });

  it("closes when a blocking deal is followed", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /contacts/5/delete-check": {
        can_delete: false,
        message: "Main contact on a deal.",
        blocking_deals: [{ id: 15, name: "Steel supply" }],
      },
    });
    const onOpenChange = vi.fn();
    renderWithProviders(
      <DeleteDialog kind="contact" id={5} name="Priya Shah" open onOpenChange={onOpenChange} />,
    );
    await user.click(await screen.findByRole("link", { name: "Steel supply" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
