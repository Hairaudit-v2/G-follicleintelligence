#!/usr/bin/env node
/**
 * FI-TEAM-COHESION-B2.4 — rewrite weekly hours + booking slot import specs (0 shims).
 * Usage: node scripts/team-cohesion/b2.4-rewrite-availability-imports.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const AVAIL = ["@", "/", "src", "/", "lib", "/", "team", "/", "roster", "/", "availability"].join("");
const BOOKINGS_SLOT = ["@", "/", "src", "/", "lib", "/", "bookings", "/", "staffSlotAvailability.server"].join("");

const SPEC_REWRITES = [
  ["@/src/lib/staff/staffSlotHours.server", BOOKINGS_SLOT],
  ["@/src/lib/staff/staffWeeklyHours", AVAIL],
];

const PATH_STRING_REWRITES = [
  ["src/lib/staff/staffSlotHours.server.ts", "src/lib/bookings/staffSlotAvailability.server.ts"],
  ["src/lib/staff/staffWeeklyHours.ts", "src/lib/team/roster/availability/weeklyHours.ts"],
  ["src/lib/staff/staffSlotHours.server", "src/lib/bookings/staffSlotAvailability.server"],
  ["src/lib/staff/staffWeeklyHours", "src/lib/team/roster/availability"],
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
  "b2.4-rewrite-availability-imports.mjs",
  "b2.4-rewrite-rostering-engine-header.mjs",
  "b2.3b-rewrite-hr-notification-imports.mjs",
  "b2.3a-rewrite-staff-role-policy-imports.mjs",
]);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR_NAMES.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function rewriteFile(filePath) {
  const base = path.basename(filePath);
  if (SKIP_FILES.has(base)) return false;
  if (!/\.(ts|tsx|js|mjs|md|json)$/.test(base) && !base.endsWith(".csv")) return false;

  let text = fs.readFileSync(filePath, "utf8");
  let next = text;
  for (const [from, to] of SPEC_REWRITES) {
    next = next.split(from).join(to);
  }
  for (const [from, to] of PATH_STRING_REWRITES) {
    next = next.split(from).join(to);
  }
  if (next === text) return false;
  fs.writeFileSync(filePath, next);
  return true;
}

let changed = 0;
for (const root of SCAN_ROOTS) {
  for (const file of walk(path.join(ROOT, root))) {
    if (rewriteFile(file)) {
      changed += 1;
      console.log("rewrote", path.relative(ROOT, file));
    }
  }
}
console.log(`done; files changed: ${changed}`);
