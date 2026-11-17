// Shared frontend code never imports from a business area such as src/crm.
// Only App.tsx, which puts the app together, may.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = dirname(fileURLToPath(import.meta.url));
const SHARED_FOLDERS = new Set(["api", "lib", "components", "styles", "test"]);
const MAY_IMPORT_AREAS = new Set([join(SRC, "App.tsx")]);

function walk(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

function areas(): string[] {
  return readdirSync(SRC).filter(
    (name) => statSync(join(SRC, name)).isDirectory() && !SHARED_FOLDERS.has(name),
  );
}

function sharedFiles(): string[] {
  const areaPaths = areas().map((area) => join(SRC, area) + sep);
  return walk(SRC).filter(
    (path) => !MAY_IMPORT_AREAS.has(path) && !areaPaths.some((area) => path.startsWith(area)),
  );
}

const IMPORT = /(?:import|export)\s[^'";]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;

function importedAreas(path: string): string[] {
  const found = new Set<string>();
  for (const match of readFileSync(path, "utf8").matchAll(IMPORT)) {
    const spec = match[1] ?? match[2] ?? match[3];
    if (!spec.startsWith(".")) continue;
    const target = relative(SRC, resolve(dirname(path), spec));
    const top = target.split(sep)[0];
    if (areas().includes(top)) found.add(top);
  }
  return [...found];
}

describe("layout", () => {
  it("has the CRM as an area", () => {
    expect(areas()).toContain("crm");
  });

  it("keeps src/lib, src/api and src/components free of imports from an area", () => {
    const offenders = Object.fromEntries(
      sharedFiles()
        .map((path) => [relative(SRC, path), importedAreas(path)] as const)
        .filter(([, found]) => found.length > 0),
    );
    expect(offenders).toEqual({});
  });
});
