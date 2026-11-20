// Zod schemas for the four forms. They mirror the server's rules, with the
// same messages, so a mistake shows before anything is sent. The server checks
// everything again, and its field errors land on the same fields.

import { z } from "zod";

export const MESSAGES = {
  name: "Enter a name.",
  email: "Enter a valid email address, like name@company.com.",
  emailTaken: "Another contact already uses this email.",
  value: "Enter a value of $0 or more, in whole dollars.",
  valueLimit: "Enter a value under $1,000,000,000,000.",
  probability: "Enter a probability from 0 to 100.",
  organization: "Choose an organization.",
  mainContact: "Choose a main contact.",
  stage: "Choose a stage.",
  closeDate: "Enter a close date.",
  type: "Choose a type.",
  description: "Enter a description.",
  occurredAt: "Enter when it happened.",
  status: "Choose a status.",
  tooLong: (limit: number) => `Use ${limit} characters or fewer.`,
  organizationTaken: (name: string) => `An organization called ${name} already exists.`,
  mainContactAt: (organization: string) => `Choose a main contact at ${organization}.`,
};

const requiredText = (limit: number) =>
  z.string().trim().min(1, MESSAGES.name).max(limit, MESSAGES.tooLong(limit));

const optionalText = (limit: number) => z.string().trim().max(limit, MESSAGES.tooLong(limit));

// The same shape as the server's check: something@domain.tld, no spaces.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const organizationSchema = z.object({
  name: requiredText(200),
  website: optionalText(200),
  industry: optionalText(100),
  notes: optionalText(5000),
});

export const contactSchema = z.object({
  name: requiredText(200),
  organization_id: z.string().min(1, MESSAGES.organization),
  email: optionalText(200).refine((v) => v === "" || EMAIL.test(v), MESSAGES.email),
  phone: optionalText(50),
  job_title: optionalText(100),
  status: z.enum(["lead", "qualified", "customer"], { message: MESSAGES.status }),
});

/** Whole dollars, zero or more. Commas are allowed while typing: "250,000". */
export function parseMoney(text: string): number | null {
  const clean = text.trim().replace(/[$,\s]/g, "");
  if (!/^\d+$/.test(clean)) return null;
  return Number(clean);
}

export const dealSchema = z.object({
  name: requiredText(200),
  organization_id: z.string().min(1, MESSAGES.organization),
  main_contact_id: z.string().min(1, MESSAGES.mainContact),
  stage: z.enum(["new", "qualified", "proposal", "negotiation", "won", "lost"], {
    message: MESSAGES.stage,
  }),
  value: z
    .string()
    .refine((v) => parseMoney(v) !== null, MESSAGES.value)
    .refine((v) => (parseMoney(v) ?? 0) <= 999_999_999_999, MESSAGES.valueLimit),
  probability: z
    .string()
    .refine((v) => /^\d+$/.test(v.trim()) && Number(v) <= 100, MESSAGES.probability),
  close_date: z.string().min(1, MESSAGES.closeDate),
});

export const activitySchema = z.object({
  type: z.enum(["note", "call", "email"], { message: MESSAGES.type }),
  description: z.string().trim().min(1, MESSAGES.description).max(5000, MESSAGES.tooLong(5000)),
  occurred_at: z.string().min(1, MESSAGES.occurredAt),
  follow_up_date: z.string(),
  second_link: z.string(),
});

export type OrganizationValues = z.infer<typeof organizationSchema>;
export type ContactValues = z.infer<typeof contactSchema>;
export type DealValues = z.infer<typeof dealSchema>;
export type ActivityValues = z.infer<typeof activitySchema>;
