# Week 1 Day 3 instructions

All the prompts to take Accountable's MVP through the six stages, then share your documents in a pull request.

## Fork the repo

You share today's documents in a pull request at the end of the day, and that needs your own fork:

1. Open https://github.com/ed-donner/accountable and click **Fork**, then **Create fork**.
2. Add your fork as a second remote, with your GitHub username in place of `<username>`:

```
git remote add fork https://github.com/<username>/accountable.git
```

Your coding agent can explain each step.

## Start the branch

From your own `main`, with yesterday's setup committed:

```
git checkout main
git checkout -b mvp
```

Or to start from my Day 2 setup. This keeps your own work on a branch called `my-day2` and moves your `main` onto my branch:

```
git branch my-day2
git checkout --no-track -B main origin/week1day2-end
git checkout -b mvp
```

## Stage 1: Plan

```
Read docs/intent.md and interview me about anything unclear or missing: scope, users, constraints and what success looks like. Then update intent.md with my answers.
```

Answer its questions. Claude Code asks multiple-choice questions, and you can type your own answer.

Read the changes in VS Code's Source Control view and fix anything the agent got wrong.

```
git add .
git commit -m "Plan: intent.md agreed"
```

## Stage 2: Design

### The spec

```
Read docs/intent.md and write docs/spec.md with the requirements and the design for the MVP. Use the brand skill. List any concerns at the top.
```

Answer each concern and ask your agent to update `docs/spec.md`. Then check the spec against the problem and the open questions in `docs/intent.md`.

```
git add .
git commit -m "Design: spec.md"
```

### Choose the look

```
Make three different mockups of the MVP's dashboard and pipeline as HTML files in docs/mockups/, following spec.md and the brand skill. Take a screenshot of each with Playwright and save it beside the HTML.
```

Open the screenshots in VS Code and choose the one you like best. Then ask your agent to record your choice and your reasons in `docs/spec.md`.

```
git add .
git commit -m "Design: chosen mockup"
```

## Stage 3: Build

### Write the plan

```
Read docs/intent.md and docs/spec.md and write docs/plan.md with four sections: Files that change, Order of work, Risks and Proof. Order the work in phases. Proof lists the unit and end-to-end tests. Don't write any code yet.
```

Then question the plan. For example: What could this break? Which step is riskiest? What did you decide against? Keep revising it until another engineer could build from `docs/plan.md` alone.

```
git add .
git commit -m "Build: plan.md"
```

### Build the MVP

Check you're on the branch: `git branch` shows `* mvp`. Then start a fresh session with a clean context (`/clear` in Claude Code), and:

```
Implement docs/plan.md, following its order of work. Write the tests in its Proof section and run them as you go. Leave the commits to me.
```

This is the longest step of the day. If a usage limit stops the build, wait for the limit to reset and carry on in the same session.

```
git add .
git commit -m "Build: the MVP"
```

## Stage 4: Test

### One command runs all the tests

```
Make sure npm test runs all the unit and end-to-end tests and fails if any fail. Add it to AGENTS.md, run it, fix failures until it passes, and show me the output.
```

### Check the look

```
Start the app, use Playwright to compare it with the chosen mockup, and fix what differs. Show me the screenshots.
```

### Check it yourself

Run `npm test` yourself. Then start the app the way `docs/STATUS.md` says, open it in your browser and check the success criteria in `docs/intent.md`.

```
git add .
git commit -m "Test: check command"
```

## Stage 5: Deploy

### Write the review policy

A review policy is your judgment about what matters in this project, so you write this file yourself. Add a new file, `docs/REVIEW.md`, with the contents below. Change anything you'd judge differently.

```markdown
# Review policy

Every change is reviewed against this policy before it merges. The reviewer reports its findings and doesn't change any code.

## Passes

Make a separate pass over every change for each of these:

- **Bugs:** the code does what it's meant to, including when something goes wrong.
- **Security:** no secrets or personal data are exposed, and nobody can do what they shouldn't.
- **Matches spec.md and plan.md:** the change does what those documents say, with nothing missing and nothing extra.

## Important

An Important finding must be fixed before the change merges. A finding is Important if the change breaks behavior that should work, leaks data or breaks a rule in AGENTS.md.

## Nits

A nit is a small point, such as style or naming, that doesn't block the merge. Report at most five per review.
```

### Review the branch

Start a fresh session (`/clear` in Claude Code), then:

```
Review this branch against main with docs/REVIEW.md. Report only, skip style.
```

Ask your agent to fix the Important findings, then use your judgment to spot check the fixes.

```
git add .
git commit -m "Deploy: review fixes"
```

### Merge it

Run `npm test` and check it passes after the fixes. Then merge the branch into your `main` and delete it:

```
git checkout main
git merge mvp
git branch -d mvp
```

`git log --oneline` now shows your commits from Plan to Deploy, newest at the top.

## Stage 6: Maintain

Start Accountable the way `docs/STATUS.md` says and use it like a salesperson would: add a deal, move it along the pipeline and log a follow-up. Note what's missing or wrong, then:

```
Here's what I noticed using the app: [your notes]. Add these to docs/STATUS.md under Ideas for later, one line each.
```

```
git add .
git commit -m "Maintain: ideas for later"
```

## Share your documents

```
Share today's documents in a pull request to community_contributions, following course/for_agents/AGENT_GIT_GUIDE.md.
```

Approve the push when your agent asks. Then check the pull request on GitHub. Its Files changed tab lists five files, all in `community_contributions/<your folder>/`: `intent.md`, `spec.md`, `plan.md`, `REVIEW.md` and `README.md`.
