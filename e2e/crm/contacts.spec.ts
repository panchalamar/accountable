import { expect, firstColumn, test, unique } from "../fixtures";

const byName = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base", numeric: true });

async function statusCounts(page: import("@playwright/test").Page) {
  const group = page.getByRole("group", { name: "Filter by status" });
  const read = async (label: string) =>
    Number((await group.getByRole("button", { name: new RegExp(`^${label}`) }).innerText()).replace(/\D+/g, ""));
  return { customer: await read("Customer"), qualified: await read("Qualified") };
}

test("the table shows the sample contacts, sorted by name A to Z", async ({ page }) => {
  await page.goto("/contacts");
  const names = await firstColumn(page);
  expect(names).toEqual(expect.arrayContaining(["Aisha Rahman", "Priya Shah", "Tom Becker"]));
  expect(names).toEqual([...names].sort(byName));
});

test("adding a contact refuses a bad email, then a used one, then saves", async ({ page, api }) => {
  const taken = await api.contact(undefined, { email: `${unique("taken").replace(/\W+/g, ".")}@acme.example.com`.toLowerCase() });
  const name = unique("Rosa Diaz");
  await page.goto("/contacts");
  await page.getByRole("button", { name: "Add contact" }).click();
  const dialog = page.getByRole("dialog", { name: "Add contact" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Organization").selectOption({ label: "Atlas Freight" });
  const email = dialog.getByLabel("Email");

  await email.fill("rosa@atlas");
  await dialog.getByRole("button", { name: "Add contact" }).click();
  await expect(dialog.getByText("Enter a valid email address, like name@company.com.")).toBeVisible();
  await expect(email).toBeFocused();

  await email.fill(taken.email!.toUpperCase());
  await dialog.getByRole("button", { name: "Add contact" }).click();
  await expect(dialog.getByText("Another contact already uses this email.")).toBeVisible();
  await expect(email).toBeFocused();

  const good = `${name.replace(/\W+/g, ".")}@atlasfreight.example.com`.toLowerCase();
  await email.fill(good);
  await dialog.getByRole("button", { name: "Add contact" }).click();
  await expect(dialog).toBeHidden();
  await page.getByLabel("Search contacts").fill(name);
  await expect(page.locator("tbody tr")).toContainText([good]);
});

test("the status filter shows counts, works with search, and counts change after a status edit", async ({ page, api }) => {
  const contact = await api.contact(undefined, { status: "customer" });
  await page.goto("/contacts");
  const group = page.getByRole("group", { name: "Filter by status" });
  await expect(group.getByRole("button", { name: /^All/ })).toHaveAttribute("aria-pressed", "true");
  const before = await statusCounts(page);

  // Each count matches the rows the filter shows.
  await group.getByRole("button", { name: /^Customer/ }).click();
  await expect(page.locator("tbody tr")).toHaveCount(before.customer);

  await page.getByLabel("Search contacts").fill(contact.name);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await group.getByRole("button", { name: /^Qualified/ }).click();
  await expect(page.getByText(`No contacts match '${contact.name}'`)).toBeVisible();

  await group.getByRole("button", { name: /^Customer/ }).click();
  await page.getByRole("button", { name: `Edit ${contact.name}` }).click();
  const dialog = page.getByRole("dialog", { name: `Edit ${contact.name}` });
  await dialog.getByLabel("Status").selectOption("qualified");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText(`No contacts match '${contact.name}'`)).toBeVisible();
  await expect.poll(() => statusCounts(page)).toEqual({ customer: before.customer - 1, qualified: before.qualified + 1 });
});

test("moving a deal's main contact to another organization is refused, naming the deals", async ({ page, api }) => {
  const contact = await api.contact();
  const deal = await api.deal(contact);
  const other = await api.org();
  await page.goto(`/contacts/${contact.id}`);
  await page.getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: `Edit ${contact.name}` });
  await dialog.getByLabel("Organization").selectOption({ label: other.name });
  await dialog.getByRole("button", { name: "Save" }).click();
  const alert = dialog.getByRole("alert");
  await expect(alert).toContainText(`${contact.name} can't move to another organization`);
  await expect(alert).toContainText(deal.name);
  await expect(alert).toContainText("Choose a different main contact");
});

test("moving a contact who isn't a main contact works", async ({ page, api }) => {
  const contact = await api.contact();
  const other = await api.org();
  await page.goto(`/contacts/${contact.id}`);
  await page.getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: `Edit ${contact.name}` });
  await dialog.getByLabel("Organization").selectOption({ label: other.name });
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("region", { name: "Details" }).getByRole("link", { name: other.name })).toBeVisible();
});

test("deleting a deal's main contact is refused, and the dialog lists the deals", async ({ page, api }) => {
  const contact = await api.contact();
  const deal = await api.deal(contact);
  await page.goto("/contacts");
  await page.getByLabel("Search contacts").fill(contact.name);
  await page.getByRole("button", { name: `Delete ${contact.name}` }).click();
  const dialog = page.getByRole("alertdialog", { name: `${contact.name} can't be deleted` });
  await expect(dialog.getByRole("link", { name: deal.name })).toBeVisible();
  await expect(dialog.getByRole("button")).toHaveText(["Close"]);
});

test("deleting another contact gives both counts, and a shared activity stays on the deal", async ({ page, api }) => {
  const org = await api.org();
  const lead = await api.contact(org);
  const deal = await api.deal(lead);
  const helper = await api.contact(org);
  await api.activity({ contact: helper });
  await api.activity({ contact: helper });
  const shared = unique("Shared call");
  await api.activity({ contact: helper, deal, description: shared });

  await page.goto(`/contacts/${helper.id}`);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: `Delete ${helper.name}?` });
  await expect(dialog).toContainText(`2 activities linked only to ${helper.name} will be deleted.`);
  await expect(dialog).toContainText("1 activity also linked to a deal will stay on the deal's timeline.");
  await dialog.getByRole("button", { name: "Delete contact" }).click();
  await expect(page).toHaveURL("/contacts");

  await page.goto(`/deals/${deal.id}`);
  await expect(page.getByRole("region", { name: "Timeline" })).toContainText(shared);
});

test("the record page shows the details and deals, with mailto and organization links", async ({ page, api }) => {
  const org = await api.org();
  const email = `${unique("lena").replace(/\W+/g, ".")}@harbor.example.com`.toLowerCase();
  const contact = await api.contact(org, { email, phone: "+1 (206) 555-0170", job_title: "Chief Nursing Officer" });
  const deal = await api.deal(contact);
  await page.goto(`/contacts/${contact.id}`);
  await expect(page.getByRole("heading", { level: 1, name: contact.name })).toBeVisible();
  await expect(page.getByRole("link", { name: email })).toHaveAttribute("href", `mailto:${email}`);
  await expect(page.getByText("+1 (206) 555-0170")).toBeVisible();
  await page.getByRole("region", { name: "Details" }).getByRole("link", { name: org.name }).click();
  await expect(page).toHaveURL(`/organizations/${org.id}`);
  await page.goBack();
  await expect(page.getByRole("region", { name: /Main contact on/ }).getByRole("link", { name: deal.name })).toBeVisible();
});
