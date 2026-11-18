import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderWithProviders } from "../../test/render";
import type { Deal } from "../api";
import { DealsPage } from "./DealsPage";

const dueNov16: Deal = {
  id: 7,
  name: "Big deal",
  organization: { id: 1, name: "Acme Ltd" },
  main_contact: { id: 10, name: "Ann Acme" },
  stage: "proposal",
  value: 500000,
  probability: 50,
  close_date: "2026-11-16",
  furthest_stage: "proposal",
  position: 0,
  created_at: "2026-10-01T09:00:00",
  updated_at: "2026-10-01T09:00:00",
};

describe("DealsPage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a deal as late once the day has passed, on a page left open past midnight", async () => {
    // Only the date is faked, so the page's own timers run as usual.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 16, 23, 58));
    mockApi({ "GET /deals": [dueNov16] });
    const user = userEvent.setup();
    renderWithProviders(<DealsPage />);

    const row = () => screen.getByRole("link", { name: "Big deal" }).closest("tr") as HTMLElement;
    await screen.findByRole("link", { name: "Big deal" });
    expect(within(row()).queryByText("Late")).toBeNull(); // due today isn't late

    vi.setSystemTime(new Date(2026, 10, 17, 0, 2));
    // Anything that draws the page again, such as typing a search.
    await user.type(screen.getByLabelText("Search deals"), "big");
    expect(within(row()).getByText("Late")).toBeInTheDocument();
  });
});
