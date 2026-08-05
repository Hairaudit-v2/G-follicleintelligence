#!/usr/bin/env node
/**
 * FI-TEAM-COHESION-B2.2b — rewrite import specs after access module moves (0 shims).
 * Usage: node scripts/team-cohesion/b2.2b-rewrite-access-imports.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const SPEC_REWRITES = [
  ["@/src/lib/team/access/staffAccessCentre.server", "@/src/lib/team/access/staffAccessCentre.server"],
  ["@/src/lib/team/access/staffAccessAccept.server", "@/src/lib/team/access/staffAccessAccept.server"],
  ["@/src/lib/team/access/staffAccessInviteAudit.server", "@/src/lib/team/access/staffAccessInviteAudit.server"],
  ["@/src/lib/team/access/staffAccessPinLayer.server", "@/src/lib/team/access/staffAccessPinLayer.server"],
  ["@/src/lib/team/access/workforceHrManageGate.server", "@/src/lib/team/access/workforceHrManageGate.server"],
  ["@/src/lib/team/access/workforceHrManageGateCore", "@/src/lib/team/access/workforceHrManageGateCore"],
  ["@/src/lib/team/access/staffAccessCentreCore", "@/src/lib/team/access/staffAccessCentreCore"],
  ["@/src/lib/team/access/staffAccessInviteCore", "@/src/lib/team/access/staffAccessInviteCore"],
  ["@/src/lib/team/access/staffAccessAcceptCore", "@/src/lib/team/access/staffAccessAcceptCore"],
  ["@/src/lib/team/access/staffHrTaskMapBannerCore", "@/src/lib/team/access/staffHrTaskMapBannerCore"],
  ["@/src/lib/team/access/staffHrTaskMapCore", "@/src/lib/team/access/staffHrTaskMapCore"],
  ["@/src/lib/team/access/staffFiUserLinkPlan", "@/src/lib/team/access/staffFiUserLinkPlan"],
];

const SCAN_ROOTS = [
  "app",
  "components",
  "lib",
  "src",
  "e2e",
  "scripts/team-cohesion",
  "docs/architecture/team-cohesion",
];

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "coverage",
  "playwright-report",
  "test-results",
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
    if (!/\.(ts|tsx|mjs|js|md)$/.test(ent.name)) continue;
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
