#!/usr/bin/env node
/**
 * Full env audit: code references vs .env.example vs .env.local vs Vercel snapshot.
 * Usage: node scripts/audit-env-vars.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const repoRoot = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

function parseEnvFile(path) {
  const full = join(repoRoot, path);
  if (!existsSync(full)) return {};
  const out = {};
  for (const line of readFileSync(full, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
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
    out[key] = val;
  }
  return out;
}

function walk(dir, exts, files = []) {
  for (const ent of readdirSync(dir)) {
    const p = join(dir, ent);
    if (["node_modules", ".git", ".next", "dist", "build"].includes(ent)) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, exts, files);
    else if (exts.some((e) => p.endsWith(e))) files.push(p);
  }
  return files;
}

const FRAMEWORK_VARS = new Set([
  "NODE_ENV",
  "VERCEL_ENV",
  "VERCEL",
  "VERCEL_URL",
  "NEXT_RUNTIME",
]);

const codeVars = new Set();
const re = /process\.env\.([A-Z][A-Z0-9_]*)/g;
for (const f of walk(repoRoot, [".ts", ".tsx", ".js", ".mjs", ".cjs"])) {
  const txt = readFileSync(f, "utf8");
  let m;
  while ((m = re.exec(txt))) codeVars.add(m[1]);
}

const example = parseEnvFile(".env.example");
const local = parseEnvFile(".env.local");
const vercel = parseEnvFile(".env.vercel.production");

// Load schema via tsx subprocess output — use precompiled keys from schema file parse
const schemaSrc = readFileSync(join(repoRoot, "src/lib/env/schema.ts"), "utf8");
const clientBlock = schemaSrc.match(/export const clientEnvKeys = \[([\s\S]*?)\] as const/)?.[1] ?? "";
const clientKeys = [...clientBlock.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
const serverKeys = [...schemaSrc.matchAll(/^\s+([A-Z][A-Z0-9_]+): optional/gms)].map((m) => m[1]);
const schemaKeys = new Set([...clientKeys, ...serverKeys]);

const inExample = new Set(Object.keys(example));
const inVercel = new Set(Object.keys(vercel));

const codeNotInExample = [...codeVars]
  .filter((v) => !inExample.has(v) && !FRAMEWORK_VARS.has(v))
  .sort();
const codeNotInSchema = [...codeVars]
  .filter((v) => !schemaKeys.has(v) && !FRAMEWORK_VARS.has(v))
  .sort();
const exampleNotInSchema = [...inExample].filter((v) => !schemaKeys.has(v)).sort();

const vercelInfra = /^(VERCEL_|TURBO_|NX_|POSTGRES_|SUPABASE_ANON|SUPABASE_URL|SUPABASE_PUBLISHABLE|SUPABASE_SECRET|SUPABASE_JWT)/;
const vercelNotInExample = [...inVercel]
  .filter((v) => !inExample.has(v) && !vercelInfra.test(v))
  .sort();

const vercelJson = JSON.parse(readFileSync(join(repoRoot, "vercel.json"), "utf8"));
const cronPaths = vercelJson.crons.map((c) => c.path);

const CRON_ENV_MAP = {
  "/api/cron/fi-reminder-jobs": ["FI_REMINDER_CRON_SECRET", "CRON_SECRET"],
  "/api/cron/leadflow/process-hubspot-events": ["FI_LEADFLOW_CRON_SECRET", "CRON_SECRET"],
  "/api/cron/iiohr-hr-perth-staff-sync": ["CRON_SECRET", "FI_HR_SYNC_CRON_SECRET"],
  "/api/cron/financial-os/automation": ["FINANCIAL_OS_CRON_SECRET", "CRON_SECRET"],
  "/api/cron/financial-os/pathway-task-escalation": ["FINANCIAL_OS_CRON_SECRET", "CRON_SECRET"],
  "/api/cron/financial-os/clearance-snapshots": ["FINANCIAL_OS_CRON_SECRET", "CRON_SECRET"],
  "/api/cron/seo-indexnow": ["CRON_SECRET"],
  "/api/cron/google-calendar/sync": ["FI_GOOGLE_CALENDAR_CRON_SECRET", "CRON_SECRET"],
  "/api/cron/platform-events/process": ["CRON_SECRET"],
  "/api/cron/workforce-time-clock-auto-close": ["CRON_SECRET"],
  "/api/cron/fi-imaging-ai-analysis": ["FI_IMAGING_AI_ANALYSIS_CRON_SECRET", "CRON_SECRET"],
};

function envStatus(env, key) {
  const v = env[key];
  if (v === undefined) return "absent";
  if (String(v).trim() === "") return "empty";
  return `set(${String(v).trim().length})`;
}

function isPresent(v) {
  return v !== undefined && String(v).trim() !== "";
}

console.log("=== FI OS ENV AUDIT ===\n");
console.log(`Code-referenced vars: ${codeVars.size}`);
console.log(`.env.example vars: ${inExample.size}`);
console.log(`.env.local vars: ${Object.keys(local).length}`);
console.log(`.env.vercel.production vars: ${inVercel.size}`);
console.log(`Zod schema vars: ${schemaKeys.size}`);

console.log("\n--- Local .env.local key coverage (non-empty) ---");
const localIssues = [];
for (const key of [...codeVars].filter((k) => !FRAMEWORK_VARS.has(k)).sort()) {
  if (!isPresent(local[key]) && inExample[key] !== undefined) {
    // only flag if example documents it as non-comment placeholder
    const ex = example[key];
    if (ex && ex.trim() && !ex.includes("your-") && !ex.includes("00000000")) continue;
  }
}
// Key local gaps for active modules
const localCritical = [
  "FI_MACHINE_INGEST_MASTER_KEY",
  "FI_IMAGING_AI_ANALYSIS_CRON_SECRET",
  "FI_HR_SYNC_CRON_SECRET",
  "WORKFORCE_COMPLIANCE_CRON_SECRET",
  "FI_INTERNAL_IMAGING_CLASSIFIER_TOKEN",
  "TWILIO_ACCOUNT_SID",
  "FI_REMINDERS_LIVE_DELIVERY",
];
for (const k of localCritical) {
  console.log(`  ${k}: ${envStatus(local, k)}`);
  if (!isPresent(local[k])) localIssues.push(k);
}

console.log("\n--- Vercel snapshot (.env.vercel.production) critical vars ---");
const vercelCritical = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "FI_BASE_URL",
  "CRON_SECRET",
  "FI_REMINDER_CRON_SECRET",
  "FINANCIAL_OS_CRON_SECRET",
  "FI_PAYMENTS_CRON_SECRET",
  "FI_LEADFLOW_CRON_SECRET",
  "FI_GOOGLE_CALENDAR_CRON_SECRET",
  "FI_ADMIN_API_KEY",
  "FI_ADMIN_API_KEY_TENANT_ALLOWLIST",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "FI_TIMELY_WEBHOOK_SECRET",
  "FI_HUBSPOT_WEBHOOK_SECRET",
  "IIOHR_HR_SYNC_SECRET",
  "EVOLVED_PERTH_TENANT_ID",
  "IIOHR_HR_PERTH_STAFF_FEED_URL",
  "FI_EXTERNAL_CONNECTOR_MASTER_KEY",
  "GOOGLE_CALENDAR_CLIENT_ID",
  "GOOGLE_CALENDAR_CLIENT_SECRET",
  "GOOGLE_CALENDAR_REDIRECT_URI",
  "FI_IMAGING_AI_ANALYSIS_CRON_SECRET",
  "FI_MACHINE_INGEST_MASTER_KEY",
  "PATHOLOGY_EMAIL_INGESTION_ENABLED",
  "PATHOLOGY_EMAIL_WEBHOOK_SECRET",
];
const vercelIssues = [];
for (const k of vercelCritical) {
  const st = envStatus(vercel, k);
  console.log(`  ${k}: ${st}`);
  if (st === "empty" || st === "absent") vercelIssues.push(k);
}

console.log("\n--- vercel.json cron → required env ---");
for (const path of cronPaths) {
  const base = path.split("?")[0];
  const keys = CRON_ENV_MAP[base] ?? CRON_ENV_MAP[path] ?? ["CRON_SECRET"];
  const coverage = keys.map((k) => `${k}=${envStatus(vercel, k)}`).join(", ");
  const ok = keys.some((k) => isPresent(vercel[k]) && vercel[k].trim().length >= 16) || isPresent(vercel.CRON_SECRET);
  console.log(`  ${path}`);
  console.log(`    env: ${coverage} → ${ok ? "OK (if values non-empty on Vercel)" : "GAP in snapshot"}`);
}

console.log(`\n--- Code vars NOT in .env.example (${codeNotInExample.length}) ---`);
console.log(codeNotInExample.join(", ") || "(none)");

console.log(`\n--- Code vars NOT in Zod schema (${codeNotInSchema.length}) ---`);
console.log(codeNotInSchema.join(", ") || "(none)");

console.log(`\n--- .env.example vars NOT in Zod schema (${exampleNotInSchema.length}) ---`);
console.log(exampleNotInSchema.join(", ") || "(none)");

console.log(`\n--- Vercel snapshot vars not in .env.example ---`);
console.log(vercelNotInExample.join(", ") || "(none)");

console.log("\n--- .env.example issues ---");
const dupes = [];
const seen = new Set();
for (const k of Object.keys(example)) {
  if (seen.has(k)) dupes.push(k);
  seen.add(k);
}
// manual duplicate check from file
const exampleRaw = readFileSync(join(repoRoot, ".env.example"), "utf8");
const keyCounts = {};
for (const line of exampleRaw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq <= 0) continue;
  const key = t.slice(0, eq).trim();
  keyCounts[key] = (keyCounts[key] ?? 0) + 1;
}
const duplicateKeys = Object.entries(keyCounts).filter(([, c]) => c > 1).map(([k]) => k);
if (duplicateKeys.length) console.log("  Duplicate keys:", duplicateKeys.join(", "));
else console.log("  No duplicate keys");

console.log("\n--- Summary ---");
console.log(`Local gaps (optional/critical unset): ${localIssues.length ? localIssues.join(", ") : "none flagged"}`);
console.log(`Vercel snapshot empty/absent critical: ${vercelIssues.length ? vercelIssues.join(", ") : "none (snapshot may be redacted — use vercel env ls)"}`);