#!/usr/bin/env node
/**
 * Sync bake-critical env gaps into .env.local (never prints secret values).
 * Optionally push non-secret vars to Vercel production when --vercel is passed.
 *
 * Usage:
 *   node scripts/sync-bake-env-gaps.mjs
 *   node scripts/sync-bake-env-gaps.mjs --vercel
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const envPath = resolve(repoRoot, ".env.local");
const pushVercel = process.argv.includes("--vercel");
const updateVercel = process.argv.includes("--vercel-update");

const EVOLVED_TID = "c2615b95-b707-4485-aa5f-be8f78ec868a";

/** Documented safe fixture pair from workspace shell validation + live DB verification. */
const GOLDEN_LEAD_ID = "c9a58f3d-e1e4-4187-9986-59faed41565d";
const GOLDEN_PATIENT_ID = "287348d5-18bd-4434-9bab-7caafacbfe86";

/** Fallback linked pair from live Evolved tenant (2026-07-13 probe). */
const FALLBACK_LEAD_ID = "193ad710-ec42-44b7-a54f-cfbd52c1ef69";
const FALLBACK_PATIENT_ID = "014d6b67-640d-4b78-b7e0-a438c7f55694";

function parseKeys(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    map.set(t.slice(0, eq).trim(), t);
  }
  return map;
}

function upsertLine(lines, key, value, comment) {
  const prefix = `${key}=`;
  let replaced = false;
  const out = lines.map((line) => {
    const t = line.trim();
    if (t.startsWith("#") || !t.startsWith(prefix)) return line;
    replaced = true;
    return `${key}=${value}`;
  });
  if (!replaced) {
    if (comment) out.push("", `# ${comment}`);
    out.push(`${key}=${value}`);
  }
  return out;
}

function runVercel(args) {
  return spawnSync("npx", ["vercel", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: true,
    stdio: "pipe",
  });
}

function vercelHas(key, env = "production") {
  const r = runVercel(["env", "ls", env]);
  if (r.status !== 0) return false;
  return r.stdout.split(/\r?\n/).some((line) => line.trim().startsWith(`${key} `));
}

function vercelUpdate(key, value, environments) {
  for (const env of environments) {
    const r = runVercel(["env", "update", key, env, "--value", value, "--yes", "--sensitive"]);
    if (r.status !== 0) {
      console.error(`vercel FAIL update ${key} → ${env}: ${r.stderr || r.stdout}`);
    } else {
      console.log(`vercel updated ${key} → ${env}`);
    }
  }
}

function vercelSet(key, value, environments) {
  for (const env of environments) {
    if (vercelHas(key, env)) {
      console.log(`vercel skip ${key} (${env} already set — use dashboard to change)`);
      continue;
    }
    const r = runVercel(["env", "add", key, env, "--value", value, "--yes", "--sensitive"]);
    if (r.status !== 0) {
      console.error(`vercel FAIL ${key} → ${env}: ${r.stderr || r.stdout}`);
    } else {
      console.log(`vercel added ${key} → ${env}`);
    }
  }
}

if (!existsSync(envPath)) {
  console.error(".env.local not found");
  process.exit(1);
}

const raw = readFileSync(envPath, "utf8");
let lines = raw.split(/\r?\n/);

const updates = [
  {
    key: "FI_PIPELINE_V1_TENANT_ALLOWLIST",
    value: EVOLVED_TID,
    comment: "FI-ROLE-JOURNEY-BAKE-1 — Pipeline V1 cutover for Evolved Perth",
  },
  {
    key: "FI_E2E_LEAD_ID",
    value: GOLDEN_LEAD_ID,
    comment: "Golden-patient spine E2E — lead with linked patient (override if stale)",
  },
  {
    key: "FI_E2E_PATIENT_ID",
    value: GOLDEN_PATIENT_ID,
    comment: "Golden-patient spine E2E — canonical patient workspace",
  },
  {
    key: "FI_E2E_WORKSPACE_SHELL_VALIDATION",
    value: "true",
    comment: "Opt-in workspace shell validation E2E",
  },
  {
    key: "FI_TODAY_SURFACE_ENABLED",
    value: "true",
    comment: "Today surface rollout — Evolved Perth tenant allowlist also required",
  },
];

// Fix wrong demo admin: auditor@hairaudit.com is platform OS, not Evolved tenant member.
const currentDemoEmail =
  raw.match(/^FI_E2E_DEMO_ADMIN_EMAIL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
if (/auditor@hairaudit\.com/i.test(currentDemoEmail)) {
  updates.push({
    key: "FI_E2E_DEMO_ADMIN_EMAIL",
    value: "manager@evolvedhair.com.au",
    comment:
      "FI-ROLE-JOURNEY-BAKE-1 — use Evolved manager login (not platform auditor@hairaudit.com)",
  });
}

for (const u of updates) {
  lines = upsertLine(lines, u.key, u.value, u.comment);
}

// Ensure tenant IDs aligned if missing
for (const key of ["EVOLVED_PERTH_TENANT_ID", "FI_SMOKE_TENANT_ID", "FI_E2E_TENANT_ID"]) {
  if (!raw.match(new RegExp(`^${key}=`, "m"))) {
    lines = upsertLine(lines, key, EVOLVED_TID, "Evolved Hair Restoration Perth");
  }
}

const next = lines.join("\n").replace(/\n{3,}/g, "\n\n");
writeFileSync(envPath, next.endsWith("\n") ? next : `${next}\n`, "utf8");

console.log("Updated .env.local bake keys:");
for (const u of updates) console.log(`  - ${u.key}`);

console.log("\nNOTE: FI_E2E_DEMO_ADMIN_PASSWORD must match the chosen demo admin user.");
console.log("      Password cannot be synced automatically — update manually or use magic-link roster fixture.");
console.log(`\nFallback golden pair if documented IDs fail: lead=${FALLBACK_LEAD_ID} patient=${FALLBACK_PATIENT_ID}`);

if (pushVercel) {
  console.log("\n=== Vercel production (add-if-missing only) ===");
  vercelSet("FI_PIPELINE_V1_TENANT_ALLOWLIST", EVOLVED_TID, ["production", "preview"]);
  vercelSet("EVOLVED_PERTH_TENANT_ID", EVOLVED_TID, ["production", "preview"]);
  vercelSet("FI_SMOKE_TENANT_ID", EVOLVED_TID, ["production"]);
  for (const key of [
    "FI_TODAY_SURFACE_TENANT_IDS",
    "FI_WORKSPACE_SHELL_TENANT_IDS",
  ]) {
    vercelSet(key, EVOLVED_TID, ["production", "preview"]);
  }
  vercelSet("FI_TODAY_SURFACE_ENABLED", "true", ["production", "preview"]);
  vercelSet("FI_WORKSPACE_SHELL_ENABLED", "true", ["production", "preview"]);
}

if (updateVercel) {
  console.log("\n=== Vercel production (update existing) ===");
  vercelUpdate("FI_TODAY_SURFACE_ENABLED", "true", ["production", "preview"]);
  vercelUpdate("FI_PIPELINE_V1_TENANT_ALLOWLIST", EVOLVED_TID, ["production", "preview"]);
  vercelUpdate("EVOLVED_PERTH_TENANT_ID", EVOLVED_TID, ["production", "preview"]);
  vercelUpdate("FI_TODAY_SURFACE_TENANT_IDS", EVOLVED_TID, ["production", "preview"]);
  vercelUpdate("FI_WORKSPACE_SHELL_TENANT_IDS", EVOLVED_TID, ["production", "preview"]);
}

console.log("\nCompare with: node scripts/compare-bake-env.mjs");
