#!/usr/bin/env node
/**
 * FI-TEAM-COHESION-B2.3a — rewrite staffRolePolicy import specs (0 shims).
 * Usage: node scripts/team-cohesion/b2.3a-rewrite-staff-role-policy-imports.mjs
 *
 * External consumers → @/src/lib/team/directory
 * Directory-internal modules → @/src/lib/team/directory/staffRolePolicy (deep, avoid barrel cycles)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const STAFF_POLICY = ["@", "/", "src", "/", "lib", "/", "staff", "/", "staffRolePolicy"].join("");
const DIR = ["@", "/", "src", "/", "lib", "/", "team", "/", "directory"].join("");
const DIR_POLICY = `${DIR}/staffRolePolicy`;

/** Modules inside team/directory that must keep a deep import. */
const DIRECTORY_INTERNAL = new Set([
  "staffDirectoryFilters.ts",
  "clinicalStaffPicker.ts",
  "assertStaffClinicallyAvailable.server.ts",
  "clinicalStaffAssignment.test.ts",
  "staffRolePolicy.test.ts",
]);

const PATH_STRING_REWRITES = [
  ["src/lib/staff/staffRolePolicy.ts", "src/lib/team/directory/staffRolePolicy.ts"],
  ["src/lib/staff/staffRolePolicy", "src/lib/team/directory/staffRolePolicy"],
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
  "b2.3a-rewrite-staff-role-policy-imports.mjs",
  "b2.3-discovery.mjs",
  "b2.3-candidate-analysis.mjs",
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
  const base = path.basename(fullPath);
  const rel = path.relative(ROOT, fullPath).replace(/\\/g, "/");
  let src = fs.readFileSync(fullPath, "utf8");
  if (!src.includes("staffRolePolicy") && !src.includes("staff/staffRolePolicy")) return false;

  let out = src;
  const isDirInternal =
    rel.startsWith("src/lib/team/directory/") && DIRECTORY_INTERNAL.has(base);

  // Relative imports of ./staffRolePolicy (legacy staff tests residual)
  out = out.replace(
    /from\s+["']\.\/staffRolePolicy["']/g,
    isDirInternal ? `from "${DIR_POLICY}"` : `from "${DIR}"`,
  );

  if (isDirInternal) {
    out = out.split(STAFF_POLICY).join(DIR_POLICY);
    // Also fix any accidental barrel imports of only role policy symbols if present via staff path
  } else {
    // @/src/lib/staff/staffRolePolicy → directory barrel
    out = out.split(STAFF_POLICY).join(DIR);
  }

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
