// npm test: Vitest, then pytest, then Playwright. All three run even if one
// fails, then a short summary, and a failing exit code if any failed.
// Never touches data/accountable.db.

import { spawnSync } from "node:child_process";
import { isAbsolute, join, resolve } from "node:path";

import { ROOT, ensureDeps } from "./ensure-deps.mjs";

const realDb = resolve(ROOT, "data", "accountable.db");
const setting = process.env.ACCOUNTABLE_DB;
if (setting) {
  const chosen = resolve(isAbsolute(setting) ? setting : join(ROOT, setting));
  if (chosen === realDb) {
    console.error(
      "ACCOUNTABLE_DB points at data/accountable.db, your own data. The tests won't run against it.",
    );
    process.exit(1);
  }
}

ensureDeps();

const isWindows = process.platform === "win32";

const runs = [
  {
    name: "Vitest (frontend unit tests)",
    command: "npm",
    args: ["run", "test", "-w", "frontend"],
    // Catches dates read as UTC, which land on the day before in the Americas.
    env: { TZ: "America/Los_Angeles" },
  },
  {
    name: "pytest (backend unit tests)",
    command: "uv",
    args: ["run", "pytest"],
  },
  {
    name: "Playwright, side by side (end-to-end tests)",
    command: "npx",
    args: ["playwright", "test", "-c", join("e2e", "playwright.config.ts"), "--project", "side-by-side"],
    env: { E2E_PASS: "side-by-side" },
  },
  {
    // The dashboard and pipeline tests, alone, on fresh servers and data.
    name: "Playwright, one at a time (end-to-end tests)",
    command: "npx",
    args: ["playwright", "test", "-c", join("e2e", "playwright.config.ts"), "--project", "one-at-a-time"],
    env: { E2E_PASS: "one-at-a-time" },
  },
];

const results = [];
for (const run of runs) {
  console.log(`\n=== ${run.name} ===\n`);
  const started = Date.now();
  const result = spawnSync(run.command, run.args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: isWindows,
    env: { ...process.env, ...run.env },
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  results.push({ name: run.name, ok: result.status === 0, seconds });
}

console.log("\n=== Summary ===");
for (const r of results) {
  console.log(`${r.ok ? "passed" : "FAILED"}  ${r.name}  (${r.seconds}s)`);
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.log(`\n${failed.length} of ${results.length} test runs failed.`);
  process.exit(1);
}
console.log("\nAll tests passed.");
