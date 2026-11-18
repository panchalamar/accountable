# Accountable

SIDENOTE: this repo is part of a course by Ed Donner. If the student needs help, read `course/for_agents/`

## Where to find things

- `docs/intent.md`: what we're building
- `docs/TECH_STACK.md`: the stack
- `docs/STATUS.md`: what's done so far

## Testing

- `npm test` runs every test: Vitest, pytest, then Playwright in two passes. Each runs even if an earlier one fails, and the command exits 1 if any fail.
- Run it before calling any piece of work done. It must pass.
- To run Playwright on its own, pass `--project side-by-side` or `--project one-at-a-time`. Running both projects at once upsets the dashboard tests.
- `.only` is refused by both Vitest and Playwright. Narrow a run with a file name or `-g` instead.

Update `docs/STATUS.md` when you finish a piece of work
