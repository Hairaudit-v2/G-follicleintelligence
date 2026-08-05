#!/usr/bin/env node
/**
 * FI-TEAM-COHESION-B2.2d — rewrite clinical staff picker import specs (0 shims).
 * Usage: node scripts/team-cohesion/b2.2d-rewrite-clinical-staff-picker-imports.mjs
 *
 * Pure helpers → @/src/lib/team/directory
 * Server loaders → @/src/lib/team/directory/server
 *
 * Note: this file intentionally spells legacy paths with a separator join so a
 * second run does not self-mutate the rewrite table.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const LEGACY_STAFF = ["@", "/", "src", "/", "lib", "/", "staff", "/"].join("");
const CANON_DIR = ["@", "/", "src", "/", "lib", "/", "team", "/", "directory"].join("");
const CANON_DIR_SERVER = `${CANON_DIR}/server`;

/** Longest-prefix first so loader paths rewrite before the pure stem. */
const SPEC_REWRITES = [
  [`${LEGACY_STAFF}clinicalStaffPickerLoader.server`, CANON_DIR_SERVER],
  [`${LEGACY_STAFF}clinicalStaffPicker`, CANON_DIR],
  // Docs / inventory / path-string fixtures (no @ alias)
  [
    "src/lib/staff/clinicalStaffPickerLoader.server.ts",
    "src/lib/team/directory/clinicalStaffPickerLoader.server.ts",
  ],
  [
    "src/lib/staff/clinicalStaffPicker.ts",
    "src/lib/team/directory/clinicalStaffPicker.ts",
  ],
  [
    "src/lib/staff/clinicalStaffAssignment.test.ts",
    "src/lib/team/directory/clinicalStaffAssignment.test.ts",
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
    // Never self-mutate this rewrite table.
    if (full.replace(/\\/g, "/").endsWith("b2.2d-rewrite-clinical-staff-picker-imports.mjs")) {
      continue;
    }
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
