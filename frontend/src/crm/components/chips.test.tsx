import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LateChip, StageChip, StatusChip } from "./chips";

describe("chips", () => {
  it("label stages, statuses and lateness", () => {
    render(
      <>
        <StageChip stage="proposal" />
        <StatusChip status="customer" />
        <LateChip />
      </>,
    );
    expect(screen.getByText("Proposal")).toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument();
    expect(screen.getByText("Late")).toBeInTheDocument();
  });

  it("outlines Negotiation on a dark background only", () => {
    render(
      <>
        <StageChip stage="negotiation" onDark />
        <StageChip stage="won" onDark />
      </>,
    );
    expect(screen.getByText("Negotiation").getAttribute("style")).toContain("box-shadow");
    expect(screen.getByText("Won").getAttribute("style") ?? "").not.toContain("box-shadow");
  });
});
