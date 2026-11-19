# Spec: the Accountable MVP

This spec turns `docs/intent.md` into requirements and a design. The intent says what we're building and why. This document says exactly how it behaves and how it looks, so it can be planned, built and tested. The stack is in `docs/TECH_STACK.md` and the look follows the `brand` skill.

Part 1 lists the requirements, each with an ID so the plan and the tests can refer to it. Part 2 is the design. Part 3 lists the concerns raised while writing it, and how each was decided.

---

# Part 1: Requirements

## Running and data (RUN)

- **RUN-1** `npm run dev`, run from the repo root on Mac, Linux or Windows, starts the backend and the frontend together. Once both are ready it opens the dashboard in Google Chrome, or in the default browser if Chrome isn't found. The first run installs what's missing by itself. The only prerequisites are Node.js 24 or later and uv.
- **RUN-2** Once it's installed, nothing needs an internet connection. The fonts and every other asset are bundled with the app.
- **RUN-3** The data lives in one SQLite file, `data/accountable.db`, which git ignores. If the file doesn't exist when the backend starts, the backend creates it and fills it with the sample data.
- **RUN-4** Every change is saved as soon as the user saves it. It's still there after a browser refresh and after the app restarts.
- **RUN-5** `npm run seed` replaces all the data with fresh sample data. `npm run clear` deletes all the data so the user can start empty. Each command says what it will do and asks the user to type `yes`. Any other answer cancels and changes nothing. Both work while the app is running, and the browser shows the new data after a refresh.
- **RUN-6** The tests use a database and ports of their own, so they never touch `data/accountable.db`, and `npm test` works while the app is running.

## Records and fields (DATA)

Required fields are marked. Every text field is trimmed, and a field left blank is stored as empty.

**Organization**

| Field | Rules |
|---|---|
| Name (required) | Up to 200 characters |
| Website | Optional. Must start with `http://` or `https://` once saved. If the user types `northwind.com`, it's saved as `https://northwind.com` |
| Industry | Optional free text. The field suggests the industries already in use |
| Notes | Optional, several lines, up to 5,000 characters |

**Contact**

| Field | Rules |
|---|---|
| Name (required) | Up to 200 characters |
| Email | Optional. Must look like an email address (something@something.something) |
| Phone | Optional free text |
| Job title | Optional |
| Organization | Optional. Chosen from a searchable list of organizations |
| Status | Lead, Qualified or Customer. New contacts start as Lead |

**Deal**

| Field | Rules |
|---|---|
| Name (required) | Up to 200 characters |
| Stage (required) | New, Qualified, Proposal, Negotiation, Won or Lost. Starts as New, or as the column's stage when it's added on the pipeline |
| Value (required) | Whole US dollars, 0 or more. The field accepts `48000`, `48,000` and `$48,000` |
| Probability of close | A whole number from 0 to 100. Starts at the stage's usual probability |
| Close date | Optional. The expected close date while the deal is open, and the actual one once it's won or lost |
| Organization | Optional |
| Main contact | Optional. Contacts at the chosen organization are listed first. If the user picks a contact while the organization is empty, the organization fills in with the contact's |

**Activity**

| Field | Rules |
|---|---|
| Type (required) | Note, Call or Email. Starts as Note |
| Relates to | The contact or the deal it was logged on, never both. Set by the page it's logged from |
| Description (required) | Up to 5,000 characters |
| When (required) | A date and time. Starts as now and can be in the past or the future |
| Follow-up date | Optional |
| Done | Only for an activity with a follow-up date. Starts as not done |

## Stages and deal rules (STAGE)

- **STAGE-1** The stages, in order, and their usual probabilities of close:

  | Stage | New | Qualified | Proposal | Negotiation | Won | Lost |
  |---|---|---|---|---|---|---|
  | Probability | 5% | 20% | 40% | 70% | 100% | 0% |

  New to Negotiation are the **open** stages. Won and Lost are **closed**.
- **STAGE-2** A deal can change stage by being dragged on the pipeline, from its card's menu, from its own page, or from the edit form. Every one of these applies the same rules in a single save:
  - The probability becomes the new stage's usual one, unless the same save sets the probability by hand.
  - An entry such as "Moved from Proposal to Negotiation" is recorded with the time of the change.
  - If the new stage is Won or Lost, the close date becomes today, unless the same save sets the close date.
  - On the pipeline, the card goes where it was dropped. Otherwise it goes to the top of its new column.
- **STAGE-3** In the edit form, choosing a new stage fills in the new probability straight away, and also today's date as the close date for Won or Lost. The user sees both before saving and can change them.
- **STAGE-4** A probability set by hand is kept until the stage changes. Editing any other field leaves it alone.
- **STAGE-5** A deal moved from Won or Lost back to an open stage keeps its close date until someone changes it.
- **STAGE-6** Whenever a deal is saved at Won with a main contact who isn't a customer, that contact becomes a customer. A "Became a customer" entry naming the deal then appears in the contact's timeline. This covers moving a deal to Won, adding a deal straight into Won, and changing the main contact of a deal that's already won. Moving a deal out of Won doesn't change the contact back.
- **STAGE-7** Adding a deal isn't a change of stage, so it doesn't record a "Moved from" entry.
- **STAGE-8** A deal is **late** when it's at an open stage and its close date is before today. A late deal shows a "Late" badge next to its close date in the deals table, on its pipeline card and on its page.
- **STAGE-9** A deal's **expected revenue** is its value times its probability of close. Totals are added up first and rounded to whole dollars only for display.
- **STAGE-10** "Today" is the date on the computer Accountable runs on.

## Tables (TBL)

- **TBL-1** Organizations, Contacts and Deals each have a table with a search box, sortable columns, a "New organization" (or contact, or deal) button, and an Edit and a Delete button on each row. A table shows 25 rows a page, with Previous and Next buttons and a line such as "26–50 of 132".
- **TBL-2** Search ignores case, matches any part of the searched columns, filters as the user types, and goes back to page 1.
- **TBL-3** Clicking a column heading sorts by that column in ascending order, and clicking it again sorts in descending order. Only one column is sorted at a time, an arrow shows which one and which way, and empty values go last either way.
- **TBL-4** Each record's name links to its own page.
- **TBL-5** An empty table says so and offers the New button: "No deals yet." A search with no results says "No deals match "acme"" and offers a Clear search button.
- **TBL-6** After a new record is saved from a table, the table stays put and a message confirms it ("Northwind Traders added"), with a link to open the record.
- **TBL-7** The columns, what search looks in, and the default sort:

  | Table | Columns | Search looks in | Default sort |
  |---|---|---|---|
  | Organizations | Name, Industry, Website, Contacts (count), Open deals (count), Open value | Name, industry, website | Name, A to Z |
  | Contacts | Name, Status, Organization, Job title, Email, Phone | Name, email, phone, job title, organization | Name, A to Z |
  | Deals | Name, Stage, Value, Probability, Expected revenue, Close date, Organization, Main contact | Name, organization, main contact | Name, A to Z |

  A missing organization shows as "No organization" and a missing main contact as "No contact".

## Organizations (ORG)

- **ORG-1** An organization's page shows its name, industry, website (opening in a new tab) and notes, with Edit and Delete buttons.
- **ORG-2** It lists the organization's contacts (name, status, job title, email) and its deals (name, stage, value, close date, late badge), with the number and total value of its open deals. Each one links to its page.
- **ORG-3** "New contact" and "New deal" buttons on the page open the form with this organization already filled in.

## Contacts (CON)

- **CON-1** The contacts table has a status filter: All, Lead, Qualified and Customer, each showing its count. The filter works together with search and is kept in the page address (for example `/contacts?status=lead`).
- **CON-2** A contact's page shows their name, status, job title, organization (a link, or "No organization"), email (a mailto link) and phone (a tel link), with Edit and Delete buttons.
- **CON-3** It lists the deals where they're the main contact, and shows their timeline (ACT-3) with a form to log an activity.

## Deals (DEAL)

- **DEAL-1** A deal's page shows its name, stage, late badge, value, probability of close, expected revenue, close date, organization and main contact, with Edit and Delete buttons.
- **DEAL-2** The page has a stage control listing all six stages. Choosing one changes the stage under the STAGE-2 rules.
- **DEAL-3** It shows the deal's timeline with a form to log an activity.

## Pipeline (PIPE)

- **PIPE-1** The board has six columns in stage order, Won and Lost included. Each column's heading shows the stage, its number of deals, their total value and their expected revenue. Above the board, a summary shows the number, total value and expected revenue of the open deals.
- **PIPE-2** Every column shows all of its deals and scrolls up and down on its own. The board fills the window's height. At 1440 pixels wide all six columns fit without scrolling sideways. In a narrower window the board scrolls sideways and the page doesn't.
- **PIPE-3** A card shows the deal's name, organization (or "No organization"), value, probability, close date and late badge. Its name opens the deal's page.
- **PIPE-4** Dragging a card to another column and dropping it anywhere in that column changes the deal's stage (STAGE-2) and puts the card where it was dropped. Dragging a card higher or lower in its own column changes its place. Either way the card stays where it was dropped after a refresh.
- **PIPE-5** The board's and the columns' figures change as soon as the card is dropped, before the server replies. If the save fails, the card goes back to where it was and an error message says so.
- **PIPE-6** Each card has a menu with "Move to" and the other five stages, and "Open deal". Moving a card from the menu puts it at the top of the new column.
- **PIPE-7** Each column has an "Add deal" button that opens the New deal form with that stage chosen. The new card appears at the top of the column.

## Activities and timelines (ACT)

- **ACT-1** A contact's page and a deal's page each have a form to log an activity: type, description, when (starting as now) and an optional follow-up date.
- **ACT-2** A timeline lists entries newest first. There are three kinds of entry:
  - An activity shows its type, when it happened, its description and, if it has one, its follow-up date with a "Done" checkbox, plus Edit and Delete buttons.
  - A stage change reads "Moved from Proposal to Negotiation", with when it happened.
  - "Became a customer" names the deal that was won. This entry appears on contact timelines only.
- **ACT-3** A contact's timeline also shows the activities and stage changes of every deal where they're the main contact, each labelled with the deal's name as a link. If a deal's main contact changes, those entries move to the new contact's timeline with it.
- **ACT-4** An activity can be edited in place, with the same fields as the log form. Deleting one asks first (DEL-1).
- **ACT-5** An activity with a follow-up date that isn't done is an **open follow-up**. It's overdue if its date is before today, due today, or upcoming. It can be marked done from the dashboard or from a timeline, and unmarked from a timeline. Removing the follow-up date from an activity removes the follow-up too.

## Deleting (DEL)

- **DEL-1** Every delete asks first, in a dialog that names the record and says, with numbers, what happens to the records linked to it. Cancel has focus when the dialog opens. Nothing changes until the user chooses Delete.
- **DEL-2** Deleting an organization keeps its contacts and deals, which then show "No organization". Example: "Delete Northwind Traders? 3 contacts and 2 deals will be kept without an organization."
- **DEL-3** Deleting a contact keeps the deals where they were the main contact, which then show "No contact". It deletes the activities logged on the contact and their "Became a customer" entries. Activities logged on their deals stay with the deals. Example: "Delete Ana Ruiz? 2 deals will be kept without a contact. 5 activities logged on this contact will be deleted."
- **DEL-4** Deleting a deal deletes its activities and its stage changes. Its main contact stays a customer. Example: "Delete Acme renewal? 4 activities logged on this deal will be deleted."
- **DEL-5** Deleting an activity deletes only that activity. Example: "Delete this call from 14 Nov 2026?"
- **DEL-6** The wording handles one and none correctly: "1 contact will be kept without an organization", and "Nothing else is linked to it" when there's nothing.
- **DEL-7** Deleting a record from its own page goes back to its table afterwards.

## Dashboard (DASH)

- **DASH-1** The dashboard is the landing page, at `/`.
- **DASH-2** Four headline figures:
  - **Open pipeline**: the total value of the open deals, with their number and how many are late ("21 open deals, 4 late").
  - **Expected revenue**: the open deals' expected revenue, labelled "Value times probability of close".
  - **Won this month**: the total value of deals won this calendar month and their number, with last month's total beside it for comparison.
  - **Follow-ups**: the number overdue, with the number due today and upcoming.
- **DASH-3** A **line chart** of revenue won each month over the last 12 months, the current month included. A deal counts in the month of its close date.
- **DASH-4** A **bar chart** of the number of deals won and lost each month over the same 12 months.
- **DASH-5** A **funnel** showing, for each stage from New to Won, the total value and number of deals that reached it. A deal has reached a stage if it's at that stage or a later one, or was at that stage or a later one at some point. A lost deal counts for the furthest open stage it reached. For each stage after New, the funnel shows the share of the previous stage's value that carried on ("93% carried on").
- **DASH-6** A **follow-ups** list of every open follow-up, grouped as Overdue, Today, Next 7 days and Later. Each one shows its description, the contact or deal it's on (as a link), its date and how late it is ("3 days overdue"), and a checkbox to mark it done.
- **DASH-7** **Recent activity**: the 10 latest activities and stage changes that have already happened, newest first, each linking to its contact or deal.
- **DASH-8** The figures match the data and are fetched again whenever the dashboard is opened, so a deal just won or a follow-up just logged shows straight away.
- **DASH-9** With no data, every figure shows $0 or 0, and each chart and list says there's nothing yet ("No deals won yet").

## Look and wording (UI)

- **UI-1** The look follows the `brand` skill and Part 2 of this spec. The MVP is light mode only, designed for laptop and desktop screens 1280 pixels wide or more.
- **UI-2** Dates read like 14 Nov 2026. A date with a time reads like 14 Nov 2026, 15:30.
- **UI-3** Money always shows its currency, in whole US dollars: $48,000. Chart axes can shorten it to $48K.
- **UI-4** Labels are short and plain, with no jargon and no exclamation marks. Buttons say what they do: "New deal", "Save", "Cancel", "Delete", "Log activity", "Mark done".
- **UI-5** Form errors appear under their field when the user saves ("Enter a name", "Enter a value of $0 or more"), and focus goes to the first field with an error.
- **UI-6** If the backend can't be reached, a message says so in plain words: "Accountable's server isn't responding. Check that `npm run dev` is still running, then try again."
- **UI-7** A record that doesn't exist, for example one that was just deleted, shows "This deal doesn't exist. It may have been deleted." with a link back to its table.

## Keyboard and accessibility (A11Y)

- **A11Y-1** Everything can be done with the keyboard alone, in a sensible tab order. The first tab stop is a "Skip to main content" link.
- **A11Y-2** Every focusable element shows a clear focus ring when it's reached from the keyboard.
- **A11Y-3** Text meets WCAG AA contrast: 4.5:1 for body text and 3:1 for large text (24 pixels, or 19 pixels bold).
- **A11Y-4** Dialogs keep focus inside them, close with Escape and return focus to whatever opened them.
- **A11Y-5** Sortable headings are buttons, and say which way they're sorted to screen readers.
- **A11Y-6** Icon-only buttons have a name that includes the record, such as "Edit Northwind Traders".
- **A11Y-7** On the pipeline, a focused card can be picked up with Space, moved between and within columns with the arrow keys, dropped with Space and put back with Escape, and each step is announced. The card's menu gives a second way to change stage.
- **A11Y-8** Each chart has a name, a one-line summary, and its figures as a table that screen readers can read. Meaning never depends on color alone: stages and statuses always carry their name.
- **A11Y-9** Animations are short, and are turned off when the computer asks for reduced motion.

## Speed (PERF)

- **PERF-1** With 300 organizations, 300 contacts, 300 deals and 2,000 activities, every page shows its data within one second of opening on a typical laptop.
- **PERF-2** Search, sorting and paging respond as the user types or clicks, with no visible wait.
- **PERF-3** Dropping a card updates the pipeline's figures immediately.

## Where each success criterion is covered

| Criterion in intent.md | Requirements |
|---|---|
| 1. Start with one command, land on the dashboard | RUN-1, RUN-2, RUN-3, DASH-1 |
| 2. Add, find, sort, edit, delete, keep, reset | DATA, TBL, DEL, RUN-4, RUN-5 |
| 3. Status filter, linked records | CON-1, ORG-2, CON-3, DEAL-1 |
| 4. Pipeline | PIPE, STAGE |
| 5. Activities, follow-ups, timelines | ACT, DASH-6 |
| 6. Dashboard figures | DASH-2 to DASH-8 |
| 7. Sharp, on brand, stunning dashboard, dates | UI, Part 2, DASH-3 to DASH-5 |
| 8. Keyboard and contrast | A11Y |
| 9. Used end to end in a real browser | All of the above, checked by hand |

---

# Part 2: Design

## How it fits together

```
Chrome  --->  Vite dev server (React app)  --- /api --->  FastAPI  --->  SQLite file
              127.0.0.1:5173                proxy         127.0.0.1:8000  data/accountable.db
```

- The browser only talks to the Vite server. Vite passes every `/api` request to FastAPI, so there's one address and no cross-origin setup.
- Both servers listen on `127.0.0.1` only, so nothing outside the computer can reach them.
- The backend owns every rule in Part 1: stage changes, probabilities, close dates, customers, delete counts and the dashboard's figures. The frontend shows the results and only works out what it needs for an instant response, such as the pipeline's totals after a drop.

### Folders

```
package.json        npm scripts, with frontend/ as a workspace
scripts/dev.mjs     starts both servers and opens the browser
frontend/           React, Vite and TypeScript
backend/            FastAPI app: tables, rules, routes, sample data, the seed/clear command
backend/tests/      pytest
e2e/                Playwright Test
data/               the SQLite file (git ignores it)
pyproject.toml, uv.lock
```

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Runs `scripts/dev.mjs`, which uses only Node's built-in modules so it can work before anything is installed. If `node_modules` is missing it runs `npm install`. Then it starts the backend with `uv run uvicorn` (uv installs the Python packages by itself), waits until `GET /api/health` answers, starts Vite and opens the dashboard in Chrome (`BROWSER` set per platform), or in the default browser if Chrome isn't found. Ctrl+C stops both |
| `npm test` | Runs Vitest, pytest and Playwright Test in turn, and fails if any of them fails |
| `npm run seed` | `uv run python -m backend.cli seed`: asks for `yes`, then replaces everything with fresh sample data |
| `npm run clear` | `uv run python -m backend.cli clear`: asks for `yes`, then deletes everything |

The backend reads the database's path from `ACCOUNTABLE_DB`, which defaults to `data/accountable.db`. The tests set it to a file in a temporary folder.

### Libraries

Popular, well-supported libraries, as `TECH_STACK.md` asks. The versions are the latest at the time of writing.

| Need | Library |
|---|---|
| Routing | React Router 8 |
| Fetching and caching data, instant updates | TanStack Query 5 |
| Tables (sorting, filtering, paging) | TanStack Table |
| Charts | Recharts 3 (with its `accessibilityLayer`) |
| Drag and drop with keyboard support | dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) |
| Dialogs, menus, selects, checkboxes, toasts | Radix UI (`radix-ui`) |
| Forms and validation | React Hook Form |
| Date formatting | date-fns (`d MMM yyyy`; `Intl` in Chrome writes "Sept" for September) |
| Icons | Lucide (`lucide-react`) |
| Fonts, served locally | Fontsource: `@fontsource-variable/instrument-sans`, `@fontsource/instrument-serif`, `@fontsource-variable/jetbrains-mono` |
| Backend | FastAPI, Pydantic, SQLAlchemy Core, Uvicorn |
| Accessibility checks in tests | `@axe-core/playwright` |

Styling is plain CSS: design tokens as CSS custom properties in one file, and a CSS module per component. No CSS framework.

## Data model

SQLite through SQLAlchemy Core. The tables are created when the backend starts, if they don't exist yet. Foreign keys are switched on for every connection (`PRAGMA foreign_keys = ON`), since SQLite leaves them off by default and the delete rules depend on them. Times are stored in UTC and shown in the computer's local time. Plain dates (close dates and follow-up dates) are stored as `YYYY-MM-DD`.

**organizations**: `id`, `name` (not null), `website`, `industry`, `notes`, `created_at`, `updated_at`

**contacts**: `id`, `name` (not null), `email`, `phone`, `job_title`, `organization_id` (references organizations, **set null** on delete), `status` (`lead` | `qualified` | `customer`, default `lead`), `created_at`, `updated_at`

**deals**: `id`, `name` (not null), `organization_id` (**set null**), `contact_id` (**set null**), `stage` (not null, one of the six), `value` (integer dollars, not null, 0 or more), `probability` (integer 0 to 100, not null), `close_date` (date), `position` (integer, the card's place in its column), `created_at`, `updated_at`

**activities**: `id`, `type` (`note` | `call` | `email`), `contact_id` (**cascade**), `deal_id` (**cascade**), `description` (not null), `occurred_at` (not null), `follow_up_date` (date), `done` (boolean, default false), `created_at`, `updated_at`. Exactly one of `contact_id` and `deal_id` is set, enforced by a check constraint.

**stage_changes**: `id`, `deal_id` (**cascade**), `from_stage`, `to_stage`, `changed_at`

**contact_events**: `id`, `contact_id` (**cascade**), `kind` (`became_customer`), `deal_id` (**set null**), `deal_name` (a copy, so the entry still reads correctly if the deal is deleted), `occurred_at`

Indexes on every foreign key, on `deals(stage, position)` and on `activities(follow_up_date)`.

**Card order.** `position` numbers the cards in each column from 0 at the top. A move names the target stage and the place in that column. The backend takes the card out of its old column, puts it in at that place and renumbers both columns, all in one transaction. With a few hundred deals that's instant.

## API

JSON under `/api`. Validation errors come back as 422 with a message for each field, and a missing record as 404.

| Method and path | Does |
|---|---|
| `GET /api/health` | Answers when the backend is ready |
| `GET /api/stages` | The six stages, in order, with their usual probabilities |
| `GET /api/organizations` | Every organization, with its contact count, open deal count and open value |
| `POST /api/organizations` | Adds one |
| `GET /api/organizations/{id}` | One organization, with its contacts and deals |
| `PATCH /api/organizations/{id}` | Changes the fields sent |
| `GET /api/organizations/{id}/delete-impact` | `{contacts, deals}`: what a delete would unlink |
| `DELETE /api/organizations/{id}` | Deletes it |
| `GET /api/contacts` | Every contact, with their organization's name |
| `POST`, `GET`, `PATCH`, `DELETE /api/contacts/{id}` | As for organizations. `GET` includes their organization and deals |
| `GET /api/contacts/{id}/delete-impact` | `{deals, activities}` |
| `GET /api/contacts/{id}/timeline` | Their timeline (ACT-3), newest first |
| `GET /api/deals` | Every deal, with its organization's and contact's names |
| `POST`, `GET`, `PATCH`, `DELETE /api/deals/{id}` | As above. A `PATCH` that changes the stage applies STAGE-2 |
| `POST /api/deals/{id}/move` | `{stage, index}`: moves a card on the board (STAGE-2) |
| `GET /api/deals/{id}/delete-impact` | `{activities}` |
| `GET /api/deals/{id}/timeline` | Its timeline, newest first |
| `POST /api/activities` | Logs one, on a `contact_id` or a `deal_id` |
| `PATCH`, `DELETE /api/activities/{id}` | Edits (including `done`) or deletes one |
| `GET /api/dashboard` | Every figure, chart series and list on the dashboard |

The list endpoints return every record, and the frontend searches, sorts and pages them in the browser. At a few hundred records that's quicker than asking the server each time, and it keeps the API small.

After any change, the frontend invalidates the cached data the change affects, so every screen shows it on its next look. A pipeline move updates the cache straight away and rolls back if the server says no.

## Screens

### The frame

- **A top bar**: a white panel with 16-pixel corners and no outline, 16 pixels in from the top and sides of the window. It stays in view when the page scrolls. It holds three things:
  - On the left, the wordmark "Accountable", with a small Sea Green dot ringed in Midnight as its mark.
  - In the middle, the five sections in this order, each with its icon: Dashboard, Organizations, Contacts, Deals, Pipeline. The current section is a Midnight pill with white, bold text, so it's marked by more than color alone.
  - On the right, a "New deal" button.

  A top bar leaves the full width of the window for the pipeline.
- Under the bar, the table and record pages have a header with the title on the left and the page's own main action on the right ("New contact"). The dashboard and the pipeline use the "New deal" button in the top bar.
- The page background is `#F0F4F5`, with 24 pixels of margin. Content sits in white, rounded panels with no outline.

### Routes

| Path | Screen |
|---|---|
| `/` | Dashboard |
| `/organizations`, `/organizations/:id` | Organizations table, one organization |
| `/contacts`, `/contacts/:id` | Contacts table (with `?status=`), one contact |
| `/deals`, `/deals/:id` | Deals table, one deal |
| `/pipeline` | Pipeline board |

### Dashboard

As in the chosen mockup, `docs/mockups/d-chosen.html`, on a 12-column grid with 24-pixel gaps:

1. **The headline panel**, across the full width:
   - **Left**, a 300-pixel column with the greeting in Instrument Serif ("Good morning") and today's date ("Sunday, 15 Nov 2026"). Below them, the four figures (DASH-2) are stacked one under another. Each figure has a label, a 30-pixel JetBrains Mono number and a line of detail. There are no separate figure tiles.
   - **Right**, the revenue line chart, with its title on the left and the 12-month total on the right above it.
2. **Under the headline panel**, three panels side by side:
   - The funnel, 5 columns wide.
   - The won and lost bar chart, 4 columns wide.
   - The follow-ups, 3 columns wide. This panel runs down the right beside both rows and scrolls inside itself when there are more follow-ups than fit.
3. **Recent activity**, 9 columns wide, under the funnel and the bar chart.

Chart and list details:

- **Line chart**:
  - A line in `--sea-green-text`, with a light, flat Sea Green fill under it and a Sea Green dot for each month.
  - The y axis is in dollars ($48K). The x axis shows short month names, with the year under January and under the first month.
  - The highest month and the latest month are labelled with their totals.
  - The tooltip reads "October 2026: $36,000 from 2 deals won".
- **Bar chart**:
  - Paired bars for each month: Won in Sea Green and Lost in slate (`#7A9199`).
  - The legend sits at the top right of the panel.
  - If the chart is too narrow to label every month, it labels every other month, counting back from the current one.
- **Funnel**: in steps, with one row per stage from New to Won. Each row has, from left to right:
  - The stage name, with its number of deals under it.
  - A bar in the stage's color, growing from the left. The longest bar takes 70% of its track, so every value fits after its bar. Each value is written just past the end of its bar and never on the color, since Midnight text on Cerulean or Raspberry fails AA.
  - The share that carried on from the stage before ("93% carried on").
- **Follow-ups**: grouped as in DASH-6. Each one has:
  - A date block on the left: the day in JetBrains Mono, with the short month under it. The block is `--raspberry-strong` with white text when overdue, Midnight with white text for today, and the page background otherwise.
  - The description, the contact or deal as a link, and how late it is when overdue.
  - The "Mark done" checkbox on the right.
- **Recent activity**: a timeline in two columns of five entries. Each entry has:
  - A round icon: Sea Green with a Midnight arrow for a stage change, or a pale circle with the type's icon for an activity.
  - Its date and time in muted text, then the description, then the contact or deal as a link.

  A short line joins the icons down each column.

### Tables

- A toolbar above the table holds the search box (with a magnifying glass icon and a "Search contacts" label) and, on Contacts, the status filter as a row of toggle buttons with counts.
- Numbers and money are right-aligned in JetBrains Mono. Text columns are left-aligned. Rows are separated by a very light rule (`#E3EAEC`), and the row under the pointer or with focus is tinted.
- The Edit (pencil) and Delete (trash) buttons sit at the end of each row, always visible, with tooltips and names that include the record.
- Paging sits under the table: "26–50 of 132", Previous and Next.

### Record pages

- A header panel with the record's name, its badges (status, stage, late), its key facts as a row of label and value pairs, and the Edit and Delete buttons.
- On contact and deal pages the main column has the "Log activity" form at the top of the timeline. A side column lists the linked records: a contact's deals, or a deal's organization and contact.
- On the organization page, the contacts and the deals are two panels side by side.

### Timeline

- A vertical list with a small round icon for each entry: a sticky note, phone or envelope for activities, an arrow for a stage change, and a check for "Became a customer".
- Each entry shows the date and time on its first line in muted ink, then the description. On a contact's timeline, entries from a deal carry a "Deal: Acme renewal" link.
- A follow-up shows as a chip: "Follow up 18 Nov 2026" with a checkbox. Overdue chips use the alert style.
- Edit turns the entry into its form in place, with Save and Cancel.

### Pipeline

The board uses mockup A's lanes inside mockup B's frame, as in `d-chosen.html`.

- **Header**: the title "Pipeline", then the open deals' number, total value and expected revenue in a row. Under them, a bar shows the open value split by stage, New to Negotiation, in the stage colors with 2-pixel gaps between the parts. "New deal" is in the top bar.
- **Lanes**: one per stage, 12 pixels apart, filling the rest of the window. Each lane is a grey panel (`--lane`) with 16-pixel corners and no outline.
- **Lane heading**:
  - A dot in the stage's color. Lost's Sea Mist dot has a slate ring so it shows against the grey.
  - The stage name and the count in JetBrains Mono, with an "Add deal to Proposal" button (a plus icon) on the right.
  - The total value in JetBrains Mono, with "$80,960 expected" under it.

  The heading stays put while the cards scroll under it.
- **Cards**: white, with 12-pixel corners, 8 pixels apart inside the lane, and no shadow. From top to bottom:
  - The deal's name in bold, with the menu button (three dots) at the top right.
  - The organization, or "No organization", in muted ink.
  - The value and the probability in JetBrains Mono.
  - The close date, with the Late badge beside it when the deal is late.
- **Card menu**: a white panel with a soft shadow. It starts with "Move to" in muted text, then lists the other five stages, each with its color dot. A divider separates them from "Open deal".
- **Dragging**: the card lifts with a soft shadow and a gap opens where it will land. The lane under it is tinted with its stage's color.

### Forms

- New and Edit open in a dialog, 520 pixels wide, with labels above their fields and required fields marked "Required". Save is the primary button and Cancel the secondary one.
- The deal form updates the probability, and the close date for Won and Lost, when the stage changes (STAGE-3). It shows the expected revenue as the value and probability change.
- The organization and contact pickers are searchable comboboxes with a "None" option.

## Visual design

### Fonts

All three fonts are bundled through Fontsource, so they work offline.

- **Instrument Sans** for headings and body text.
- **JetBrains Mono** for money, percentages, counts and other figures, with tabular numbers so columns line up.
- **Instrument Serif** for accents only: the dashboard greeting, and nowhere else.

| Use | Size and weight |
|---|---|
| Page title (h1) | 28px, 600 |
| Panel title (h2) | 18px, 600 |
| Body and table text | 14px, 400, line height 1.5 |
| Small text (meta, chart axes) | 13px; nothing smaller |
| Dashboard figures | 30px JetBrains Mono, 500 |
| Dashboard greeting | 38px Instrument Serif |

### Colors

Brand colors, plus darker shades that pass WCAG AA (worked out for this spec, checked against both white and the page background).

| Token | Value | Used for |
|---|---|---|
| `--page` | `#F0F4F5` | Page background |
| `--panel` | `#FFFFFF` | Panels and cards |
| `--ink` | `#073B4C` Midnight | All main text (12.1:1 on white) |
| `--ink-muted` | `#52707A` | Secondary text, labels, meta (5.3:1 on white, 4.8:1 on the page) |
| `--rule` | `#E3EAEC` | Light dividers inside panels |
| `--lane` | `#E6EDEF` | Pipeline lanes, hover backgrounds |
| `--field-border` | `#7A9199` | Form field outlines (3.3:1 on white) |
| `--slate` | `#7A9199` | Lost in charts, and the ring on Lost's dot |
| `--sea-green` | `#06D6A0` | Primary buttons (Midnight text, 6.4:1), Won, chart fills |
| `--sea-green-text` | `#037D5D` | Sea Green as text on light backgrounds (5.1:1) |
| `--marigold` | `#FFC145` | Qualified, chart fills |
| `--marigold-text` | `#946300` | Marigold as text (5.2:1) |
| `--coral` | `#F78C6B` | Proposal, chart fills |
| `--coral-text` | `#CB380B` | Coral as text (5.1:1) |
| `--cerulean` | `#118AB2` | New, chart fills, focus ring |
| `--cerulean-strong` | `#0F7698` | Cerulean as text and links, and fills with white text (5.2:1) |
| `--raspberry` | `#EF476F` | Negotiation, chart fills |
| `--raspberry-strong` | `#D91342` | Alerts: late, overdue, Delete buttons, with white text (5.1:1), and as alert text |
| `--sea-mist` | `#CDD8DB` | Lost, and the secondary button's fill |

Each color also has a light tint (about 15%) for badge backgrounds and hover states. Midnight text on any tint is above 9.9:1. Lost badges use Sea Mist itself (8.3:1), since its tint is almost white.

**Stage colors**, used for lane dots, badges, the funnel and the pipeline's value bar:

| New | Qualified | Proposal | Negotiation | Won | Lost |
|---|---|---|---|---|---|
| Cerulean | Marigold | Coral | Raspberry | Sea Green | Sea Mist |

The open stages warm up from cool blue to hot pink as a deal gets closer, Won takes the primary Sea Green, and Lost is the neutral.

**Contact status colors**: Lead in Cerulean, Qualified in Marigold and Customer in Sea Green, matching the stages they line up with.

### Shapes and components

- **Radius**: 16px for panels, lanes and the top bar, 12px for cards and menus, 8px for buttons and fields, and full pills for badges and the current section in the top bar.
- **Spacing** on a 4px scale. Panels have 24px of padding.
- **Panels and cards** have no outline and no shadow. Shadows are only for things that float above the page: menus, dialogs and a card being dragged.
- **Buttons** are 36px tall:
  - Primary: Sea Green with Midnight text.
  - Secondary: Sea Mist with Midnight text.
  - Danger: `--raspberry-strong` with white text.
  - Icon buttons are 32px square and show a tint on hover.
- **Badges** have a tint background, Midnight text and a dot in the full color, such as "● Proposal". The Late and Overdue badges are solid `--raspberry-strong` with white text and a clock icon, so they stand out from the stage colors.
- **Links** are `--cerulean-strong`, underlined on hover and on focus.
- **Focus ring**: a 2px `--cerulean` outline, 2px away from the element (4.0:1 on white). Where the background is dark, it's Sea Green.
- **Messages** (toasts) appear at the bottom right as a Midnight panel with Sea Mist text, and are announced to screen readers.
- No gradients, no outline down one edge of a panel, and no line across the top of the page.

### Motion

Movement lasts 150 to 200ms, for hover, opening dialogs, lifting a card and the gap opening under it. There's no movement at all when reduced motion is on.

## Sample data

Created by `backend/sample_data.py` from a fixed random seed, so it's the same every time. Its dates are counted back and forward from the day it's loaded, so it always looks current.

- **12 organizations** across software, manufacturing, healthcare, retail, logistics, financial services, education and hospitality, with made-up names, websites on `.example` addresses, and notes on about half.
- **36 contacts**: 14 leads, 10 qualified and 12 customers. Two belong to no organization. Emails use `.example` addresses and phones use the 555-01xx range, so none of it is real.
- **40 deals**:
  - 21 open: 6 New, 6 Qualified, 5 Proposal and 4 Negotiation. They're due to close over the next four months, and 4 of them are already late.
  - 13 won over the past 12 months, including two this month.
  - 6 lost.
  - Values run from $2,000 to $120,000. One open deal has no main contact, and two deals have a probability set by hand.
- **Stage history** for every deal, in date order and leading to its current stage. Every won deal's main contact is a customer, with a matching "Became a customer" entry.
- **About 120 activities** over the past six months, with 12 open follow-ups (3 overdue, 2 due today and 7 in the next three weeks) and a handful already done.

## Testing

`npm test` runs these, and fails if any fails:

- **Vitest** for the frontend's logic: money and date formatting, the pipeline's totals after a move, the late and overdue rules, and the delete message wording.
- **pytest** for the backend: each endpoint, the STAGE rules on every route, the delete rules and counts, the timelines, every dashboard figure against data built for the test, the sample data's promises, and the seed and clear commands with and without `yes`. Each test gets a fresh database.
- **Playwright Test** in Chrome (`channel: "chrome"`), for each success criterion as a salesperson would do it, including the keyboard-only routes. The tests start their own backend and frontend on ports 8100 and 5273, with their own database. Every page is checked with axe for WCAG AA problems, and any error in the browser's console fails the test. Each test starts from known data. `plan.md` decides how.

## Mockups

Three mockups in `docs/mockups/` each took a different route to the design, showing the dashboard and the pipeline with the same sample figures. A fourth combines the parts that were chosen. Open one in a browser and add `#pipeline` to the address to see its board. A screenshot of each screen sits beside it.

| Mockup | Frame | Dashboard | Pipeline |
|---|---|---|---|
| `a-sidebar.html` | Midnight sidebar with labels | Figures in four tiles, then panels on a grid. The funnel's bars are centered | Grey lanes. One card shows the keyboard focus ring |
| `b-top-bar.html` | White top bar | The figures and the revenue chart share one large panel. The funnel's bars grow from the left in steps | Cards straight on the page, with a bar of open value by stage above the board. One card's "Move to" menu is open |
| `c-midnight.html` | Midnight icon rail | A Midnight panel holds the figures and the revenue chart. The funnel is drawn as a funnel | Lanes tinted by stage, with a probability meter on each card. One card is mid-drag, with the gap where it will land |
| `d-chosen.html` | White top bar, from B | B's dashboard | A's grey lanes and cards, under B's header with the bar of open value by stage. One card's "Move to" menu is open |

`tokens.css` and `shared.js` hold the shared colors and sample figures.

**Chosen mockup: `d-chosen.html`.** The choice was B's top bar and dashboard, with the pipeline board styled as in A. D puts the two together, and this spec describes it. It's the reference for the build and for the visual checks at the Test stage, with `d-chosen-dashboard.png` and `d-chosen-pipeline.png` as its screenshots. A, B and C stay as a record of the options.

---

# Part 3: Concerns

Every concern raised while writing this spec has been decided, as recorded below. Mockup D (`d-chosen.html`) shows the first three in use.

## Decided by the choice of mockup D

1. **Colors that carry text.** The brand's white text on Cerulean (3.96:1) and on Raspberry (3.62:1) falls short of WCAG AA's 4.5:1, and Sea Green, Marigold and Coral as text on white are under 2.4:1. **Decided:** the brand colors stay as they are for fills, dots and charts. Wherever a color carries text, the darker shades in the Colors table are used instead (`--sea-green-text`, `--marigold-text`, `--coral-text`, `--cerulean-strong`, `--raspberry-strong`).
2. **Stage colors.** There are six stages and five brand colors, and Raspberry is also the alert color. **Decided:** New Cerulean, Qualified Marigold, Proposal Coral, Negotiation Raspberry, Won Sea Green and Lost Sea Mist. Negotiation shares Raspberry's hue with the Late badge, but the badge is solid `--raspberry-strong`, has a clock icon and says "Late", so the two can't be confused.
3. **What the funnel measures.** **Decided:** the value of every deal that ever reached each stage (DASH-5), so the funnel narrows from New to Won. The open value sitting in each stage today is on the pipeline board. Over a year or two, "every deal" may need a time limit, and that will be a later change.

## Decided with the rest of the spec

4. **Fonts work offline.** The brand names Google Fonts, but the app must work without the internet. **Decided:** the same fonts are bundled from npm through Fontsource.
5. **One command on first run.** **Decided:** `npm run dev` installs the npm packages itself. Node.js 24+ and uv have to be installed beforehand, and `docs/STATUS.md` will say how.
6. **Chrome first.** **Decided:** the app opens in Chrome when it's installed, and in the default browser otherwise.
7. **The Won rule applies on every save at Won** (STAGE-6), including a deal added straight into Won and a won deal whose main contact is changed. **Decided** as written. Adding a deal doesn't record a stage change.
8. **Deal entries follow the deal.** **Decided:** a contact's timeline shows the deals where they're the main contact now. If the main contact changes, the deal's history moves to the new contact's timeline.
9. **Whole dollars.** **Decided:** values have no cents. Invoices in a later ERP will need cents, and that's for a later change.
10. **24-hour times** on activities, such as 14 Nov 2026, 15:30. **Decided** as written.
11. **No database migrations yet.** **Decided:** tables are created when the backend starts. Before real data goes in for good, a migration tool such as Alembic should be added, so later changes to the tables keep it.
12. **The Won and Lost columns keep every closed deal**, as the intent asks. **Decided** as written. It's fine at a few hundred deals, and the columns may need a time limit after a year or two of use.
13. **Chart colors.** Sea Green, Marigold and Coral fills are under 3:1 against white. **Decided:** every chart labels its figures in text and has a table behind it, so nothing depends on telling the colors apart.
14. **Keyboard dragging is the riskiest part.** **Decided:** dnd-kit's keyboard dragging is built and tested, and the card's "Move to" menu is the dependable keyboard route for changing stage. The tests cover both.
15. **The speed targets** in PERF. **Decided** as written, since the intent says "quick" without a number.
