import { describe, expect, it } from "vitest";

import { MESSAGES, contactSchema, dealSchema, organizationSchema } from "./schemas";

// The server's wording, from the spec. backend/tests/crm/test_validation.py
// checks the server says the same.
const SERVER = {
  name: "Enter a name.",
  email: "Enter a valid email address, like name@company.com.",
  emailTaken: "Another contact already uses this email.",
  organizationTaken: "An organization called Acme Ltd already exists.",
  value: "Enter a value of $0 or more, in whole dollars.",
  mainContactAt: "Choose a main contact at Acme Ltd.",
  probability: "Enter a probability from 0 to 100.",
  tooLong: "Use 200 characters or fewer.",
};

function firstError(
  result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } },
  field: string,
) {
  return result.error?.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("form messages", () => {
  it("match the server's wording", () => {
    expect(MESSAGES.name).toBe(SERVER.name);
    expect(MESSAGES.email).toBe(SERVER.email);
    expect(MESSAGES.emailTaken).toBe(SERVER.emailTaken);
    expect(MESSAGES.organizationTaken("Acme Ltd")).toBe(SERVER.organizationTaken);
    expect(MESSAGES.value).toBe(SERVER.value);
    expect(MESSAGES.mainContactAt("Acme Ltd")).toBe(SERVER.mainContactAt);
    expect(MESSAGES.probability).toBe(SERVER.probability);
    expect(MESSAGES.tooLong(200)).toBe(SERVER.tooLong);
  });

  it("are what the schemas give", () => {
    expect(
      firstError(
        organizationSchema.safeParse({ name: "   ", website: "", industry: "", notes: "" }),
        "name",
      ),
    ).toBe(SERVER.name);
    expect(
      firstError(
        organizationSchema.safeParse({
          name: "x".repeat(201),
          website: "",
          industry: "",
          notes: "",
        }),
        "name",
      ),
    ).toBe(SERVER.tooLong);
    const contact = { name: "Ann", organization_id: "1", phone: "", job_title: "", status: "lead" };
    expect(firstError(contactSchema.safeParse({ ...contact, email: "ann@acme" }), "email")).toBe(
      SERVER.email,
    );
    expect(contactSchema.safeParse({ ...contact, email: "" }).success).toBe(true);
    const deal = {
      name: "D",
      organization_id: "1",
      main_contact_id: "2",
      stage: "new",
      probability: "10",
      close_date: "2026-12-01",
    };
    for (const value of ["-5", "1.5", "abc", ""]) {
      expect(firstError(dealSchema.safeParse({ ...deal, value }), "value")).toBe(SERVER.value);
    }
    expect(dealSchema.safeParse({ ...deal, value: "250,000" }).success).toBe(true);
    expect(
      firstError(dealSchema.safeParse({ ...deal, value: "1", probability: "101" }), "probability"),
    ).toBe(SERVER.probability);
  });
});
