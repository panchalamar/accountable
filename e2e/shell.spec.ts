import { expect, test } from "./fixtures";

const SECTIONS = [
  { label: "Dashboard", path: "/" },
  { label: "Organizations", path: "/organizations" },
  { label: "Contacts", path: "/contacts" },
  { label: "Deals", path: "/deals" },
  { label: "Pipeline", path: "/pipeline" },
];

test("the app opens on the dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Sections" });
  await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
});

test("the top bar lists the five sections in order, and each one opens and is marked", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Sections" });
  await expect(nav.getByRole("link")).toHaveText(SECTIONS.map((s) => s.label));

  for (const section of SECTIONS) {
    await nav.getByRole("link", { name: section.label }).click();
    await expect(page).toHaveURL(section.path);
    await expect(page.getByRole("heading", { level: 1, name: section.label })).toBeVisible();
    await expect(nav.getByRole("link", { name: section.label })).toHaveAttribute("aria-current", "page");
    await expect(nav.locator("[aria-current=page]")).toHaveCount(1);
  }
});

test("an unknown address shows Page not found with a link to the dashboard", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Go to the dashboard" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
});

test("the first Tab lands on Skip to content, and it works", async ({ page }) => {
  await page.goto("/organizations");
  await expect(page.getByRole("heading", { level: 1, name: "Organizations" })).toBeVisible();
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});
