// Runs in the "one-at-a-time" project (e2e/playwright.config.ts), on fresh
// sample data with nothing else running, since it checks exact changes to
// figures every test shares.

import type { Page } from "@playwright/test";

import { type DealRec, expect, isoDaysFromToday, test, unique } from "../fixtures";

function figure(page: Page, label: string) {
  return page.getByRole("group", { name: label });
}

async function figureValue(page: Page, label: string) {
  const text = await figure(page, label).locator("p.num").innerText();
  return Number(text.replace(/[^0-9]/g, ""));
}

async function figureNote(page: Page, label: string) {
  return figure(page, label).locator("p").last().innerText();
}

function followUpGroup(page: Page, title: "Overdue" | "Next 7 days") {
  return page.getByRole("heading", { level: 3, name: new RegExp(`^${title}`) }).locator("xpath=..");
}

async function groupCount(page: Page, title: "Overdue" | "Next 7 days") {
  const text = await page.getByRole("heading", { level: 3, name: new RegExp(`^${title}`) }).innerText();
  return Number(text.replace(/\D+/g, ""));
}

async function openDashboard(page: Page) {
  await page.goto("/");
  await expect(figure(page, "Open pipeline")).toBeVisible();
}

test("the dashboard opens with the sample data in every part", async ({ page }) => {
  await openDashboard(page);
  for (const label of ["Won in the last 12 months", "Won this month", "Open pipeline", "Expected revenue"]) {
    await expect(figure(page, label).locator("p.num")).toHaveText(/^\$[\d,]+$/);
  }
  await expect(page.getByRole("heading", { name: "Revenue won, and what's due to close" })).toBeVisible();
  await expect(page.locator('[data-chart="forecast"] svg')).toBeVisible();
  await expect(page.locator('[data-chart="forecast"]').getByText("Today")).toBeVisible();
  await expect(page.locator('[data-chart="won"] svg')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sales funnel" })).toBeVisible();
  await expect(page.getByRole("table", { name: /Sales funnel/ }).getByRole("row")).toHaveCount(6);
  await expect(followUpGroup(page, "Overdue")).toContainText("Send revised pricing for year two");
  await expect(followUpGroup(page, "Next 7 days")).toContainText("Check budget approval");
  await expect(page.getByRole("region", { name: "Recent activity" }).getByRole("listitem")).toHaveCount(10);
});

test("the four figures match totals worked out from the deals", async ({ page, api }) => {
  const deals = await api.get<DealRec[]>("/deals");
  const now = new Date();
  const month = isoDaysFromToday(0).slice(0, 7);
  const first = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const windowStart = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}-01`;
  const open = deals.filter((d) => !["won", "lost"].includes(d.stage));
  const won = deals.filter((d) => d.stage === "won");
  const wonThisMonth = won.filter((d) => d.close_date.startsWith(month));
  const won12 = won.filter((d) => d.close_date >= windowStart && d.close_date.slice(0, 7) <= month);
  const sum = (rows: DealRec[]) => rows.reduce((s, d) => s + d.value, 0);

  await openDashboard(page);
  expect(await figureValue(page, "Open pipeline")).toBe(sum(open));
  expect(await figureNote(page, "Open pipeline")).toMatch(new RegExp(`^${open.length} deals`));
  expect(await figureValue(page, "Expected revenue")).toBe(
    open.reduce((s, d) => s + Math.floor((d.value * d.probability + 50) / 100), 0),
  );
  expect(await figureValue(page, "Won this month")).toBe(sum(wonThisMonth));
  expect(await figureNote(page, "Won this month")).toMatch(new RegExp(`^${wonThisMonth.length} deals?,`));
  expect(await figureValue(page, "Won in the last 12 months")).toBe(sum(won12));
  expect(await figureNote(page, "Won in the last 12 months")).toMatch(new RegExp(`^${won12.length} deals,`));
});

test('moving a deal to Won raises "Won this month" by its value and its count by one', async ({ page, api }) => {
  const deal = await api.deal(undefined, { stage: "negotiation", value: 345000 });
  await openDashboard(page);
  const before = await figureValue(page, "Won this month");
  const countBefore = Number((await figureNote(page, "Won this month")).split(" ")[0]);

  await page.goto("/pipeline");
  await page.getByRole("button", { name: `Stage: Negotiation. Change stage of ${deal.name}` }).click();
  await page.getByRole("menuitemradio", { name: "Won" }).click();
  await expect(page.getByText("Moved to Won. Close date set to today.")).toBeVisible();

  await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Dashboard" }).click();
  await expect.poll(() => figureValue(page, "Won this month")).toBe(before + 345000);
  expect(await figureNote(page, "Won this month")).toMatch(new RegExp(`^${countBefore + 1} deals?,`));
});

test('a follow-up due tomorrow shows under "Next 7 days", and ticking it on the dashboard takes it off', async ({
  page,
  api,
}) => {
  const contact = await api.contact();
  await openDashboard(page);
  const countBefore = await groupCount(page, "Next 7 days");

  const description = unique("Send the signed contract");
  await page.goto(`/contacts/${contact.id}`);
  await page.getByRole("button", { name: "Log activity" }).click();
  const dialog = page.getByRole("dialog", { name: "Log activity" });
  await dialog.getByLabel("Description").fill(description);
  await dialog.getByLabel("Follow-up date").fill(isoDaysFromToday(1));
  await dialog.getByRole("button", { name: "Log activity" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Dashboard" }).click();
  const item = followUpGroup(page, "Next 7 days").getByRole("listitem").filter({ hasText: description });
  // "Due" over "tomorrow", as in the mockup.
  await expect(item.locator("p").last()).toHaveText(/^Due\s*tomorrow$/);
  await expect(item.getByRole("link", { name: contact.name })).toBeVisible();
  expect(await groupCount(page, "Next 7 days")).toBe(countBefore + 1);

  const saved = page.waitForResponse((r) => r.url().includes("/api/activities/") && r.request().method() === "PATCH");
  await item.getByRole("checkbox", { name: `Done: ${description}` }).click();
  await expect(item).toHaveCount(0);
  expect(await groupCount(page, "Next 7 days")).toBe(countBefore);
  await saved;
  await page.reload();
  await expect(followUpGroup(page, "Next 7 days")).toBeVisible();
  await expect(page.getByText(description)).toHaveCount(0);
  expect(await groupCount(page, "Next 7 days")).toBe(countBefore);
});

test("overdue follow-ups come first, oldest first", async ({ page }) => {
  await openDashboard(page);
  const overdue = followUpGroup(page, "Overdue").getByRole("listitem");
  const days = (await overdue.allInnerTexts()).map((t) => Number(/(\d+) days?\s*overdue/.exec(t)?.[1]));
  expect(days.length).toBeGreaterThanOrEqual(4);
  expect(days).toEqual([...days].sort((a, b) => b - a));
  const order = await page.getByRole("heading", { level: 3 }).allInnerTexts();
  expect(order.findIndex((t) => t.startsWith("Overdue"))).toBeLessThan(order.findIndex((t) => t.startsWith("Next 7 days")));
});

test("after a stage change, recent activity shows it at the top", async ({ page, api }) => {
  const deal = await api.deal(undefined, { stage: "qualified" });
  await api.move(deal, "proposal");
  await openDashboard(page);
  const first = page.getByRole("region", { name: "Recent activity" }).getByRole("listitem").first();
  await expect(first).toContainText(deal.name);
  await expect(first).toContainText(/Moved from\s*Qualified\s*to\s*Proposal/);
  await expect(first).toContainText("Today");
});

test("the forecast shows a Late slot with the late deals, and hovering a month ahead lists its deals", async ({ page, api }) => {
  const deals = await api.get<DealRec[]>("/deals");
  const today = isoDaysFromToday(0);
  const late = deals.filter((d) => !["won", "lost"].includes(d.stage) && d.close_date < today);
  expect(late.length).toBeGreaterThan(0);

  await openDashboard(page);
  const chart = page.locator('[data-chart="forecast"]');
  const lateTick = chart.locator("text", { hasText: /^Late$/ });
  await expect(lateTick).toBeVisible();
  const box = (await chart.boundingBox())!;

  // The Late slot lists its deals.
  const lateBox = (await lateTick.boundingBox())!;
  await page.mouse.move(lateBox.x + lateBox.width / 2, box.y + box.height / 2);
  const tip = chart.locator(".recharts-tooltip-wrapper");
  await expect(tip).toContainText(`Late: ${late.length} open deals`);
  for (const d of late) await expect(tip).toContainText(d.name);

  // The next month ahead lists its deals too.
  const ahead = deals.filter((d) => !["won", "lost"].includes(d.stage) && d.close_date > today);
  const soonest = ahead.sort((a, b) => a.close_date.localeCompare(b.close_date))[0];
  // The axis label just right of Late, on the same line, is the next slot.
  const nextX = await chart.evaluate((el) => {
    const texts = [...el.querySelectorAll("text")];
    const late = texts.find((t) => t.textContent === "Late")!.getBoundingClientRect();
    const right = texts
      .map((t) => t.getBoundingClientRect())
      .filter((r) => Math.abs(r.top - late.top) < 2 && r.left > late.right)
      .sort((a, b) => a.left - b.left)[0];
    return right.left + right.width / 2;
  });
  await page.mouse.move(nextX, box.y + box.height / 2);
  if (soonest.close_date.slice(0, 7) === today.slice(0, 7)) {
    await expect(tip).toContainText("Rest of");
  }
  await expect(tip).toContainText(soonest.name);
});

test("each chart has its summary line and a table of the same figures for screen readers", async ({ page }) => {
  await openDashboard(page);
  const total = await figureValue(page, "Won in the last 12 months");
  const summary = page.getByRole("heading", { name: "Revenue won, and what's due to close" }).locator("xpath=following-sibling::p");
  await expect(summary).toContainText("won in the last 12 months.");

  const revenue = page.getByRole("table", { name: /Revenue won by month/ });
  const rows = revenue.locator("tbody tr");
  const wonCells = await rows.locator("td:nth-child(2)").allInnerTexts();
  const wonSum = wonCells.filter(Boolean).reduce((s, t) => s + Number(t.replace(/[^0-9]/g, "")), 0);
  expect(wonSum).toBe(total);
  const open = await figureValue(page, "Open pipeline");
  const openCells = await rows.locator("td:nth-child(5)").allInnerTexts();
  expect(openCells.filter(Boolean).reduce((s, t) => s + Number(t.replace(/[^0-9]/g, "")), 0)).toBe(open);

  const deals = page.getByRole("table", { name: "Deals won by month" });
  await expect(deals.locator("tbody tr")).toHaveCount(12);
  const counts = (await deals.locator("tbody td").allInnerTexts()).map(Number);
  expect(await figureNote(page, "Won in the last 12 months")).toMatch(new RegExp(`^${counts.reduce((a, b) => a + b, 0)} deals`));
  await expect(page.getByText(/deals in the last 12 months\./)).toBeVisible();

  const funnelSummary = page.getByRole("heading", { name: "Sales funnel" }).locator("xpath=following-sibling::p");
  await expect(funnelSummary).toContainText(/\d+% of the value that reached New was won\./);
  const funnel = page.getByRole("table", { name: /Sales funnel/ });
  await expect(funnel.getByRole("rowheader")).toHaveText(["New", "Qualified", "Proposal", "Negotiation", "Won"]);
  // Every deal won in the last 12 months reached Won, so the funnel's Won row is at least that.
  const reachedWon = Number((await funnel.locator("tbody tr").last().locator("td").nth(1).innerText()).replace(/[^0-9]/g, ""));
  expect(reachedWon).toBeGreaterThanOrEqual(total);
});
