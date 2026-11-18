import type { Locator, Page } from "@playwright/test";

import { type DealRec, expect, isoDaysFromToday, shownDate, test, unique } from "../fixtures";

const STAGES = ["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];

// Tall enough that dragged cards and their targets are on screen together.
test.use({ viewport: { width: 1440, height: 1500 } });

// This file runs in the "one-at-a-time" project (e2e/playwright.config.ts): a
// move names the card it lands above, and tests running alongside could move
// that card first.

function column(page: Page, stage: string) {
  return page.getByRole("region", { name: new RegExp(`^${stage},`) });
}

function card(page: Page, name: string) {
  return page.locator("li[data-deal-id]", { hasText: name });
}

function cardsIn(page: Page, stage: string) {
  return column(page, stage).locator("li[data-deal-id]");
}

function money(text: string) {
  return Number(text.replace(/[^0-9]/g, ""));
}

async function columnFigures(page: Page, stage: string) {
  const header = column(page, stage).locator("header");
  const [count, value] = await Promise.all([
    header.locator("h2 .num").textContent().then((t) => t ?? ""),
    header.locator("p.num").innerText(),
  ]);
  return { count: Number(count.replace(/\D+/g, "")), value: money(value) };
}

async function sentence(page: Page) {
  return page.getByRole("main").locator("p", { hasText: "open across" }).innerText();
}

/** dnd-kit needs to see the pointer move before a drag starts, so the mouse moves in steps. */
async function drag(page: Page, from: Locator, to: Locator, { above = false } = {}) {
  await to.scrollIntoViewIfNeeded();
  await from.scrollIntoViewIfNeeded();
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  const startX = a.x + a.width / 2;
  const startY = a.y + Math.min(30, a.height / 2);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 4, startY + 8, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, above ? b.y + 6 : b.y + b.height / 2, { steps: 20 });
  await page.mouse.move(b.x + b.width / 2, above ? b.y + 4 : b.y + b.height / 2 + 2, { steps: 4 });
  await page.mouse.up();
}

async function chooseStage(page: Page, deal: DealRec | { name: string }, from: string, to: string) {
  await page.getByRole("button", { name: `Stage: ${from}. Change stage of ${deal.name}` }).click();
  await page.getByRole("menuitemradio", { name: to }).click();
}

function stageButton(page: Page, deal: DealRec, stage: string) {
  return page.getByRole("button", { name: `Stage: ${stage}. Change stage of ${deal.name}` });
}

/** Opens a stage menu with the keyboard and chooses a stage with the arrow keys and Enter. */
async function chooseStageByKeyboard(page: Page, button: Locator, to: string) {
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitemradio", { name: "New" })).toBeFocused();
  // Radix moves focus a moment after each key, so wait for each step as a person would.
  for (const stage of STAGES.slice(1, STAGES.indexOf(to) + 1)) {
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitemradio", { name: stage })).toBeFocused();
  }
  await page.keyboard.press("Enter");
}

test("the board shows the sample deals as cards in six columns", async ({ page }) => {
  await page.goto("/pipeline");
  for (const stage of STAGES) await expect(column(page, stage)).toBeVisible();
  await expect(cardsIn(page, "Negotiation").filter({ hasText: "Steel supply agreement 2027" })).toHaveCount(1);
  await expect(cardsIn(page, "New").filter({ hasText: "Grid sensor rollout" })).toHaveCount(1);
  await expect(cardsIn(page, "Won").filter({ hasText: "Branch network upgrade" })).toHaveCount(1);
  await expect(cardsIn(page, "Lost").filter({ hasText: "Policy admin migration" })).toHaveCount(1);
  // Long-closed deals stay off the board.
  await expect(card(page, "Conveyor replacement")).toHaveCount(0);
  await expect(card(page, "Steel supply agreement 2027")).toContainText("$950K");
});

test("a card dragged to the next column moves, with its totals, before the server replies", async ({ page, api }) => {
  const deal = await api.deal(undefined, { stage: "qualified", value: 123000 });
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/deals/*/move", async (route) => {
    await held;
    await route.continue();
  });

  await page.goto("/pipeline");
  await expect(cardsIn(page, "Qualified").filter({ hasText: deal.name })).toHaveCount(1);
  const qualifiedBefore = await columnFigures(page, "Qualified");
  const proposalBefore = await columnFigures(page, "Proposal");
  const sentenceBefore = await sentence(page);

  // Dropped on a sample card that no other test moves, since tests run side by side.
  await drag(page, card(page, deal.name), card(page, "Turbine maintenance contract"));

  // Moved already, while the server's reply is held back.
  await expect(cardsIn(page, "Proposal").filter({ hasText: deal.name })).toHaveCount(1);
  await expect(cardsIn(page, "Qualified").filter({ hasText: deal.name })).toHaveCount(0);
  expect(await columnFigures(page, "Proposal")).toEqual({
    count: proposalBefore.count + 1,
    value: proposalBefore.value + 123000,
  });
  expect(await columnFigures(page, "Qualified")).toEqual({
    count: qualifiedBefore.count - 1,
    value: qualifiedBefore.value - 123000,
  });
  // Expected revenue went from 25% to 50% of $123,000: up $30,750.
  const expected = (text: string) => money(/with \$([\d,]+) expected/.exec(text)![1]);
  expect(expected(await sentence(page))).toBe(expected(sentenceBefore) + 30750);

  const reply = page.waitForResponse("**/api/deals/*/move");
  release();
  expect((await reply).status()).toBe(200);

  await page.goto("/deals");
  await page.getByLabel("Search deals").fill(deal.name);
  await expect(page.locator("tbody tr")).toContainText("Proposal");
  await expect(page.locator("tbody tr td:nth-child(6)")).toHaveText("50%");
});

test("a card dragged higher in its own column stays there after a refresh", async ({ page, api }) => {
  const contact = await api.contact();
  const lower = await api.deal(contact, { stage: "negotiation", name: unique("Lower") });
  const upper = await api.deal(contact, { stage: "negotiation", name: unique("Upper") });
  await page.goto("/pipeline");
  const names = () => cardsIn(page, "Negotiation").allInnerTexts();
  const index = (texts: string[], name: string) => texts.findIndex((t) => t.includes(name));
  let texts = await names();
  expect(index(texts, upper.name)).toBeLessThan(index(texts, lower.name));

  const moved = page.waitForResponse("**/api/deals/*/move");
  await drag(page, card(page, lower.name), card(page, upper.name), { above: true });
  await moved;
  await page.reload();
  await expect(card(page, lower.name)).toBeVisible();
  texts = await names();
  expect(index(texts, lower.name)).toBeLessThan(index(texts, upper.name));
});

test("the stage menu works by keyboard, moves the card to the top, keeps focus and announces it", async ({ page, api }) => {
  const deal = await api.deal(undefined, { stage: "proposal" });
  await page.goto("/pipeline");
  const button = page.getByRole("button", { name: `Stage: Proposal. Change stage of ${deal.name}` });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitemradio", { name: "New" })).toBeFocused();
  // Radix moves focus a moment after each key, so wait for each step as a person would.
  for (const stage of ["Qualified", "Proposal", "Negotiation"]) {
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitemradio", { name: stage })).toBeFocused();
  }
  await page.keyboard.press("Enter");

  // At the top: above the column's sample cards. Other tests may add cards of their own meanwhile.
  await expect(cardsIn(page, "Negotiation").filter({ hasText: deal.name })).toHaveCount(1);
  const texts = await cardsIn(page, "Negotiation").allInnerTexts();
  const at = texts.findIndex((t) => t.includes(deal.name));
  expect(at).toBeGreaterThanOrEqual(0);
  expect(at).toBeLessThan(texts.findIndex((t) => t.includes("Steel supply agreement 2027")));
  await expect(page.getByRole("button", { name: `Stage: Negotiation. Change stage of ${deal.name}` })).toBeFocused();
  await expect(page.getByText(`Moved ${deal.name} to Negotiation`)).toHaveAttribute("aria-live", "polite");
});

test("moving a deal to Won sets today's close date, says so, and leaves the contact's status alone", async ({ page, api }) => {
  const contact = await api.contact(undefined, { status: "qualified" });
  const deal = await api.deal(contact, { stage: "negotiation", close_date: isoDaysFromToday(50) });
  await page.goto("/pipeline");
  await chooseStage(page, deal, "Negotiation", "Won");
  await expect(page.getByText("Moved to Won. Close date set to today.")).toBeVisible();
  await expect(cardsIn(page, "Won").filter({ hasText: deal.name })).toContainText(shownDate(isoDaysFromToday(0)));
  const after = await api.get<{ status: string }>(`/contacts/${contact.id}`);
  expect(after.status).toBe("qualified");
});

test("moving a Won deal back asks for a new close date; Cancel puts it back, and Reopen moves it", async ({ page, api }) => {
  const deal = await api.deal(undefined, { stage: "won" });
  await page.goto("/pipeline");
  await chooseStage(page, deal, "Won", "Proposal");
  const dialog = page.getByRole("dialog", { name: `Reopen ${deal.name}` });
  await expect(dialog.getByLabel("New expected close date")).toHaveValue(isoDaysFromToday(30));
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(cardsIn(page, "Won").filter({ hasText: deal.name })).toHaveCount(1);

  await chooseStage(page, deal, "Won", "Proposal");
  await dialog.getByLabel("New expected close date").fill(isoDaysFromToday(45));
  await dialog.getByRole("button", { name: "Reopen" }).click();
  const moved = cardsIn(page, "Proposal").filter({ hasText: deal.name });
  await expect(moved).toHaveCount(1);
  await expect(moved).toContainText(shownDate(isoDaysFromToday(45)));
});

test("dragging a Won deal to an open column asks first, and Cancel puts the card back", async ({ page, api }) => {
  const deal = await api.deal(undefined, { stage: "lost" });
  await page.goto("/pipeline");
  await drag(page, card(page, deal.name), card(page, "Steel supply agreement 2027"));
  const dialog = page.getByRole("dialog", { name: `Reopen ${deal.name}` });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(cardsIn(page, "Lost").filter({ hasText: deal.name })).toHaveCount(1);
  await expect(cardsIn(page, "Negotiation").filter({ hasText: deal.name })).toHaveCount(0);
});

test("dragging a Lost deal to an open column and choosing Reopen moves it, and the board keeps up with the next move", async ({
  page,
  api,
}) => {
  const lost = await api.deal(undefined, { stage: "lost" });
  const next = await api.deal(undefined, { stage: "new" });
  await page.goto("/pipeline");
  await drag(page, card(page, lost.name), card(page, "Steel supply agreement 2027"));
  const dialog = page.getByRole("dialog", { name: `Reopen ${lost.name}` });
  await dialog.getByLabel("New expected close date").fill(isoDaysFromToday(45));
  await dialog.getByRole("button", { name: "Reopen" }).click();
  await expect(dialog).toBeHidden();
  const reopened = cardsIn(page, "Negotiation").filter({ hasText: lost.name });
  await expect(reopened).toHaveCount(1);
  await expect(reopened).toContainText(shownDate(isoDaysFromToday(45)));
  await expect(cardsIn(page, "Lost").filter({ hasText: lost.name })).toHaveCount(0);

  // The board still follows the data: the next move shows at once, and the
  // column's header counts the cards it shows.
  await chooseStage(page, next, "New", "Qualified");
  await expect(cardsIn(page, "Qualified").first()).toContainText(next.name);
  await expect(cardsIn(page, "New").filter({ hasText: next.name })).toHaveCount(0);
  const { count } = await columnFigures(page, "Qualified");
  await expect(cardsIn(page, "Qualified")).toHaveCount(count);

  const saved = await api.get<DealRec & { stage: string; close_date: string }>(`/deals/${lost.id}`);
  expect([saved.stage, saved.close_date]).toEqual(["negotiation", isoDaysFromToday(45)]);
});

test("when the server refuses a reopen after a drag, the card goes back to its column", async ({ page, api }) => {
  const lost = await api.deal(undefined, { stage: "lost" });
  await page.route("**/api/deals/*/move", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ message: "Refused for this test.", details: {} }),
    }),
  );
  await page.goto("/pipeline");
  await drag(page, card(page, lost.name), card(page, "Steel supply agreement 2027"));
  const dialog = page.getByRole("dialog", { name: `Reopen ${lost.name}` });
  await dialog.getByRole("button", { name: "Reopen" }).click();
  await expect(page.locator("[data-sonner-toast]", { hasText: `${lost.name} wasn't moved. Refused for this test.` })).toBeVisible();
  await expect(cardsIn(page, "Lost").filter({ hasText: lost.name })).toHaveCount(1);
  await expect(cardsIn(page, "Negotiation").filter({ hasText: lost.name })).toHaveCount(0);
});

test("reopening from a card's stage menu by keyboard keeps focus on the card, after Cancel and after Reopen", async ({
  page,
  api,
}) => {
  const deal = await api.deal(undefined, { stage: "won" });
  await page.goto("/pipeline");
  const dialog = page.getByRole("dialog", { name: `Reopen ${deal.name}` });
  const date = dialog.getByLabel("New expected close date");

  await chooseStageByKeyboard(page, stageButton(page, deal, "Won"), "Proposal");
  await expect(date).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(stageButton(page, deal, "Won")).toBeFocused();

  await chooseStageByKeyboard(page, stageButton(page, deal, "Won"), "Proposal");
  await expect(date).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(cardsIn(page, "Proposal").filter({ hasText: deal.name })).toHaveCount(1);
  await expect(stageButton(page, deal, "Proposal")).toBeFocused();
});

test("on a deal's page, the stage menu by keyboard keeps focus on its button, also after reopening", async ({
  page,
  api,
}) => {
  // The same menu as on the board, so it's tested here, away from tests that move cards.
  const deal = await api.deal(undefined, { stage: "new" });
  await page.goto(`/deals/${deal.id}`);

  await chooseStageByKeyboard(page, stageButton(page, deal, "New"), "Qualified");
  await expect(stageButton(page, deal, "Qualified")).toBeFocused();

  await chooseStageByKeyboard(page, stageButton(page, deal, "Qualified"), "Won");
  await expect(stageButton(page, deal, "Won")).toBeFocused();

  await chooseStageByKeyboard(page, stageButton(page, deal, "Won"), "Proposal");
  const dialog = page.getByRole("dialog", { name: `Reopen ${deal.name}` });
  await expect(dialog.getByLabel("New expected close date")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(stageButton(page, deal, "Proposal")).toBeFocused();
});

test("when the server refuses a move, the card goes back and a message says why", async ({ page, api }) => {
  const deal = await api.deal(undefined, { stage: "new" });
  await page.route("**/api/deals/*/move", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ message: "That card is no longer in the Qualified column. Refresh the page and try again.", details: {} }),
    }),
  );
  await page.goto("/pipeline");
  await chooseStage(page, deal, "New", "Qualified");
  await expect(
    page.locator("[data-sonner-toast]", { hasText: `${deal.name} wasn't moved. That card is no longer in the Qualified column.` }),
  ).toBeVisible();
  await expect(cardsIn(page, "New").filter({ hasText: deal.name })).toHaveCount(1);
  await expect(cardsIn(page, "Qualified").filter({ hasText: deal.name })).toHaveCount(0);
});

test("Add deal in the Qualified column starts at Qualified, and the card lands at the top", async ({ page }) => {
  const name = unique("From the column");
  await page.goto("/pipeline");
  await page.getByRole("button", { name: "Add deal to Qualified" }).click();
  const dialog = page.getByRole("dialog", { name: "Add deal" });
  await expect(dialog.getByLabel("Stage")).toHaveValue("qualified");
  await expect(dialog.getByLabel("Probability (%)")).toHaveValue("25");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Organization").selectOption({ label: "Meridian Labs" });
  await dialog.getByLabel("Main contact").selectOption({ label: "Aisha Rahman" });
  await dialog.getByLabel("Value ($)").fill("300000");
  await dialog.getByLabel("Close date").fill(isoDaysFromToday(90));
  await dialog.getByRole("button", { name: "Add deal" }).click();
  await expect(dialog).toBeHidden();
  await expect(cardsIn(page, "Qualified").first()).toContainText(name);
});

test("a Won deal whose close date is edited to 40 days ago leaves the board and stays in the Deals table", async ({
  page,
  api,
}) => {
  const deal = await api.deal(undefined, { stage: "won" });
  await page.goto(`/deals/${deal.id}`);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Edit ${deal.name}` });
  await dialog.getByLabel("Close date").fill(isoDaysFromToday(-40));
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await page.goto("/pipeline");
  await expect(cardsIn(page, "Won").first()).toBeVisible();
  await expect(card(page, deal.name)).toHaveCount(0);
  await page.goto("/deals");
  await page.getByLabel("Search deals").fill(deal.name);
  await expect(page.locator("tbody tr")).toContainText(shownDate(isoDaysFromToday(-40)));
});

test("a late deal's card shows the Late chip", async ({ page }) => {
  await page.goto("/pipeline");
  await expect(card(page, "Precast panel contract").getByText("Late", { exact: true })).toBeVisible();
  await expect(card(page, "Grid sensor rollout").getByText("Late", { exact: true })).toHaveCount(0);
});

test("the header sentence and the column totals match the deals on the board", async ({ page, api }) => {
  await expect
    .poll(
      async () => {
        await page.goto("/pipeline");
        await expect(cardsIn(page, "New").first()).toBeVisible();
        const deals = await api.get<DealRec[]>("/deals");
        const today = isoDaysFromToday(0);
        const window = isoDaysFromToday(-30);
        const onBoard = deals.filter((d) => !["won", "lost"].includes(d.stage) || d.close_date >= window);
        const open = onBoard.filter((d) => !["won", "lost"].includes(d.stage));
        const expected = open.reduce((s, d) => s + Math.floor((d.value * d.probability + 50) / 100), 0);
        const late = open.filter((d) => d.close_date < today).length;
        const wanted = `$${open.reduce((s, d) => s + d.value, 0).toLocaleString("en-US")} open across ${open.length} deals, with $${expected.toLocaleString("en-US")} expected. ${late} are late.`;
        const shown = await sentence(page);
        const columns = await Promise.all(STAGES.map((s) => columnFigures(page, s)));
        const fromApi = STAGES.map((s) => {
          const inColumn = onBoard.filter((d) => d.stage === s.toLowerCase());
          return { count: inColumn.length, value: inColumn.reduce((sum, d) => sum + d.value, 0) };
        });
        const cardCounts = await Promise.all(STAGES.map((s) => cardsIn(page, s).count()));
        return shown === wanted && JSON.stringify(columns) === JSON.stringify(fromApi) && cardCounts.every((n, i) => n === columns[i].count);
      },
      { timeout: 20_000 },
    )
    .toBe(true);
});
