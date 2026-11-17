import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Ports come from the environment, so the end-to-end tests can run their own
// servers beside `npm run dev`. The browser is opened by scripts/dev.mjs
// (`--open`), not here, since Playwright starts Vite from this same config.
// Unit tests run in Los Angeles time, where a date read as UTC lands on the
// day before, so that mistake shows up. scripts/test.mjs sets it too.
if (process.env.VITEST) process.env.TZ = process.env.TZ || "America/Los_Angeles";

const backendPort = process.env.BACKEND_PORT || "8000";
const frontendPort = Number(process.env.FRONTEND_PORT || 5173);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Prepare every dependency when the server starts. Otherwise Vite can find
  // one late, rebuild, and fail the first page load with "Outdated Optimize Dep".
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react-router",
      "@tanstack/react-query",
      "@tanstack/react-table",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "recharts",
      "@radix-ui/react-dialog",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-popover",
      "react-hook-form",
      "@hookform/resolvers/zod",
      "zod",
      "date-fns",
      "lucide-react",
      "sonner",
    ],
  },
  server: {
    host: "localhost",
    port: frontendPort,
    strictPort: true,
    proxy: {
      "/api": { target: `http://127.0.0.1:${backendPort}` },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    restoreMocks: true,
  },
});
