# Plan: building the Accountable MVP

This plan builds what `docs/spec.md` describes, to meet the success criteria in `docs/intent.md`. The look is mockup 7 (`docs/mockups/7-forecast-board.html`).

How to use it:

- Build one phase at a time, in order. Each phase ends with `npm test` passing and `docs/STATUS.md` updated. That's a commit point, "Build: phase 1" and so on.
- Write the tests listed under "Proof" for a phase in the same phase, and run them as you go. Each group of tests there is marked with the phase that writes it.
- Where this plan and the spec disagree, the spec wins. This plan only adds decisions the spec left open, and says so.

## Files that change

Everything is new except `.gitignore`, `docs/STATUS.md` and `backend/crm/sample_data.json`, which already holds the mockups' records. `README.md` stays as it is.

The code is grouped by business area, as the spec's "Repo layout" says. The MVP has one area, the CRM, in `backend/crm/`, `frontend/src/crm/` and `e2e/crm/`. Code any area could use sits at the top level and never imports from an area. Only the files that put the app together import the areas: `main.py`, `seed.py` and `migrations/env.py`, and `App.tsx`.

```
accountable/
├── package.json, package-lock.json
├── pyproject.toml, uv.lock, .python-version
├── alembic.ini
├── .gitignore                 changed: adds data/
├── scripts/                   ensure-deps, dev, test, e2e-backend
├── shared/
│   └── crm-rule-cases.json
├── backend/
│   ├── __init__.py, settings.py, clock.py, db.py, errors.py, main.py, seed.py
│   ├── migrations/            env.py, script.py.mako, versions/
│   ├── crm/                   tables, schemas, rules, queries, dashboard, sample_data (.json and .py), routes/
│   └── tests/                 shared tests, and crm/ for the CRM's
├── frontend/
│   ├── package.json, tsconfig.json, index.html, vite.config.ts
│   └── src/
│       ├── main.tsx, App.tsx
│       ├── styles/, api/, lib/, components/, test/
│       └── crm/               api, routes, lib/, components/, forms/, timeline/, board/, dashboard/, pages/
├── e2e/                       config, fixtures, shell, keyboard, accessibility, seed, and crm/
└── data/                      git-ignored: accountable.db, backups/, test/
```

### Repo root

| File | What it's for |
|---|---|
| `package.json` | npm workspaces (`frontend`), the scripts `dev`, `test` and `seed`, and root dev dependencies: `concurrently`, `@playwright/test`, `@axe-core/playwright` |
| `package-lock.json` | npm's lock file |
| `pyproject.toml` | Python 3.12 or later. Dependencies: `fastapi`, `uvicorn`, `sqlalchemy`, `alembic`, `pydantic`, `email-validator`. Dev group: `pytest`, `httpx`. pytest settings. |
| `uv.lock` | uv's lock file |
| `.python-version` | `3.12`, so uv uses the right Python |
| `alembic.ini` | Points Alembic at `backend/migrations`, so `uv run alembic revision --autogenerate -m "..."` makes a new migration |
| `.gitignore` | add `data/`, so the database, backups and the test database stay out of git |
| `shared/crm-rule-cases.json` | Cases for the rules the backend and frontend both have: expected revenue and its rounding, totals, the late check and stage probabilities. Each case has its input, the answer and why. Both test suites check every case. |
| `docs/STATUS.md` | how to run the app, and progress after each phase |

`@axe-core/playwright` isn't in the spec's list of libraries. It's added for the accessibility checks in criterion 11 (labels and contrast on every page). It's widely used, and only the tests use it.

### `scripts/` (Node, no packages needed unless noted)

| File | What it's for |
|---|---|
| `ensure-deps.mjs` | Checks Node is 24 or later and that `uv` is installed, with a plain message if not. Runs `npm install` when `node_modules` is missing or out of date, judged by comparing `package-lock.json` with `node_modules/.package-lock.json`, as the spec says. |
| `dev.mjs` | Runs `ensure-deps.mjs`, then starts the backend (`uv run uvicorn`) and the frontend (Vite, with `--open` so the browser opens at the dashboard) with `concurrently`'s Node API. Ports come from `BACKEND_PORT` and `FRONTEND_PORT`. Doing this in Node rather than in the npm script keeps it working on Windows, where `$VAR` doesn't expand. |
| `test.mjs` | Runs Vitest, then pytest (`uv run pytest`), then Playwright. It runs all three even if one fails, prints a short summary and exits with an error if any failed. Refuses to run if `ACCOUNTABLE_DB` points at `data/accountable.db`. |
| `e2e-backend.mjs` | For the end-to-end tests: deletes `data/test/e2e.db`, then starts the backend on the test port with that file. The backend migrates the new database and fills it with sample data, so every run starts from the same data. |

### `backend/`, shared by every area

| File | What it's for |
|---|---|
| `__init__.py` | Makes `backend` a package, so `uv run python -m backend.seed` works |
| `settings.py` | Reads `ACCOUNTABLE_DB` (default `data/accountable.db`) and turns it into the database URL that everything else uses. Also `BACKEND_PORT` (default 8000). |
| `clock.py` | `today()` and `now()`, the only source of the date. Tests replace them. |
| `db.py` | The engine, with foreign keys on for every SQLite connection. `upgrade()` runs Alembic's migrations up to the latest. |
| `errors.py` | The 422, 409 and 404 shapes, and the handler that turns FastAPI's own validation errors into plain words |
| `main.py` | `create_app()`. Runs the migrations, fills a new database with each area's sample data, adds the error handlers, `/api/health` and each area's routes. |
| `seed.py` | The reset command: asks, backs up the file, makes a fresh database with the migrations, then adds each area's sample data |
| `migrations/env.py`, `migrations/script.py.mako` | Alembic's setup. It reads the URL from `settings.py` and the tables from each area's `tables.py`, with batch mode on so SQLite can change existing tables. |
| `migrations/versions/0001_crm_tables.py` | The first migration: the CRM's five tables, their constraints and indexes |
| `tests/conftest.py` | Migrates one template database per test run and gives each test its own copy, with a fixed today and a test client |
| `tests/test_*.py` | Tests for the shared code, listed under "Proof" |

### `backend/crm/`

The spec's single backend module for rules is `crm/rules.py`. The other files keep it and the routes short.

| File | What it's for |
|---|---|
| `__init__.py` | Makes `crm` a package |
| `tables.py` | The five tables from "Data model", with check constraints and indexes. Dates use SQLAlchemy's `Date` type and times its `DateTime` type. |
| `schemas.py` | Pydantic models for requests and responses, with the length limits |
| `rules.py` | Every CRM rule: validation, stage changes, placement, delete checks, contact moves and activity links. Each write is one transaction. |
| `queries.py` | Read queries: lists with counts and names, record pages and timelines |
| `dashboard.py` | Every dashboard figure, the forecast slots, the funnel, follow-ups and recent activity |
| `sample_data.json` | Already in the repo. The mockups' records, with every date an offset from today: 12 organizations, 15 contacts, all 40 deals with their furthest stage and board order, 9 follow-ups and 10 recent activity items. Its `dates` section says how each offset becomes a date, and `stillToAdd` lists what Phase 3 adds. |
| `sample_data.py` | Turns the offsets in `sample_data.json` into dates on the day the data is made, and adds the records |
| `routes/__init__.py` | One router that collects the others, for `main.py` to add |
| `routes/organizations.py`, `contacts.py`, `deals.py`, `activities.py`, `dashboard.py` | The API routes under `/api` |
| `../tests/crm/test_*.py` | The CRM's tests, listed under "Proof" |

### `frontend/`, shared by every area

| Path | What it's for |
|---|---|
| `package.json`, `tsconfig.json`, `index.html` | The Vite, React and TypeScript app |
| `vite.config.ts` | React and Tailwind plugins, the `/api` proxy to the backend, ports from the environment. Vitest settings (jsdom). It doesn't open the browser itself, since Playwright starts the frontend from the same config. |
| `src/main.tsx` | Query client and the app |
| `src/App.tsx` | The router and the shell. Adds each area's routes and its sections in the top bar. |
| `src/styles/tokens.css` | Every color token from "Visual design" as CSS variables |
| `src/styles/global.css` | Tailwind import, the tokens mapped into Tailwind's theme, Fontsource fonts, base type, the focus ring |
| `src/api/client.ts` | `fetch` wrapper that turns the error shapes into one error type with field errors |
| `src/lib/money.ts` | `$250,000` in full and `$1.2M` or `$250K` short |
| `src/lib/dates.ts` | Today in the browser, parsing ISO dates as local dates, "Nov 16, 2026" |
| `src/lib/table.ts` | Search across the shown text, and sorting numbers, money and dates as such |
| `src/lib/links.ts` | Shows a website as a link only for `http` and `https` |
| `src/components/layout/` | `TopBar`, `PageHeader`, `ServerBanner`, `SkipLink`, `NotFound` |
| `src/components/table/` | `DataTable` (TanStack Table), `SearchBox` |
| `src/components/dialogs/` | `FormDialog`, `ConfirmDialog` |
| `src/components/fields/` | Labeled text, select, date and checkbox fields, with their error messages |
| `src/components/Chip.tsx` | The chip shape that the CRM's chips use |
| `src/test/setup.ts` | Testing Library setup for Vitest |
| `**/*.test.ts(x)` | Unit and component tests next to the file they test, listed under "Proof" |

### `frontend/src/crm/`

| Path | What it's for |
|---|---|
| `api.ts` | The CRM's types, TanStack Query hooks, query keys, and what each save refreshes |
| `routes.tsx` | The CRM's pages and its five sections, for `App.tsx` to add |
| `lib/stages.ts` | Stage order, open or closed, usual probabilities, colors and tints |
| `lib/deals.ts` | Late check, the board's 30-day window, expected revenue, totals, "in 3 months" |
| `lib/followups.ts` | "9 days overdue", "Due today", "Due tomorrow", "Due in 3 days" |
| `lib/board.ts` | Applying a move to the cached deals for the instant update, and undoing it |
| `components/` | `StageChip`, `StatusChip`, `LateChip`, `StatusFilter`, `DeleteDialog` (reads the delete check first), `ReopenDialog` |
| `forms/` | `OrganizationForm`, `ContactForm`, `DealForm`, `ActivityForm`, `schemas.ts` (Zod, same messages as the server) |
| `timeline/` | `Timeline`, `TimelineItem` |
| `board/` | `Board`, `BoardColumn` (arrow header), `DealCard`, `StageMenu`, the screen reader announcements |
| `dashboard/` | `ForecastPanel` (figures, forecast chart, deals won bars, stage table), `FunnelPanel`, `FollowUps`, `RecentActivity`, `ChartTable` (the screen reader tables) |
| `pages/` | `DashboardPage`, `OrganizationsPage`, `OrganizationPage`, `ContactsPage`, `ContactPage`, `DealsPage`, `DealPage`, `PipelinePage` |

### `e2e/`

| File | What it's for |
|---|---|
| `playwright.config.ts` | Installed Chrome (`channel: "chrome"`). Starts `scripts/e2e-backend.mjs` on port 8011 and the frontend on 5183, with `ACCOUNTABLE_DB=data/test/e2e.db`, so it never touches your data or clashes with `npm run dev`. |
| `fixtures.ts` | Fails a test on any page error or console error from the app. It ignores Chrome's "Failed to load resource" lines for 4xx replies, since several tests make the server refuse on purpose and check the message on screen instead. Helpers to add records through the API with unique names, and to run axe. |
| `shell.spec.ts`, `keyboard.spec.ts`, `accessibility.spec.ts`, `seed.spec.ts` | Checks across the whole app, listed under "Proof" |
| `crm/*.spec.ts` | The CRM's end-to-end tests, listed under "Proof" |

## Order of work

Seven phases. The backend comes first, because the rules live there and pytest can prove them without a browser. Each screen then gets its end-to-end tests in the same phase it's built.

### Phase 1: Skeleton, commands and shell

- Root `package.json`, `pyproject.toml`, `.python-version`, `alembic.ini`, lock files, and `data/` in `.gitignore`.
- `scripts/ensure-deps.mjs`, `scripts/dev.mjs`, `scripts/test.mjs`, `scripts/e2e-backend.mjs`.
- **Backend:**
  - `settings.py`, `clock.py`, `db.py` and `errors.py`
  - `main.py` with `create_app()` and `/api/health`
  - `crm/tables.py` with all five tables
  - Alembic in `backend/migrations/`, with the first migration made from `crm/tables.py` and checked by hand
  - The app runs the migrations each time it starts.
- Frontend: Vite app with Tailwind v4, Fontsource fonts and `tokens.css` with every token from the spec. `App.tsx` takes its sections and routes from `crm/routes.tsx`.
- **The shell from mockup 7:**
  - the top bar with the five sections, the current one marked with `aria-current`, and today's date
  - the skip link
  - routes with placeholder pages
  - "Page not found"
  - the server banner. It shows "Can't reach Accountable's server. Check that `npm run dev` is still running." only after the health check has failed a few times, so a slow first start doesn't flash it.
- Test runners wired up: Vitest, pytest with `conftest.py`, and Playwright with its web servers and fixtures.

**Done when** `npm run dev` on a fresh clone installs what's missing, starts both servers and opens the browser on the dashboard placeholder. `npm test` passes the Phase 1 tests: `test_app.py`, `test_migrations.py`, `test_layout.py`, `TopBar.test.tsx`, `ServerBanner.test.tsx`, `layout.test.ts` and `shell.spec.ts`. Each runner needs at least one test from Phase 1 on, since pytest and Vitest fail when they find none.

### Phase 2: Backend records and rules

- `crm/schemas.py`, `crm/rules.py`, `crm/queries.py`, and every route in the API table except `/dashboard`, in `crm/routes/`:
  - organizations, contacts, deals and activities: list, read, add, edit, delete
  - delete checks for organizations, contacts and deals
  - the deal move, with placement
  - timelines for contacts and deals
  - `PATCH /activities/{id}` for the Done checkbox
- One stage-change function, used by both the move and the deal edit.
- **Stage-menu placement (a decision the spec left open).** The spec says a move with no `before_id` goes to the bottom of the column, but a stage-menu move goes to the top. So the stage menu sends the `before_id` of the target column's top card, or none if the column is empty. The API stays as the spec has it.
- **Expected revenue (a decision the spec left open).** Each deal's expected revenue is `value × probability / 100`, rounded to whole dollars with halves rounding up. It's worked out in whole numbers, so large values don't pick up floating-point errors. Totals add up those whole-dollar amounts. So every total equals the sum of the figures shown under it: a column's, the board's, and the dashboard's stage table and headline figure. The frontend uses the same rule.
- `shared/crm-rule-cases.json`: the cases for expected revenue, totals, the late check and stage probabilities, checked here by pytest and in Phase 4 by Vitest.

**Done when** the Phase 2 pytest files pass: validation, records, stage changes, placement, activities, deletes, timelines, shared cases, API errors and persistence.

### Phase 3: Sample data, reset and dashboard figures

- **`crm/sample_data.py`:**
  - `crm/sample_data.json` already holds every record the mockups show, including all 40 deals. Keep them as they are, so the app can be compared with mockup 7.
  - Add what its `stillToAdd` list asks for to the same file: the other contacts, the organizations' industries, websites and notes, stage history, the rest of the activities and follow-ups.
  - `sample_data.py` turns the offsets into dates, following the file's `dates` section. Won deals are placed by calendar month and day, clamped to today, so the right wins land in each month on any day of the year. The file's figures were checked on nine dates, from Jan 1 to Dec 31 and Feb 29: 2 wins this month, 16 in the last 12 months across 10 months, at least 2 won and 2 lost in the last 30 days, 3 late, and no close date more than 9 months ahead.
- `main.py` fills a new database with the sample data on first start. A later start leaves the data alone.
- **`seed.py`:**
  - It explains what it does and asks "Replace all data with fresh sample data? (y/N)". Only "y" or "yes" goes ahead.
  - It backs up to `<database folder>/backups/accountable-YYYYMMDD-HHMMSS.db` and prints where, then makes a fresh database with the migrations and adds the sample data.
  - `--yes` skips the question. With no database yet, it just creates one.
- **`crm/dashboard.py` and `GET /api/dashboard`:**
  - the four figures
  - 12 months of revenue and deals won
  - the forecast slots, under the rules in Dashboard 2 of the spec: Late, Rest of this month, up to 9 months, Later, and "No open deals"
  - open pipeline by stage
  - the funnel
  - follow-ups (overdue, then the next 7 days)
  - the 10 most recent items

**Done when** the Phase 3 tests pass: the pytest files for sample data, seed, dashboard and forecast, and `seed.spec.ts`. With today fixed at Nov 16, 2026, the figures equal mockup 7's.

### Phase 4: Tables, forms and record pages

- `src/lib`, `src/api/client.ts`, the shared components, `crm/lib` and `crm/api.ts`, with their unit tests. Vitest checks every case in `shared/crm-rule-cases.json`.
- **The three tables:**
  - search, sorting with `aria-sort`, and the default sorts
  - "12 of 36 contacts"
  - "No contacts match 'acme'"
  - the contacts' status filter with counts
  - Edit and Delete on each row
- **The four forms in dialogs:**
  - field messages from the spec, with focus on the first bad field
  - the deal form lists only the chosen organization's contacts
  - the deal form's stage notes: probability, the close date locked to today for Won and Lost, and "New expected close date" when reopening
  - "Add a contact first" when an organization has none
- **Delete dialogs** that read the delete check just before opening. After a delete from a record's own page, the app goes back to the table.
- **The three record pages:**
  - Organization, with "Add contact" and "Add deal" filled in
  - Contact, with its deals
  - Deal (the stage menu arrives in Phase 5)
- **Timelines** on contact and deal pages, with "Log activity", Edit, Delete and the Done checkbox. Stage changes look different from activities.
- Tables, record pages and dialogs weren't mocked up. They use mockup 7's tokens, type and panel style.

**Done when** the Phase 4 tests pass:
- Vitest for `src/lib`, `crm/lib`, the shared cases, the forms, the table and the delete dialog
- the end-to-end files for organizations, contacts, deals and activities
- the cases for these pages in `keyboard.spec.ts` and `accessibility.spec.ts`

### Phase 5: Pipeline

- **The board from mockup 7:**
  - the totals sentence under the title
  - six equal columns
  - arrow-shaped headers in stage colors. Open stages show expected revenue. Won and Lost show "Closed in the last 30 days".
  - an outlined "Add deal" button per column
  - cards tinted by stage, with a Late chip or "in 3 months", and a "Stage" button
- Won and Lost show only deals closed in the last 30 days.
- **Dragging with dnd-kit:**
  - between and within columns, using its sortable pattern for several containers
  - a lifted copy follows the pointer, with a gap where the card will land
  - dnd-kit's screen reader announcements
- **`StageMenu`** (Radix DropdownMenu):
  - works by keyboard, and focus stays on the moved card
  - a live region says "Moved Atlas Freight renewal to Negotiation"
  - the same menu goes on the deal page
- **The instant update:**
  - a move changes the cached deals first, so cards, column totals and board totals change at once
  - if the server refuses, the move is undone and a message says why
  - a short message after closing a deal: "Moved to Won. Close date set to today."
- **`ReopenDialog`**, for a move from Won or Lost to an open stage. The date is 30 days from today by default. Cancelling puts the card back.

**Done when** the Phase 5 tests pass:
- Vitest for board totals, moves and the stage menu
- `crm/pipeline.spec.ts`
- the pipeline's cases in `keyboard.spec.ts` and `accessibility.spec.ts`

### Phase 6: Dashboard

- **The layout from mockup 7:** the main column, and the dark Midnight column (400px at 1,440px, about 356px at 1,280px) running from under the top bar to the bottom of the page.
- **"Revenue won, and what's due to close"** (Recharts `ComposedChart`, one money axis):
  - Revenue won is a line over a light Sea Green fill for the 12 months.
  - A "Today" marker (`ReferenceLine`) follows.
  - Open deals are stacked bars by forecast slot.
  - The future part sits on `--forecast-bg` (`ReferenceArea`).
  - Labels are selective, as in the mockup.
  - **The figures** are split into past and future above the chart. The split is worked out from the number of slots, so it lines up with Today.
  - **Deals won by month** (Recharts `BarChart`) sits under the past part, with the same months lined up.
  - **The stage table** sits under the future part.
  - **Tooltips:** a past month shows its figures, and a future slot lists its deals.
- **Sales funnel:** Recharts `Funnel` trapezoids in stage colors, beside a table of deals, value reached, share of New and share of the stage before. The rows are fixed to the bands' height so they line up.
- **The dark column:**
  - follow-ups: Overdue, then Next 7 days, each with a count, and checkboxes that save at once and refresh the figures
  - recent activity, with "Moved from" and stage chips
  - "No follow-ups due in the next 7 days" when none are due
- Every chart has a title, a one-line summary and a screen reader table of its figures.

**Done when** the Phase 6 tests pass:
- `FollowUps.test.tsx`
- `crm/dashboard.spec.ts`
- the dashboard's cases in `keyboard.spec.ts` and `accessibility.spec.ts`

Screenshots at 1,440px and 1,280px should look like `7-forecast-board-dashboard.png`.

### Phase 7: Finish and check by eye

- Run the whole of `npm test`, including the keyboard and accessibility files across every page, and fix what it finds.
- **Check by eye (criterion 12), with the Playwright MCP server:**
  - use every section and every action in a real browser, the way a salesperson would
  - compare the dashboard and pipeline with mockup 7 at 1,440px and 1,280px
  - check the console is clean on every page
- Try it from a fresh clone: `npm run dev` with no `node_modules`, then `npm run seed`, then a restart to see changes kept.
- Write the run instructions in `docs/STATUS.md`:
  - what to install (Node 24 or later, uv, Google Chrome)
  - `npm run dev`, `npm test` and `npm run seed`
  - where the data lives

**Done when** `npm test` passes in full, the check by eye finds nothing left to fix, and `docs/STATUS.md` says how to run it.

## Risks

1. **The dashboard's main chart is the hardest screen.**
   - Recharts has to draw a line for the past and stacked bars for the future on one axis, with a Today marker and a shaded future area. The figures above it and the deals won bars below have to line up with the same split.
   - Mitigation:
     - Build this panel first in Phase 6, and compare it with the mockup before moving on.
     - Use one category axis covering every slot, and give the line values only in past slots and the bars values only in future slots.
     - Work out the split from the slot count and the chart's left margin, and share it with the panels above and below.
   - If Recharts really can't match the mockup, stop and ask before writing the chart by hand. The tech stack says to prefer a library.
2. **Sample data can land in the wrong month.** If a win is "3 days ago" and today is the 2nd, it falls in last month, and "Won this month" shows $0. Mitigation:
   - Place win dates by calendar month and clamp them to today, as in Phase 3.
   - The sample data tests run against several fixed dates: Jan 1, Feb 28 and 29, a mid-month day and Dec 31.
3. **Dates can be off by a day between the browser and the server.** `new Date("2026-11-16")` is midnight UTC, which is the day before in the Americas. Mitigation:
   - Every date string is parsed as a local date in `src/lib/dates.ts`, and nothing else parses dates.
   - The backend's `Date` and `DateTime` columns give Python dates and times, never strings to parse by hand.
   - Vitest runs with `TZ=America/Los_Angeles` to catch this.
4. **Drag and drop is tricky to get right.** Moving between columns and within one, the instant update, undoing on refusal and cancelling a reopen all touch the same state. Mitigation:
   - Follow dnd-kit's documented pattern for several containers.
   - Keep the board's order in the query cache only, and make `crm/lib/board.ts` a pure function with unit tests.
   - In end-to-end tests, drag with step-by-step mouse moves. dnd-kit needs to see the pointer move before a drag starts, so Playwright's one-step `dragTo` can miss.
5. **Figures that don't add up.** Rounding expected revenue in different places, or rounding a total separately from its parts, would show columns that don't add up to the board total. Mitigation:
   - One rule (Phase 2): round each deal, then add.
   - Its cases are in `shared/crm-rule-cases.json`, which pytest and Vitest both check, including halves and values large enough to show floating-point errors.
6. **Windows.** Environment variables in npm scripts, stopping both servers with Ctrl+C, and paths all differ on Windows. Mitigation:
   - Every command is a Node script or `uv run`.
   - `concurrently` stops the other process when one exits.
   - Paths are built with `path.join`.
   - Only macOS is available to test on here, so say in `docs/STATUS.md` that Windows and Linux haven't been tried by hand yet.
7. **First run needs the internet once.** `npm install` and uv's first download of Python and packages need a connection. After that it works offline, as the intent asks, with the fonts bundled. Mitigation: `ensure-deps.mjs` gives a plain message if `uv` is missing or a download fails.
8. **Tests touching real data.** Mitigation:
   - pytest uses a temporary file per test.
   - Playwright uses `data/test/e2e.db`.
   - `scripts/test.mjs` refuses to run if the database setting points at `data/accountable.db`.
9. **Flaky end-to-end tests.** Shared data between tests, and runs across midnight or the end of a month, can make results change. Mitigation:
   - Every test adds its own records with unique names.
   - Tests check changes ("Won this month went up by the deal's value") rather than fixed totals.
   - Nothing depends on another test having run.
10. **Contrast and accessibility on the tinted cards and the dark column.** The tokens were checked in the spec, but real components can drift from them. Mitigation: axe runs on every page in the end-to-end tests, and the check by eye covers focus rings on light and dark surfaces. Axe can raise false alarms on chart shapes. Those get excluded one at a time, with a reason, never as a whole page.
11. **Migrations and tables drift apart.** Someone changes `tables.py` and forgets the migration, or the reverse. SQLite also can't change a column in place. Mitigation:
    - A test checks that the migrated database matches the tables exactly.
    - Batch mode is on in `env.py`, so Alembic rebuilds a SQLite table when a column changes.
    - Each migration is read by hand before it's committed, since autogenerate misses some changes, such as check constraints.
12. **Areas getting tangled.** Shared code that imports from `crm/` would make every later area depend on the CRM. Mitigation: the layout tests in pytest and Vitest fail if any shared file imports from an area.
13. **It's a big build.** Mitigation:
    - Seven phases, each ending green and committed, so a stop leaves working software.
    - If a usage limit stops a phase, carry on in the same session after the reset.

## Proof

Each item is one test. The phase in brackets after a file name is the phase that writes it. Today is fixed in pytest, and in Vitest where the case needs it. The end-to-end tests use the real date and the sample data.

### Backend unit tests (pytest, `backend/tests/`)

**`test_app.py`** (Phase 1)

1. `/api/health` answers ok.
2. A new database file gets every table and index, with the check constraints.
3. Foreign keys are on for every connection: a contact with an organization that doesn't exist is refused by the database itself.
4. `ACCOUNTABLE_DB` chooses the database file, and the default is `data/accountable.db`.

**`test_migrations.py`** (Phase 1)

1. Running every migration on an empty database gives exactly the tables, columns, constraints and indexes in `crm/tables.py`. Alembic's compare finds no differences.
2. Starting the app on an up-to-date database runs nothing and changes nothing.
3. A date column comes back as a Python `date`, and SQLite holds it as `2026-11-16`.
4. The check constraints are there after migrating: a deal with a negative value is refused by the database itself.

**`test_layout.py`** (Phase 1)

1. No shared backend file imports from `backend/crm/`. Only `main.py`, `seed.py` and `migrations/env.py` may.

**`crm/test_validation.py`** (Phase 2)

1. An organization with no name, or only spaces, is refused with "Enter a name."
2. A second organization named " acme ltd " is refused with "An organization called Acme Ltd already exists."
3. Saving an organization unchanged, keeping its own name, is allowed.
4. Each length limit is enforced: names 200, job title and industry 100, phone 50, website 200, notes and descriptions 5,000.
5. A contact needs an organization that exists.
6. A badly formed email is refused with "Enter a valid email address, like name@company.com."
7. An email already used, in different case, is refused with "Another contact already uses this email."
8. Emails are stored trimmed and in lower case. Several contacts can have no email.
9. A deal with a negative or fractional value is refused with "Enter a value of $0 or more, in whole dollars."
10. A probability outside 0 to 100 is refused.
11. A deal whose main contact is at another organization is refused with "Choose a main contact at Acme Ltd."
12. A deal with no close date, or an unknown stage, is refused.
13. An activity needs a type, a description and when it happened.

**`crm/test_records.py`** (Phase 2)

1. Organizations list with their contact and open-deal counts.
2. An organization's page lists its contacts and deals.
3. Contacts list with their organization's name.
4. Deals list in board order, with organization and contact names.
5. Editing each kind of record saves every field.
6. A missing record gives 404 with "That deal no longer exists."
7. **Contact move:** moving a contact who is the main contact on a deal is refused with 409, listing those deals.
8. Moving a contact who isn't a main contact works, and their activities keep their links.
9. Changing a deal's organization without a main contact there is refused. With one, it works.

**`crm/test_stage_changes.py`** (Phase 2)

1. Each stage sets its usual probability: 10, 25, 50, 75, 100, 0.
2. A probability typed in the same save as a stage change is replaced by the stage's usual one.
3. A probability set by hand, with no stage change, is kept. It's replaced at the next stage change.
4. A move into Won sets the close date to today, even if another date was sent.
5. A move into Lost does the same.
6. A move from Won to Lost resets the close date to today.
7. Reopening from Won or Lost without a close date is refused with 409.
8. Reopening with a date sets it.
9. Every stage change adds a row with from, to and the time.
10. Changing a card's place in its column adds no row.
11. The furthest stage moves forward with the deal, and stays at Won after the deal moves back.
12. A deal added at Won gets today as its close date, Won as its furthest stage, and no stage-change row.
13. A deal added at Lost has New as its furthest stage.
14. Winning a deal leaves the main contact's status alone.
15. The deal edit and the move use the same rules: the same input gives the same result through both.

**`crm/test_placement.py`** (Phase 2)

1. A new deal goes to the top of its column.
2. A move with `before_id` lands just above that card.
3. A move with no `before_id` lands at the bottom.
4. A deal changed to a new stage in the edit form goes to the top.
5. Positions are renumbered from 0 with no gaps after moves and deletes.
6. A `before_id` from a different column is refused.

**`crm/test_activities.py`** (Phase 2)

1. An activity logged on a contact can also link to a deal at the contact's organization.
2. A deal at another organization is refused.
3. The same holds the other way, for an activity logged on a deal.
4. An activity must keep at least one link.
5. Editing an activity keeps its links, even after its contact has moved to another organization.
6. `PATCH` sets done and unsets it.
7. An activity can be dated in the future.

**`crm/test_deletes.py`** (Phase 2)

1. An organization's delete check counts its contacts and deals.
2. The delete is refused with 409 while there are any. An empty organization deletes.
3. A contact's delete check lists the deals where they're the main contact, and the delete is refused.
4. A contact's delete check counts activities linked only to them and activities also linked to a deal.
5. **Deleting a contact:**
   - activities linked only to them go
   - activities also linked to a deal stay, with no contact
6. A deal's delete check counts the same way.
7. **Deleting a deal:**
   - activities linked only to it go
   - activities also linked to a contact stay, with no deal
   - its stage changes go
8. Deleting an activity works.
9. No delete ever leaves an activity with no link.

**`crm/test_timelines.py`** (Phase 2)

1. A contact's timeline is newest first by when it happened.
2. A deal's timeline mixes activities and stage changes, newest first.
3. An activity linked to both appears on both timelines.

**`crm/test_dashboard.py`** (Phase 3, known data and a fixed today)

1. **Open pipeline:** the value and count of open deals.
2. **Expected revenue:** each deal is rounded to whole dollars, halves up, then added. The stage table's rows add up to the headline figure.
3. **Won this month:** a deal closed on the 1st counts, and one closed on the last day of last month doesn't.
4. **Won in the last 12 months:** this month and the 11 before. The 12th month back doesn't count.
5. Revenue and deals won give 12 months ending with this month. Months with no wins show 0.
6. Open pipeline by stage gives the count, value and expected revenue for each open stage.
7. **Funnel:**
   - only open deals, and deals closed in the last 12 months, are counted
   - each stage counts the deals that reached it or later
   - a lost deal counts up to its furthest stage
   - a deal won and then moved back still counts at Won
8. **Follow-ups:**
   - overdue ones come oldest first
   - then those due today to 7 days from today, soonest first
   - done ones are left out
   - one due in 8 days is left out
9. **Recent activity:** the 10 latest activities and stage changes, newest first. Future-dated activities are left out.
10. A deal due today isn't late.

**`crm/test_forecast.py`** (Phase 3)

1. Late deals form one "Late" slot, first. With none late, there's no Late slot.
2. **"Rest of Nov":**
   - deals due from today to the end of the month go here
   - a deal due today goes here, not in Late
   - with none, there's no slot
3. Monthly slots run from next month to the latest close date. A month in between with nothing due still appears, empty.
4. A deal due more than 9 months ahead goes into "Later". No monthly slot goes beyond 9 months.
5. With no open deals, there are no slots, and the response says so.
6. Each slot gives its value by stage and lists its deals for the tooltip.
7. The slots add up to the open pipeline's value and expected revenue.

**`crm/test_sample_data.py`** (Phase 3, run for each of: Jan 1, Feb 28 and Feb 29 of a leap year, Nov 16, 2026, and Dec 31)

1. About 12 organizations in at least six industries, and about 36 contacts with every status.
2. **40 deals:**
   - 16 won in the last 12 months, with a win in at least 10 of the 12 months
   - 7 lost
   - at least 2 won and 2 lost in the last 30 days
   - 17 open across the four open stages, 3 of them late
3. Open close dates fall within the next 9 months, so there's no "Later" slot.
4. At least one deal is won this month, on every date tested.
5. **Follow-ups:**
   - 4 overdue
   - 5 due in the next 7 days, one of them today
   - 4 due later
   - some done
6. Every main contact is at their deal's organization, and every activity's links follow the rules.
7. **Stage history:**
   - every deal past New has entries, in time order
   - each one falls between the deal's start and today, or its close
   - each deal's furthest stage matches its history
8. Every email ends in `.example.com`.
9. With today Nov 16, 2026, the figures equal mockup 7's:
   - open pipeline: $9,040,000 across 17 deals
   - expected revenue: $3,481,000
   - won this month: $1,080,000, 2 deals
   - won in the last 12 months: $7,710,000, 16 deals
10. A new database gets the sample data on first start, and a second start doesn't add it again.

**`test_seed.py`** (Phase 3)

1. Without `--yes`, it asks. Answering "n" or just Enter changes nothing.
2. Answering "y" or "yes" saves a backup named `accountable-YYYYMMDD-HHMMSS.db`, prints where it went, and replaces the data.
3. `--yes` skips the question.
4. With no database yet, it creates one and makes no backup.
5. Seeding on two different days gives dates shifted by the same number of days.

**`crm/test_shared_cases.py`** (Phase 2)

1. Every expected revenue case in `shared/crm-rule-cases.json` gives its answer, including halves and very large values.
2. Every totals case gives its answer: each deal rounded, then added, so the total equals the sum of the rounded parts.
3. Every late case gives its answer: due yesterday is late, due today isn't, closed deals never are.
4. Every stage's probability matches the file.

**`test_api_errors.py` and `test_persistence.py`** (Phase 2)

1. A malformed request gives 422 in the spec's shape, in plain words.
2. Refusals give 409 with a message and details.
3. A missing record gives 404 with a message.
4. A body over the length limits is refused.
5. **The restart test:** a change made through one app instance is there when a new instance opens the same file.

### Frontend unit tests (Vitest, `frontend/src/`)

**`layout.test.ts`** (Phase 1)

1. No file in `src/lib`, `src/api` or `src/components` imports from `src/crm`. Only `App.tsx` may.

**`components/layout/TopBar.test.tsx`** (Phase 1)

1. Lists Dashboard, Organizations, Contacts, Deals and Pipeline in that order, each with its label.
2. The current section has `aria-current="page"`.

**`components/layout/ServerBanner.test.tsx`** (Phase 1)

1. Hidden while the health check answers.
2. Shows "Can't reach Accountable's server. Check that `npm run dev` is still running." only after several failed checks, and hides again when the server answers.

**`lib/money.test.ts`** (Phase 4)

1. Full amounts: "$250,000" and "$0".
2. Short amounts: "$520K", "$250K", "$1.2M", "$9.0M".

**`lib/dates.test.ts`** (Phase 4)

1. Formats as "Nov 16, 2026".
2. Run with `TZ=America/Los_Angeles`: "2026-11-16" stays Nov 16.

**`crm/lib/deals.test.ts`** (Phase 4, except case 4 in Phase 5)

1. **Late:**
   - an open deal due yesterday is late
   - an open deal due today isn't
   - Won and Lost deals never are
2. **The board window:**
   - open deals always show
   - a closed deal 30 days ago shows
   - a closed deal 31 days ago doesn't
3. Column and board expected revenue are sums of each deal's rounded amount, so the columns add up to the board's total. The shared cases cover the rounding itself.
4. **Board totals:**
   - the board counts open deals only
   - each column gives its count and value
   - open columns also give expected revenue
5. **How soon a deal is due:**
   - "in 25 days" under 45 days
   - "in 3 months" from 45 days, rounded to whole months

**`crm/lib/sharedCases.test.ts`** (Phase 4)

1. Every case in `shared/crm-rule-cases.json` gives the same answer in the browser's code as it does in the backend's: expected revenue, totals, late and probabilities.

**`crm/lib/stages.test.ts`** (Phase 4)

1. Stage order, open or closed, and the usual probabilities.

**`crm/lib/followups.test.ts`** (Phase 4)

1. "9 days overdue", "1 day overdue", "Due today", "Due tomorrow", "Due in 3 days".

**`crm/lib/board.test.ts`** (Phase 5)

1. A move to another column with a `before_id` puts the card above it, and sets the stage and probability.
2. A move into Won sets today's close date.
3. A move within a column changes only the order.
4. Undoing restores the cache exactly.

**`lib/table.test.ts`** (Phase 4)

1. Search ignores case and matches any shown text, such as the organization or a formatted amount.
2. Money and dates sort as numbers and dates, not text.

**`lib/links.test.ts`** (Phase 4)

1. `http` and `https` websites become links.
2. `javascript:` and other text stay plain text.

**`crm/forms/schemas.test.ts`** (Phase 4)

1. Each message matches the server's wording.

**`crm/forms/DealForm.test.tsx`** (Phase 4)

1. Choosing another stage shows "Probability will be set to 50%".
2. Choosing Won or Lost locks the close date to today with "The close date will be set to today."
3. Reopening shows "New expected close date", filled with 30 days from today.
4. Changing the organization clears the main contact and lists only that organization's contacts.

**`components/table/DataTable.test.tsx`** (Phase 4)

1. Clicking a heading sorts and sets `aria-sort`, and a second click reverses it.
2. It shows "12 of 36 contacts", and "No contacts match 'acme'" when nothing matches.

**`crm/components/DeleteDialog.test.tsx`** (Phase 4)

1. Shows the counts from the delete check.
2. When the delete is refused, it offers only Close.

**`crm/board/StageMenu.test.tsx`** (Phase 5)

1. Lists the stages and works with the arrow keys and Enter.
2. Moving sends the target column's top card as `before_id`.

**`crm/dashboard/FollowUps.test.tsx`** (Phase 6)

1. Overdue items come first, under "Overdue" with a count, then "Next 7 days" with a count.
2. With none due, it says "No follow-ups due in the next 7 days".
3. Ticking a checkbox saves it as done.

### End-to-end tests (Playwright, `e2e/`)

Every test fails on a page error or a console error from the app. Chrome's "Failed to load resource" lines for 4xx replies are ignored, since refusals are checked on screen. The numbers in brackets are the success criteria in `docs/intent.md`.

**`shell.spec.ts`** (Phase 1) [1, 11]

1. The app opens on the dashboard.
2. The top bar lists the five sections in order. Each one opens, and the current one is marked.
3. An unknown address shows "Page not found" with a link to the dashboard.
4. The first Tab lands on "Skip to content", and it works.

**`crm/organizations.spec.ts`** (Phase 4) [1, 2, 3, 4]

1. The table shows the sample organizations, sorted by name A to Z.
2. **Add an organization:**
   - it appears in the table
   - search finds it
   - it's still there after a refresh
3. A duplicate name in different case is refused with the message next to the field, and the field gets focus.
4. Sorting by name reverses on a second click.
5. **Edit:** the change shows in the table and on the record page.
6. **Deleting an organization with contacts and deals:**
   - the dialog gives the counts and offers only Close
   - an empty organization deletes
7. **The record page:**
   - it lists the organization's contacts and deals
   - "Add contact" opens with the organization filled in

**`crm/contacts.spec.ts`** (Phase 4) [1, 2, 3, 4]

1. The table shows the sample contacts, sorted by name A to Z.
2. **Add a contact:**
   - an invalid email is refused, then a used email is refused
   - with a good one, it saves
3. The status filter shows counts, works together with search, and the counts change after a status edit.
4. **Moving a contact who is a deal's main contact** to another organization is refused, and the message names the deals.
5. Moving a contact who isn't a main contact works.
6. Deleting a contact who is a main contact is refused, and the dialog lists the deals.
7. **Deleting another contact:**
   - the dialog gives both counts
   - afterwards, an activity that was also linked to a deal is still on the deal's timeline
8. **The record page:**
   - it shows the contact's details and deals
   - the email is a `mailto:` link
   - the organization links to its page

**`crm/deals.spec.ts`** (Phase 4) [1, 2, 3, 5, 6]

1. The table shows the sample deals, sorted by close date, latest first.
2. **Add a deal:**
   - the main contact list shows only the chosen organization's contacts
   - changing the organization clears it
3. Choosing an organization with no contacts shows the message saying so, with a link to add a contact there.
4. A negative value is refused with its message.
5. Adding a deal at Won locks the close date to today, with the note.
6. A late deal shows the Late chip in the table.
7. Sorting by value is numeric.
8. Changing the stage in the edit form shows the probability note, and the table then shows the new stage and probability.
9. **Deleting a deal:**
   - the dialog gives both counts and mentions the stage history
   - afterwards, an activity that was also linked to a contact is still on the contact's timeline
10. Deleting from the deal's own page goes back to the Deals table.

**`crm/activities.spec.ts`** (Phase 4) [7]

1. **Log a call on a contact, also linked to one of their organization's deals:**
   - it appears on both timelines, newest first
   - each timeline links to the other record
2. Edit the activity, then delete it with its confirmation.
3. Ticking Done on a timeline keeps the follow-up there, marked done. It can be unticked.
4. A stage change shows "Moved from Proposal to Negotiation" on the deal's timeline.

**`crm/pipeline.spec.ts`** (Phase 5) [1, 5, 6, 11]

1. The board shows the sample deals as cards in six columns.
2. **Drag a card to the next column:**
   - The test holds up the server's reply, so it can check the card, its column's totals and the board's totals have already changed.
   - Then the reply arrives, and the Deals table shows the new stage and probability.
3. **Drag a card higher in its own column:** after a refresh, it's still in that place.
4. **The stage menu by keyboard:**
   - focus the card's "Stage" button, open the menu and choose Negotiation with the keys
   - the card moves to the top of Negotiation and keeps focus
   - the announcement is made
5. **Move a deal to Won:**
   - its close date becomes today, and the message says so
   - its main contact's status hasn't changed
6. **Move a Won deal back to Proposal:**
   - the reopen dialog offers a date 30 days ahead
   - Cancel puts the card back
   - confirming moves it with the chosen date
7. When the server refuses a move, the card goes back and a message says why. The test makes the server refuse.
8. "Add deal" in the Qualified column opens the form at Qualified, and the new card appears at the top of that column.
9. A Won deal whose close date is edited to 40 days ago leaves the board and stays in the Deals table.
10. A late deal's card shows the Late chip.
11. The header sentence and the column totals match the deals on the board.

**`crm/dashboard.spec.ts`** (Phase 6) [1, 7, 8, 10]

1. The dashboard opens with the sample data in the figures, the forecast chart, the funnel, follow-ups and recent activity.
2. The four figures match totals worked out from `/api/deals` in the test.
3. Moving a deal to Won raises "Won this month" by its value and its count by one.
4. **Log a follow-up due tomorrow on a contact:**
   - it appears under "Next 7 days" as "Due tomorrow"
   - the counts go up
5. **Tick the follow-up done on the dashboard:**
   - it disappears and the counts go down
   - it's still gone after a refresh
6. Overdue follow-ups come first, oldest first.
7. After a stage change, recent activity shows it at the top.
8. The forecast chart shows a "Late" slot with the sample data's late deals. Hovering a month ahead lists its deals.
9. Each chart has its summary line and a screen reader table with the same figures.

**`keyboard.spec.ts`** (Phases 4 to 6, each adding its pages) [11]

1. Every top bar link can be reached and opened with the keyboard.
2. **"Add" opens its dialog by keyboard:**
   - focus stays inside the dialog
   - Escape closes it and focus returns to the button
3. Sorting works from a heading with Enter. The status filter and search work by keyboard.
4. A follow-up's Done checkbox works with Space, on the dashboard and on a timeline.
5. The focused element shows a visible ring on light panels and on the dark column.

**`accessibility.spec.ts`** (Phases 4 to 6, each adding its pages) [11]

1. Axe finds no failures for contrast or missing labels on these pages:
   - the dashboard
   - each table
   - each record page
   - the pipeline
   - each form dialog, open

**`seed.spec.ts`** (Phase 3) [9]

This runs the real `npm run seed` against a copy of the test database. No browser is needed.

1. Answering "n" leaves the file unchanged.
2. **`--yes`:**
   - it makes a timestamped backup in the `backups` folder beside the database
   - it brings back the sample data, so a record added before the reset is gone

### Check by eye (Phase 7) [10, 12]

Done in Phase 7 with the Playwright MCP server:

1. Every section and every action in the criteria, used as a salesperson would.
2. The dashboard and pipeline compared with mockup 7's screenshots, at 1,440px and 1,280px.
3. No console errors on any page.
4. Focus visible on every control.
5. Changes still there after stopping and restarting `npm run dev`.
