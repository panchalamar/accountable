# Plan: building the Accountable MVP

This plan builds what `docs/spec.md` describes. IDs such as STAGE-2 or DASH-5 point to the spec's requirements, and the Traceability table at the end of Proof maps every one of them to the phase that builds it and the tests that prove it. The work is split into ten phases. Each phase ends with its tests passing, `docs/STATUS.md` updated, and a commit ("Build: phase 3, deal rules and timelines"). A phase doesn't start until the one before it passes `npm test`.

---

## 1. Files that change

### How the code is organized

The aim is a structure that has room for the Business OS and ERP to come, without layers or helpers the MVP doesn't need.

- **Backend, by business area.** The CRM lives in `backend/crm/`. Each resource is one module holding its Pydantic models, its queries and its routes. A module is split only when it gets hard to read, and `deals.py` is the likeliest first. `crm/stages.py` is separate because the create, edit and move routes all share its rules. ERP will go in `backend/erp/` beside it, with its own `tables.py`, sharing `db.py`, `settings.py` and `fields.py`. If ERP ends up sharing organizations and contacts (as customers and suppliers), they move out of `crm/` then. It isn't worth guessing now.
- **Frontend, by feature.** `src/ui/` holds generic pieces that know nothing about deals or contacts. Each folder in `src/features/` holds one area's pages, forms, data hooks and logic. A feature can use `ui/`, `lib/` and another feature's `api.ts`; the pipeline reads deals through `features/deals/api.ts`. A new area is a new folder and a line in `routes.tsx`.
- **No cache map.** After any successful change, the frontend refreshes every cached query. That covers the spec's "invalidates the cached data the change affects" without a central list of which change touches which data. At a few hundred records on a local server the cost isn't noticeable. The pipeline's instant update is the one exception (phase 8).
- **Not added:** repository or service layers, base classes for create, read, update and delete, generic resource factories, a dependency injection framework, or a state library beside TanStack Query.
- **Kept right now because it's costly to change later:**
  - No SQLite-only SQL outside the pragmas in `db.py`, since Supabase's Postgres comes later.
  - One MetaData for every table, which Alembic will need.
  - Every route gets its connection through `get_conn()`, a FastAPI dependency, so a sign-in check can be added the same way later.

### Existing files

| File | Change |
|---|---|
| `docs/STATUS.md` | Updated at the end of every phase. The last phase adds how to install Node.js 24+ and uv, and how to run, seed, clear and test the app |
| `.gitignore` | Already ignores `*.db` (with its `-wal` and `-shm` files), `test-results/` and `playwright-report/`. Checked in phase 1; no change expected |
| `README.md`, `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/mockups/` | Not changed. If the build finds a gap in the spec, it's raised with the user, not patched quietly |

### New files at the root

```
package.json            workspaces ["frontend"]; scripts dev, test, test:unit, test:backend,
                        test:e2e, seed, clear; devDependencies @playwright/test, @axe-core/playwright
package-lock.json
pyproject.toml          Python 3.12; fastapi, uvicorn, sqlalchemy, pydantic; dev group pytest, httpx,
                        time-machine; pytest's pythonpath set to the repo root
uv.lock
.python-version         3.12
playwright.config.ts    Chrome channel, ports 8100 and 5273, a temporary database, one worker
scripts/dev.mjs         Node built-ins only: checks Node and uv, installs, starts both servers, opens the browser
```

`npm test` is `npm run test:unit && npm run test:backend && npm run test:e2e`, so it stops and fails at the first runner that fails.

### Backend

```
backend/__init__.py
backend/main.py               create_app(): mounts the crm router under /api, GET /api/health,
                              422 errors per field, 404s; startup creates the tables and seeds a
                              new database file; POST /api/test/reset {data: "sample" | "empty" |
                              "large"}, mounted only when ACCOUNTABLE_TEST_MODE=1
backend/settings.py           ACCOUNTABLE_DB (default data/accountable.db), ACCOUNTABLE_TEST_MODE
backend/db.py                 engine; PRAGMA foreign_keys=ON and a busy timeout on every SQLite
                              connection; the shared MetaData; get_conn(), the dependency that
                              gives each request its connection and transaction
backend/fields.py             the field types every model shares: trimmed text, blank to null,
                              a name of up to 200 characters, long text of up to 5,000
backend/sample_data.py        load_sample(conn, today) from a fixed seed, load_large(conn, today)
                              for the speed tests, clear_all(conn)
backend/cli.py                seed and clear, each asking for yes, calling sample_data
backend/crm/__init__.py       one router that includes the routers below
backend/crm/tables.py         the six CRM tables and their indexes
backend/crm/organizations.py  its Pydantic models, queries and routes, and /delete-impact
backend/crm/contacts.py       the same for contacts
backend/crm/deals.py          the same for deals, with /move
backend/crm/stages.py         the six stages and their usual probabilities (GET /api/stages), and
                              every stage rule (STAGE-2 to STAGE-7): probability, close date,
                              the stage change entry, position and renumbering, Won makes a customer
backend/crm/activities.py     activities, and both timelines (ACT-3)
backend/crm/dashboard.py      every DASH figure, chart series and list, and GET /api/dashboard
backend/tests/conftest.py     a fresh database file per test, TestClient, small factories
backend/tests/test_*.py       listed under Proof
```

### Frontend

```
frontend/package.json         react, react-dom, react-router, @tanstack/react-query,
                              @tanstack/react-table, recharts, @dnd-kit/core, @dnd-kit/sortable,
                              @dnd-kit/utilities, radix-ui, react-hook-form, date-fns, lucide-react,
                              downshift, react-day-picker, the three Fontsource packages;
                              dev: vite, @vitejs/plugin-react, typescript, vitest
frontend/index.html           links the favicon
frontend/public/favicon.svg   the Sea Green dot ringed in Midnight (also stops a 404 in the console)
frontend/vite.config.ts       127.0.0.1, strictPort, port from ACCOUNTABLE_WEB_PORT (default 5173),
                              /api proxied to ACCOUNTABLE_API_PORT (default 8000), a proxy error
                              answered as 502; Vitest settings (TZ fixed per test file where needed)
frontend/tsconfig.json
frontend/src/main.tsx         fonts, global CSS, the QueryClient (any successful change refreshes
                              every cached query), the router
frontend/src/routes.tsx       the spec's routes inside the Layout
frontend/src/styles/tokens.css    colors, tints, fonts, radii, spacing (starting from docs/mockups/tokens.css)
frontend/src/styles/global.css    reset, focus ring, skip link, sr-only, reduced motion
frontend/src/lib/api.ts       fetch wrapper: network failure and 502/503/504 become "server down",
                              404 becomes "not found", 422 becomes field errors
frontend/src/lib/format.ts    money ($48,000 and $48K), dates (14 Nov 2026; 14 Nov 2026, 15:30), parseMoney
frontend/src/lib/deleteMessages.ts  the DEL wording for every kind of record, with one and none
frontend/src/ui/              Layout, TopBar, Button (with an icon-only option), Badge (a color and
                              a label, plus the solid alert style for Late and Overdue), Dialog,
                              ConfirmDelete, Toasts, Field, MoneyField, DateField, DateTimeField,
                              Combobox, DataTable, table.ts (sorting with empties last, A to Z
                              ignoring case, search over chosen columns, the "26–50 of 132" label),
                              EmptyState, NotFound, ServerDown
frontend/src/features/organizations/  api.ts (types, queries, mutations), OrganizationsPage,
                                      OrganizationPage, OrganizationForm
frontend/src/features/contacts/       api.ts, ContactsPage, ContactPage, ContactForm
frontend/src/features/deals/          api.ts, stages.ts (order, colors, usual probabilities,
                                      isLate, expectedRevenue, the form's stage autofill),
                                      DealsPage, DealPage, DealForm
frontend/src/features/pipeline/       PipelinePage, Lane, DealCard, CardMenu, board.ts (applyMove,
                                      and the board and column totals), keyboard.ts (the
                                      coordinate getter and the spoken announcements)
frontend/src/features/activities/     api.ts, Timeline, ActivityForm, followUps.ts
                                      (followUpBucket, daysOverdue)
frontend/src/features/dashboard/      api.ts, DashboardPage, Headline, RevenueChart, WonLostChart,
                                      Funnel, FollowUps, RecentActivity, ChartDataTable
frontend/src/**/*.test.ts     Vitest, beside the code it tests
```

Every component has its `.module.css` beside it.

### End-to-end tests

```
e2e/global-setup.ts   deletes the previous run's test database
e2e/fixtures.ts       extends Playwright's test: resets the data before each test, fails on
                      console errors and on any request that leaves 127.0.0.1, and gives
                      checkPage() for axe
e2e/api.ts            helpers that set up records through the API
e2e/*.spec.ts         listed under Proof
```

### Not committed

`data/accountable.db`, created by the backend the first time it starts.

### Additions the spec doesn't name

These come from decisions in this plan and are explained under Risks:

- `downshift` for the organization and contact pickers (Radix has no combobox).
- `react-day-picker` for date fields, so dates read like 14 Nov 2026 inside forms too.
- `time-machine` in pytest, to fix the date and time zone in tests, so the backend needs no clock module of its own.
- The test-only reset route, `POST /api/test/reset`.
- Port overrides for `scripts/dev.mjs` (`ACCOUNTABLE_API_PORT`, `ACCOUNTABLE_WEB_PORT`), so its own test can run beside a running app.
- A favicon.

---

## 2. Order of work

### Phase 1: Skeleton, commands and test harness

1. Root `package.json` with `frontend/` as a workspace, `pyproject.toml` with uv, and a Vite + React + TypeScript app showing a placeholder page.
2. Backend: `settings.py`, `db.py` with `get_conn()`, `crm/tables.py` with all six tables and their indexes (the whole schema now, so later phases don't change it), the stage table in `crm/stages.py`, `GET /api/health` and `GET /api/stages`. Startup creates `data/` and the file if they're missing. Seeding is empty until phase 4.
3. `scripts/dev.mjs`:
   - Checks Node is 24 or later and that `uv` runs, and says how to install either if not.
   - Runs `npm install` if `node_modules` is missing.
   - Checks ports 8000 and 5173 are free, and names the one that isn't.
   - Starts `uv run uvicorn backend.main:app --host 127.0.0.1 --port 8000` and polls `/api/health`, with a long first-run timeout and a line saying Python packages are being installed.
   - Starts Vite with `--open`. Sets `BROWSER` to Chrome's name for the platform when Chrome is found (`google chrome` on Mac, `google-chrome` on Linux, `chrome` on Windows), and leaves it unset otherwise so the default browser opens. A `BROWSER` already set, such as `none`, is respected.
   - Ctrl+C stops both. On Windows it uses `taskkill /T` to stop the process trees, and spawns `npm` and `uv` through the shell.
4. Test harness:
   - Vitest config in `vite.config.ts`.
   - `backend/tests/conftest.py` with a fresh database file per test. Tests that need a fixed date use `time-machine`.
   - `playwright.config.ts` with two `webServer` entries: the backend on 8100 with `ACCOUNTABLE_DB` set to a temp file and `ACCOUNTABLE_TEST_MODE=1`, and Vite on 5273 proxying to 8100. `reuseExistingServer: false`, `workers: 1`, `channel: "chrome"`.
   - `e2e/fixtures.ts` with the console-error guard, `checkPage()` and the reset call.
5. One smoke test in each runner.

**Done when** `npm run dev` from a fresh clone opens Chrome on the placeholder, `npm test` passes while `npm run dev` is running, and `data/accountable.db` is untouched by the tests.

### Phase 2: Backend records and deletes

1. The DATA rules. `fields.py` has the shared ones: trimming, blank optional text stored as null, a name of up to 200 characters, notes and descriptions of up to 5,000. Each resource module's Pydantic models add their own: `northwind.com` saved as `https://northwind.com`, the email shape, value a whole number of dollars of 0 or more, probability 0 to 100.
2. CRUD routes in `crm/organizations.py`, `crm/contacts.py`, `crm/deals.py` and `crm/activities.py`, as in the spec's API table. List endpoints include the counts and names the tables need. `GET` one includes the linked records.
3. A new deal starts at New with that stage's probability unless one is given, and goes to the top of its column (position 0, the rest renumbered).
4. Activities: exactly one of `contact_id` and `deal_id`; `done` only with a follow-up date; removing the follow-up date clears `done`.
5. `delete-impact` routes and deletes, relying on the foreign keys' set null and cascade. Positions in the deal's column are renumbered after a delete.

**Done when** the phase 2 pytest files pass.

### Phase 3: Deal rules and timelines

1. `crm/stages.py` has one function that every stage change goes through: `PATCH`, `/move` and create. "Today" is `date.today()`, the computer's local date (STAGE-10).
   - Probability takes the new stage's usual one unless the same save sets it.
   - A `stage_changes` row is written with the time.
   - Won or Lost sets the close date to today unless the same save sets it.
   - A stage change made anywhere but a drop on the board (the edit form, the deal page or the card menu) puts the deal at the top of its new column, position 0, and renumbers both columns. The card menu calls `/move` with index 0.
   - A save at Won with a main contact who isn't a customer makes them one and writes a `contact_events` row naming the deal (STAGE-6). This runs on create, on `PATCH` and on `/move`.
   - Create never writes a stage change (STAGE-7). A `PATCH` to the same stage isn't a change.
2. `/move` with `{stage, index}`. `index` is the card's place in the target column after the move, 0 at the top, clamped to the column's length. Same stage means a reorder only. Both columns are renumbered in one transaction.
3. Both timelines, in `crm/activities.py`:
   - A deal's timeline is its activities and stage changes.
   - A contact's timeline is their own activities, their "Became a customer" entries, and the activities and stage changes of the deals where they're the main contact now, each carrying the deal's id and name.
   - Newest first, with ties broken by insertion order so "Became a customer" sits above the "Moved from Negotiation to Won" that caused it.

**Done when** the phase 3 pytest files pass.

### Phase 4: Dashboard data, sample data and commands

1. `crm/dashboard.py`, one response for the whole page. Definitions this plan pins down where the spec leaves room:
   - "Upcoming" follow-ups are every open follow-up after today. "Next 7 days" is tomorrow to today + 7, and "Later" is after that.
   - Funnel: a deal reached a stage if its current stage or any `to_stage` in its history is that stage or later, in the order New, Qualified, Proposal, Negotiation, Won. A deal once won and later reopened still counts for Won. A lost deal counts up to the furthest open stage it reached, and a deal that went straight to Lost counts for New only. The "carried on" share is hidden when the previous stage's value is $0.
   - Months for the line and bar charts come from the close date of won and lost deals. The 12 months end with the current month.
   - Recent activity is activities and stage changes with a time at or before now.
2. `sample_data.py` builds exactly the counts in the spec's Sample data section, from a fixed seed, dated from today:
   - The two deals won this month have close dates between the 1st and today, so they stay in this month on any day, the 1st included.
   - Every deal has a stage history in date order that ends at its current stage. Every won deal's main contact is a customer with a matching "Became a customer" entry.
   - The same day gives the same data every time.
   - `load_large()` builds the large set (300 organizations, 300 contacts, 300 deals, 2,000 activities) for the speed tests, and `clear_all()` empties every table. The commands and the reset route all use these three functions.
3. Startup seeds a new file (RUN-3). A file that exists but is empty, after `npm run clear`, stays empty.
4. `cli.py`: `seed` and `clear` say what they'll do, ask for `yes`, and do the whole replacement in one transaction. Any other answer prints "Cancelled. Nothing was changed." and exits.
5. The reset route in `main.py` accepts `sample`, `empty` and `large`.

**Done when** the phase 4 pytest files pass and `npm run seed` and `npm run clear` work by hand.

### Phase 5: Frontend foundations

1. `tokens.css` and `global.css` from the spec's Visual design section, the Fontsource fonts, and the favicon.
2. Layout: the top bar with wordmark, five sections (current one as the Midnight pill with `aria-current="page"`) and "New deal"; the skip link; the page header pattern.
3. Routes with stub pages. Each page sets its document title, such as "Deals · Accountable".
4. `lib/api.ts`, and the QueryClient set to refresh every cached query after any successful change. The dashboard query also refetches every time it's opened (DASH-8).
5. The logic and its Vitest tests: `lib/format.ts`, `lib/deleteMessages.ts`, `ui/table.ts`, `features/deals/stages.ts` and `features/activities/followUps.ts`.
6. The `ui/` components: Button, Badge, Dialog, ConfirmDelete (Radix AlertDialog, Cancel focused), Toasts (Radix Toast, announced), Field, MoneyField, DateField, DateTimeField, Combobox, EmptyState, NotFound (UI-7) and ServerDown (UI-6).

**Done when** Vitest passes, and the phase 5 e2e tests show the frame, the routes and the server-down message, with axe passing on each stub page.

### Phase 6: Tables and forms

1. `DataTable` on TanStack Table: the search box, sortable headings as buttons with `aria-sort`, 25 rows a page, the paging line, the empty and no-results states, and Edit and Delete on each row with names that include the record.
2. The Organizations, Contacts and Deals tables, with the columns, search and default sort in TBL-7. Each record's name links to its own page (TBL-4). Late deals show the Late badge next to their close date (STAGE-8).
3. The Contacts status filter, kept in `?status=`. Its counts follow the current search, so each count matches the rows the filter will show.
4. Forms in 520-pixel dialogs, with React Hook Form running the same rules as the backend. Errors show under their fields on save, and focus goes to the first one (UI-5). Backend 422s map onto the same fields. The organization form's industry field suggests the industries already in use, through a native `<datalist>`.
5. Deal form: choosing a stage fills in its probability, and today for Won and Lost (STAGE-3). It shows the expected revenue as you type. The contact picker lists the chosen organization's contacts first, and picking a contact fills an empty organization. Edits send only the fields that changed.
6. Delete from a row, with the counted message from `delete-impact` (DEL-1 to DEL-6).
7. After an add, the table stays put and a toast says "Northwind Traders added" with a link to the record (TBL-6).

**Done when** the phase 6 e2e tests pass.

### Phase 7: Record pages and timelines

1. Organization page: header facts, website opening in a new tab, contacts and deals panels side by side with the open deal count and value, and "New contact" and "New deal" with the organization filled in.
2. Contact page: header facts, mailto and tel links, their deals in the side column, and their timeline.
3. Deal page: header facts with Late badge and expected revenue, the stage control (DEAL-2), the organization and contact in the side column, and its timeline.
4. `Timeline` with its three kinds of entry. On a contact's timeline, deal entries carry a "Deal: Acme renewal" link. Follow-up chips have a Done checkbox, in the alert style when overdue.
5. `ActivityForm` at the top of each timeline, and edit in place with Save and Cancel.
6. Deleting from a record page goes back to its table (DEL-7). A missing record shows NotFound.

**Done when** the phase 7 e2e tests pass.

### Phase 8: Pipeline

Built in this order, so the dependable route works before the hard one:

1. Board and lanes from the deals list, grouped by stage and ordered by position. Lane headings with count, total and expected revenue. Cards as in the spec.
2. The card menu: "Move to" the other five stages, and "Open deal". This is the keyboard route that always works.
3. Mouse dragging with dnd-kit: a sortable list per lane, a droppable on each lane so an empty one takes a drop, `DragOverlay` for the lifted card, and a drop anywhere in a lane. `onDragEnd` calls `/move` with the target stage and index.
4. Keyboard dragging with our own coordinate getter in `keyboard.ts`: Up and Down move within the lane, Left and Right move to the same place in the next lane. Space picks up and drops, Escape puts back. The same file's announcements say each step in words: "Picked up Acme renewal. Proposal, position 2 of 5."
5. The instant update: the move is applied to the cached deals list with `applyMove` from `board.ts` before the request goes, so every figure changes at once. On an error the cache goes back and a toast says the move wasn't saved. On success the server's deals list replaces the cache.
6. "Add deal to Proposal" in each lane opens the deal form at that stage, and the new card lands at the top.
7. The header summary and the bar of open value by stage.
8. Styling: lanes fill the window's height and scroll on their own, the board scrolls sideways below 1440 pixels and the page doesn't, the lane under a dragged card is tinted, and motion is off when reduced motion is on.

**Done when** the phase 8 e2e tests pass, the keyboard ones included.

### Phase 9: Dashboard

1. The headline panel: greeting and date, the four figures, and the revenue line chart with its 12-month total.
2. The won and lost bar chart, labelling every other month when it's narrow.
3. The funnel as rows of HTML and CSS bars, since each row is mostly text and the value has to sit past its bar. The longest bar takes 70% of its track.
4. The follow-ups panel, grouped, with date blocks and "Mark done".
5. Recent activity in two columns of five.
6. Each chart gets a name, a one-line summary and an sr-only table of its figures (A11Y-8). Every panel has its empty state (DASH-9).
7. Layout on the 12-column grid, as in `docs/mockups/d-chosen.html`.

**Done when** the phase 9 e2e tests pass.

### Phase 10: Hardening and sign-off

1. The keyboard-only journeys, the speed tests on the large set, and the startup test that runs `scripts/dev.mjs`.
2. Screenshots of the dashboard and pipeline at 1440 × 900, compared by eye with `docs/mockups/d-chosen-dashboard.png` and `d-chosen-pipeline.png`, and the differences fixed.
3. The check by hand described under Proof, with what was found and fixed recorded in `docs/STATUS.md`.
4. `docs/STATUS.md` says how to install Node.js 24+ and uv on Mac, Linux and Windows, and how to run, seed, clear and test.

**Done when** `npm test` passes, the check by hand is complete, and the browser console showed no errors.

---

## 3. Risks

| # | Risk | What we do about it |
|---|---|---|
| 1 | **Keyboard dragging across six scrolling lanes** (spec concern 14). dnd-kit's default keyboard coordinates pick targets by position on screen, which goes wrong when lanes scroll or are empty. | Build the card menu first. Write our own coordinate getter that works from lane and index, not screen position. Write the keyboard e2e test before styling the board. |
| 2 | **The instant update and the server disagree on order**, so a card jumps after the reply. | `applyMove` in the frontend and `/move` in the backend use the same rule (take out, insert at the clamped index, renumber from 0), and Vitest and pytest share the same cases. The server's answer replaces the cache. |
| 3 | **Chrome's date and time inputs ignore UI-2.** `<input type="date">` shows 11/14/2026 on a US computer, and `<input type="time">` can be 12-hour. | `DateField` is a button showing "14 Nov 2026" that opens `react-day-picker` in a Radix Popover, with Clear for optional dates. The time is a 24-hour `HH:MM` text field with validation. |
| 4 | **Radix has no combobox**, and a searchable picker with "None" is easy to get wrong for screen readers. | Use Downshift's `useCombobox`. The industry field uses a native `<datalist>`. |
| 5 | **Plain dates shift a day.** `new Date("2026-11-14")` is UTC midnight, which shows 13 Nov west of UTC. | Parse plain dates with date-fns `parseISO`, which reads them as local. Vitest runs the date tests in Los Angeles and Auckland time zones. |
| 6 | **Tests that depend on today.** Sample data is dated from today, so "this month" and "last 12 months" change on the 1st and in January. | pytest fixes the date with `time-machine` and includes 1 Jan, the 1st and the last day of a month. E2E tests compare the screen with figures worked out from the API's data, never with numbers written into the test. |
| 7 | **Expected errors fail the console rule.** Chrome logs "Failed to load resource" for every 404, so the not-found and server-down tests would fail on their own errors. | A test can declare the exact messages it expects, and every other console error still fails it. The favicon stops the one 404 every page would otherwise cause. |
| 8 | **The Vite proxy's answer when the backend is down** may not be a clean 502, so UI-6 might not show. | Answer proxy errors with 502 in `vite.config.ts`, and treat network errors and 502/503/504 as "server down". Check it by hand by stopping the backend, since the e2e test can only simulate it with `page.route`. |
| 9 | **"Set by hand" misread.** If the edit form sent every field, an unchanged probability would count as set by hand in a stage change, and the new stage's probability wouldn't apply. | Edits send only changed fields. The form's autofill marks the probability as changed with the new default, so the result is right either way. pytest covers `{stage}` and `{stage, probability}`. |
| 10 | **"Database is locked"** when `npm run seed` or `clear` runs while the app is open (RUN-5). | A 5-second busy timeout on every connection and one transaction for the whole replacement. pytest runs the command with an app connection open. |
| 11 | **`scripts/dev.mjs` across platforms.** Windows needs the shell for `npm` and `uv`, handles Ctrl+C differently, and keeps Chrome in other places. The first `uv run` downloads Python 3.12, which needs the internet once. | Platform branches for spawning, stopping and finding Chrome. Clear messages for missing Node or uv and busy ports. The startup test only runs on the machine doing the build, so Linux and Windows are checked by reading the code. STATUS.md says the first run needs the internet. |
| 12 | **axe findings in Recharts SVGs and Radix portals.** | Fix them where they come from: names on charts, sr-only tables, labelled controls. Any axe rule that ends up switched off is listed in `e2e/fixtures.ts` with the reason. |
| 13 | **Funnel edge cases** the spec doesn't spell out. | Decided in phase 4: a deal that went straight to Lost counts for New only; a deal once won counts for Won even if reopened; "carried on" is hidden when the stage before is $0. pytest pins each one. |
| 14 | **Library versions.** React Router 8, Recharts 3 and the `radix-ui` package may differ from older examples. | Install the current versions and follow their docs and type definitions, not memory. |
| 15 | **Speed with 2,000 activities.** The contact timeline joins several tables, and the dashboard adds up the whole database. | Indexes as in the spec, the dashboard in a handful of queries, and pytest and Playwright speed tests on the large set. |
| 16 | **End-to-end tests run one at a time,** since they share one database. A full run will take a few minutes. | Accepted for now. Running them in parallel, with servers and a database per worker, is an optional step at the Test stage. |

---

## 4. Proof

### Known data for the end-to-end tests

The spec leaves this to the plan.

- Playwright starts the backend on 8100 with `ACCOUNTABLE_DB` set to `accountable-e2e.db` in the system's temp folder and `ACCOUNTABLE_TEST_MODE=1`, and Vite on 5273, proxying to 8100. `e2e/global-setup.ts` deletes the file left by the previous run.
- Before each test, the fixture calls `POST /api/test/reset` with `sample` by default, or `empty` or `large` when the test asks. Tests that need particular records create them through `e2e/api.ts`, with names no sample record uses.
- One worker, and every test stands on its own.
- The reset route only exists in test mode. A pytest test checks it's a 404 otherwise.
- Every test fails on an unexpected console error, and calls `checkPage()` (axe, WCAG 2.1 A and AA) on each page and open dialog it visits.
- Every test also fails if the page sends a request to any host other than 127.0.0.1. That proves fonts and every other asset come from the app itself (RUN-2).

### Unit tests: Vitest (`frontend/src`)

| File | Covers |
|---|---|
| `lib/format.test.ts` | $48,000, $0, $1,234,567; axis labels $48K and $1.2M; 14 Nov 2026; "Sep", not "Sept"; 14 Nov 2026, 15:30 in 24-hour time; plain dates don't shift in Los Angeles or Auckland; `parseMoney` takes `48000`, `48,000` and `$48,000` and rejects `-1`, `12.5` and `abc` |
| `features/deals/stages.test.ts` | Order and usual probabilities match STAGE-1. `isLate`: open and before today is late, today isn't, Won and Lost never are, no date never is. Expected revenue adds up before rounding. Stage autofill for each stage, and for Won and Lost fills today |
| `features/activities/followUps.test.ts` | `followUpBucket` at yesterday, today, today + 7 and today + 8. `daysOverdue` reads "1 day overdue" and "3 days overdue" |
| `features/pipeline/board.test.ts` | `applyMove` to the top, middle and bottom of another column, up and down its own column, into an empty column, with an index past the end; the probability becomes the new stage's; board totals count open deals only; column totals; undo restores the old list exactly |
| `lib/deleteMessages.test.ts` | Each example in DEL-2 to DEL-5 word for word; one and none ("1 contact will be kept without an organization", "Nothing else is linked to it"); contacts and deals together |
| `ui/table.test.ts` | Empty values last when sorting up and down; A to Z ignores case; search ignores case, matches part of a word and looks in the right columns (an organization's name on Contacts and Deals); "1–25 of 132", "26–50 of 132", "126–132 of 132" |
| `lib/api.test.ts` | A network failure and a 502 become "server down", a 404 becomes "not found", and a 422 becomes errors keyed by field |

### Unit tests: pytest (`backend/tests`)

| File | Covers |
|---|---|
| `test_startup.py` | A missing file is created and filled with sample data (RUN-3); an existing file isn't reseeded; a cleared file stays empty; foreign keys are on; data is still there for a new app on the same file (RUN-4, restart); tests never open `data/accountable.db` (RUN-6) |
| `test_meta.py` | `/api/health` answers; `/api/stages` matches STAGE-1 |
| `test_organizations.py` | Add with a name only; trimming; `northwind.com` saved with `https://`; length limits give 422 with a message per field; the list's contact count, open deal count and open value; `GET` one with its contacts and deals; `PATCH` changes only the fields sent; 404 for a missing id |
| `test_contacts.py` | Starts as Lead; the email rule; the organization link; the list includes the organization's name; `GET` one includes their deals |
| `test_deals.py` | Name, stage and value required; value a whole number of 0 or more; probability 0 to 100; starting probability from the stage; a new deal goes to the top of its column; the list includes organization and contact names and positions |
| `test_stage_rules.py` | STAGE-2 on `PATCH` and on `/move`: the new probability unless set in the same save, a stage change with its time, today as the close date for Won and Lost unless set in the same save, and a `PATCH` that changes the stage puts the deal at the top of its new column with both columns renumbered. STAGE-4: a probability set by hand survives other edits. STAGE-5: moving back to an open stage keeps the close date. STAGE-6: a contact becomes a customer when a deal is added at Won, moved to Won, or has its main contact changed while won; an existing customer gets no second entry; moving out of Won doesn't change the contact back. STAGE-7: adding a deal writes no stage change. A `PATCH` to the same stage writes none. STAGE-10: a deal moved to Won late in the evening in a time zone behind UTC gets the computer's local date, not the UTC one (`time-machine` sets the time zone) |
| `test_move.py` | Both columns renumbered from 0; a reorder in the same column writes no stage change; the index is clamped; a failed move leaves everything as it was; an unknown stage gives 422 |
| `test_activities.py` | Logged on a contact or a deal, and 422 for both or neither; defaults; `done` needs a follow-up date; removing the follow-up date clears `done`; edit; delete |
| `test_timelines.py` | Newest first; a deal's timeline has its activities and stage changes; a contact's has their own activities, "Became a customer" and their deals' entries with the deal's name; changing a deal's main contact moves its entries; "Became a customer" still names a deal after it's deleted |
| `test_deletes.py` | Each `delete-impact` count; deleting an organization keeps its contacts and deals without it; deleting a contact keeps their deals without a contact, deletes their activities and events, and leaves their deals' activities alone; deleting a deal removes its activities and stage changes and leaves the contact a customer; deleting an activity removes only that one |
| `test_dashboard.py` | With a fixed date and data built for each test: each DASH-2 figure, including late count and last month's total; the line chart's 12 months, the current one included, and across 1 Jan; the bar chart's won and lost counts; the funnel's reached rule with skipped stages, a deal added mid-pipeline, lost deals, a reopened won deal and a $0 stage; follow-up groups; recent activity is the 10 latest, past only, with stage changes; an empty database gives zeros and empty lists (DASH-9) |
| `test_sample_data.py` | Every count in the spec: 12 organizations; 36 contacts (14, 10, 12) with two without an organization; 40 deals with 21 open (6, 6, 5, 4), 4 late, 13 won with 2 this month, 6 lost; values from $2,000 to $120,000; one open deal without a contact; two probabilities set by hand; every history in date order ending at the current stage; every won deal's contact a customer with an entry; about 120 activities with 12 open follow-ups (3 overdue, 2 today, 7 within three weeks) and some done; `.example` addresses and 555-01xx phones. Checked for several "todays", the 1st of a month and 1 Jan among them, and the same output twice on the same day |
| `test_cli.py` | `seed` with `yes` replaces everything; any other answer changes nothing; `clear` with `yes` empties every table; both work with an app connection open |
| `test_testing_route.py` | The reset route works in test mode and is a 404 otherwise |
| `test_speed.py` | With the large set, each list endpoint, each timeline and the dashboard answer in under 200 ms (the backend's share of PERF-1) |

### End-to-end tests: Playwright (`e2e/`)

The number in brackets is the success criterion in `docs/intent.md`.

| File | Covers |
|---|---|
| `startup.spec.ts` (1) | Runs `node scripts/dev.mjs` on ports 8200 and 5373 with its own database and `BROWSER=none`: the dashboard loads with sample data; an organization is added; the script is stopped with Ctrl+C, both servers stop, it's started again and the organization is still there |
| `frame.spec.ts` (7, 8) | The skip link is the first tab stop; the five sections are in order and the current one is marked; "New deal" in the top bar opens the form; every route has a title |
| `organizations.spec.ts` (2, 3) | Add with a name only and see the toast with its link; the industry field suggests the industries already in use; search, and a search made on page 2 goes back to page 1; sort each column both ways with empties last; 25 rows a page and the paging line; each name opens its page; edit; with empty data, "No organizations yet." with the New button; a search with no results says "No organizations match "zzz"" and Clear search brings the rows back; the organization page shows its industry, notes and website (opening in a new tab) with Edit and Delete, and lists its contacts and deals with the open count and value; "New contact" and "New deal" there start with the organization filled in |
| `contacts.spec.ts` (2, 3) | Add with a name only, starting as Lead; each name opens its page; the status filter's counts and `?status=lead`, together with search and after a refresh; "No contacts yet." and the no-results message; the contact page's organization link, mailto and tel links, and the deals where they're the main contact |
| `deals.spec.ts` (2, 4) | Add with name, stage and value; `48000`, `48,000` and `$48,000` all save as $48,000; error messages under their fields with focus on the first; choosing Won in the form fills 100% and today, and the table shows both after saving; each name opens its page; the Late badge in the table and on the deal page; "No deals yet." and the no-results message; picking a contact fills the organization; the deal page shows every fact in DEAL-1; its stage control changes the stage, probability and close date, adds the move to the timeline, and puts the card at the top of its new column on the pipeline |
| `deletes.spec.ts` (2) | Each kind of confirmation with its numbers; Cancel has focus; Cancel and Escape change nothing; delete from a row and from a record page (back to the table); linked records then show "No organization" and "No contact" |
| `persistence.spec.ts` (2) | Each kind of change, including a card's place in its column, is still there after a reload |
| `pipeline.spec.ts` (4) | Six columns with the right figures; a card shows its name, its organization or "No organization", value, probability and close date, and its name opens the deal page; "Open deal" in the card menu opens it too; drag to the middle of another column changes stage and probability, and the card stays there after a reload; drag within a column; drop on an empty column; the figures change before the server replies (reply held back with `page.route`); a failed save puts the card back and says so; "Move to" from the menu puts the card at the top; "Add deal" in a column; moving to Won sets today's date and makes the contact a customer, shown in their timeline; late cards stand out; lanes scroll on their own; at 1440 pixels all six columns fit, and at 1280 the board scrolls sideways and the page doesn't |
| `pipeline-keyboard.spec.ts` (4, 8) | A focused card is picked up with Space, moved with the arrow keys within and between columns, dropped with Space and put back with Escape; each step is announced; the card menu works from the keyboard |
| `timelines.spec.ts` (5) | Log a note, a call and an email on a contact and on a deal; newest first; a follow-up chip with its Done checkbox; unticking Done on a timeline brings the follow-up back to the dashboard; edit in place; delete asks first; stage changes appear on their own; a contact's timeline shows their deals' entries with the deal's name, and "Became a customer" |
| `dashboard.spec.ts` (6) | The four figures and every chart's table match figures worked out from the API's data; winning a deal updates "Won this month" and the charts when the dashboard is opened again; a new follow-up shows in the right group; "Mark done" removes it; recent activity is newest first; with empty data every figure is $0 or 0 and each panel says there's nothing yet |
| `formats.spec.ts` (7) | No page shows a date as `2026-11-14` or `11/14/2026`; dates with times read like 14 Nov 2026, 15:30; every amount has a $; no label, button or message has an exclamation mark (UI-4) |
| `keyboard.spec.ts` (8) | With the keyboard only: add an organization, a contact and a deal, log an activity, mark a follow-up done, delete with the confirmation and change a stage from a card's menu; the focused element always has a visible outline; dialogs keep focus inside, close with Escape and return focus |
| `a11y.spec.ts` (8) | axe on every route with sample data and with empty data, and with each dialog and menu open; every icon-only button's name includes its record, such as "Edit Northwind Traders" and "Add deal to Proposal" (A11Y-6); sortable headings are buttons, and the sorted one has `aria-sort` ascending, then descending after a second click (A11Y-5); with reduced motion on, dialogs, menus and a dragged card have no transition or animation (A11Y-9) |
| `errors.spec.ts` | With the API unreachable, the UI-6 message; `/deals/99999` and a just-deleted record show the UI-7 message with a link back |
| `commands.spec.ts` (2) | With the app running, `npm run seed` and `npm run clear` against the test database: an answer other than `yes` changes nothing; `yes` replaces or clears, and the browser shows it after a refresh |
| `speed.spec.ts` | With the large set, every page shows its data within one second of opening (PERF-1); search filters as you type and sorting and paging answer at once (PERF-2); dropping a card updates the figures at once (PERF-3) |

### The check by hand (criterion 9)

Passing tests isn't enough to call it done. In phase 10:

1. From a fresh clone, `npm run dev` opens Chrome on the dashboard with sample data.
2. Go through every section and action in `docs/intent.md` as a salesperson would, first with the mouse and then with the keyboard only.
3. Compare each screen with `docs/mockups/d-chosen.html` and its screenshots, by eye.
4. Keep Chrome's console open the whole time. It must stay empty.
5. Stop the backend while the app is open and check the UI-6 message, then start it again.
6. Run `npm run seed` and `npm run clear`, answering something other than `yes` first.
7. Write down what was checked, what was found and what was fixed in `docs/STATUS.md`.

### Traceability

Every requirement ID in `docs/spec.md`, the phase that builds it, and what proves it. Test files are named without their extensions. "By hand" is the check above.

| ID | Phase | Proved by |
|---|---|---|
| RUN-1 | 1, 10 | startup.spec, by hand |
| RUN-2 | 5 | every e2e test (no request leaves 127.0.0.1), by hand |
| RUN-3 | 1, 4 | test_startup |
| RUN-4 | 2 | test_startup, persistence.spec, startup.spec |
| RUN-5 | 4 | test_cli, commands.spec |
| RUN-6 | 1 | test_startup |
| DATA (field rules) | 2, 6 | test_organizations, test_contacts, test_deals, test_activities, organizations.spec, deals.spec |
| STAGE-1 | 1, 5 | test_meta, stages.test |
| STAGE-2 | 3, 6, 7, 8 | test_stage_rules, test_move, deals.spec, pipeline.spec |
| STAGE-3 | 5, 6 | stages.test, deals.spec |
| STAGE-4 | 3 | test_stage_rules |
| STAGE-5 | 3 | test_stage_rules |
| STAGE-6 | 3 | test_stage_rules, pipeline.spec, timelines.spec |
| STAGE-7 | 3 | test_stage_rules |
| STAGE-8 | 5, 6, 7, 8 | stages.test, deals.spec, pipeline.spec |
| STAGE-9 | 4, 5, 8 | stages.test, board.test, test_dashboard |
| STAGE-10 | 3, 4 | test_stage_rules |
| TBL-1 | 6 | organizations.spec, contacts.spec, deals.spec |
| TBL-2 | 5, 6 | table.test, organizations.spec, speed.spec |
| TBL-3 | 5, 6 | table.test, organizations.spec |
| TBL-4 | 6 | organizations.spec, contacts.spec, deals.spec |
| TBL-5 | 6 | organizations.spec, contacts.spec, deals.spec |
| TBL-6 | 6 | organizations.spec |
| TBL-7 | 6 | table.test, organizations.spec, deletes.spec |
| ORG-1 | 7 | organizations.spec |
| ORG-2 | 7 | test_organizations, organizations.spec |
| ORG-3 | 7 | organizations.spec |
| CON-1 | 6 | contacts.spec |
| CON-2 | 7 | contacts.spec |
| CON-3 | 7 | test_contacts, contacts.spec, timelines.spec |
| DEAL-1 | 7 | deals.spec |
| DEAL-2 | 7 | test_stage_rules, deals.spec |
| DEAL-3 | 7 | timelines.spec |
| PIPE-1 | 8 | pipeline.spec |
| PIPE-2 | 8 | pipeline.spec |
| PIPE-3 | 8 | pipeline.spec |
| PIPE-4 | 8 | pipeline.spec, persistence.spec |
| PIPE-5 | 8 | pipeline.spec, board.test |
| PIPE-6 | 8 | pipeline.spec, pipeline-keyboard.spec |
| PIPE-7 | 8 | pipeline.spec |
| ACT-1 | 7 | timelines.spec |
| ACT-2 | 7 | timelines.spec |
| ACT-3 | 3, 7 | test_timelines, timelines.spec |
| ACT-4 | 7 | timelines.spec |
| ACT-5 | 2, 4, 5, 7, 9 | test_activities, test_dashboard, followUps.test, dashboard.spec, timelines.spec |
| DEL-1 | 5, 6, 7 | deletes.spec |
| DEL-2 | 2, 6 | test_deletes, deleteMessages.test, deletes.spec |
| DEL-3 | 2, 6 | test_deletes, deleteMessages.test, deletes.spec |
| DEL-4 | 2, 6 | test_deletes, deleteMessages.test, deletes.spec |
| DEL-5 | 2, 7 | test_activities, deleteMessages.test, timelines.spec |
| DEL-6 | 5 | deleteMessages.test |
| DEL-7 | 7 | deletes.spec |
| DASH-1 | 5, 9 | startup.spec, frame.spec |
| DASH-2 | 4, 9 | test_dashboard, dashboard.spec |
| DASH-3 | 4, 9 | test_dashboard, dashboard.spec |
| DASH-4 | 4, 9 | test_dashboard, dashboard.spec |
| DASH-5 | 4, 9 | test_dashboard, dashboard.spec |
| DASH-6 | 4, 9 | test_dashboard, followUps.test, dashboard.spec |
| DASH-7 | 4, 9 | test_dashboard, dashboard.spec |
| DASH-8 | 5, 9 | dashboard.spec |
| DASH-9 | 4, 9 | test_dashboard, dashboard.spec |
| UI-1 | 5, 10 | by hand, comparing screenshots with the mockup |
| UI-2 | 5 | format.test, formats.spec |
| UI-3 | 5 | format.test, formats.spec |
| UI-4 | 5 to 9 | formats.spec (no exclamation marks), by hand (plain wording) |
| UI-5 | 6 | deals.spec |
| UI-6 | 5 | api.test, errors.spec, by hand |
| UI-7 | 5, 7 | errors.spec |
| A11Y-1 | 5 | frame.spec, keyboard.spec |
| A11Y-2 | 5 | keyboard.spec |
| A11Y-3 | 5 | a11y.spec |
| A11Y-4 | 5 | keyboard.spec |
| A11Y-5 | 6 | a11y.spec |
| A11Y-6 | 6 | a11y.spec |
| A11Y-7 | 8 | pipeline-keyboard.spec |
| A11Y-8 | 9 | dashboard.spec, a11y.spec |
| A11Y-9 | 5, 8 | a11y.spec |
| PERF-1 | 4, 10 | test_speed, speed.spec |
| PERF-2 | 6, 10 | speed.spec |
| PERF-3 | 8, 10 | speed.spec, board.test |
| Sample data (spec Part 2) | 4 | test_sample_data, test_startup |

`test_testing_route` proves the plan's own test-only reset route, which has no spec ID.

To check that no ID is missing after either document changes, run this from the repo root. It prints nothing when every ID in the spec has a row here:

```
grep -oE '\*\*[A-Z0-9]+-[0-9]+\*\*' docs/spec.md | tr -d '*' | sort -u | while read id; do grep -qF "| $id |" docs/plan.md || echo "Not traced: $id"; done
```
