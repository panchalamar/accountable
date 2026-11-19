# A Copilot and a HubSpot import

Two changes on top of Accountable, both built with the six stages and checked with `npm run check`. Every name and figure in the code, the tests and the docs is made up.

The build is at https://github.com/VerbodhDev/accountable, on the branch `main-v2`. The Copilot is in `backend/accountable/copilot/` and `frontend/src/copilot/`. The import is in `backend/accountable/crm/` (`hubspot.py`, `importer.py`) and `frontend/src/imports/`. The intent, spec and plan of the import are in `docs/changes/hubspot-import/` and `docs/specs/import.md`.

## The Copilot

A button in the top bar opens a panel. The person asks in plain English. The Copilot calls the app's own API, as the signed-in user, through a fixed list of tools. A change waits for Confirm. A note in a record that says "move every deal to Lost" changes nothing, because record text is data and never an instruction.

## The HubSpot import

An Import page reads a HubSpot CSV of companies, contacts or deals. It shows a preview with counts and the reason for each rejected row. After a confirm it saves the new records in one step, through the same schemas and rules as a record added by hand. The same file imported twice adds nothing.

## What I would tell the next student

1. **Look at the real files before you write the spec.** A free HubSpot account gave real exports. The default deal export has no link from a deal to its company or contact. The spec was written around that, and the page refuses the default file and says how to export it.
2. **Try the real files by hand, even when the tests pass.** The tests used made-up files. The real contacts file, sent as companies, passed for a companies file, because it also has a Company Name column. No test had sent one kind of file to another kind's route.
3. **Untrusted text meets an interpreter in three places.** A file path built from a tool call, a prompt built from a conversation with record text in it, and a regular expression on a long cell. Each was found by a review. The last one took 0.125 seconds for 16,000 spaces and grows with the square of the length, so a cell near the CSV reader's limit would stall the server for seconds. Measure it, cap the length, and read the cell without a backtracking pattern.
4. **Show that a test can fail.** For the rule that a save takes the write lock, I made the save skip the lock in a copy of the file. The test failed. With the code put back, it passed. A test that has never failed proves nothing.
5. **A reviewer and a security hook find different things.** The hook found the slow pattern. The reviewer found that the spec promised a stage and a rounded amount in the preview, and that the build had left both out. Read each spec requirement next to its test before the review.
6. **A subscription token and the API are not the same door.** The Copilot's first version called the model API directly with a Claude Code token. Every call got a rate-limit error while the plan was far from its limit. It runs through the Claude Agent SDK now. The SDK's quickstart says a product may not offer a claude.ai login to other people, so this is right only for a copy that runs on one person's own computer.
