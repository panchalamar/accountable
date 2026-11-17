// npm run dev: checks dependencies, then starts the backend and the frontend
// together and opens the dashboard in the browser. Ctrl+C stops both.
//
// Done in Node rather than in the npm script so it works the same on Windows,
// where $VAR doesn't expand.

import { ROOT, ensureDeps } from "./ensure-deps.mjs";

ensureDeps();

const { default: concurrently } = await import("concurrently");

const backendPort = process.env.BACKEND_PORT || "8000";
const frontendPort = process.env.FRONTEND_PORT || "5173";
const env = { ...process.env, BACKEND_PORT: backendPort, FRONTEND_PORT: frontendPort };

console.log(`Starting Accountable at http://localhost:${frontendPort}`);

const { result } = concurrently(
  [
    {
      name: "backend",
      command: `uv run uvicorn backend.main:create_app --factory --host 127.0.0.1 --port ${backendPort}`,
      env,
      prefixColor: "green",
    },
    {
      name: "frontend",
      command: "npm run dev -w frontend -- --open",
      env,
      prefixColor: "cyan",
    },
  ],
  { cwd: ROOT, killOthersOn: ["failure", "success"], restartTries: 0 },
);

result.then(
  () => process.exit(0),
  () => process.exit(1),
);
