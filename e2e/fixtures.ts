import AxeBuilder from "@axe-core/playwright";
import { type APIRequestContext, type Page, test as base, expect } from "@playwright/test";

// Chrome logs "Failed to load resource" for every 4xx reply. Several tests make
// the server refuse on purpose and check the message on screen, so those lines
// are ignored. Any other console error, or any page error, fails the test.
const EXPECTED_REFUSAL = /Failed to load resource: the server responded with a status of 4\d\d/;

type Fixtures = {
  api: Api;
};

export const test = base.extend<Fixtures>({
  // Every test that opens a page fails on a page error or a console error.
  page: async ({ page }, use) => {
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(`Page error: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (EXPECTED_REFUSAL.test(message.text())) return;
      problems.push(`Console error: ${message.text()}`);
    });
    await use(page);
    expect(problems, "page errors and console errors from the app").toEqual([]);
  },
  api: async ({ request }, use) => {
    await use(new Api(request));
  },
});

export { expect };

let counter = 0;

/** A name no other test uses, such as "Org 1731772800123-4-7". */
export function unique(prefix: string): string {
  counter += 1;
  return `${prefix} ${Date.now().toString(36)}${process.pid.toString(36)}${counter}`;
}

/** Adds records through the API, for tests that need them in place first. */
export class Api {
  constructor(private request: APIRequestContext) {}

  async post<T = Record<string, unknown>>(path: string, data: unknown): Promise<T> {
    const response = await this.request.post(`/api${path}`, { data });
    expect(response.ok(), `POST ${path}: ${await response.text()}`).toBeTruthy();
    return (await response.json()) as T;
  }

  async put<T = Record<string, unknown>>(path: string, data: unknown): Promise<T> {
    const response = await this.request.put(`/api${path}`, { data });
    expect(response.ok(), `PUT ${path}: ${await response.text()}`).toBeTruthy();
    return (await response.json()) as T;
  }

  async get<T = Record<string, unknown>>(path: string): Promise<T> {
    const response = await this.request.get(`/api${path}`);
    expect(response.ok(), `GET ${path}: ${await response.text()}`).toBeTruthy();
    return (await response.json()) as T;
  }

  org(fields: Record<string, unknown> = {}) {
    return this.post<Rec>("/organizations", { name: unique("Org"), ...fields });
  }

  async contact(org?: Rec, fields: Record<string, unknown> = {}) {
    const at = org ?? (await this.org());
    return this.post<ContactRec>("/contacts", { name: unique("Person"), organization_id: at.id, ...fields });
  }

  async deal(contact?: ContactRec, fields: Record<string, unknown> = {}) {
    const lead = contact ?? (await this.contact());
    return this.post<DealRec>("/deals", {
      name: unique("Deal"),
      organization_id: lead.organization.id,
      main_contact_id: lead.id,
      stage: "new",
      value: 100000,
      close_date: isoDaysFromToday(60),
      ...fields,
    });
  }

  activity(fields: { contact?: Rec | null; deal?: Rec | null } & Record<string, unknown>) {
    const { contact, deal, ...rest } = fields;
    return this.post<Rec>("/activities", {
      type: "call",
      description: unique("Activity"),
      occurred_at: localDateTime(new Date(Date.now() - 60 * 60 * 1000)),
      contact_id: contact?.id ?? null,
      deal_id: deal?.id ?? null,
      ...rest,
    });
  }

  move(deal: Rec, stage: string, before_id: number | null = null, close_date: string | null = null) {
    return this.post<DealRec>(`/deals/${deal.id}/move`, { stage, before_id, close_date });
  }
}

export type Rec = { id: number; name: string };
export type ContactRec = Rec & { organization: Rec; status: string; email: string | null };
export type DealRec = Rec & {
  organization: Rec;
  main_contact: Rec;
  stage: string;
  value: number;
  probability: number;
  close_date: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "2026-11-16", local time, that many days from today. */
export function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-11-16T09:30:00", local time with no time zone, as the API takes it. */
export function localDateTime(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/** "Nov 16, 2026" */
export function shownDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The text of the first cell in each body row of the page's table. */
export async function firstColumn(page: Page): Promise<string[]> {
  return page.locator("table tbody tr td:first-child").allInnerTexts();
}

/** Runs axe for contrast and missing labels, the checks criterion 11 asks for. */
export async function axeViolations(page: Page, options: { include?: string; exclude?: string[] } = {}) {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (options.include) builder = builder.include(options.include);
  for (const selector of options.exclude ?? []) builder = builder.exclude(selector);
  const results = await builder.analyze();
  return results.violations.map((v) => ({
    id: v.id,
    help: v.help,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
  }));
}
