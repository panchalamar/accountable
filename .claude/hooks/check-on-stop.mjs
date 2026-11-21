// Claude Code Stop hook: runs `npm run check:quick` when Claude finishes a turn.
// If it fails, Claude is sent back with the failing checks' output to fix them.
// It blocks only once: when Claude stops again after that, it's let through
// without another run, so a failure Claude can't fix never loops forever.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MAX_LINES_PER_SECTION = 150;

const input = JSON.parse(readFileSync(0, "utf8"));
if (input.stop_hook_active) process.exit(0);

const output = runCheck();
if (output !== null) {
  console.log(JSON.stringify({ decision: "block", reason: reasonFor(output) }));
}

/** The check's output, or null when it passes. */
function runCheck() {
  // Through a shell so stderr lands in order with stdout (sh and cmd both read 2>&1).
  const result = spawnSync("npm run check:quick 2>&1", {
    cwd: process.env.CLAUDE_PROJECT_DIR ?? input.cwd,
    shell: true,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status === 0) return null;
  // gitleaks colors its log even when it isn't writing to a terminal.
  return stripAnsi(result.stdout || String(result.error ?? "No output."));
}

function reasonFor(output) {
  const sections = failedSections(output);
  const details = sections.length
    ? sections.map(formatSection).join("\n\n")
    : lastLines(output, MAX_LINES_PER_SECTION);
  return [
    "`npm run check:quick` failed when you finished. Fix what it found and run it again.",
    "If a failure isn't yours to fix, tell the user why instead.",
    "",
    details,
  ].join("\n");
}

/**
 * check.mjs and test.mjs head each step with "=== name ===" and end with a
 * summary that marks each failed step "FAILED  name". Keeps the failed steps
 * with output of their own, then the overall summary.
 */
function failedSections(output) {
  const failed = new Set(
    [...output.matchAll(/^FAILED\s+(.+?)(?:\s+\(\d+s\))?$/gm)].map((match) => match[1]),
  );
  const sections = splitSections(output);
  return sections.filter(
    (section) =>
      (failed.has(section.name) && section.body) || section.name === "Check summary",
  );
}

function splitSections(output) {
  const sections = [];
  let current = null;
  for (const line of output.split("\n")) {
    const header = line.match(/^=== (.+) ===$/);
    if (header) {
      current = { name: header[1], lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return sections.map(({ name, lines }) => ({ name, body: lines.join("\n").trim() }));
}

function formatSection({ name, body }) {
  const lines = body.split("\n");
  const shown = lines.slice(0, MAX_LINES_PER_SECTION).join("\n");
  const cut = lines.length - MAX_LINES_PER_SECTION;
  const note = cut > 0 ? `\n[${cut} more lines cut. Run \`npm run check:quick\` to see them.]` : "";
  return `=== ${name} ===\n${shown}${note}`;
}

function lastLines(text, count) {
  return text.trim().split("\n").slice(-count).join("\n");
}

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}
