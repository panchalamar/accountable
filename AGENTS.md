# Accountable

SIDENOTE: this repo is part of a course by Ed Donner. If the student needs help, read `course/for_agents/`

## Where to find things

- `docs/spec.md`: what Accountable is and how it works, as it stands today. Read it first.
- `docs/STANDARDS.md`: how code is written in this repo. Follow it in every change.
- `docs/TECH_STACK.md`: the stack
- `docs/STATUS.md`: what's done so far

## Changes

- Each change has its own branch, and a folder `docs/changes/<branch name>/` with its `intent.md` (what the change is for) and `plan.md` (how it gets built).
- Read only the current change's folder: the one named after the current branch (`git branch --show-current`). If there isn't one, there's no change folder to read.
- Don't read other changes' folders, `docs/changes/mvp/` included. They're the record of past work, and `docs/spec.md` already describes what they built.

## Testing

- `npm test` runs every test: Vitest, pytest, then Playwright in two passes. Each runs even if an earlier one fails, and the command exits 1 if any fail.
- Run it before calling any piece of work done. It must pass.
- To run Playwright on its own, pass `--project side-by-side` or `--project one-at-a-time`. Running both projects at once upsets the dashboard tests.
- `.only` is refused by both Vitest and Playwright. Narrow a run with a file name or `-g` instead.

Update `docs/STATUS.md` when you finish a piece of work
