import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { formatMoney } from "../../lib/money";
import { dashboard, pastMonths } from "../test/dashboardData";
import type { Dashboard } from "../api";
import { ForecastPanel } from "./ForecastPanel";

const WIDTH = 900;

// jsdom has no layout, so the charts get a fixed size to draw at.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children, height }: { children: ReactElement; height: number }) =>
      cloneElement(children as ReactElement<{ width: number; height: number }>, {
        width: WIDTH,
        height,
      }),
  };
});

function show(data: Dashboard) {
  return render(<ForecastPanel data={data} />);
}

/** Points at the column-th of columns in a chart, as a mouse would. */
function hover(chart: string, column: number, columns: number, left = 58) {
  const wrapper = document.querySelector(`[data-chart="${chart}"] .recharts-wrapper`)!;
  const step = (WIDTH - left - 10) / columns;
  fireEvent.mouseMove(wrapper, { clientX: left + step * (column + 0.5), clientY: 100 });
}

/** The tooltip's text, once it shows. */
async function tip(chart: string) {
  let text = "";
  await waitFor(() => {
    text =
      document.querySelector(`[data-chart="${chart}"] .recharts-tooltip-wrapper`)?.textContent ??
      "";
    expect(text).not.toBe("");
  });
  return text;
}

const figure = (label: string) => within(screen.getByRole("group", { name: label }));

describe("ForecastPanel", () => {
  it("shows the headline figures", () => {
    show(dashboard());
    expect(figure("Won in the last 12 months").getByText(formatMoney(1800000))).toBeVisible();
    expect(figure("Won in the last 12 months").getByText("14 deals, a win in 9 of 12 months"));
    expect(
      figure("Won this month").getByText(`2 deals, up ${formatMoney(30000)} on October`),
    ).toBeInTheDocument();
    expect(figure("Open pipeline").getByText("4 deals, 1 late")).toBeInTheDocument();
    expect(figure("Expected revenue").getByText("44% of the open pipeline")).toBeInTheDocument();
    expect(screen.getByText(/is open, .* of it in 1 late deal\./)).toBeInTheDocument();
  });

  it("says when this month is down on last month, or the same", () => {
    const base = dashboard();
    const { unmount } = show({
      ...base,
      figures: { ...base.figures, won_this_month: { value: 100000, count: 1 } },
    });
    expect(
      figure("Won this month").getByText(`1 deal, down ${formatMoney(50000)} on October`),
    ).toBeInTheDocument();
    unmount();
    show({ ...base, figures: { ...base.figures, won_this_month: { value: 150000, count: 1 } } });
    expect(figure("Won this month").getByText("1 deal, the same as October")).toBeInTheDocument();
  });

  it("says when nothing open is late", () => {
    const base = dashboard();
    show({
      ...base,
      figures: {
        ...base.figures,
        open_pipeline: { value: 900000, count: 4, late_count: 0, late_value: 0 },
      },
    });
    expect(screen.getByText(/is open, and none of it is late\./)).toBeInTheDocument();
  });

  it("says when there are no open deals", () => {
    const base = dashboard();
    show({
      ...base,
      figures: {
        ...base.figures,
        open_pipeline: { value: 0, count: 0, late_count: 0, late_value: 0 },
        expected_revenue: 0,
      },
      forecast: { none_open: true, slots: [] },
      stages: base.stages.map((s) => ({ ...s, count: 0, value: 0, expected: 0 })),
    });
    expect(screen.getByText(/There are no open deals\./)).toBeInTheDocument();
    expect(screen.getByText("No open deals")).toBeInTheDocument();
    expect(figure("Expected revenue").getByText("0% of the open pipeline")).toBeInTheDocument();
    expect(screen.getByText("No expected revenue in the open stages.")).toBeInTheDocument();
  });

  it("names the months without a win, when there are few", () => {
    const base = dashboard();
    const { unmount } = show(base);
    expect(
      screen.getByText("14 deals in the last 12 months. None in January, April or August."),
    ).toBeInTheDocument();
    unmount();
    const one = pastMonths(base.months.map((m, i) => [m.won_value, i === 3 ? 0 : 1]));
    const r = show({ ...base, months: one });
    expect(screen.getByText(/None in March\.$/)).toBeInTheDocument();
    r.unmount();
    show({ ...base, months: pastMonths(base.months.map(() => [100, 1])) });
    expect(screen.getByText(/A win in every month\.$/)).toBeInTheDocument();
  });

  it("counts the months without a win, when there are many", () => {
    const base = dashboard();
    show({ ...base, months: pastMonths(base.months.map((_, i) => [i, i % 2])) });
    expect(screen.getByText(/None in 6 of the months\.$/)).toBeInTheDocument();
  });

  it("says where the expected revenue sits", () => {
    const base = dashboard();
    const { unmount } = show(base);
    expect(
      screen.getByText("Most of the expected revenue sits in Proposal and Negotiation."),
    ).toBeInTheDocument();
    unmount();
    const one = show({
      ...base,
      stages: base.stages.map((s) => ({ ...s, expected: s.stage === "new" ? 300000 : 1000 })),
    });
    expect(screen.getByText("Most of the expected revenue sits in New.")).toBeInTheDocument();
    one.unmount();
    const two = show({
      ...base,
      stages: [
        { stage: "new", count: 1, value: 1, expected: 100000 },
        { stage: "qualified", count: 1, value: 1, expected: 50000 },
        { stage: "proposal", count: 1, value: 1, expected: 150000 },
        { stage: "negotiation", count: 1, value: 1, expected: 100000 },
      ],
    });
    expect(
      screen.getByText("Most of the expected revenue sits in New and Proposal."),
    ).toBeInTheDocument();
    two.unmount();
    show({
      ...base,
      stages: [
        { stage: "new", count: 1, value: 1, expected: 100000 },
        { stage: "qualified", count: 1, value: 1, expected: 100000 },
        { stage: "proposal", count: 1, value: 1, expected: 100000 },
        { stage: "negotiation", count: 1, value: 1, expected: 100000 },
      ],
    });
    expect(
      screen.getByText("The expected revenue is spread across the stages."),
    ).toBeInTheDocument();
  });

  it("lists the open pipeline by stage", () => {
    show(dashboard());
    const row = screen.getByRole("row", { name: /Proposal/ });
    expect(within(row).getByText(formatMoney(300000))).toBeInTheDocument();
    expect(within(row).getByText(formatMoney(150000))).toBeInTheDocument();
  });

  it("gives screen readers the chart's figures as tables", () => {
    show(dashboard());
    const chart = screen.getByRole("table", { name: /Revenue won by month/ });
    expect(within(chart).getByRole("row", { name: /December 2025/ })).toHaveTextContent(
      formatMoney(100000),
    );
    expect(within(chart).getByRole("row", { name: /^Late/ })).toHaveTextContent(
      formatMoney(200000),
    );
    expect(within(chart).getByRole("row", { name: /January 2027/ })).toHaveTextContent(
      formatMoney(400000),
    );
    const won = screen.getByRole("table", { name: "Deals won by month" });
    expect(within(won).getByRole("row", { name: "June 2026 3" })).toBeInTheDocument();
  });

  it("shows a past month's wins on hover", async () => {
    show(dashboard());
    hover("forecast", 6, 15);
    expect(await tip("forecast")).toBe(`June 2026${formatMoney(400000)} won3 deals`);
  });

  it("lists a forecast slot's deals on hover", async () => {
    show(dashboard());
    hover("forecast", 14, 15);
    expect(await tip("forecast")).toBe(
      `January 2027: 2 open deals, ${formatMoney(400000)}` +
        `New deal, ${formatMoney(150000)}, New` +
        `Qual deal, ${formatMoney(250000)}, Qualified`,
    );
  });

  it("shows a month's deal count on hover in the wins chart", async () => {
    show(dashboard());
    hover("won", 0, 12);
    expect(await tip("won")).toBe("December 20251 deal won");
  });
});
