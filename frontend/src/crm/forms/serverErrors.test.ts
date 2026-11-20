import type { UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/client";
import { placeServerErrors } from "./serverErrors";

type Values = { name: string; email: string };

function fakeForm() {
  return { setError: vi.fn(), setFocus: vi.fn() } as unknown as UseFormReturn<Values> & {
    setError: ReturnType<typeof vi.fn>;
    setFocus: ReturnType<typeof vi.fn>;
  };
}

describe("placeServerErrors", () => {
  it("gives a general message for an error that didn't come from the API", () => {
    const form = fakeForm();
    expect(placeServerErrors(new Error("boom"), form, ["name"])).toBe(
      "Something went wrong. Try again.",
    );
    expect(form.setError).not.toHaveBeenCalled();
  });

  it("puts field errors on their fields, focuses the first in the form's order, and returns the rest", () => {
    const form = fakeForm();
    const error = new ApiError(422, "Check the form.", {
      email: "Bad email.",
      name: "Enter a name.",
      stage: "That move isn't allowed.",
    });
    expect(placeServerErrors(error, form, ["name", "email"])).toBe("That move isn't allowed.");
    expect(form.setError).toHaveBeenCalledWith("email", { type: "server", message: "Bad email." });
    expect(form.setFocus).toHaveBeenCalledWith("name");
  });

  it("returns nothing when a 422's errors all landed on fields", () => {
    const form = fakeForm();
    const error = new ApiError(422, "Check the form.", { email: "Bad email." });
    expect(placeServerErrors(error, form, ["name", "email"])).toBeNull();
    expect(form.setFocus).toHaveBeenCalledWith("email");
  });
});
