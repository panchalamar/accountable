import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { formatMoney } from "../../lib/money";
import { dashboard } from "../test/dashboardData";
import type { Stage } from "../lib/stages";
import { type Band, FunnelPanel, bandShape } from "./FunnelPanel";

const band = (stage: Stage): Band => ({
  stage,
  value: 1,
  count: 1,
  fill: "#000",
  ofNew: null,
  ofBefore: null,
});

/** The top and bottom widths of the band's path, "M l,y H r L br,y2 H bl Z". */
function widths(element: ReactElement) {
  const d = (element.props as { d: string }).d;
  const [left, , right, bottomRight, , bottomLeft] = d.match(/-?[\d.]+/g)!.map(Number);
  return { top: right - left, bottom: bottomRight - bottomLeft };
}

describe("the funnel's band shape", () => {
  const Shape = bandShape("won");

  it("narrows from the stage's width to the next stage's", () => {
    const shape = Shape({
      x: 0,
      y: 0,
      upperWidth: 264,
      lowerWidth: 228,
      height: 53,
      payload: band("qualified"),
    });
    expect(widths(shape)).toEqual({ top: 264, bottom: 228 });
  });

  // Recharts gives the last band the same width at the bottom as the top, and
  // doesn't pass its index, so the shape has to know it by its stage.
  it("narrows the last band to 78% of its width, as in the mockup", () => {
    const shape = Shape({
      x: 0,
      y: 0,
      upperWidth: 100,
      lowerWidth: 100,
      height: 53,
      payload: band("won"),
    });
    const { top, bottom } = widths(shape);
    expect(top).toBe(100);
    expect(bottom).toBeCloseTo(78);
  });
});

const cells = (row: HTMLElement) =>
  within(row)
    .getAllByRole("cell")
    .map((c) => c.textContent);

describe("FunnelPanel", () => {
  it("shows the value that reached each stage, and the share that went on", () => {
    render(<FunnelPanel data={dashboard()} />);
    expect(
      screen.getByText("Deals in the last 12 months. 10% of the value that reached New was won."),
    ).toBeInTheDocument();
    expect(cells(screen.getByRole("row", { name: /^New/ }))).toEqual([
      "10",
      formatMoney(1000000),
      "100%",
      "Not applicable",
    ]);
    expect(cells(screen.getByRole("row", { name: /^Proposal/ }))).toEqual([
      "5",
      formatMoney(500000),
      "50%",
      "63%",
    ]);
  });

  it("says when no deal has reached New yet", () => {
    const empty = dashboard().funnel.map((f) => ({ ...f, count: 0, value: 0 }));
    const { container } = render(<FunnelPanel data={dashboard({ funnel: empty })} />);
    expect(screen.getByText("No deals in the last 12 months yet.")).toBeInTheDocument();
    expect(cells(screen.getByRole("row", { name: /^Won/ }))).toEqual([
      "0",
      formatMoney(0),
      "",
      "Not applicable",
    ]);
    expect(container.querySelector('[data-chart="funnel"] svg')).toBeNull();
  });

  it("describes a band on hover", async () => {
    const { container } = render(<FunnelPanel data={dashboard()} />);
    const wrapper = container.querySelector('[data-chart="funnel"] .recharts-wrapper')!;
    const band = container.querySelectorAll('[data-chart="funnel"] path')[1];
    fireEvent.mouseEnter(band);
    fireEvent.mouseMove(wrapper, { clientX: 130, clientY: 80 });
    await waitFor(() =>
      expect(wrapper.querySelector(".recharts-tooltip-wrapper")).toHaveTextContent(
        `Qualified${formatMoney(800000)} reached Qualified8 deals, 80% of the stage before`,
      ),
    );
  });
});
