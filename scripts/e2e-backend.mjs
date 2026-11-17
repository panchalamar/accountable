// For the end-to-end tests: starts the backend on the test port with a fresh
// test database. The backend migrates the new file and fills it with the
// sample data, so every run starts from the same data.

import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { ROOT } from "./ensure-deps.mjs";

const dbSetting = process.env.ACCOUNTABLE_DB || join("data", "test", "e2e.db");
const dbPath = isAbsolute(dbSetting) ? dbSetting : join(ROOT, dbSetting);
const realDb = resolve(ROOT, "data", "accountable.db");

if (resolve(dbPath) === realDb) {
  console.error("Refusing to start the test backend on data/accountable.db, your own data.");
  process.exit(1);
}

mkdirSync(dirname(dbPath), { recursive: true });
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(dbPath + suffix, { force: true });
}

const port = process.env.BACKEND_PORT || "8011";
const child = spawn(
  "uv",
  ["run", "uvicorn", "backend.main:create_app", "--factory", "--host", "127.0.0.1", "--port", port],
  {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ACCOUNTABLE_DB: dbPath, BACKEND_PORT: port },
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 0));
