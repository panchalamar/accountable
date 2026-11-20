import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addDays } from "date-fns";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";

import { toISODate, today } from "../../lib/dates";
import { mockApi, renderWithProviders } from "../../test/render";
import type { Activity, TimelineItem } from "../api";
import type { LoggedOn } from "../forms/ActivityForm";
import { Timeline } from "./Timeline";

const ON_DEAL: LoggedOn = {
  kind: "deal",
  id: 3,
  name: "Atlas Freight renewal",
  organization: { id: 1, name: "Atlas Freight" },
};
const ON_CONTACT: LoggedOn = {
  kind: "contact",
  id: 8,
  name: "Dana Ortiz",
  organization: { id: 1, name: "Atlas Freight" },
};

const day = (offset: number) => toISODate(addDays(today(), offset));

function activity(id: number, extra: Partial<Activity>): TimelineItem {
  return {
    kind: "activity",
    at: "2026-11-01T10:00:00",
    id,
    type: "call",
    description: `Activity ${id}`,
    occurred_at: "2026-11-01T10:00:00",
    follow_up_date: null,
    done: false,
    contact: { id: 8, name: "Dana Ortiz" },
    deal: { id: 3, name: "Atlas Freight renewal" },
    ...extra,
  };
}

function show(items: TimelineItem[] | undefined, on = ON_DEAL, loading = false) {
  mockApi({ "GET /deals": [], "GET /contacts": [], "DELETE /activities/1": { status: 204 } });
  renderWithProviders(
    <>
      <Timeline on={on} items={items} loading={loading} />
      <Toaster />
    </>,
  );
}

describe("Timeline", () => {
  it("says when it's loading or empty", () => {
    show(undefined, ON_DEAL, true);
    expect(screen.getByText("Loading the timeline...")).toBeInTheDocument();
  });

  it("invites a first activity when there are none", () => {
    show([]);
    expect(screen.getByText(/No activities yet/)).toBeInTheDocument();
  });

  it("shows stage changes and activities with their follow-ups", () => {
    show([
      {
        kind: "stage_change",
        id: 1,
        deal: { id: 3, name: "Atlas Freight renewal" },
        from_stage: "new",
        to_stage: "proposal",
        at: "2026-11-02T09:00:00",
      },
      activity(1, { follow_up_date: day(-2), description: "Overdue call" }),
      activity(2, { type: "email", follow_up_date: day(0), description: "Due email" }),
      activity(3, { type: "note", follow_up_date: day(3), description: "Later note" }),
      activity(4, { follow_up_date: day(-1), done: true, description: "Finished call" }),
      activity(5, { contact: null, description: "Plain call" }),
    ]);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(/Moved from\s*New\s*to\s*Proposal/);
    expect(within(items[1]).getByText("2 days overdue")).toBeInTheDocument();
    expect(within(items[1]).getByRole("link", { name: "Dana Ortiz" })).toHaveAttribute(
      "href",
      "/contacts/8",
    );
    expect(within(items[2]).getByText("Due today")).toBeInTheDocument();
    expect(within(items[2]).getByText("Email")).toBeInTheDocument();
    expect(within(items[3]).getByText("Due in 3 days")).toBeInTheDocument();
    expect(within(items[4]).getByText("Done")).toBeInTheDocument();
    expect(within(items[5]).queryByRole("link")).not.toBeInTheDocument();
    expect(within(items[5]).queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("links to the deal from a contact's timeline", () => {
    show([activity(1, {})], ON_CONTACT);
    expect(screen.getByRole("link", { name: "Atlas Freight renewal" })).toHaveAttribute(
      "href",
      "/deals/3",
    );
  });

  it("deletes an activity after asking", async () => {
    const user = userEvent.setup();
    show([activity(1, { description: "Old call" })]);
    await user.click(screen.getByRole("button", { name: "Delete activity: Old call" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete this activity?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Deleted the activity.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("says why a delete failed", async () => {
    const user = userEvent.setup();
    show([activity(2, { description: "Stuck call" })]);
    await user.click(screen.getByRole("button", { name: "Delete activity: Stuck call" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("No mock for DELETE /activities/2")).toBeInTheDocument();
  });

  it("opens the activity form to log or edit", async () => {
    const user = userEvent.setup();
    show([activity(1, { description: "Old call" })]);
    await user.click(screen.getByRole("button", { name: "Log activity" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Edit activity: Old call" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
