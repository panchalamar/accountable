import { join } from "node:path";

import { defineConfig, devices } from "@playwright/test";

// The end-to-end tests start their own backend and frontend on other ports,
// with their own database, so they never touch your data or clash with
// `npm run dev`. The backend starts from a fresh copy of the sample data.
//
// Two projects. "side-by-side" runs most files in parallel; each test adds its
// own records. "one-at-a-time" holds the files that check exact changes to
// shared figures (the dashboard) or move cards relative to other cards (the
// pipeline), which tests running alongside would upset. scripts/test.mjs runs
// the two projects one after the other, each with fresh servers and data.

const ROOT = join(import.meta.dirname, "..");
const BACKEND_PORT = "8011";
const FRONTEND_PORT = "5183";
const TEST_DB = join("data", "test", "e2e.db");
const ONE_AT_A_TIME = [/crm[\\/]dashboard\.spec\.ts$/, /crm[\\/]pipeline\.spec\.ts$/];
const BROWSER = {
  ...devices["Desktop Chrome"],
  channel: "chrome", // the installed Google Chrome
  viewport: { width: 1440, height: 900 },
};

export default defineConfig({
  testDir: ".",
  // Each project below sets its own results folder, and E2E_PASS (set by
  // scripts/test.mjs) its own report folder, so the second pass of `npm test`
  // doesn't wipe the first's traces and screenshots.
  outputDir: join(ROOT, "test-results"),
  fullyParallel: true,
  workers: 4,
  // A stray test.only would quietly run a few tests and pass, so refuse it.
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: join(ROOT, "playwright-report", process.env.E2E_PASS || "all") }]],
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "side-by-side",
      outputDir: join(ROOT, "test-results", "side-by-side"),
      testIgnore: ONE_AT_A_TIME,
      use: BROWSER,
    },
    {
      name: "one-at-a-time",
      outputDir: join(ROOT, "test-results", "one-at-a-time"),
      testMatch: ONE_AT_A_TIME,
      workers: 1,
      use: BROWSER,
    },
  ],
  webServer: [
    {
      command: "node scripts/e2e-backend.mjs",
      cwd: ROOT,
      url: `http://127.0.0.1:${BACKEND_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { BACKEND_PORT, ACCOUNTABLE_DB: TEST_DB },
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: "npm run dev -w frontend",
      cwd: ROOT,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { BACKEND_PORT, FRONTEND_PORT },
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
