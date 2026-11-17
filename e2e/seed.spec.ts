// Runs the real `npm run seed` against a copy of the test database. No browser.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, backup } from "node:sqlite";

import { expect, test, unique } from "./fixtures";

const ROOT = join(import.meta.dirname, "..");
const E2E_DB = join(ROOT, "data", "test", "e2e.db");

async function copyOfTestDatabase(label: string): Promise<{ dir: string; path: string }> {
  const dir = join(ROOT, "data", "test", `seed-${label}-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "accountable.db");
  const source = new DatabaseSync(E2E_DB, { readOnly: true });
  try {
    await backup(source, path); // a consistent copy, though the test server is running
  } finally {
    source.close();
  }
  return { dir, path };
}

function seed(path: string, args: string[], input = "") {
  return spawnSync("npm", ["run", "seed", "--", ...args], {
    cwd: ROOT,
    input,
    encoding: "utf8",
    env: { ...process.env, ACCOUNTABLE_DB: path },
    shell: process.platform === "win32",
    timeout: 60_000,
  });
}

function organizationNames(path: string): string[] {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return db.prepare("SELECT name FROM organizations").all().map((row) => String(row.name));
  } finally {
    db.close();
  }
}

function dealCount(path: string): number {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return Number(db.prepare("SELECT count(*) AS n FROM deals").get()?.n);
  } finally {
    db.close();
  }
}

test("answering n leaves the database unchanged", async () => {
  const { dir, path } = await copyOfTestDatabase("no");
  try {
    const before = readFileSync(path);
    const result = seed(path, [], "n\n");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Replace all data with fresh sample data? (y/N)");
    expect(result.stdout).toContain("Nothing changed.");
    expect(readFileSync(path).equals(before)).toBe(true);
    expect(existsSync(join(dir, "backups"))).toBe(false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--yes saves a timestamped backup and brings back the sample data", async ({ api }) => {
  const name = unique("Added before the reset");
  await api.post("/organizations", { name });
  const { dir, path } = await copyOfTestDatabase("yes");
  try {
    expect(organizationNames(path)).toContain(name);

    const result = seed(path, ["--yes"]);
    expect(result.status, result.stderr).toBe(0);

    const backups = readdirSync(join(dir, "backups"));
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatch(/^accountable-\d{8}-\d{6}\.db$/);
    expect(result.stdout).toContain(join(dir, "backups", backups[0]));
    expect(organizationNames(join(dir, "backups", backups[0]))).toContain(name);

    expect(organizationNames(path)).not.toContain(name);
    expect(organizationNames(path)).toHaveLength(12);
    expect(dealCount(path)).toBe(40);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
