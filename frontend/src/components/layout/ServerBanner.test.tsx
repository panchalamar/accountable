import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServerBanner } from "./ServerBanner";

const MESSAGE = "Can't reach Accountable's server. Check that npm run dev is still running.";

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("ServerBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays hidden while the health check answers", async () => {
    const check = vi.fn().mockResolvedValue(true);
    render(<ServerBanner check={check} intervalMs={1000} />);
    await tick(10_000);
    expect(check.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows only after several failed checks, and hides when the server answers", async () => {
    let up = false;
    const check = vi.fn(async () => {
      if (!up) throw new TypeError("Failed to fetch");
      return true;
    });
    render(<ServerBanner check={check} intervalMs={1000} failuresBeforeShowing={3} />);

    await tick(0); // first check fails
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await tick(1000); // second
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await tick(1000); // third
    expect(screen.getByRole("alert")).toHaveTextContent(MESSAGE);

    up = true;
    await tick(1000);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("counts a refusal from the proxy as a failure", async () => {
    const check = vi.fn().mockResolvedValue(false);
    render(<ServerBanner check={check} intervalMs={1000} failuresBeforeShowing={2} />);
    await tick(0);
    await tick(1000);
    expect(screen.getByRole("alert")).toHaveTextContent(MESSAGE);
  });
});
