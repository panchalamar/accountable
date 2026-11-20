// npm run check: formatting, lint, complexity, types, secrets and every test
// with coverage. --quick skips the end-to-end tests. Every step runs even if
// an earlier one fails, then a summary, and a failing exit code if any failed.

import { spawnSync } from "node:child_process";

import { ROOT, ensureDeps } from "./ensure-deps.mjs";

const quick = process.argv.includes("--quick");
const isWindows = process.platform === "win32";

ensureDeps();

const steps = [
  { name: "Prettier", command: "npx", args: ["prettier", "--check", "frontend"] },
  { name: "ESLint", command: "npx", args: ["eslint", "--max-warnings", "0", "frontend"] },
  { name: "tsc", command: "npm", args: ["run", "typecheck", "-w", "frontend"] },
  { name: "ruff format", command: "uv", args: ["run", "ruff", "format", "--check", "backend"] },
  { name: "ruff check", command: "uv", args: ["run", "ruff", "check", "backend"] },
  { name: "ty", command: "uv", args: ["run", "ty", "check", "backend"] },
  { name: "gitleaks, history", command: "gitleaks", args: ["git", "--no-banner", "--redact", "."] },
  // .gitleaks.toml lets the git-ignored .env through.
  { name: "gitleaks, working tree", command: "gitleaks", args: ["dir", "--no-banner", "--redact", "."] },
  {
    name: quick ? "Unit tests with coverage" : "All tests with coverage",
    command: "node",
    args: ["scripts/test.mjs", "--coverage", ...(quick ? ["--unit-only"] : [])],
  },
];

const results = [];
for (const step of steps) {
  console.log(`\n=== ${step.name} ===\n`);
  const result = spawnSync(step.command, step.args, { cwd: ROOT, stdio: "inherit", shell: isWindows });
  results.push({ name: step.name, ok: result.status === 0 });
}

console.log("\n=== Check summary ===");
for (const r of results) console.log(`${r.ok ? "passed" : "FAILED"}  ${r.name}`);

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.log(`\n${failed.length} of ${results.length} checks failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
