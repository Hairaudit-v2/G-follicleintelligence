#!/usr/bin/env node
/**
 * FI-TEAM-COHESION-B2.2c — rewrite import specs after onboarding move (0 shims).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const FROM = "@/src/lib/team/onboarding/";
const TO = "@/src/lib/team/onboarding/";

const SCAN_ROOTS = ["app", "components", "lib", "src", "e2e", "scripts"];
const SKIP = new Set(["node_modules", ".next", ".git", "dist", "coverage", "playwright-report", "test-results", ".worktrees"]);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
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

let touched = 0;
for (const abs of SCAN_ROOTS.flatMap((r) => walk(path.join(ROOT, r)))) {
  const before = fs.readFileSync(abs, "utf8");
  if (!before.includes(FROM)) continue;
  fs.writeFileSync(abs, before.split(FROM).join(TO), "utf8");
  touched += 1;
  console.log(path.relative(ROOT, abs).replace(/\\/g, "/"));
}
console.log(`Updated ${touched} files`);
