import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import type { Stage } from "../lib/stages";
import { type Band, bandShape } from "./FunnelPanel";

const band = (stage: Stage): Band => ({ stage, value: 1, count: 1, fill: "#000", ofNew: null, ofBefore: null });

/** The top and bottom widths of the band's path, "M l,y H r L br,y2 H bl Z". */
function widths(element: ReactElement) {
  const d = (element.props as { d: string }).d;
  const [left, , right, bottomRight, , bottomLeft] = d.match(/-?[\d.]+/g)!.map(Number);
  return { top: right - left, bottom: bottomRight - bottomLeft };
}

describe("the funnel's band shape", () => {
  const Shape = bandShape("won");

  it("narrows from the stage's width to the next stage's", () => {
    const shape = Shape({ x: 0, y: 0, upperWidth: 264, lowerWidth: 228, height: 53, payload: band("qualified") });
    expect(widths(shape)).toEqual({ top: 264, bottom: 228 });
  });

  // Recharts gives the last band the same width at the bottom as the top, and
  // doesn't pass its index, so the shape has to know it by its stage.
  it("narrows the last band to 78% of its width, as in the mockup", () => {
    const shape = Shape({ x: 0, y: 0, upperWidth: 100, lowerWidth: 100, height: 53, payload: band("won") });
    const { top, bottom } = widths(shape);
    expect(top).toBe(100);
    expect(bottom).toBeCloseTo(78);
  });
});
