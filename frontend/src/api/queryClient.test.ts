import { describe, expect, it } from "vitest";

import { makeQueryClient } from "./queryClient";

describe("makeQueryClient", () => {
  it("retries a query once, never a save, and doesn't refetch on focus", () => {
    const defaults = makeQueryClient().getDefaultOptions();
    expect(defaults.queries).toMatchObject({ retry: 1, refetchOnWindowFocus: false });
    expect(defaults.mutations).toMatchObject({ retry: false });
  });
});
