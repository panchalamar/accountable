import type { Page } from "@playwright/test";

import { type Rec, axeViolations, expect, test } from "./fixtures";

// Axe checks each page against WCAG 2.1 AA, which covers contrast and labels.

async function idOf(api: { get: <T>(p: string) => Promise<T> }, path: string, name: string) {
  const rows = await api.get<Rec[]>(path);
  const found = rows.find((r) => r.name === name);
  expect(found, `${name} in ${path}`).toBeTruthy();
  return found!.id;
}

async function settled(page: Page) {
  await expect(page.getByText(/^Loading/)).toHaveCount(0);
}

for (const path of ["/organizations", "/contacts", "/deals"]) {
  test(`the table at ${path} passes axe`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("tbody tr").first()).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
}

test("each record page passes axe", async ({ page, api }) => {
  const pages = [
    `/organizations/${await idOf(api, "/organizations", "Northwind Metals")}`,
    `/contacts/${await idOf(api, "/contacts", "Priya Shah")}`,
    `/deals/${await idOf(api, "/deals", "Steel supply agreement 2027")}`,
    `/deals/${await idOf(api, "/deals", "Precast panel contract")}`,
  ];
  for (const path of pages) {
    await page.goto(path);
    await settled(page);
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(/^(Organization|Contact|Deal)$/);
    expect(await axeViolations(page), path).toEqual([]);
  }
});

test("each form dialog passes axe, open and showing its messages", async ({ page, api }) => {
  for (const [path, button, title] of [
    ["/organizations", "Add organization", "Add organization"],
    ["/contacts", "Add contact", "Add contact"],
    ["/deals", "Add deal", "Add deal"],
  ]) {
    await page.goto(path);
    await page.getByRole("main").getByRole("button", { name: button }).click();
    const dialog = page.getByRole("dialog", { name: title });
    await expect(dialog.getByLabel("Name")).toBeVisible();
    expect(await axeViolations(page), `${title}, empty`).toEqual([]);
    await dialog.getByRole("button", { name: button }).click();
    await expect(dialog.getByText("Enter a name.")).toBeVisible();
    expect(await axeViolations(page), `${title}, with messages`).toEqual([]);
    await page.keyboard.press("Escape");
  }

  const dealId = await idOf(api, "/deals", "Steel supply agreement 2027");
  await page.goto(`/deals/${dealId}`);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Edit Steel supply agreement 2027" });
  await edit.getByLabel("Stage").selectOption("won");
  await expect(edit.getByText(/The close date will be set to today/)).toBeVisible();
  expect(await axeViolations(page), "Edit deal, closing").toEqual([]);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Log activity" }).click();
  await expect(page.getByRole("dialog", { name: "Log activity" }).getByLabel("Description")).toBeVisible();
  expect(await axeViolations(page), "Log activity").toEqual([]);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  expect(await axeViolations(page), "Delete deal").toEqual([]);
});

test("the pipeline passes axe, with a stage menu open and with the reopen dialog open", async ({ page, api }) => {
  const deal = await api.deal(undefined, { stage: "won" });
  await page.goto("/pipeline");
  await expect(page.locator("li[data-deal-id]").first()).toBeVisible();
  expect(await axeViolations(page), "board").toEqual([]);

  await page.getByRole("button", { name: `Stage: Won. Change stage of ${deal.name}` }).click();
  await expect(page.getByRole("menuitemradio", { name: "Proposal" })).toBeVisible();
  expect(await axeViolations(page), "stage menu").toEqual([]);

  await page.getByRole("menuitemradio", { name: "Proposal" }).click();
  await expect(page.getByRole("dialog", { name: `Reopen ${deal.name}` })).toBeVisible();
  expect(await axeViolations(page), "reopen dialog").toEqual([]);
  await page.keyboard.press("Escape");
});

test("the dashboard passes axe", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("group", { name: "Open pipeline" })).toBeVisible();
  await expect(page.locator('[data-chart="forecast"] svg')).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
});
