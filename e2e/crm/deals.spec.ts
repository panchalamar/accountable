import { expect, isoDaysFromToday, shownDate, test, unique } from "../fixtures";

function money(text: string) {
  return Number(text.replace(/[$,]/g, ""));
}

test("the table shows the sample deals, sorted by close date, latest first", async ({ page }) => {
  await page.goto("/deals");
  await expect(page.getByRole("columnheader", { name: /Close date/ })).toHaveAttribute("aria-sort", "descending");
  await expect(page.getByRole("link", { name: "Steel supply agreement 2027" })).toBeVisible();
  const dates = (await page.locator("tbody tr td:nth-child(7)").allInnerTexts()).map((t) =>
    Date.parse(t.replace("Late", "").trim()),
  );
  expect(dates.length).toBeGreaterThanOrEqual(40);
  expect(dates).toEqual([...dates].sort((a, b) => b - a));
});

test("the main contact list shows only the organization's contacts, and changing it clears the choice", async ({ page }) => {
  await page.goto("/deals");
  await page.getByRole("button", { name: "Add deal" }).click();
  const dialog = page.getByRole("dialog", { name: "Add deal" });
  await dialog.getByLabel("Organization").selectOption({ label: "Atlas Freight" });
  const contact = dialog.getByLabel("Main contact");
  await expect(contact.locator("option")).toContainText(["Choose a main contact", "Dana Ortiz", "Kevin Brooks", "Sam Whitfield"]);
  await expect(contact.locator("option", { hasText: "Priya Shah" })).toHaveCount(0);
  await contact.selectOption({ label: "Dana Ortiz" });
  await dialog.getByLabel("Organization").selectOption({ label: "Northwind Metals" });
  await expect(contact).toHaveValue("");
  await expect(contact.locator("option", { hasText: "Priya Shah" })).toHaveCount(1);
  await expect(contact.locator("option", { hasText: "Dana Ortiz" })).toHaveCount(0);
});

test("an organization with no contacts says so, with a link to add a contact there", async ({ page, api }) => {
  const org = await api.org();
  await page.goto("/deals");
  await page.getByRole("button", { name: "Add deal" }).click();
  const dialog = page.getByRole("dialog", { name: "Add deal" });
  await dialog.getByLabel("Organization").selectOption({ label: org.name });
  await expect(dialog.getByText(`${org.name} has no contacts yet. Add a contact first.`)).toBeVisible();
  await dialog.getByRole("link", { name: `Add a contact at ${org.name}` }).click();
  await expect(page).toHaveURL(`/organizations/${org.id}`);
  const contactDialog = page.getByRole("dialog", { name: "Add contact" });
  await expect(contactDialog.getByLabel("Organization")).toHaveValue(String(org.id));
});

test("a negative value is refused with its message", async ({ page }) => {
  await page.goto("/deals");
  await page.getByRole("button", { name: "Add deal" }).click();
  const dialog = page.getByRole("dialog", { name: "Add deal" });
  await dialog.getByLabel("Name").fill(unique("Negative"));
  await dialog.getByLabel("Organization").selectOption({ label: "Atlas Freight" });
  await dialog.getByLabel("Main contact").selectOption({ label: "Dana Ortiz" });
  await dialog.getByLabel("Value ($)").fill("-5000");
  await dialog.getByLabel("Close date").fill(isoDaysFromToday(40));
  await dialog.getByRole("button", { name: "Add deal" }).click();
  await expect(dialog.getByText("Enter a value of $0 or more, in whole dollars.")).toBeVisible();
  await expect(dialog.getByLabel("Value ($)")).toBeFocused();
});

test("adding a deal at Won locks the close date to today, with the note", async ({ page }) => {
  const name = unique("Won straight away");
  await page.goto("/deals");
  await page.getByRole("button", { name: "Add deal" }).click();
  const dialog = page.getByRole("dialog", { name: "Add deal" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Organization").selectOption({ label: "Keystone Capital" });
  await dialog.getByLabel("Main contact").selectOption({ label: "Henry Liu" });
  await dialog.getByLabel("Stage").selectOption("won");
  const close = dialog.getByLabel("Close date");
  await expect(close).toHaveValue(isoDaysFromToday(0));
  await expect(close).toHaveAttribute("readonly");
  await expect(dialog.getByText(/The close date will be set to today\./)).toBeVisible();
  await expect(dialog.getByLabel("Probability (%)")).toHaveValue("100");
  await dialog.getByLabel("Value ($)").fill("250,000");
  await dialog.getByRole("button", { name: "Add deal" }).click();
  await expect(dialog).toBeHidden();
  await page.getByLabel("Search deals").fill(name);
  const row = page.locator("tbody tr");
  await expect(row).toContainText("Won");
  await expect(row).toContainText(shownDate(isoDaysFromToday(0)));
  await expect(row).toContainText("$250,000");
});

test("a late deal shows the Late chip in the table", async ({ page }) => {
  await page.goto("/deals");
  await page.getByLabel("Search deals").fill("Precast panel contract");
  await expect(page.locator("tbody tr td:nth-child(7)")).toContainText("Late");
  await page.getByLabel("Search deals").fill("Grid sensor rollout");
  await expect(page.locator("tbody tr td:nth-child(7)")).not.toContainText("Late");
});

test("sorting by value is numeric", async ({ page }) => {
  await page.goto("/deals");
  const header = page.getByRole("columnheader", { name: /Value/ });
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "descending");
  const values = (await page.locator("tbody tr td:nth-child(5)").allInnerTexts()).map(money);
  expect(values).toEqual([...values].sort((a, b) => b - a));
  await header.getByRole("button").click();
  const ascending = (await page.locator("tbody tr td:nth-child(5)").allInnerTexts()).map(money);
  expect(ascending).toEqual([...ascending].sort((a, b) => a - b));
});

test("changing the stage in the edit form shows the note, then the table shows the new stage and probability", async ({
  page,
  api,
}) => {
  const deal = await api.deal(undefined, { stage: "qualified" });
  await page.goto("/deals");
  await page.getByLabel("Search deals").fill(deal.name);
  await page.getByRole("button", { name: `Edit ${deal.name}` }).click();
  const dialog = page.getByRole("dialog", { name: `Edit ${deal.name}` });
  await dialog.getByLabel("Stage").selectOption("negotiation");
  await expect(dialog.getByText("Probability will be set to 75%")).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  const row = page.locator("tbody tr");
  await expect(row).toContainText("Negotiation");
  await expect(row.locator("td:nth-child(6)")).toHaveText("75%");
});

test("deleting a deal gives both counts and mentions the stage history; a shared activity stays on the contact", async ({
  page,
  api,
}) => {
  const contact = await api.contact();
  const deal = await api.deal(contact, { stage: "proposal" });
  await api.move(deal, "negotiation");
  await api.activity({ deal });
  const shared = unique("Shared email");
  await api.activity({ contact, deal, type: "email", description: shared });

  await page.goto("/deals");
  await page.getByLabel("Search deals").fill(deal.name);
  await page.getByRole("button", { name: `Delete ${deal.name}` }).click();
  const dialog = page.getByRole("alertdialog", { name: `Delete ${deal.name}?` });
  await expect(dialog).toContainText("1 activity linked only to this deal will be deleted.");
  await expect(dialog).toContainText("1 activity also linked to a contact will stay on the contact's timeline.");
  await expect(dialog).toContainText("The deal's stage history will be deleted too.");
  await dialog.getByRole("button", { name: "Delete deal" }).click();
  await expect(page.getByText(`No deals match '${deal.name}'`)).toBeVisible();

  await page.goto(`/contacts/${contact.id}`);
  await expect(page.getByRole("region", { name: "Timeline" })).toContainText(shared);
});

test("deleting from the deal's own page goes back to the Deals table", async ({ page, api }) => {
  const deal = await api.deal();
  await page.goto(`/deals/${deal.id}`);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete deal" }).click();
  await expect(page).toHaveURL("/deals");
  await expect(page.getByRole("heading", { level: 1, name: "Deals" })).toBeVisible();
});
