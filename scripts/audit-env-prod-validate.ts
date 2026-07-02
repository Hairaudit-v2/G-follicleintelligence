import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { validateFullEnv } from "../src/lib/env/schema";

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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

const root = resolve(__dirname, "..");
const local = parseEnvFile(resolve(root, ".env.local"));

console.log("=== .env.local as production ===");
const localProd = validateFullEnv({ ...local, NODE_ENV: "production", VERCEL_ENV: "production" });
if (!localProd.ok) {
  for (const i of localProd.issues) console.log(`${i.variable}\t${i.message}`);
  process.exit(1);
}
console.log("PASS");

// Module readiness matrix (presence only — no secret values)
type ModuleCheck = { module: string; vars: string[]; note?: string };
const checks: ModuleCheck[] = [
  { module: "Core Supabase", vars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] },
  { module: "Vercel crons (shared)", vars: ["CRON_SECRET"] },
  { module: "ReminderOS cron", vars: ["FI_REMINDER_CRON_SECRET", "CRON_SECRET"], note: "either ≥16 chars" },
  { module: "LeadFlow HubSpot cron", vars: ["FI_LEADFLOW_CRON_SECRET", "CRON_SECRET"], note: "either" },
  { module: "HR Perth sync cron", vars: ["CRON_SECRET", "EVOLVED_PERTH_TENANT_ID", "IIOHR_HR_PERTH_STAFF_FEED_URL"] },
  { module: "FinancialOS crons", vars: ["FINANCIAL_OS_CRON_SECRET", "CRON_SECRET"], note: "either" },
  { module: "Google Calendar cron", vars: ["FI_GOOGLE_CALENDAR_CRON_SECRET", "GOOGLE_CALENDAR_CLIENT_ID", "FI_EXTERNAL_CONNECTOR_MASTER_KEY"] },
  { module: "Imaging AI cron", vars: ["CRON_SECRET"], note: "FI_IMAGING_AI_ANALYSIS_CRON_SECRET optional alias" },
  { module: "Timely webhooks", vars: ["FI_TIMELY_WEBHOOK_SECRET"] },
  { module: "HubSpot webhooks", vars: ["FI_HUBSPOT_WEBHOOK_SECRET"] },
  { module: "IIOHR staff-sync POST", vars: ["IIOHR_HR_SYNC_SECRET"] },
  { module: "Machine ingest HMAC", vars: ["FI_MACHINE_INGEST_MASTER_KEY"], note: "≥32 chars in prod when ingest used" },
  { module: "OpenAI / DoctorOS", vars: ["OPENAI_API_KEY"] },
  { module: "Email reminders (live)", vars: ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "FI_REMINDERS_LIVE_DELIVERY"] },
  { module: "Pathology email ingest", vars: ["PATHOLOGY_EMAIL_INGESTION_ENABLED", "PATHOLOGY_EMAIL_WEBHOOK_SECRET"] },
  { module: "Internal imaging classify", vars: ["FI_INTERNAL_IMAGING_CLASSIFIER_TOKEN", "HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN"], note: "either" },
  { module: "ReceptionOS comms safety", vars: ["RECEPTION_OS_COMMUNICATION_DRY_RUN"] },
];

function present(k: string): boolean {
  const v = local[k];
  return v !== undefined && v.trim() !== "";
}

console.log("\n=== Local module readiness ===");
for (const c of checks) {
  const ok = c.vars.some((k) => present(k) && local[k].trim().length >= (k.includes("SECRET") || k.includes("KEY") ? 16 : 1));
  const detail = c.vars.map((k) => `${k}=${present(k) ? "✓" : "✗"}`).join(", ");
  console.log(`${ok ? "OK" : "GAP"}  ${c.module}: ${detail}${c.note ? ` (${c.note})` : ""}`);
}