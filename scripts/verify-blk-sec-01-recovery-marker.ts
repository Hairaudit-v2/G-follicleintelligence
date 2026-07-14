/**
 * BLK-SEC-01 E4 — recovery marker verify (read-only).
 *
 * Runbooks do not define a separate marker insert table. This drill uses the
 * existing Evolved SMOKETEST journey synthetic rows already on production
 * (SMOKETEST- prefix per clinic readiness) as the recoverability probe.
 *
 * Usage (production pre-restore or staging post-restore):
 *   node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/verify-blk-sec-01-recovery-marker.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Never restores; never writes.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const MARKER_ID = "SMOKETEST-JOURNEY-001-20260630";
const TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const LEAD_ID = "66b47348-bf0e-48b7-a188-accbee0db4a3";
const CASE_ID = "efa25110-9dbc-4599-8fbd-3670e8921efd";
const PATIENT_ID = "51a44cf6-e4de-4282-960c-be220909f9a0";
const BOOKING_ID = "f53f63aa-3d8a-4e36-9646-f26dd5e16af9";

function loadRepoEnvFiles(): void {
  for (const name of [".env.local", ".env"] as const) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    let raw = readFileSync(p, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
      const eq = withoutExport.indexOf("=");
      if (eq <= 0) continue;
      const key = withoutExport.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      let val = withoutExport.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

loadRepoEnvFiles();

type Row = { id: string; tenant_id?: string; created_at?: string; summary?: string } | null;

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const verifiedAtUtc = new Date().toISOString();

  const [lead, cse, patient, booking] = await Promise.all([
    sb.from("fi_crm_leads").select("id, tenant_id, summary, created_at").eq("id", LEAD_ID).maybeSingle(),
    sb.from("fi_cases").select("id, tenant_id, created_at").eq("id", CASE_ID).maybeSingle(),
    sb.from("fi_patients").select("id, tenant_id, created_at").eq("id", PATIENT_ID).maybeSingle(),
    sb.from("fi_bookings").select("id, tenant_id, created_at").eq("id", BOOKING_ID).maybeSingle(),
  ]);

  const result = {
    markerId: MARKER_ID,
    tenantId: TENANT_ID,
    envHost: new URL(url).host,
    verifiedAtUtc,
    mode: "read-only",
    rows: {
      fi_crm_leads: (lead.error ? { error: lead.error.message } : lead.data) as Row | { error: string },
      fi_cases: (cse.error ? { error: cse.error.message } : cse.data) as Row | { error: string },
      fi_patients: (patient.error ? { error: patient.error.message } : patient.data) as Row | {
        error: string;
      },
      fi_bookings: (booking.error ? { error: booking.error.message } : booking.data) as Row | {
        error: string;
      },
    },
  };

  const pass =
    !!lead.data?.id &&
    lead.data.tenant_id === TENANT_ID &&
    !!cse.data?.id &&
    cse.data.tenant_id === TENANT_ID &&
    !!patient.data?.id &&
    patient.data.tenant_id === TENANT_ID &&
    !!booking.data?.id &&
    booking.data.tenant_id === TENANT_ID;

  console.log(JSON.stringify({ ...result, pass }, null, 2));

  const outPath = resolve(
    process.cwd(),
    "docs/production/evidence/attachments/blk-sec-01-recovery-marker-verify.json"
  );
  writeFileSync(outPath, JSON.stringify({ ...result, pass }, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outPath}`);

  if (!pass) {
    console.error("FAIL: recovery marker rows missing or tenant mismatch");
    process.exit(2);
  }
  console.log("PASS: recovery marker present");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
