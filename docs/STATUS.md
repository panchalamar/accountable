# Status

## How to run Accountable

You need **Node 24 or later**, **uv** and, for the end-to-end tests, **Google Chrome**. The first run needs the internet once, to install packages and Python; after that Accountable works offline.

| Command | Does |
|---|---|
| `npm run dev` | Installs anything missing, starts the backend (port 8000) and the frontend (port 5173), and opens the dashboard in your browser. Ctrl+C stops both. |
| `npm test` | Runs every test: Vitest, pytest, then Playwright in two passes. Never touches your data. |
| `npm run seed` | Resets the data to the sample data. It asks first and saves a copy of your current data. `npm run seed -- --yes` skips the question. If the app is open, refresh the browser afterwards. |

- **Your data** lives in `data/accountable.db`, made with the sample data the first time the app starts. Every change is saved at once. Backups from `npm run seed` go in `data/backups/`. The `data/` folder is never committed.
- **Ports**: `BACKEND_PORT` and `FRONTEND_PORT` change them, and `ACCOUNTABLE_DB` chooses another database file.
- **The tests' own data**: pytest uses temporary files; the end-to-end tests use `data/test/e2e.db` on ports 8011 and 5183, so they can run beside `npm run dev`.
- **Windows and Linux** haven't been tried by hand yet. The commands are Node scripts and `uv run`, with paths built by Node, so they're written to work there; only macOS has been tested.

## How it got here

- Day 2 setup done: AGENTS.md, Playwright MCP server, brand skill, project settings.
- Intent refined after two interviews: delete and move rules, stage probabilities, close date on Won/Lost, activity links, required fields, follow-ups on the dashboard, closed cards on the board, reset safety, sample data for large B2B deals, keyboard accessibility.
- Spec written on the `mvp` branch: `docs/spec.md`, with requirements, design and concerns at the top. Decided: darker Cerulean and Raspberry behind small text only, and stage colors by meaning (Won Sea Green, Negotiation Midnight, Raspberry kept for Late and errors).
- Three mockups in `docs/mockups/`, each an HTML file with a Dashboard and a Pipeline screen (switch with the sidebar) and a screenshot of each screen beside it: `1-midnight-rail`, `2-open-desk`, `3-big-tickets`. All three use the same sample figures, which add up.
- Three more mockups with different layouts, since 1 to 3 looked alike: `4-forecast` (top bar, revenue won and deals due to close on one time line, follow-ups as a week planner), `5-deal-mosaic` (headline figures in the sidebar, every open deal as a block sized by value, follow-ups as a table) and `6-stage-flow` (narrow icon rail, a flow chart of where the money went from New to Won, follow-ups and activity in a dark column on the right, arrow-shaped column headers on the board). Where they depart from the spec: 4 has no sidebar; 5 moves the headline figures and board totals into the sidebar and tints cards by stage; 6 writes the figures as a sentence, merges pipeline by stage and the funnel into one chart, and stacks follow-ups and activity. The chosen one's departures go into the spec under "Chosen design".
- Mockup `7-forecast-board` combines the picks. Dashboard: the forecast chart of 4, the funnel of 3 (with a table of full amounts beside it), and 6's dark column on the right for follow-ups and recent activity. Pipeline: the page header and arrow-shaped column headers of 6, and the cards of 5 (tinted by stage, short value, Stage button). Top bar on both screens, so all six board columns fit from 1,280px up. Won and Lost headers say "Closed in the last 30 days" instead of expected revenue.
- Mockup 7 recorded in the spec under "Chosen design", with Screens, color tokens and the affected requirements updated to match (top bar, card details, Won and Lost totals, the chart past today).
- `docs/plan.md` written: files that change, seven phases (skeleton and shell, backend rules, sample data and dashboard figures, tables and forms, pipeline, dashboard, finish and check by eye), risks, and the unit and end-to-end test cases. No code yet.
- Folder structure reviewed against the intent's growth into a Business OS. Spec and plan now group code by business area (`backend/crm/`, `frontend/src/crm/`, `e2e/crm/`), with shared code at the top level that never imports from an area. Also decided: Alembic migrations from the start, SQLAlchemy `Date` and `DateTime` columns so the later move to Postgres is a change of URL, and `shared/crm-rule-cases.json` so the backend and frontend are tested against the same cases.
- The mockups' sample records saved to `backend/crm/sample_data.json`, with dates as offsets from today: 12 organizations, 15 contacts, all 40 deals, 9 follow-ups and 10 recent activity items. Checked on nine dates through the year to give the mockups' figures and keep the spec's promises (wins this month, 16 wins across 10 months, recent closes, 3 late). Phase 3 adds what its `stillToAdd` list names.
- The plan was then built in its seven phases, below.

## Build

### Phase 1: skeleton, commands and shell (done)

- Root `package.json` (npm workspaces with `frontend`), `pyproject.toml` with `uv.lock`, `.python-version` (3.12), `alembic.ini`, and `data/` in `.gitignore`.
- `scripts/`: `ensure-deps.mjs` (Node 24+, uv, `npm install` when `node_modules` doesn't match `package-lock.json`, `uv sync`), `dev.mjs`, `test.mjs` (Vitest with `TZ=America/Los_Angeles`, then pytest, then Playwright, with a summary), `e2e-backend.mjs`.
- Backend: `settings.py`, `clock.py`, `db.py` (foreign keys on, `BEGIN IMMEDIATE` so parallel writes wait instead of failing, migrations on start), `errors.py`, `main.py` with `create_app()` and `/api/health`, `crm/tables.py`, and the first migration `0001_crm_tables.py`, checked by hand. The unique index on organizations' lower-case names is added by hand, since SQLite can't reflect expression indexes.
- Frontend: Vite, React, Tailwind v4 with every token from the spec in `styles/tokens.css`, bundled fonts, and the shell from mockup 7: top bar with the five sections and today's date, skip link, placeholder pages, "Page not found" and the server banner (shown after three failed health checks).
- Tests: pytest (`test_app.py`, `test_migrations.py`, `test_layout.py`), Vitest (`TopBar`, `ServerBanner`, `layout`), Playwright (`shell.spec.ts`). `npm test` passes.
- Versions differ from what the spec was written against in a few places: React Router 8, TanStack Table 9, Vite 8, Vitest 5, TypeScript 7, lucide-react 1. Starlette now wants `httpx2` for its test client, so the dev group has `httpx2` in place of `httpx`.

### Phase 2: backend records and rules (done)

- `crm/schemas.py`, `crm/rules.py`, `crm/queries.py` and the routes in `crm/routes/` for organizations, contacts, deals and activities: list, read, add, edit, delete, delete checks, the deal move with placement, timelines and `PATCH /activities/{id}`.
- One stage-change function (`_change_stage`) for the move and the deal edit. The stage menu will send the target column's top card as `before_id`.
- Expected revenue is `(value x probability + 50) // 100`, so halves round up with no floating-point error. Totals add the rounded amounts.
- `shared/crm-rule-cases.json` with the cases for expected revenue, totals, late and stage probabilities.
- Calls made where the spec was silent: values are capped below $1,000,000,000,000 ("Enter a value under $1,000,000,000,000.") so they stay exact in the browser; an activity with no link gets "Link the activity to a contact or a deal."; a `before_id` from another column gets a 409 asking to refresh.
- pytest: 133 tests pass, covering validation, records, stage changes, placement, activities, deletes, timelines, the shared cases, API errors and persistence.

### Phase 3: sample data, reset and dashboard figures (done)

- `crm/sample_data.json` now has everything its `stillToAdd` list asked for: 21 more contacts (36 in all, 12 of each status), each organization's industry (9 industries), website and notes, a start date and stage history for every deal, 120 more activities (145 in all), and 10 more follow-ups (4 due later, 6 done). The mockups' records are unchanged.
- `crm/sample_data.py` turns the offsets into dates. Anything dated later today than now moves to just before now, in order, so recent activity never shows the future.
- `main.py` fills a new database with the sample data on first start. A new database is one Alembic has never touched.
- `seed.py` (`npm run seed`): asks, backs up with SQLite's backup API to `backups/accountable-YYYYMMDD-HHMMSS.db` beside the database, then empties the file in place and rebuilds it with the migrations and the sample data. Emptying in place (rather than deleting the file) means a running app sees the new data after a browser refresh, and a database migrated on another branch resets cleanly.
- `crm/dashboard.py` and `GET /api/dashboard`: the four figures, 12 months of wins, the forecast slots (Late, Rest of the month, months up to 9 ahead, Later, or "none open"), open pipeline by stage, the funnel, follow-ups and the 10 most recent items. With today at Nov 16, 2026, every figure equals mockup 7's, and so do the follow-ups and recent activity.
- Tests: pytest 203 (dashboard, forecast, sample data on five dates through the year, seed), and `seed.spec.ts`, which runs the real `npm run seed` on a copy of the test database.

### Phase 4: tables, forms and record pages (done)

- Shared: `lib/` (money, dates, table search and sort, website links), `api/client.ts`, `DataTable` on TanStack Table 9 (sorting with `aria-sort`, search over the shown text, "12 of 36 contacts", "No contacts match 'acme'"), `SearchBox`, `FormDialog` and `ConfirmDialog` on Radix, labeled fields with their errors tied by `aria-describedby`, and `Chip`.
- CRM: `crm/lib` (stages, deal rules, follow-up wording), `crm/api.ts` (types, query hooks, one refresh after every save), the stage, status and Late chips, the status filter, `DeleteDialog` (reads the delete check, then opens; offers only Close when refused), the four forms with Zod and the server's wording, the timeline with "Log activity", Edit, Delete and the Done checkbox, and the six pages.
- Fixed along the way: Radix only returns focus to its own trigger, so dialogs remember what opened them; forms mount once their lists have loaded, so an edit form never shows a blank organization; the Done checkbox stays focusable while it saves; Vite prepares every dependency at start, so a fresh run doesn't fail with "Outdated Optimize Dep".
- Tests: Vitest 62 (lib, crm/lib, the shared cases, form messages, `DealForm`, `DataTable`, `DeleteDialog`), Playwright 47 (organizations, contacts, deals, activities, and these pages' keyboard and axe checks). `npm test` passes.

### Phase 5: pipeline (done)

- The board from mockup 7: the totals sentence, six equal columns with arrow-shaped headers (expected revenue on open stages, "Closed in the last 30 days" on Won and Lost), an outlined Add deal per column that starts the form at that stage, and cards tinted by stage with the short value, the Late chip or "in 3 months", and a Stage button.
- Dragging with dnd-kit's sortable pattern for several containers: a lifted copy follows the pointer and a gap opens where it will land, with announcements that name the deal and column. Only the pointer drags; the card isn't a focusable handle, since its own link and Stage button are the keyboard's way in.
- `StageMenu` (Radix DropdownMenu) on each card and on the deal page: it moves the card to the top of the chosen column, keeps focus on the moved card and says "Moved Atlas Freight renewal to Negotiation" in a live region.
- `useDealMover`: the cache changes first (`crm/lib/board.ts`, a pure function), so cards and every total move at once. A refusal puts the cache back and says why, and a move into Won or Lost says "Moved to Won. Close date set to today." `ReopenDialog` asks for a new close date, 30 days ahead by default; Cancel puts the card back.
- Tests: Vitest 72 (board totals, moves on the cache, the stage menu), and `crm/pipeline.spec.ts` plus the pipeline's keyboard and axe checks. Drags land on sample cards no test moves. `npm test` passes.

### Phase 6: dashboard (done)

- The layout from mockup 7: the main column, and the dark Midnight column (`clamp(340px, 27.8vw, 400px)`, so 400px at 1,440 and 356px at 1,280) from under the top bar to the bottom of the page.
- "Revenue won, and what's due to close" (Recharts `ComposedChart`, one money axis keyed by each slot's own key, so the two Decembers never collide): the revenue line over a light Sea Green fill, the Today marker on the edge of the first slot ahead (`ReferenceLine position="start"`), stacked bars by stage with a 2px gap and a rounded top, the future part on `--forecast-bg`, and labels only on the best and latest months, the Late bar and the biggest month ahead. Tooltips give a month's figures, or list a slot's deals.
- The figures above and the strip below share the chart's pixel margins in a CSS `calc()`, so their split lines up with Today without measuring. Deals won by month (Recharts `BarChart`) sits under the past part and the stage table under the future part.
- Sales funnel: Recharts `Funnel` with a custom band shape (3px gaps), beside a table whose 53px rows line up with the bands.
- The dark column: follow-ups (Overdue, then Next 7 days, each with a count) whose checkboxes save at once, take the item off and move focus to the next one, and recent activity with "Moved from" and stage chips.
- Each chart has a title, a one-line summary and a screen reader table; the SVGs are hidden from screen readers and aren't tab stops (`accessibilityLayer={false}`).
- Fixed: Tailwind's `transition-colors` also fades `outline-color`, so focus rings faded in from the text color. One unlayered rule keeps outline color out of transitions.
- Tests: Vitest 75 (`FollowUps`), `crm/dashboard.spec.ts`, and the dashboard's keyboard and axe checks. The end-to-end tests now run as two Playwright projects: "side-by-side" (most files, 4 workers) and "one-at-a-time" (dashboard and pipeline, 1 worker, on their own fresh servers and data, since they check exact changes to shared figures). `npm test` runs one after the other and passes.

### Phase 7: finish and check by eye (done)

- `npm test` passes in full: Vitest 75, pytest 203, Playwright 52 side by side and 20 one at a time, with the keyboard and axe checks on every page.
- Checked by eye with the Playwright MCP server at 1,440 and 1,280px: every section, the forms with their messages, the delete and reopen dialogs, the stage menu, dragging, and the dashboard and pipeline beside mockup 7's screenshots. They looked close, but that check missed the funnel's last band, two icons and a few pixels in the chart; see "Compared with mockup 7" below. Fixed on the way: deal rows on an organization's page didn't line up. No console errors from the app on any page.
- A reset while the app is running: `npm run seed -- --yes` with the servers up, and the running backend served the fresh sample data at once, with no errors.
- From a fresh copy (no `node_modules`, `.venv` or `data`): `npm run dev` installed the packages and Python, made `data/accountable.db` with the sample data, and served the dashboard and pipeline with a clean console. A change made through the app was still there after stopping and starting it again, and the second start installed nothing.
- Known gaps:
  - The sample data has 145 activities, against the spec's "about 120". Left as it is: every one is tied to a real deal or contact, and the dashboard's figures and recent activity are unaffected.
  - Windows and Linux haven't been tried by hand.
  - `npx playwright test` on its own runs both end-to-end projects at once, which can upset the dashboard tests' exact checks. Use `npm test`, or pass `--project side-by-side` or `--project one-at-a-time`. Each pass keeps its results in `test-results/<project>` and its report in `playwright-report/<project>`.
  - `npm audit` reports a ReDoS advisory in `picomatch`, which only the dev tools (Vite, Vitest) use. The fix it offers is a downgrade to an older Vitest, so it's left for now.

### `npm test` checked

- `npm test` runs all four test runs and exits 1 if any fail. Checked by planting a failing test in Vitest, pytest and the end-to-end tests: the summary said FAILED for each, the other runs still ran, and the exit code was 1. The two Playwright projects together hold all 72 end-to-end tests (52 + 20), so none fall between them.
- `.only` is now refused everywhere, not just on CI (`allowOnly: false` in `frontend/vite.config.ts`, `forbidOnly: true` in `e2e/playwright.config.ts`), since a stray one would quietly run a few tests and pass.
- AGENTS.md has a Testing section: `npm test` must pass before work is called done.

### Compared with mockup 7

- Compared with a script rather than by eye: the app on a scratch database with the date fixed at Nov 16, 2026 (the mockup's), screenshots of the dashboard and pipeline at 1,440 and 1,280px beside the mockup's HTML at the same sizes, and a pixel diff of each pair. The mockup has only these two screens, so Organizations, Contacts and Deals had nothing to compare against.
- Fixed:
  - The funnel's last band (Won) was a rectangle. The shape meant to narrow it to 78%, as in the mockup, but Recharts 3 doesn't pass a custom shape its index, so it never knew which band was last. It goes by the band's stage now, with a test.
  - The chart's plot stopped 6px short of the panel's edge instead of the mockup's 10px, so Today and everything right of it sat 2px right at 1,440. At 1,280 that left the "Open pipeline by stage" table 6px past the panel's content edge. The plot now matches the mockup to the pixel at 1,440, and the strip under the chart keeps the room its table needs, moving its split a few pixels left of Today if it has to.
  - Organizations used lucide's `Building`; the mockup draws `Building2`, with wings. Notes used `StickyNote`; the mockup draws `FileText`, a page with lines. That also changes the note icon on the deal and contact timelines.
  - Recent activity's stage chips were 18px, the size for board cards; the mockup's are 20px with 11.5px text. `Chip` has a `mid` size for them. The rows below each stage change no longer drift down a pixel or two.
  - The pipeline page was 24px taller than the mockup: each column's 24px drop space under the last card sat on top of the page's 48px bottom padding. The page now pads 24px, 48px in all.
- After: every page height matches the mockup at both widths. Pixels that differ: pipeline 2.3% to 0.1%, dashboard at 1,440 3.6% to 1.6%, almost all of it text a pixel or two apart.
- Left as they are:
  - The y-axis labels sit 2px further left, and the funnel is 4px wider and 2px lower.
  - At 1,280 the mockup's forecast chart is a picture that shrinks with the page, so it's about 40px shorter than the app's, which stays 330px tall with full-size text. The app's dashboard is laid out the same, just lower below the chart.
  - Lucide's current `Building2` has a door that the mockup's older drawing doesn't.

### Review against `main`

The branch was reviewed against `docs/REVIEW.md`: bugs, security, and a match with `spec.md` and `plan.md`. `npm test` passed (Vitest 77, pytest 203, Playwright 52 + 20), but the review found these. Each was checked in a real browser or with `curl`, on a scratch database.

Important (must be fixed before merging):

1. **The board stopped following the data after a drag and Reopen.** Dragging a Won or Lost card into an open column and choosing Reopen left the board on the layout it had while dragging, since only Cancel cleared it. A later move by the stage menu was saved but its card stayed put, and the column header and cards disagreed (6 deals, 5 cards). A refused reopen after a drag didn't put the card back, and new deals didn't appear until a reload. The tests covered only drag and Cancel.
2. **Focus was lost after a stage change by keyboard.** After reopening from a card's Stage menu, and after any stage change from the menu on a deal's own page, focus fell to the page itself. The spec says focus stays on the moved card, and dialogs return focus to what opened them.
3. **The backend answered requests for any host name.** A web page could point its own domain at this computer (DNS rebinding) and read or change the CRM's data while the app is running. Vite already refused such requests; the backend didn't.

Not blocking:

4. `npm run seed` with no input (stdin closed) stopped with an `EOFError` traceback instead of "Nothing changed." No data was touched.
5. The Deals table worked out "Late" once, when the page first showed, so a page left open past midnight kept yesterday's Late chips.
6. Endpoints beyond the spec's API table: `GET /activities/{id}`, and FastAPI's docs pages (`/api/docs`, `/redoc`, `/api/openapi.json`), which also need the internet.
7. The build landed as one commit, "Build: the MVP", not one per phase as the plan asks.
8. This file gave Vitest's count as 75; it is 77.

Fixes:

1. Fixed. The reopen dialog now tells the board when it closes, by Reopen or Cancel (`useDealMover`'s `onDialogClose`), and the board drops its dragging layout either way, so it shows the cache: moved, or put back after a refusal. New end-to-end tests: drag and Reopen, then a stage-menu move that must show at once with the header matching the cards; and drag and Reopen refused, with the card back in Lost.
2. Fixed. `FormDialog` takes an `onCloseAutoFocus`, and the mover uses it to put focus back after the reopen dialog (`refocus`): on the card's Stage button on the board, after Reopen or Cancel, and on the stage button on a deal's page, which also gets focus back after every move from its menu. New end-to-end tests check focus by keyboard on the board and on a deal's page.
3. Fixed. The backend answers only requests addressed to `localhost` or `127.0.0.1` (Starlette's `TrustedHostMiddleware` in `main.py`). pytest's clients now use `http://localhost`, and new tests check other host names get 400 with no data. The spec's Security section says so.
4. Fixed. No answer (input closed, or Ctrl+C) counts as no: "Nothing changed.", exit code 0. New pytest cases.
5. Fixed. The Deals table's columns are worked out again when the day changes. A new Vitest test moves the clock past midnight.
6. Fixed. `GET /activities/{id}` is a plain read the tests rely on, so it's now in the spec's API table. The docs pages are switched off, with a test.
7. Left as it is. Splitting the commit into phases would mean rewriting history, for no change to the software.
8. Fixed by the counts below.

Found while testing the fixes:

9. **A drag across columns could land in the wrong column, or crash the page.** Fixed. The board picked the column under the dragged card's corners (`closestCorners`). Moving the card into a column changes the columns' heights, so the closest corners could flip to another column: once, and the card landed in Proposal while the pointer was on a Negotiation card; or back and forth, until React stopped with "Maximum update depth exceeded" and the page fell over mid-drag. It was there before this review, in the original drag tests too, and showed up when columns had grown to very different heights. The traces showed the flip (`negotiation -> proposal` on the last mouse move). Now the column under the pointer decides, as in dnd-kit's own example for several containers. Between columns or over a header, the card stays where it last was. `onDragEnd` also copes with a drop before the last move was drawn. Before the fix, repeating the end-to-end drag tests gave 1 crash in 40 runs, and 2 wrong columns in 144. After it, 0 in 144 (the dashboard and pipeline files, six times over) and 0 in 120 (the drag tests, 24 times over).

`npm test` passes: Vitest 78, pytest 214, Playwright 52 side by side and 24 one at a time. The new tests fail on the old code: the four new pipeline tests and the Deals table's midnight test were each run against it first.

## Bugs

- Editing an organization: the Industry dropdown shows only the current industry, since the browser filters the datalist by what is already in the box. It should list every industry in use (spec: "suggests industries already in use"). Confirmed in Chrome: the arrow also shows only the current industry; clearing the box shows all 9.
