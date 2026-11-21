// Claude Code PreToolUse hook: refuses any change to a .env file, which holds
// real keys. The file tools are checked by their path. Bash commands are
// refused when they name a .env file at all; that's a guess from the command's
// text, so a command that reaches .env without naming it still gets through.

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const FILE_EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

const input = JSON.parse(readFileSync(0, "utf8"));

if (touchesEnvFile(input.tool_name, input.tool_input ?? {})) {
  console.error(
    "Blocked by .claude/hooks/protect-env.mjs: .env holds real keys, so Claude may not change it. " +
      "Ask the user to make this change themselves.",
  );
  process.exit(2);
}

function touchesEnvFile(tool, args) {
  if (tool === "Bash") return namesEnvFile(args.command ?? "");
  if (!FILE_EDIT_TOOLS.has(tool)) return false;
  const path = args.file_path ?? args.notebook_path;
  // macOS and Windows don't tell .env from .ENV.
  return typeof path === "string" && basename(path).toLowerCase() === ".env";
}

/** True when the command names a file called .env, such as `>> .env` or `backend/.env`. */
function namesEnvFile(command) {
  return /(^|[\s'"=<>|;&(/])\.env($|[\s'"<>|;&)])/i.test(command);
}
