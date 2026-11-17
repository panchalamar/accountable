// Checks what Accountable needs before anything starts. Uses only Node itself,
// so it works on a fresh clone with no node_modules yet.
//
// - Node 24 or later, and uv, with a plain message if either is missing.
// - npm install when node_modules is missing or older than package-lock.json.
// - uv sync, so the Python download happens here with a clear message, not
//   halfway through starting the servers.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";

function fail(lines) {
  console.error(["", ...lines, ""].join("\n"));
  process.exit(1);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, { cwd: ROOT, stdio: "inherit", shell: isWindows, ...options });
}

export function checkNode() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 24) {
    fail([
      `Accountable needs Node 24 or later, and this is Node ${process.versions.node}.`,
      "Install the current LTS from https://nodejs.org and try again.",
    ]);
  }
}

export function checkUv() {
  const result = spawnSync("uv", ["--version"], { stdio: "ignore", shell: isWindows });
  if (result.error || result.status !== 0) {
    fail([
      "Accountable needs uv to run its backend, and uv isn't installed.",
      "Install it from https://docs.astral.sh/uv/getting-started/installation/ and try again.",
    ]);
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * True when node_modules matches package-lock.json. npm keeps its own record
 * of what it installed in node_modules/.package-lock.json. That file leaves out
 * the root entry and optional packages for other platforms, so it's compared
 * entry by entry rather than byte for byte.
 */
export function nodeModulesUpToDate() {
  const lock = readJson(join(ROOT, "package-lock.json"));
  const installed = readJson(join(ROOT, "node_modules", ".package-lock.json"));
  if (!lock || !installed) return false;
  const wanted = lock.packages ?? {};
  const have = installed.packages ?? {};
  for (const [path, entry] of Object.entries(wanted)) {
    if (path === "") continue;
    if (!(path in have)) {
      if (entry.optional) continue;
      return false;
    }
    if (JSON.stringify(entry) !== JSON.stringify(have[path])) return false;
  }
  return Object.keys(have).every((path) => path in wanted);
}

export function ensureNodeModules() {
  if (existsSync(join(ROOT, "node_modules")) && nodeModulesUpToDate()) return;
  console.log("Installing Accountable's frontend packages (npm install). This needs the internet once.");
  const result = run("npm", ["install", "--no-audit", "--no-fund"]);
  if (result.status !== 0) {
    fail([
      "npm install didn't finish. Check your internet connection and run `npm run dev` again.",
    ]);
  }
}

export function ensurePython() {
  const result = run("uv", ["sync", "--quiet"]);
  if (result.status !== 0) {
    fail([
      "uv couldn't install Python or the backend's packages.",
      "The first run needs the internet once. Check your connection and try again.",
    ]);
  }
}

export function ensureDeps({ npm = true } = {}) {
  checkNode();
  checkUv();
  if (npm) ensureNodeModules();
  ensurePython();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  ensureDeps({ npm: !process.argv.includes("--uv-only") });
}
