#!/usr/bin/env node
/**
 * FI-TEAM-COHESION-B2.3b — rewrite HR readiness / notification import specs (0 shims).
 * Usage: node scripts/team-cohesion/b2.3b-rewrite-hr-notification-imports.mjs
 *
 * Identity readiness symbols that previously lived on staffHrNotificationSummary
 * and must not pull notifications into identity are handled separately in source.
 *
 * Consumer mapping:
 * - staffHrNotificationSummary → @/src/lib/team/notifications
 * - myHrPortalSelection → @/src/lib/team/notifications
 * - staffHrNotificationLoader.server → @/src/lib/team/notifications/server
 * - myHrPortalLoader.server → @/src/lib/team/notifications/server
 * - identity modules keep deep readiness imports already applied in delivery
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const NOTIF = ["@", "/", "src", "/", "lib", "/", "team", "/", "notifications"].join("");
const NOTIF_SERVER = `${NOTIF}/server`;

const SPEC_REWRITES = [
  ["@/src/lib/staff/staffHrNotificationLoader.server", NOTIF_SERVER],
  ["@/src/lib/staff/myHrPortalLoader.server", NOTIF_SERVER],
  ["@/src/lib/staff/staffHrNotificationSummary", NOTIF],
  ["@/src/lib/staff/myHrPortalSelection", NOTIF],
];

const PATH_STRING_REWRITES = [
  ["src/lib/staff/staffHrNotificationLoader.server.ts", "src/lib/team/notifications/staffHrNotificationLoader.server.ts"],
  ["src/lib/staff/myHrPortalLoader.server.ts", "src/lib/team/notifications/myHrPortalLoader.server.ts"],
  ["src/lib/staff/staffHrNotificationSummary.ts", "src/lib/team/notifications/staffHrNotificationSummary.ts"],
  ["src/lib/staff/staffHrNotificationSummary.test.ts", "src/lib/team/notifications/staffHrNotificationSummary.test.ts"],
  ["src/lib/staff/myHrPortalSelection.ts", "src/lib/team/notifications/myHrPortalSelection.ts"],
  ["src/lib/staff/myHrPortalLoader.test.ts", "src/lib/team/notifications/myHrPortalSelection.test.ts"],
  ["src/lib/staff/staffHrNotificationLoader.server", "src/lib/team/notifications/staffHrNotificationLoader.server"],
  ["src/lib/staff/myHrPortalLoader.server", "src/lib/team/notifications/myHrPortalLoader.server"],
  ["src/lib/staff/staffHrNotificationSummary", "src/lib/team/notifications/staffHrNotificationSummary"],
  ["src/lib/staff/myHrPortalSelection", "src/lib/team/notifications/myHrPortalSelection"],
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
  "b2.3b-rewrite-hr-notification-imports.mjs",
  "b2.3a-rewrite-staff-role-policy-imports.mjs",
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

function rewriteFile(fullPath) {
  let src = fs.readFileSync(fullPath, "utf8");
  if (
    !src.includes("staffHrNotification") &&
    !src.includes("myHrPortal") &&
    !src.includes("staff/staffHrNotification") &&
    !src.includes("staff/myHrPortal")
  ) {
    return false;
  }

  let out = src;

  for (const [from, to] of SPEC_REWRITES) {
    if (out.includes(from)) out = out.split(from).join(to);
  }

  // Relative imports from legacy staff tree residues
  out = out.replace(
    /from\s+["']\.\/staffHrNotificationSummary["']/g,
    `from "${NOTIF}"`
  );
  out = out.replace(
    /from\s+["']\.\/myHrPortalSelection["']/g,
    `from "${NOTIF}"`
  );
  out = out.replace(
    /from\s+["']\.\/staffHrNotificationLoader\.server["']/g,
    `from "${NOTIF_SERVER}"`
  );
  out = out.replace(
    /from\s+["']\.\/myHrPortalLoader\.server["']/g,
    `from "${NOTIF_SERVER}"`
  );

  for (const [from, to] of PATH_STRING_REWRITES) {
    if (out.includes(from)) out = out.split(from).join(to);
  }

  if (out === src) return false;
  fs.writeFileSync(fullPath, out);
  return true;
}

let changed = 0;
for (const root of SCAN_ROOTS) {
  for (const file of walk(path.join(ROOT, root))) {
    if (rewriteFile(file)) {
      changed++;
      console.log("rewrote", path.relative(ROOT, file).replace(/\\/g, "/"));
    }
  }
}
console.log(JSON.stringify({ ok: true, changed }, null, 2));
