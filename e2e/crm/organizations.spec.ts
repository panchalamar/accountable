import { expect, firstColumn, test, unique } from "../fixtures";

const byName = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base", numeric: true });

test("the table shows the sample organizations, sorted by name A to Z", async ({ page }) => {
  await page.goto("/organizations");
  await expect(page.getByRole("columnheader", { name: /Name/ })).toHaveAttribute("aria-sort", "ascending");
  const names = await firstColumn(page);
  expect(names).toEqual(expect.arrayContaining(["Atlas Freight", "Northwind Metals", "Summit Rail Logistics"]));
  expect(names).toEqual([...names].sort(byName));
});

test("an organization can be added, found by search, and is still there after a refresh", async ({ page }) => {
  const name = unique("Ocean Freight");
  await page.goto("/organizations");
  await page.getByRole("button", { name: "Add organization" }).click();
  const dialog = page.getByRole("dialog", { name: "Add organization" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Industry").fill("Logistics");
  await dialog.getByLabel("Website").fill("www.oceanfreight.example.com");
  await dialog.getByRole("button", { name: "Add organization" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("link", { name })).toBeVisible();

  await page.getByLabel("Search organizations").fill(name.toUpperCase());
  await expect(page.locator("table tbody tr")).toHaveCount(1);
  await expect(page.getByText(/^1 of \d+ organizations$/)).toBeVisible();

  await page.reload();
  await page.getByLabel("Search organizations").fill(name);
  await expect(page.getByRole("link", { name })).toBeVisible();
  await expect(page.getByRole("link", { name: "oceanfreight.example.com" })).toHaveAttribute(
    "href",
    "https://www.oceanfreight.example.com/",
  );
});

test("a duplicate name in different case is refused next to the field, which gets focus", async ({ page, api }) => {
  const existing = await api.org();
  await page.goto("/organizations");
  await page.getByRole("button", { name: "Add organization" }).click();
  const dialog = page.getByRole("dialog", { name: "Add organization" });
  const field = dialog.getByLabel("Name");
  await field.fill(`  ${existing.name.toUpperCase()} `);
  await dialog.getByRole("button", { name: "Add organization" }).click();
  const message = `An organization called ${existing.name} already exists.`;
  await expect(dialog.getByText(message)).toBeVisible();
  await expect(field).toHaveAccessibleDescription(message);
  await expect(field).toBeFocused();
});

test("sorting by name reverses on a second click", async ({ page }) => {
  await page.goto("/organizations");
  const header = page.getByRole("columnheader", { name: /Name/ });
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "descending");
  const names = await firstColumn(page);
  expect(names).toEqual([...names].sort(byName).reverse());
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
});

test("an edit shows in the table and on the record page", async ({ page, api }) => {
  const org = await api.org({ industry: "Energy" });
  await page.goto("/organizations");
  await page.getByLabel("Search organizations").fill(org.name);
  await page.getByRole("button", { name: `Edit ${org.name}` }).click();
  const dialog = page.getByRole("dialog", { name: `Edit ${org.name}` });
  await expect(dialog.getByLabel("Name")).toHaveValue(org.name);
  await dialog.getByLabel("Industry").fill("Healthcare");
  await dialog.getByLabel("Notes").fill("Moved into hospitals this year.");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  const row = page.locator("tbody tr", { hasText: org.name });
  await expect(row).toContainText("Healthcare");

  await row.getByRole("link", { name: org.name }).click();
  await expect(page.getByRole("heading", { level: 1, name: org.name })).toBeVisible();
  await expect(page.getByText("Moved into hospitals this year.")).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Healthcare");
});

test("an organization with contacts and deals can't be deleted, and an empty one can", async ({ page, api }) => {
  const busy = await api.org();
  const contact = await api.contact(busy);
  await api.deal(contact);
  const empty = await api.org();

  await page.goto("/organizations");
  await page.getByLabel("Search organizations").fill(busy.name);
  await page.getByRole("button", { name: `Delete ${busy.name}` }).click();
  const refusal = page.getByRole("alertdialog");
  await expect(refusal).toContainText(`${busy.name} can't be deleted while it has 1 contact and 1 deal.`);
  await expect(refusal.getByRole("button")).toHaveText(["Close"]);
  await refusal.getByRole("button", { name: "Close" }).click();

  await page.getByLabel("Search organizations").fill(empty.name);
  await page.getByRole("button", { name: `Delete ${empty.name}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete organization" }).click();
  await expect(page.getByText(`No organizations match '${empty.name}'`)).toBeVisible();
});

test("the record page lists its contacts and deals, and Add contact starts at this organization", async ({ page, api }) => {
  const org = await api.org();
  const ann = await api.contact(org, { job_title: "Buyer", status: "qualified" });
  const deal = await api.deal(ann, { value: 420000 });

  await page.goto(`/organizations/${org.id}`);
  const contacts = page.getByRole("region", { name: /Contacts/ });
  await expect(contacts.getByRole("link", { name: ann.name })).toBeVisible();
  await expect(contacts).toContainText("Buyer");
  await expect(contacts).toContainText("Qualified");
  const deals = page.getByRole("region", { name: /Deals/ });
  await expect(deals.getByRole("link", { name: deal.name })).toBeVisible();
  await expect(deals).toContainText("$420,000");

  await contacts.getByRole("button", { name: "Add contact" }).click();
  const dialog = page.getByRole("dialog", { name: "Add contact" });
  await expect(dialog.getByLabel("Organization")).toHaveValue(String(org.id));
  const name = unique("New hire");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: "Add contact" }).click();
  await expect(contacts.getByRole("link", { name })).toBeVisible();
});
