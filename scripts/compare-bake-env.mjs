#!/usr/bin/env node
/**
 * Compare bake-critical env vars: .env.local vs Vercel production snapshot.
 * Usage: node scripts/compare-bake-env.mjs [.env.vercel.check-prod-live]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const vercelPath = process.argv[2] ?? ".env.vercel.check-prod-live";

function parseEnvFile(relPath) {
  const full = resolve(repoRoot, relPath);
  if (!existsSync(full)) return { path: relPath, vars: {} };
  const vars = {};
  for (const line of readFileSync(full, "utf8").split(/\r?\n/)) {
    let t = line.trim();
    if (!t || t.startsWith("#")) continue;
    if (t.startsWith("export ")) t = t.slice(7).trim();
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    vars[key] = val.replace(/\\n$/, "").trim();
  }
  return { path: relPath, vars };
}

const BAKE_KEYS = [
  "EVOLVED_PERTH_TENANT_ID",
  "FI_SMOKE_TENANT_ID",
  "FI_PIPELINE_V1_TENANT_ALLOWLIST",
  "FI_PAYMENTS_ENABLED",
  "FI_PROCEDURE_DAY_ENABLED",
  "FI_TODAY_SURFACE_TENANT_IDS",
  "FI_TODAY_SURFACE_ENABLED",
  "FI_WORKSPACE_SHELL_TENANT_IDS",
  "FI_WORKSPACE_SHELL_ENABLED",
  "FI_E2E_TENANT_ID",
  "FI_E2E_DEMO_ADMIN_EMAIL",
  "FI_E2E_LEAD_ID",
  "FI_E2E_PATIENT_ID",
  "FI_E2E_WORKSPACE_SHELL_VALIDATION",
  "RECEPTION_OS_COMMUNICATION_DRY_RUN",
  "FI_BASE_URL",
  "NEXT_PUBLIC_SITE_URL",
];

const EXPECTED_TID = "c2615b95-b707-4485-aa5f-be8f78ec868a";

function isSecretKey(key) {
  return /PASSWORD|SECRET|KEY|TOKEN/i.test(key) && !/ALLOW|ENABLED|SURFACE|SHELL|TENANT|DRY_RUN|PAYMENTS|PROCEDURE|BASE_URL|SITE_URL/i.test(key);
}

function fmt(key, val) {
  if (!val) return "(missing)";
  if (isSecretKey(key)) return `(set, len ${val.length})`;
  return val;
}

function includesTenantId(val, tid) {
  if (!val) return false;
  return val.split(",").map((s) => s.trim()).includes(tid);
}

const local = parseEnvFile(".env.local");
const vercel = parseEnvFile(vercelPath);

console.log("=== Bake env comparison ===");
console.log(`Local:  ${local.path}`);
console.log(`Vercel: ${vercel.path}\n`);

const gaps = [];

for (const key of BAKE_KEYS) {
  const l = local.vars[key] ?? "";
  const v = vercel.vars[key] ?? "";
  let status = "OK";
  if (!l && !v) status = "BOTH_MISSING";
  else if (!l) status = "LOCAL_MISSING";
  else if (!v) status = "VERCEL_MISSING";
  else if (l !== v && !isSecretKey(key)) status = "DIFF";

  if (/TENANT_ID|ALLOWLIST/.test(key) && (l || v)) {
    const okLocal = !l || includesTenantId(l, EXPECTED_TID) || l === EXPECTED_TID;
    const okVercel = !v || includesTenantId(v, EXPECTED_TID) || v === EXPECTED_TID;
    if (!okLocal || !okVercel) status = "TENANT_MISMATCH";
  }

  if (status !== "OK") gaps.push({ key, status });

  console.log(`${key}`);
  console.log(`  local  = ${fmt(key, l)}`);
  console.log(`  vercel = ${fmt(key, v)}`);
  console.log(`  → ${status}`);
}

console.log("\n--- Summary ---");
if (gaps.length === 0) console.log("All bake keys aligned.");
else {
  console.log(`${gaps.length} gap(s):`);
  for (const g of gaps) console.log(`  ${g.key}: ${g.status}`);
}
