import type { Locator, Page } from "@playwright/test";

import { expect, isoDaysFromToday, test, unique } from "./fixtures";

/** Presses Tab until the element has focus, as a keyboard user would. */
async function tabTo(page: Page, target: Locator, limit = 80) {
  for (let i = 0; i < limit; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Couldn't reach ${target} with Tab`);
}

async function focusRing(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const style = getComputedStyle(el);
    return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
  });
}

test("every top bar link can be reached and opened with the keyboard", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Sections" });
  for (const [label, path] of [
    ["Organizations", "/organizations"],
    ["Contacts", "/contacts"],
    ["Deals", "/deals"],
    ["Pipeline", "/pipeline"],
    ["Dashboard", "/"],
  ]) {
    const link = nav.getByRole("link", { name: label });
    await tabTo(page, link);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(path);
    await expect(link).toHaveAttribute("aria-current", "page");
  }
});

for (const [path, button, title] of [
  ["/organizations", "Add organization", "Add organization"],
  ["/contacts", "Add contact", "Add contact"],
  ["/deals", "Add deal", "Add deal"],
]) {
  test(`${button} opens its dialog by keyboard, keeps focus inside, and Escape returns focus`, async ({ page }) => {
    await page.goto(path);
    const opener = page.getByRole("main").getByRole("button", { name: button });
    await tabTo(page, opener);
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: title });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Name")).toBeFocused();
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });
}

test("sorting works from a heading with Enter, and search and the status filter work by keyboard", async ({ page }) => {
  await page.goto("/contacts");
  const header = page.getByRole("columnheader", { name: /Organization/ });
  await tabTo(page, header.getByRole("button"));
  await page.keyboard.press("Enter");
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await page.keyboard.press("Enter");
  await expect(header).toHaveAttribute("aria-sort", "descending");

  await page.goto("/contacts");
  await tabTo(page, page.getByLabel("Search contacts"));
  await page.keyboard.type("northwind");
  await expect(page.locator("tbody tr").first()).toContainText("Northwind Metals");
  const lead = page.getByRole("group", { name: "Filter by status" }).getByRole("button", { name: /^Lead/ });
  await tabTo(page, lead);
  await page.keyboard.press("Space");
  await expect(lead).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("tbody tr")).not.toHaveCount(0);
  for (const row of await page.locator("tbody tr").all()) {
    await expect(row).toContainText("Lead");
  }
});

test("a follow-up's Done checkbox works with Space on a timeline", async ({ page, api }) => {
  const contact = await api.contact();
  const description = unique("Ring back");
  await api.activity({ contact, description, follow_up_date: isoDaysFromToday(1) });
  await page.goto(`/contacts/${contact.id}`);
  const box = page.getByRole("checkbox", { name: `Done: ${description}` });
  await tabTo(page, box);
  await page.keyboard.press("Space");
  await expect(box).toBeChecked();
  await page.keyboard.press("Space");
  await expect(box).not.toBeChecked();
});

test("the focused element shows a visible ring on light panels", async ({ page }) => {
  await page.goto("/organizations");
  await tabTo(page, page.getByRole("button", { name: "Edit Atlas Freight" }));
  expect(await focusRing(page)).toEqual({ style: "solid", width: "2px", color: "rgb(11, 110, 142)" });
  await tabTo(page, page.getByRole("link", { name: "Northwind Metals" }));
  expect(await focusRing(page)).toEqual({ style: "solid", width: "2px", color: "rgb(11, 110, 142)" });
});

test("on the pipeline, Tab reaches a card's Stage button, and the keyboard alone changes its stage", async ({
  page,
  api,
}) => {
  const deal = await api.deal(undefined, { stage: "new" });
  await page.goto("/pipeline");
  const button = page.getByRole("button", { name: `Stage: New. Change stage of ${deal.name}` });
  await tabTo(page, button, 200);
  expect(await focusRing(page)).toEqual({ style: "solid", width: "2px", color: "rgb(11, 110, 142)" });
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitemradio", { name: "New" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("menuitemradio", { name: "Lost" })).toBeFocused();
  await page.keyboard.press("Enter");
  const moved = page.getByRole("button", { name: `Stage: Lost. Change stage of ${deal.name}` });
  await expect(moved).toBeFocused();
  await expect(page.getByRole("region", { name: /^Lost,/ }).locator("li", { hasText: deal.name })).toHaveCount(1);

  // The column's Add deal button is reachable too, and Escape returns to it.
  const add = page.getByRole("button", { name: "Add deal to Won" });
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Add deal" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(add).toBeFocused();
});

test("on the dashboard, Space ticks a follow-up done and focus moves to the next one", async ({ page, api }) => {
  const contact = await api.contact();
  const first = unique("Aa first follow-up");
  const second = unique("Ab second follow-up");
  // Due in 6 days, so these two sit next to each other near the end of the list.
  await api.activity({ contact, description: first, follow_up_date: isoDaysFromToday(6), occurred_at: "2026-01-01T09:00:00" });
  await api.activity({ contact, description: second, follow_up_date: isoDaysFromToday(6), occurred_at: "2026-01-01T09:00:00" });
  await page.goto("/");
  const box = page.getByRole("checkbox", { name: `Done: ${first}` });
  await tabTo(page, box, 200);
  // The dark column's focus ring is Sea Green.
  expect(await focusRing(page)).toEqual({ style: "solid", width: "2px", color: "rgb(6, 214, 160)" });
  await page.keyboard.press("Space");
  await expect(page.getByText(first)).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: `Done: ${second}` })).toBeFocused();
});

test("links in the dark column show a Sea Green focus ring", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("region", { name: "Recent activity" }).getByRole("link").first();
  await tabTo(page, link, 200);
  expect(await focusRing(page)).toEqual({ style: "solid", width: "2px", color: "rgb(6, 214, 160)" });
});
