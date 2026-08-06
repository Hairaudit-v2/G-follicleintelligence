#!/usr/bin/env node
/**
 * FI-TEAM-COHESION-B2.2a — rewrite directory-core import specs (0 shims).
 * Usage: node scripts/team-cohesion/b2.2a-rewrite-directory-core-imports.mjs
 *
 * Pure helpers → @/src/lib/team/directory
 * Server loaders / asserts → @/src/lib/team/directory/server
 *
 * Legacy path stems are built via joins so re-running this script cannot
 * self-mutate the rewrite table.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const STAFF = ["@", "/", "src", "/", "lib", "/", "staff", "/"].join("");
const WOS = ["@", "/", "src", "/", "lib", "/", "workforce-os", "/"].join("");
const DIR = ["@", "/", "src", "/", "lib", "/", "team", "/", "directory"].join("");
const DIR_SERVER = `${DIR}/server`;

/** Longest-prefix / most-specific first. */
const SPEC_REWRITES = [
  // Server modules → directory/server barrel
  [`${STAFF}assertStaffClinicallyAvailable.server`, DIR_SERVER],
  [`${STAFF}staffDirectoryLoader.server`, DIR_SERVER],
  [`${WOS}workforceOsDirectoryLoader.server`, DIR_SERVER],
  // Pure modules → directory barrel
  [`${STAFF}staffDirectoryFilters`, DIR],
  [`${STAFF}calendarVisibleStaff`, DIR],
  [`${STAFF}staffAssigneeDisplay`, DIR],
  // Path-string fixtures / docs (no @ alias)
  [
    "src/lib/staff/assertStaffClinicallyAvailable.server.ts",
    "src/lib/team/directory/assertStaffClinicallyAvailable.server.ts",
  ],
  [
    "src/lib/staff/staffDirectoryLoader.server.ts",
    "src/lib/team/directory/staffDirectoryLoader.server.ts",
  ],
  [
    "src/lib/workforce-os/workforceOsDirectoryLoader.server.ts",
    "src/lib/team/directory/workforceOsDirectoryLoader.server.ts",
  ],
  [
    "src/lib/staff/staffDirectoryFilters.ts",
    "src/lib/team/directory/staffDirectoryFilters.ts",
  ],
  [
    "src/lib/staff/calendarVisibleStaff.ts",
    "src/lib/team/directory/calendarVisibleStaff.ts",
  ],
  [
    "src/lib/staff/calendarVisibleStaff.test.ts",
    "src/lib/team/directory/calendarVisibleStaff.test.ts",
  ],
  [
    "src/lib/staff/staffAssigneeDisplay.ts",
    "src/lib/team/directory/staffAssigneeDisplay.ts",
  ],
  [
    "src/lib/staff/staffDirectoryIdentityAttention.test.ts",
    "src/lib/team/directory/staffDirectoryIdentityAttention.test.ts",
  ],
  [
    "src/lib/staff/staffDirectoryLifecycle.test.ts",
    "src/lib/team/directory/staffDirectoryLifecycle.test.ts",
  ],
];

const SCAN_ROOTS = [
  "app",
  "components",
  "lib",
  "src",
  "e2e",
  "scripts",
  "docs/architecture/team-cohesion",
  "tests",
];

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "coverage",
  "playwright-report",
  "test-results",
  ".worktrees",
  "generated",
]);

const SKIP_FILES = new Set([
  "b2.2a-rewrite-directory-core-imports.mjs",
  "b2.2d-rewrite-clinical-staff-picker-imports.mjs",
]);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR_NAMES.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full, acc);
      continue;
    }
    if (!/\.(ts|tsx|mjs|js|md|json|csv)$/.test(ent.name)) continue;
    if (SKIP_FILES.has(ent.name)) continue;
    acc.push(full);
  }
  return acc;
}

function rewriteContent(src) {
  let out = src;
  for (const [from, to] of SPEC_REWRITES) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}

const files = SCAN_ROOTS.flatMap((rel) => walk(path.join(ROOT, rel)));
let touched = 0;
const changed = [];
for (const abs of files) {
  const before = fs.readFileSync(abs, "utf8");
  const after = rewriteContent(before);
  if (after !== before) {
    fs.writeFileSync(abs, after, "utf8");
    touched += 1;
    changed.push(path.relative(ROOT, abs).replace(/\\/g, "/"));
  }
}

console.log(`Updated ${touched} files`);
for (const rel of changed) console.log(`  ${rel}`);
