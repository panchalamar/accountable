# Spec: the Accountable MVP

This spec turns `docs/intent.md` into requirements (Part 1) and a design (Part 2) for the MVP. It follows `docs/TECH_STACK.md` and the brand skill (`.claude/skills/brand/`). Where they disagree, the intent wins on behavior and the brand wins on looks.

The chosen design is mockup 7 in `docs/mockups/`, recorded under "Chosen design" near the end. Choosing it changed a few requirements, and they're listed there.

## Concerns

### Decided

1. **Two brand colors fail WCAG AA behind small white text.** White on Cerulean is 3.96:1 and white on Raspberry is 3.62:1. AA asks for 4.5:1 for normal text, and 3:1 for large text (24px, or 18.7px bold). Both colors pass for large text. Decided:
   - Keep the brand colors for large text, fills and charts.
   - Use a darker shade only behind small white text, such as the Late chip, the New stage chip and the Delete button: Cerulean `#0B6E8E` (5.78:1) and Raspberry `#C9184A` (5.66:1).
   - The brand already says to darken Sea Green and Marigold for text. The shades for them are under "Color tokens".
2. **Six stages, five brand colors.** Decided:
   - New is Cerulean, Qualified Marigold, Proposal Coral, Negotiation Midnight, Won Sea Green and Lost slate grey.
   - Raspberry stays free for late deals and errors, so warnings stand out.
   - Contact statuses reuse the same colors: Lead is Cerulean, Qualified Marigold and Customer Sea Green.
   - The brand's order puts Sea Green first. I've put it on Won because green reads as success.
3. **Won and Lost columns don't show expected revenue.** On Won it would repeat the total, and on Lost it's always $0. They show "Closed in the last 30 days" in its place. Decided when choosing the design, and the intent was updated to match.

### Calls made where the intent was silent

- **Every stage change follows the same rules**, whether it comes from the board, the card's stage menu or the deal's edit form. When the stage changes in the edit form, the form shows what will happen before saving:
  - The probability always becomes the new stage's usual one, even if another was typed in the same save.
  - A move into Won or Lost sets the close date to today, even if another was typed.
  - A move from Won or Lost to an open stage uses the new expected close date typed in the form, 30 days from today by default.

  Probability and close date can both be edited in a later save.
- **Moving between Won and Lost** is a move into a closed stage, so the close date resets to today. It isn't a reopening.
- **Changing a card's place within its column** isn't a stage change. It adds no timeline entry and keeps a probability set by hand.
- **Adding a deal isn't a stage change**, even when it's added straight into a column. It adds no timeline entry.
- **A new deal, and a deal moved with the stage menu or the edit form, goes to the top of its column.** A dragged card goes where it's dropped.
- **The sales funnel counts how far each deal got.** For each stage from New to Won, it shows the value of the deals that reached that stage or a later one. It counts deals that are open, or that closed in the last 12 months. A lost deal counts up to the furthest stage it reached before it was lost.
- **An activity's date can be in the future**, since an activity can be something that needs to happen. Recent activity on the dashboard shows only what has already happened.
- **Values are whole dollars**, zero or more. Probability is a whole percentage from 0 to 100.
- **Text has length limits**:
  - names: 200 characters
  - job title and industry: 100
  - phone: 50
  - website: 200
  - notes and activity descriptions: 5,000

  These stop pasted junk and keep the layout sane.
- **Duplicate checks ignore case and spaces at either end.** "Acme Ltd" and " acme ltd" are the same organization. Emails are compared ignoring case.
- **Website isn't checked.** It shows as a link only when it is a web address. Anything else shows as plain text.
- **Stage-change entries are kept apart from activities.** They can't be edited or deleted on their own, and they go when their deal is deleted. The confirmation says so.
- **Moving a contact.** Every deal's main contact is always at the deal's organization. So "the main contact on a deal at their current organization" means the same as "the main contact on any deal".
- **Moving a deal to another organization** means choosing a main contact at the new organization in the same save.
- **Editing an activity** keeps its existing links, even if the contact or deal has since moved organization. The organization match is checked only when a link is added or changed.
- **An organization's page** has "Add contact" and "Add deal" buttons, with the organization already filled in.
- **Industry is free text**, and the field suggests industries already in use.
- **Formats:**
  - Dates show as "Nov 16, 2026".
  - Money always shows with `$`: "$250,000" in full, and "$1.2M" or "$250K" where space is short, chart axes included.

### Worth knowing

- **Fonts are bundled.** Loading fonts from Google Fonts needs the internet, and the intent says Accountable works offline. So the same three Google fonts are installed from npm and served by the app.
- **Adding a deal for a new company takes three steps:** add the organization, then a contact there, then the deal. A deal needs a main contact at its organization.
- **The funnel remembers the furthest stage.** A deal moved to Won by mistake and moved back still counts as having reached Won.
- **The layout needs a window at least 1,280px wide**, which fits all six board columns. On a narrower window the whole page scrolls sideways, as the mockup does.
- **Closed deals leave the board** 30 days after their close date. They stay in the Deals table and in the dashboard's figures.
- **Reset while the app is running:** refresh the browser afterwards to see the sample data.
- **No database migrations yet.** Tables are created on first start. If the data model changes during the build, reset the data. Migrations come with the shared database on Day 5.
- **What you need installed:** Node 24 or later, uv, and Google Chrome for the end-to-end tests.

# Part 1: Requirements

## Terms

- **Open stages**: New, Qualified, Proposal, Negotiation. **Closed stages**: Won, Lost.
- **Today**: the date on the computer running Accountable. The backend gets today and now from one function, so tests can fix the date.
- **Late deal**: an open deal whose close date is before today. A deal due today isn't late.
- **Expected revenue**: a deal's value times its probability of close. Totals add these up.
- **Open pipeline**: the total value of open deals.
- **Follow-up**: an activity with a follow-up date that isn't marked done.
  - **Overdue**: the follow-up date is before today.
  - **Due in the next 7 days**: the date is from today to 7 days from today, inclusive.
- **Closed in the last 30 days**: a Won or Lost deal whose close date is on or after the date 30 days before today.
- **The last 12 months**: the current calendar month and the 11 before it.
- **Furthest stage**: the latest stage a deal has reached, in the order New, Qualified, Proposal, Negotiation, Won. Lost doesn't count as a stage reached. A deal added straight into Lost has New as its furthest stage.

## App shell

1. A bar across the top lists the five sections in this order: Dashboard, Organizations, Contacts, Deals, Pipeline. The current section is marked.
2. The app opens on the Dashboard.
3. Each record has its own address, such as `/deals/12`. The browser's back button and refresh keep you where you were.
4. If the backend can't be reached, a message at the top of the page says so: "Can't reach Accountable's server. Check that `npm run dev` is still running."

## Tables

The Organizations, Contacts and Deals pages each have a table that works the same way.

1. All records load at once. There's no paging.
2. A search box filters rows as you type. It ignores case and matches any text shown in the row.
3. Clicking a column heading sorts by it, and clicking again reverses the order. Numbers, money and dates sort as numbers and dates.
4. The default sort:
   - Organizations and contacts: by name, A to Z.
   - Deals: by close date, latest first.
5. The table shows how many rows match, such as "12 of 36 contacts".
6. An "Add" button opens the form for a new record.
7. Each row has Edit and Delete, and its name links to the record's page.
8. When nothing matches, the table says so, such as "No contacts match 'acme'".

The columns:

- **Organizations**: Name, Industry, Website, Contacts (count), Open deals (count).
- **Contacts**: Name, Organization, Job title, Email, Phone, Status. Above the table, a status filter offers All, Lead, Qualified and Customer, each with its count. It works together with search.
- **Deals**: Name, Organization, Main contact, Stage, Value, Probability, Close date. A late deal shows a "Late" chip next to its close date.

## Adding and editing

1. Add and edit open a form in a dialog. Saving closes it, and the table or page updates. Cancel or Escape closes it without saving.
2. The fields:

   | Record | Field | Rule |
   |---|---|---|
   | Organization | Name | Required. Unique. |
   | | Website, Industry, Notes | Optional. |
   | Contact | Name | Required. |
   | | Organization | Required. Chosen from a list. |
   | | Email | Optional. A valid address, not used by another contact. |
   | | Phone, Job title | Optional. |
   | | Status | Required: Lead, Qualified or Customer. Lead by default. |
   | Deal | Name | Required. |
   | | Organization | Required. |
   | | Main contact | Required. Lists only the chosen organization's contacts. Choosing another organization clears it. |
   | | Stage | Required. New by default, or the column it was added from. |
   | | Value | Required. Whole dollars, zero or more. |
   | | Probability | Filled with the stage's usual probability. Can be changed. |
   | | Close date | Required. |
   | Activity | Type | Required: Note, Call or Email. |
   | | Description | Required. |
   | | When it happened | Required. Date and time, now by default. |
   | | Follow-up date | Optional. |
   | | Second link | Optional. See "Activities and timelines". |

3. If an organization has no contacts, the deal form says so and links to adding a contact there.
4. The server checks every rule, and the form also checks what it can before sending. A missing or invalid field shows a message next to it, and the first such field gets the focus. The messages:
   - "Enter a name."
   - "Enter a valid email address, like name@company.com."
   - "Another contact already uses this email."
   - "An organization called Acme Ltd already exists."
   - "Enter a value of $0 or more, in whole dollars."
   - "Choose a main contact at Acme Ltd."
5. Changing a contact's organization is refused while they are the main contact on any deal. The message names those deals and asks for a different main contact on each first.
6. Changing a deal's organization requires a main contact at the new organization.
7. Changing a deal's stage in the edit form follows "Stage changes". Before saving, the form shows what will happen:
   - For every new stage: "Probability will be set to 50%", with that stage's figure, so 100% for Won and 0% for Lost.
   - When the new stage is Won or Lost, the close date field shows today and is locked, with "The close date will be set to today."
   - When reopening, the close date field becomes "New expected close date", filled with 30 days from today.
8. Adding a deal at Won or Lost works the same way: the close date field shows today and is locked, with the same note. It can be changed after saving.

## Deleting

Every delete asks first, in a dialog that says what will happen. The dialog gets its numbers from the server just before it opens. The server checks again when deleting.

- **Organization**: refused while it has contacts or deals, for example "Northwind Metals can't be deleted while it has 3 contacts and 2 deals. Delete them or move them to another organization first." The dialog offers only Close.
- **Contact**: refused while they are the main contact on a deal. The dialog lists those deals. Otherwise the dialog says, for example, "4 activities linked only to Priya Shah will be deleted. 2 activities also linked to a deal will stay on the deal's timeline." When Priya is deleted, those 2 activities lose their link to her and keep their link to the deal.
- **Deal**: the dialog says, for example, "3 activities linked only to this deal will be deleted. 1 activity also linked to a contact will stay on the contact's timeline. The deal's stage history will be deleted too." Those activities lose their link to the deal.
- **Activity**: "Delete this activity?" with Delete and Cancel.

Every activity is linked to at least one contact or deal at all times.

After a delete from a record's own page, the app goes to that section's table.

## Stage changes

These rules apply to every stage change, whether it comes from dragging a card, the card's stage menu or the edit form.

1. The deal's probability becomes the new stage's usual probability: New 10%, Qualified 25%, Proposal 50%, Negotiation 75%, Won 100%, Lost 0%.
2. A move into Won or Lost, including from one to the other, sets the close date to today.
3. A move from Won or Lost to an open stage asks for a new expected close date, 30 days from today by default. On the board, cancelling puts the card back where it was.
4. An entry "Moved from Proposal to Negotiation" is added to the deal's timeline, with the time, and shows in the dashboard's recent activity.
5. The deal's furthest stage is updated.
6. The contact's status never changes by itself.

Other cases:

- A deal added at Won or Lost gets today as its close date.
- After any of these, the close date and probability can be edited by hand. A probability set by hand stays until the next stage change.
- Changing a card's place in its column changes nothing but its place.

## Activities and timelines

1. An activity can be logged from a contact's page or a deal's page, with "Log activity".
   - **From a contact's page**: it's linked to that contact. It can also be linked to one of the deals at the contact's organization.
   - **From a deal's page**: it's linked to that deal. It can also be linked to one of the contacts at the deal's organization.
   - The second link is never filled in automatically.
2. An activity linked to both shows on both timelines.
3. Each timeline shows the record's activities with the newest first, by when they happened. A deal's timeline also includes its stage changes, in the same order.
4. Each activity shows:
   - its type, description and when it happened
   - its other link, if any, as a link
   - its follow-up date, with a Done checkbox
   - Edit and Delete
5. Editing an activity uses the same form, with the link to the current page fixed.
6. Ticking Done saves at once. A done follow-up stays on the timeline, marked done. It can be unticked.

## Record pages

- **Organization**: name, website (as a link), industry and notes, with Edit and Delete. It lists its contacts (name, job title, status) and its deals (name, stage, value, close date, Late chip). Each item links to its page. "Add contact" and "Add deal" open their forms with this organization filled in.
- **Contact**: name, status chip, job title, email (as a `mailto:` link), phone, and organization (as a link), with Edit and Delete. It lists the deals where they're the main contact, then shows their timeline with "Log activity".
- **Deal**: name, stage chip with a stage menu, Late chip if late, value, probability, expected revenue, close date, organization and main contact (as links), with Edit and Delete. Then its timeline with "Log activity".

## Pipeline

1. **Columns.** There are six columns, in stage order, each with the deals at that stage.
   - Won and Lost show only deals closed in the last 30 days.
   - Cards in a column are in their saved order.
2. **Card.** Each card shows:
   - the deal's name (linking to its page)
   - organization and main contact
   - value, in short form such as "$520K"
   - close date, with a Late chip if late. An open deal that isn't late also says how soon it's due, such as "in 25 days" or "in 3 months".
   - a "Stage" button that opens the stage menu
3. **Dragging.** Drag a card to another column to change its stage, and it lands where it's dropped. Drag it within its column to change its place.
4. **Stage menu.** The menu lists the stages. Choosing one moves the card to the top of that column.
   - The menu works by keyboard. Focus stays on the moved card.
   - A screen reader hears "Moved Atlas Freight renewal to Negotiation".
5. **Adding.** Each column has an "Add deal" button that opens the deal form at that stage. The new deal goes to the top of the column.
6. **Totals.**
   - The board shows the total value, expected revenue and number of open deals.
   - Each column shows its own count, total value and expected revenue. Won and Lost show "Closed in the last 30 days" in place of expected revenue (see "Concerns").
   - All of these, the card's place and its stage update the moment a card moves, before the server replies. If the server refuses, the card goes back and a message says why.
7. **After a refresh** every card is where it was left.

## Dashboard

All figures come from the data at the time the page loads.

1. **Headline figures**:
   - Open pipeline: the value and number of open deals.
   - Expected revenue: across open deals.
   - Won this month: the value and number of deals won with a close date this month.
   - Won in the last 12 months: value and number.
2. **Revenue won by month**: a line chart of the value won in each of the last 12 months, by close date, ending with the current month. Months with nothing won show $0. The same chart goes on past today to show what's due to close: the value of open deals by the month of their close date, stacked by stage. After the Today marker, in this order:
   - **"Late"**: deals past their close date. Shown only when some are.
   - **"Rest of Nov"** (the current month): deals due from today to the end of this month. Shown only when there are some.
   - **One bar per month**, from next month up to the month of the latest close date, at most 9 months ahead. Months in between with nothing due show no bar.
   - **"Later"**: anything due more than 9 months ahead, in one bar. Shown only when there is some.

   With no open deals, the future part says "No open deals" in place of the bars.
3. **Deals won by month**: a bar chart of the number of deals won in each of the same 12 months.
4. **Pipeline by stage**: a visual of the four open stages, each with its number of deals, value and expected revenue.
5. **Sales funnel**: the stages from New to Won, each with the value that reached that stage or a later one, as defined in "Concerns".
6. **Follow-ups**: overdue first, oldest first, then those due in the next 7 days, soonest first. Each shows:
   - its description
   - how late or how soon it is: "3 days overdue", "Due today", "Due in 2 days"
   - links to its contact and deal
   - a Done checkbox

   Ticking it saves at once and removes it from the list, and the figures refresh. With none due, it says "No follow-ups due in the next 7 days".
7. **Recent activity**: the 10 latest activities and stage changes that have already happened, newest first. Each links to its contact or deal.
8. The layout and styling of the charts follow the chosen design, described under "Screens".

## Sample data

The sample data is made fresh from a fixed list each time, with every date counted back or forward from today. Names, companies and email addresses are made up. Emails use made-up company domains under `example.com`, so they can't reach a real company.

- **About 12 organizations** across at least six industries: manufacturing, logistics, healthcare, energy, construction and financial services, for example.
- **About 36 contacts**, two to four per organization, with all three statuses well represented.
- **About 40 deals**, with values mostly between $100,000 and $1,000,000:
  - About 16 won over the last 12 months, with a win in at least 10 of the 12 months.
  - About 7 lost.
  - At least 2 won and 2 lost in the last 30 days.
  - About 17 open, spread across the four open stages, closing in the coming 1 to 9 months, with 3 running late.
- **Stage history** for every deal past New: entries between its start and today, or its close, so timelines and the funnel have something to show.
- **About 120 activities** over the last 12 months:
  - Notes, calls and emails, linked to a contact, a deal or both.
  - Follow-ups: about 4 overdue, 5 due in the next 7 days (one due today), 4 due later, and some done.
- **Board order** is set for each column.

## Running and keeping data

1. **On a fresh clone, `npm run dev`** installs what's missing, starts the backend and frontend, and opens the dashboard in the browser. It works the same on Mac, Linux and Windows and needs no internet once installed.
2. **The data lives in one SQLite file**, `data/accountable.db`. It's created with the sample data the first time the app starts.
   - Every change is saved at once, and is still there after a refresh and a restart.
   - `data/` is git-ignored, so the data is never committed.
3. **`npm run seed` resets the data to the sample data:**
   - It explains what it does and asks "Replace all data with fresh sample data? (y/N)". Anything other than "y" or "yes" stops without changing anything.
   - Before replacing, it saves a copy of the current database as `data/backups/accountable-YYYYMMDD-HHMMSS.db` and prints where.
   - `npm run seed -- --yes` skips the question.
   - With no database yet, it just creates one.
4. **`npm test`** runs every test and fails if any fails. It never touches `data/accountable.db`.
5. **Run instructions** go in `docs/STATUS.md`. `README.md` stays as it is.

## Accessibility

1. Everything works by keyboard, apart from changing a card's place within its column:
   - the top bar, tables, sorting, search and filters
   - forms, dialogs and menus
   - follow-up checkboxes and the stage menu
2. **Focus is always visible**, with a 2px ring in a color that stands out on the surface behind it.
3. **Dialogs** keep focus inside while open, close with Escape, and return focus to the button that opened them.
4. **Contrast**: all text meets WCAG AA, which is 4.5:1, or 3:1 for large text.
5. **Form fields** each have a visible label. Error messages are tied to their field so screen readers read them.
6. **Sorting**: column headings say how they're sorted.
7. **Charts** each have a short text summary, and a table of their figures for screen readers.
8. **"Skip to content"** is the first link on every page.
9. **Color is never the only signal.** Chips have words, and late deals say "Late".

## Success criteria and where they're covered

| Criterion in the intent | Covered by |
|---|---|
| 1. One command, lands on the dashboard | Running and keeping data, Sample data |
| 2. Add, find, sort, edit, delete, validation | Tables, Adding and editing |
| 3. Delete and move rules | Deleting, Adding and editing (5, 6) |
| 4. Status filter and linked records | Tables, Record pages |
| 5. Pipeline | Pipeline, Stage changes |
| 6. Close date and reopening | Stage changes |
| 7. Timelines and follow-ups | Activities and timelines, Dashboard (6) |
| 8. Dashboard figures | Dashboard |
| 9. Reset | Running and keeping data (3) |
| 10. Look and feel | Visual design, Chosen design |
| 11. Keyboard and contrast | Accessibility, Pipeline (4) |
| 12. End-to-end use in a browser | Testing |

# Part 2: Design

## Architecture

```
Browser
  React app (Vite dev server, localhost:5173)
    | fetch /api/...  (Vite proxies /api to the backend)
FastAPI backend (127.0.0.1:8000)
    | SQLAlchemy Core
SQLite file  data/accountable.db
```

- The frontend talks to the backend only through the JSON API under `/api`. Because the proxy makes them share an address, there's no CORS to set up.
- The backend holds every rule. The frontend repeats a few of them, such as late deals, the board's 30-day window and stage probabilities, only to show results at once. The server's answer is final.
- The backend listens on 127.0.0.1 only, so other computers on the network can't reach it.
- Settings come from environment variables, with defaults:
  - `ACCOUNTABLE_DB`: the database file. Default: `data/accountable.db`.
  - `BACKEND_PORT`: default 8000.
  - `FRONTEND_PORT`: default 5173.

  The tests set their own, and so would parallel test workers later.

## Repo layout

```
package.json          npm scripts, workspaces: ["frontend"]
pyproject.toml        backend dependencies (uv)
uv.lock
frontend/             React + Vite + TypeScript
  src/api/            fetch client, TanStack Query hooks
  src/lib/            money, dates, stage rules shown in the browser
  src/components/     table, dialogs, forms, chips, timeline, stage menu, charts
  src/pages/          dashboard, organizations, contacts, deals, pipeline, record pages
  src/styles/         tokens and global styles
backend/
  main.py             FastAPI app and routes
  db.py               engine, tables, SQLite settings, create on first start
  clock.py            today() and now(), the one source of the date
  rules.py            validation, stage changes, delete and move rules
  dashboard.py        dashboard figures
  sample_data.py      the sample records, as offsets from today
  seed.py             the reset command
  tests/              pytest
e2e/                  Playwright tests and config
scripts/              small Node scripts: dependency check, running the tests
data/                 database and backups (git-ignored)
```

The plan can adjust file names. The split to keep is that rules live in one backend module and the date comes from one function.

## Libraries

Popular, well-supported libraries do the heavy lifting.

**Frontend**

- **React, TypeScript, Vite.**
- **React Router**: pages and addresses.
- **TanStack Query**: fetching, caching, and the instant updates on the board, with rollback if the server refuses.
- **TanStack Table**: sorting and search in the tables.
- **dnd-kit** (`@dnd-kit/core`, `@dnd-kit/sortable`): dragging on the board, with its screen reader announcements.
- **Recharts**: line, bar and funnel charts.
- **Radix UI primitives**: Dialog, AlertDialog, DropdownMenu, Checkbox and Popover. They handle accessible dialogs and menus.
- **React Hook Form with Zod**: forms and in-browser checks.
- **date-fns**: date arithmetic and formatting.
- **Tailwind CSS v4**: styling, with the brand's tokens as CSS variables, so a dark theme later means a second set of values.
- **lucide-react**: icons.
- **sonner**: short messages after an action, such as "Moved to Won. Close date set to today."
- **Fontsource** (`@fontsource-variable/instrument-sans`, `@fontsource/instrument-serif`, `@fontsource-variable/jetbrains-mono`): the brand fonts, bundled for offline use.

**Backend**

- FastAPI and Uvicorn.
- SQLAlchemy Core 2. No ORM and no raw SQL.
- Pydantic v2, with `email-validator` for email checks.

**Tests and tools**

- Vitest, React Testing Library and jsdom.
- pytest, with FastAPI's TestClient (httpx).
- Playwright Test, using the installed Google Chrome (`channel: "chrome"`).
- `concurrently`, to run the backend and frontend together.

## Data model

SQLite, with foreign keys switched on for every connection. Dates are stored as ISO text (`2026-11-16`), and times as local ISO date-time text, since everything runs on one computer.

**organizations**

| Column | Type | Notes |
|---|---|---|
| id | integer | primary key |
| name | text | required. Unique index on its trimmed, lower-case form. |
| website, industry, notes | text | optional |
| created_at, updated_at | text | date-time |

**contacts**

| Column | Type | Notes |
|---|---|---|
| id | integer | primary key |
| organization_id | integer | required, references organizations |
| name | text | required |
| email | text | optional. Stored trimmed and lower-case. Unique when present. |
| phone, job_title | text | optional |
| status | text | `lead`, `qualified` or `customer` (check constraint) |
| created_at, updated_at | text | |

**deals**

| Column | Type | Notes |
|---|---|---|
| id | integer | primary key |
| organization_id | integer | required, references organizations |
| main_contact_id | integer | required, references contacts. The contact must be at the same organization (checked in `rules.py`). |
| name | text | required |
| stage | text | one of the six stages (check constraint) |
| value | integer | whole dollars, 0 or more (check constraint) |
| probability | integer | 0 to 100 (check constraint) |
| close_date | text | date, required |
| furthest_stage | text | for the funnel |
| position | integer | place within its column, smallest at the top |
| created_at, updated_at | text | |

**activities**

| Column | Type | Notes |
|---|---|---|
| id | integer | primary key |
| type | text | `note`, `call` or `email` |
| description | text | required |
| occurred_at | text | date-time |
| follow_up_date | text | date, optional |
| done | boolean | false by default |
| contact_id | integer | optional, references contacts |
| deal_id | integer | optional, references deals |
| created_at, updated_at | text | |

A check constraint keeps at least one of `contact_id` and `deal_id` filled.

**stage_changes**

| Column | Type | Notes |
|---|---|---|
| id | integer | primary key |
| deal_id | integer | references deals, deleted with the deal |
| from_stage, to_stage | text | |
| changed_at | text | date-time |

Indexes are on every foreign key, on `deals(stage, position)` and on `activities(follow_up_date)`.

## Backend rules

All in `rules.py`, each write in one transaction:

- **Validation**: required fields, lengths, email format, unique name and email, and that the main contact and any second activity link are at the right organization. Errors come back per field.
- **Stage change**: one function is used by the move endpoint and by the deal edit. It sets probability, close date and furthest stage, adds a `stage_changes` row, and places the deal in its new column.
- **Placement**:
  - A move gives `before_id`, the card it now sits above, or nothing for the bottom of the column.
  - The server renumbers that column's positions from 0. That's fine at a few hundred deals.
  - A new deal, or one moved without a `before_id` from the stage menu or the edit form, goes to the top.
- **Delete checks**: count what a delete would remove or keep, and refuse the delete when the intent's rules say so.
- **Contact move**: refused while the contact is the main contact on any deal.

## API

All under `/api`, JSON in and out.

| Method and path | Does |
|---|---|
| `GET /organizations` | All organizations, with contact and open-deal counts |
| `POST /organizations` | Add one |
| `GET /organizations/{id}` | One organization, with its contacts and deals |
| `PUT /organizations/{id}` | Edit |
| `GET /organizations/{id}/delete-check` | What deleting would do |
| `DELETE /organizations/{id}` | Delete, or 409 if blocked |
| `GET /contacts` | All contacts, with organization names |
| `POST /contacts`, `GET`, `PUT`, `DELETE /contacts/{id}` | As above |
| `GET /contacts/{id}/delete-check` | Blocking deals, activities to delete, activities to keep |
| `GET /contacts/{id}/timeline` | Activities, newest first |
| `GET /deals` | All deals, with organization and contact names, in board order |
| `POST /deals`, `GET`, `PUT`, `DELETE /deals/{id}` | As above. `PUT` applies the stage rules if the stage changes. |
| `POST /deals/{id}/move` | `{stage, before_id, close_date}`. `close_date` is required when reopening. |
| `GET /deals/{id}/delete-check` | Activities to delete and to keep |
| `GET /deals/{id}/timeline` | Activities and stage changes, newest first |
| `POST /activities`, `PUT`, `DELETE /activities/{id}` | Log, edit, delete |
| `PATCH /activities/{id}` | `{done}`, for the checkbox |
| `GET /dashboard` | Every dashboard figure, follow-up and recent item |

Errors share one shape:

- **422** for invalid input: `{"message": "Check the highlighted fields.", "errors": {"email": "Another contact already uses this email."}}`. FastAPI's own validation errors are converted to this shape, in plain words.
- **409** for a refused delete, move or reopening without a date: `{"message": "...", "details": {...}}`, with the counts or the deals involved.
- **404** for a record that no longer exists: `{"message": "That deal no longer exists."}`

## Frontend

- **Data.** One TanStack Query cache.
  - After a save, the affected lists, record pages, timelines and the dashboard are refreshed.
  - Board moves update the cache first, then the server, and roll back on an error.
- **Forms.**
  - Zod schemas mirror the server's rules. Server field errors are placed on the matching fields.
  - The deal form loads the chosen organization's contacts for the main contact list.
- **Shared logic** in `src/lib`: money and date formatting, late and board-window checks, stage order, probabilities and colors. Each has unit tests.
- **Routes**: `/`, `/organizations`, `/organizations/:id`, `/contacts`, `/contacts/:id`, `/deals`, `/deals/:id`, `/pipeline`. An unknown address shows a "Page not found" panel with a link to the dashboard.

## Screens

This is the chosen design, mockup 7. The Dashboard and Pipeline match it. Tables, record pages and dialogs weren't mocked up, so they follow these notes in the same style.

### Shell

- A white bar across the top holds:
  - the Accountable wordmark
  - the five sections, each with an icon and a label, with the current one on `--nav-current`
  - today's date on the right
- The main area has a page header: the title, a short line of context such as "36 contacts", and the page's main button.
- Content sits in white panels on the page background.

### Dashboard

Two columns: the main column, and a dark Midnight column on the right. The dark column runs from under the top bar to the bottom of the page. It's 400px wide at a 1,440px window and about 356px at 1,280px.

The main column has two panels:

1. **"Revenue won, and what's due to close"**, the panel that sets the look:
   - **The four headline figures in time order.** Won in the last 12 months and Won this month sit above the past part of the chart. Open pipeline and Expected revenue sit above the future part.
   - **One chart with one money axis.**
     - Revenue won for the last 12 months is a line over a light fill.
     - A "Today" marker follows.
     - Open deals are bars by close month, stacked by stage, with the Late bar first. The future part sits on `--forecast-bg`.
     - Only a few values are labeled: the best month, the latest month, the Late bar and the biggest month ahead. A key under the chart names the series.
   - **Under the chart**, two parts:
     - Deals won by month as bars, lined up under the same months.
     - "Open pipeline by stage" as a table under the future part, with stage, deals, value and expected revenue.
   - **Hovering** shows a month's figures. A month ahead also lists its deals.
2. **Sales funnel:**
   - The shape: each band is as wide at the top as the value that reached its stage, and as wide at the bottom as the value that reached the next.
   - Beside it, a table lists each stage's deals, value reached, share of New and share of the stage before. Its rows line up with the bands.

The dark column:

- **Follow-ups**, with a line saying how many are left, such as "9 to do. Tick one when it's done.":
  - "Overdue" with a count comes first, then "Next 7 days" with a count.
  - Each item has a checkbox, the description, links to the contact and deal, and its timing on the right ("9 days overdue", "Due today", "Due in 3 days").
  - The Overdue heading and timings use `--alert-on-dark`, because `--alert-strong` is too dark to read on Midnight.
- **Recent activity** sits below follow-ups:
  - Each item has a type icon and a line such as "Call with Priya Shah about Steel supply agreement 2027", with its time underneath. An activity linked to only a contact or only a deal leaves out the missing part, such as "Call with Priya Shah".
  - Stage changes read "Moved from" with two stage chips.
  - Links are Sea Green, and times use `--muted-on-dark`. The Negotiation chip gets a thin Sea Mist outline so it shows on Midnight.

Every chart has a title and a one-line summary, such as "$7.7M won in the last 12 months".

### Tables

- Each table sits in a panel. Search and filters are above it on the left, and the Add button is on the right.
- Rows are separated by light dividers. Panels have no outline.
- Money, probabilities and dates are right-aligned and set in JetBrains Mono.

### Record pages

- The header carries the name, chips and actions.
- Two columns: details on the left, related records and the timeline on the right.
- The timeline is a vertical list, each entry with a small type icon. Stage changes are styled differently from activities, so they're easy to tell apart.

### Pipeline

- The board totals are a sentence under the page title: "$9,040,000 open across 17 deals, with $3,481,000 expected. 3 are late."
- Six equal columns fill the width. They fit from 1,280px, the narrowest window the layout supports (see "Worth knowing").
- **Column headers** are arrow shapes in the stage color, with the chip text color from the stage table. The first one is flat on its left side.
  - Each shows the name, count and total value.
  - Open stages also show expected revenue. Won and Lost show "Closed in the last 30 days".
- Under each header is an outlined "Add deal" button, then the cards.
- **Cards** are filled with their stage's tint, with small text in `--ink-on-tint`. Each card has:
  - the name, with the short value on the right
  - "organization, main contact"
  - the close date, with "in 3 months" or a Late chip on the line under it
  - a "Stage" button at the bottom right
- When a card is dragged, a lifted copy follows the pointer, and a gap opens where it will land.
- The reopen dialog, "Reopen Atlas Freight renewal", has a "New expected close date" field and the buttons "Reopen" and "Cancel".

### Dialogs

- Forms are one column, with labels above the fields. The buttons are at the bottom right, with the main one last.
- Delete buttons use the Raspberry shade for small text, and say what they delete, such as "Delete contact".

## Visual design

### Color tokens

Defined once as CSS variables. These are the light theme's values.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F0F4F5` | page background |
| `--panel` | `#FFFFFF` | panels, cards, dialogs |
| `--ink` | `#073B4C` Midnight | text, Negotiation |
| `--ink-muted` | `#56717A` | secondary text, Lost (5.2:1 on white) |
| `--divider` | `#E3EAEC` | lines between table rows only, never behind text |
| `--primary` | `#06D6A0` Sea Green | main buttons (Midnight text, 6.4:1), Won, Customer |
| `--primary-text` | `#047A5C` | Sea Green as text (5.3:1) |
| `--secondary` | `#FFC145` Marigold | Qualified (Midnight text, 7.5:1) |
| `--secondary-text` | `#8A5A00` | Marigold as text (5.9:1) |
| `--tertiary` | `#F78C6B` Coral | Proposal (Midnight text, 5.1:1) |
| `--tertiary-text` | `#B54A2A` | Coral as text (5.3:1) |
| `--info` | `#118AB2` Cerulean | New, Lead, large text and fills |
| `--info-strong` | `#0B6E8E` | behind small white text, and the focus ring (5.8:1) |
| `--alert` | `#EF476F` Raspberry | large alerts, chart highlights |
| `--alert-strong` | `#C9184A` | Late chip, Delete buttons, error text (5.7:1) |
| `--sea-mist` | `#CDD8DB` | ink on dark surfaces (8.3:1 on Midnight) |
| `--nav-current` | `#E6FBF5` | current section in the top bar (Midnight text 11.2:1, `--primary-text` icon 4.9:1) |
| `--forecast-bg` | `#F3F7F8` | behind the future part of the dashboard chart |
| `--tint-new` | `#DCEFF6` | New cards on the board |
| `--tint-qualified` | `#FFF0CC` | Qualified cards |
| `--tint-proposal` | `#FDE3DA` | Proposal cards |
| `--tint-negotiation` | `#DDE6E9` | Negotiation cards |
| `--tint-won` | `#D5F7EC` | Won cards |
| `--tint-lost` | `#E6ECEE` | Lost cards |
| `--ink-on-tint` | `#4A6670` | small text on the card tints (4.8:1 or more on each) |
| `--alert-on-dark` | `#FF9DB1` | overdue on the Midnight column (6.2:1) |
| `--muted-on-dark` | `#9DB4BA` | times on the Midnight column (5.6:1) |

On the Midnight column, links are Sea Green (6.4:1) and "Due today" is Marigold (7.5:1).

The focus ring is `--info-strong` on light surfaces. On any dark surface, such as the dashboard's Midnight column, it's Sea Green.

### Stage, status and chart colors

| Stage | Color | Chip text |
|---|---|---|
| New | Cerulean (`--info-strong` for chips) | white |
| Qualified | Marigold | Midnight |
| Proposal | Coral | Midnight |
| Negotiation | Midnight | white |
| Won | Sea Green | Midnight |
| Lost | `--ink-muted` | white |

| Status | Color |
|---|---|
| Lead | Cerulean, like New: chips use `--info-strong` with white text |
| Qualified | Marigold |
| Customer | Sea Green, like Won |

On the charts:

- Revenue won is Sea Green, with a `--primary-text` line over a light Sea Green fill.
- Deals won is Marigold.
- Pipeline and funnel use the stage colors. So do the open-deal bars after Today, and the Late bar's label is `--alert-strong`.
- Gradients are kept to that one light fill under the line.

### Type

- **Instrument Sans**: all headings and body text. Body is 15px, tables 14px and page titles 28px semibold.
- **JetBrains Mono**: money, percentages, dates in tables and headline figures, with tabular numbers so columns line up.
- **Instrument Serif**: used sparingly as an accent, such as one line on the dashboard. Never for data.

### Shapes

- Panels are rounded 16px with no outline, and at most a very soft shadow. The dashboard's chart panel is 20px.
- Board cards are rounded 12px. Inputs and buttons are 10px, and chips are fully rounded.
- The dashboard's dark column has square corners and runs to the edges of the window.
- No borders on one edge of a panel, and no single-line border across the top of the page.

### Motion

Short transitions, 150 to 200ms. The board's drag uses dnd-kit's own animation. Everything respects "reduce motion".

### Words

- Plain business English, short labels and no exclamation marks.
- Buttons say what they do: "Add deal", "Log activity", "Save", "Cancel", "Delete deal".
- Empty states say what to do next, such as "No activities yet. Log a call, email or note to start the timeline."

## Chosen design

**Mockup 7, `docs/mockups/7-forecast-board.html`**, with a screenshot of each screen beside it. It combines parts of the earlier mockups:

| Part | From |
|---|---|
| Top bar | 4, Forecast |
| Dashboard chart with the figures above it, deals won by month and the stage table under it | 4, Forecast |
| Sales funnel shape | 3, Big tickets |
| Dark column with follow-ups and recent activity | 6, Stage flow |
| Pipeline header sentence and arrow-shaped column headers | 6, Stage flow |
| Board cards tinted by stage, with a Stage button | 5, Deal mosaic |

"Screens" and "Visual design" above describe it. Take sizes, spacing and corner radii from the mockup's HTML. Its figures are the sample data's, and they add up.

**What choosing it changed in this spec:**

- A top bar replaces the sidebar (App shell 1).
- Won and Lost columns show "Closed in the last 30 days" in place of expected revenue (Concerns, Pipeline 6).
- Cards show the value in short form, and how soon an open deal is due (Pipeline 2).
- The revenue chart goes on past today with open deals by close month, up to 9 months ahead (Dashboard 2).
- Follow-ups and recent activity are stacked in a dark column, not side by side.
- Six board columns fit from 1,280px wide, down from 1,500px.
- New color tokens: the top bar's current section, the card tints, and the dark column's text colors. `--column` is gone, since columns no longer have a background.

**In the mockup but not working:** dragging cards, the stage menu, the "Add deal" buttons and the links to records. Part 1 says how they work. The mockup loads its fonts from Google Fonts, but the app bundles them (see "Worth knowing").

Mockups 1 to 6 stay in `docs/mockups/` for reference.

## Commands and first run

| Command | Does |
|---|---|
| `npm run dev` | Checks dependencies, then starts the backend (`uv run` Uvicorn) and the frontend (Vite) together with `concurrently`, and opens the browser at the dashboard |
| `npm test` | Runs Vitest, pytest (`uv run pytest`) and the Playwright tests in turn, and fails if any fail |
| `npm run seed` | Resets the data to the sample data, after asking. `npm run seed -- --yes` skips the question. Runs the backend's seed module through `uv run`. |

**First run.** Before `npm run dev` starts anything, a small Node script that needs no packages runs `npm install` if `node_modules` is missing or out of date, judged by comparing `package-lock.json` with `node_modules/.package-lock.json`. `uv run` installs the Python dependencies itself. On a fresh clone, one command is enough, given Node and uv.

## Security

- The backend listens on 127.0.0.1 only. There's no sign-in, as the intent says, so nothing is exposed to the network.
- All database access goes through SQLAlchemy Core with bound parameters.
- React escapes everything it shows. Website links are rendered only for `http` and `https` addresses, with `rel="noopener noreferrer"`. Anything else shows as text, so a `javascript:` address can't run.
- Request bodies are checked against the length limits.
- `data/` is git-ignored, so customer data and backups stay off GitHub. There are no secrets in the MVP.

## Testing

`npm test` runs all three kinds. None of them touches `data/accountable.db`.

- **Backend (pytest)**:
  - Each test gets a fresh temporary database and a fixed today.
  - Covers every rule in `rules.py`: validation messages, unique checks, delete and move rules, and stage changes, including Won to Lost, reopening and probability kept by hand. Also placement, and the activity link rules.
  - Covers the dashboard figures against known data, including the window boundaries, and the seed: the backup is made, it asks without `--yes`, and the dates are relative.
- **Frontend (Vitest)**: formatting money and dates, the late and board-window checks, the board totals, and the deal form's stage-change notes.
- **End to end (Playwright Test, installed Chrome)**:
  - Config starts its own backend and frontend on other ports, with `ACCOUNTABLE_DB` set to a test database that's reset with sample data first.
  - Tests add their own records with unique names rather than relying on each other.
  - Covers criteria 1 to 9 and the keyboard parts of 11, including:
    - adding, searching, sorting, editing and deleting in each table
    - the delete dialogs' counts
    - a refused contact move
    - drag and stage-menu moves, with totals and the saved position after a refresh
    - reopening a deal
    - a follow-up ticked done on the dashboard
    - an activity showing on both timelines
    - the figures changing after a win
- **By eye**:
  - Criterion 12 needs a person, or the agent with the Playwright MCP server, to use every section in a real browser. That means checking each screen against the brand and the chosen mockup, with no console errors.
  - Tests passing is necessary but not enough.
