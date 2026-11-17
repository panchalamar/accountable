import { expect, isoDaysFromToday, localDateTime, test, unique } from "../fixtures";

test("a call logged on a contact and linked to a deal shows on both timelines, newest first", async ({ page, api }) => {
  const org = await api.org();
  const contact = await api.contact(org);
  const deal = await api.deal(contact);
  const older = unique("Older note");
  await api.activity({ contact, deal, type: "note", description: older, occurred_at: localDateTime(new Date(Date.now() - 3 * 864e5)) });

  const description = unique("Called about the renewal");
  await page.goto(`/contacts/${contact.id}`);
  await page.getByRole("button", { name: "Log activity" }).click();
  const dialog = page.getByRole("dialog", { name: "Log activity" });
  await dialog.getByText("Call", { exact: true }).click();
  await dialog.getByLabel("Description").fill(description);
  await dialog.getByLabel("Also link to a deal").selectOption({ label: deal.name });
  await dialog.getByRole("button", { name: "Log activity" }).click();
  await expect(dialog).toBeHidden();

  const contactTimeline = page.getByRole("region", { name: "Timeline" });
  await expect(contactTimeline.locator("li")).toContainText([description, older]);
  await contactTimeline.locator("li", { hasText: description }).getByRole("link", { name: deal.name }).click();

  await expect(page).toHaveURL(`/deals/${deal.id}`);
  const dealTimeline = page.getByRole("region", { name: "Timeline" });
  await expect(dealTimeline.locator("li")).toContainText([description, older]);
  await dealTimeline.locator("li", { hasText: description }).getByRole("link", { name: contact.name }).click();
  await expect(page).toHaveURL(`/contacts/${contact.id}`);
});

test("an activity can be edited, then deleted after confirming", async ({ page, api }) => {
  const contact = await api.contact();
  const description = unique("First draft");
  await api.activity({ contact, description });
  await page.goto(`/contacts/${contact.id}`);
  const timeline = page.getByRole("region", { name: "Timeline" });
  await timeline.getByRole("button", { name: `Edit activity: ${description}` }).click();
  const dialog = page.getByRole("dialog", { name: "Edit activity" });
  const edited = unique("Second draft");
  await dialog.getByLabel("Description").fill(edited);
  await dialog.getByText("Email", { exact: true }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(timeline).toContainText(edited);
  await expect(timeline.locator("li", { hasText: edited })).toContainText("Email");

  await timeline.getByRole("button", { name: `Delete activity: ${edited}` }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete this activity?" });
  await expect(confirm.getByRole("button")).toHaveText(["Cancel", "Delete"]);
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(timeline).not.toContainText(edited);
  await expect(timeline).toContainText("No activities yet.");
});

test("ticking Done on a timeline keeps the follow-up there, marked done, and it can be unticked", async ({ page, api }) => {
  const contact = await api.contact();
  const description = unique("Send the price list");
  await api.activity({ contact, description, follow_up_date: isoDaysFromToday(2) });
  await page.goto(`/contacts/${contact.id}`);
  const item = page.getByRole("region", { name: "Timeline" }).locator("li", { hasText: description });
  const done = item.getByRole("checkbox", { name: `Done: ${description}` });
  await expect(item).toContainText("Due in 2 days");
  await done.click();
  await expect(done).toBeChecked();
  await expect(item).toContainText("Done");
  await page.reload();
  await expect(done).toBeChecked();
  await done.click();
  await expect(done).not.toBeChecked();
  await expect(item).toContainText("Due in 2 days");
});

test('a stage change shows "Moved from Proposal to Negotiation" on the deal\'s timeline', async ({ page, api }) => {
  const deal = await api.deal(undefined, { stage: "proposal" });
  await api.move(deal, "negotiation");
  await page.goto(`/deals/${deal.id}`);
  await expect(page.getByRole("region", { name: "Timeline" }).locator("li").first()).toHaveText(/Moved from\s*Proposal\s*to\s*Negotiation/);
});
