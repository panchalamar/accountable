import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, CANT_REACH, api, errorMessage } from "./client";

function reply(status: number, body?: unknown) {
  const fetchMock = vi.fn(
    async () =>
      new Response(
        body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body),
        {
          status,
        },
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("Expected the request to fail");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("returns the JSON body and sends JSON for writes", async () => {
    const fetchMock = reply(200, { id: 3 });
    expect(await api.post("/contacts", { name: "Priya" })).toEqual({ id: 3 });
    expect(fetchMock).toHaveBeenCalledWith("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Priya" }),
    });
  });

  it("uses each method", async () => {
    const fetchMock = reply(200, {});
    await api.get("/a");
    await api.put("/b", {});
    await api.patch("/c", {});
    expect(fetchMock.mock.calls.map((call) => (call as unknown[])[1])).toMatchObject([
      { method: "GET", headers: undefined, body: undefined },
      { method: "PUT" },
      { method: "PATCH" },
    ]);
  });

  it("returns nothing for 204", async () => {
    reply(204);
    expect(await api.delete("/contacts/1")).toBeUndefined();
  });

  it("returns null when a success has no JSON", async () => {
    reply(200, "not json");
    expect(await api.get("/odd")).toBeNull();
  });

  it("says the server can't be reached when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network");
      }),
    );
    const error = await failure(api.get("/contacts"));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toBe(CANT_REACH);
  });

  it("says the server can't be reached on a 500 with no message", async () => {
    reply(500, "<html>");
    const error = await failure(api.get("/contacts"));
    expect(error.status).toBe(500);
    expect(error.message).toBe(CANT_REACH);
  });

  it("keeps the message, field errors and details", async () => {
    reply(422, { message: "Check the form.", errors: { name: "Enter a name." } });
    const invalid = await failure(api.post("/contacts", {}));
    expect(invalid.message).toBe("Check the form.");
    expect(invalid.fieldErrors).toEqual({ name: "Enter a name." });
    expect(invalid.details).toEqual({});

    reply(409, { message: "Can't delete.", details: { deals: [{ id: 1, name: "A" }] } });
    const conflict = await failure(api.delete("/contacts/1"));
    expect(conflict.details).toEqual({ deals: [{ id: 1, name: "A" }] });
    expect(conflict.fieldErrors).toEqual({});
  });

  it("falls back to a general message", async () => {
    reply(400, {});
    const error = await failure(api.get("/x"));
    expect(error.message).toBe("Something went wrong. Try again.");
  });

  it("gives a message for any error", () => {
    expect(errorMessage(new ApiError(404, "Not here."))).toBe("Not here.");
    expect(errorMessage(new Error("boom"))).toBe("Something went wrong. Try again.");
  });
});
