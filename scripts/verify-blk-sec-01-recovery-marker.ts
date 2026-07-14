/**
 * BLK-SEC-01 E4 — recovery marker verify (read-only).
 *
 * Canonical probe (within 7-day PITR): SMOKETEST-RECOVERY-MARKER-20260714 lead.
 * Legacy probe (outside 7d as of 2026-07-14): SMOKETEST-JOURNEY-001-20260630
 * journey rows — still reported for history, not required for PASS.
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

const TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";

/** Primary E4 marker — must sit inside current PITR retention (7 days). */
const PRIMARY_MARKER_ID = "SMOKETEST-RECOVERY-MARKER-20260714";

/** Optional override if a later seed wrote a different lead UUID. */
const PRIMARY_LEAD_ID_ENV = process.env.BLK_SEC_01_RECOVERY_LEAD_ID?.trim() || null;

/** Legacy journey marker (superseded for 7-day PITR drills). */
const LEGACY_MARKER_ID = "SMOKETEST-JOURNEY-001-20260630";
const LEGACY_LEAD_ID = "66b47348-bf0e-48b7-a188-accbee0db4a3";
const LEGACY_CASE_ID = "efa25110-9dbc-4599-8fbd-3670e8921efd";
const LEGACY_PATIENT_ID = "51a44cf6-e4de-4282-960c-be220909f9a0";
const LEGACY_BOOKING_ID = "f53f63aa-3d8a-4e36-9646-f26dd5e16af9";

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

  let primaryLeadQuery = sb
    .from("fi_crm_leads")
    .select("id, tenant_id, summary, created_at")
    .eq("tenant_id", TENANT_ID);

  if (PRIMARY_LEAD_ID_ENV) {
    primaryLeadQuery = primaryLeadQuery.eq("id", PRIMARY_LEAD_ID_ENV);
  } else {
    primaryLeadQuery = primaryLeadQuery.ilike("summary", `${PRIMARY_MARKER_ID}%`);
  }

  const [primaryLead, legacyLead, legacyCase, legacyPatient, legacyBooking] = await Promise.all([
    primaryLeadQuery.order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("fi_crm_leads").select("id, tenant_id, summary, created_at").eq("id", LEGACY_LEAD_ID).maybeSingle(),
    sb.from("fi_cases").select("id, tenant_id, created_at").eq("id", LEGACY_CASE_ID).maybeSingle(),
    sb.from("fi_patients").select("id, tenant_id, created_at").eq("id", LEGACY_PATIENT_ID).maybeSingle(),
    sb.from("fi_bookings").select("id, tenant_id, created_at").eq("id", LEGACY_BOOKING_ID).maybeSingle(),
  ]);

  const primaryOk =
    !!primaryLead.data?.id &&
    primaryLead.data.tenant_id === TENANT_ID &&
    typeof primaryLead.data.summary === "string" &&
    primaryLead.data.summary.includes(PRIMARY_MARKER_ID);

  const legacyOk =
    !!legacyLead.data?.id &&
    legacyLead.data.tenant_id === TENANT_ID &&
    !!legacyCase.data?.id &&
    legacyCase.data.tenant_id === TENANT_ID &&
    !!legacyPatient.data?.id &&
    legacyPatient.data.tenant_id === TENANT_ID &&
    !!legacyBooking.data?.id &&
    legacyBooking.data.tenant_id === TENANT_ID;

  const createdAt = primaryLead.data?.created_at ?? null;
  const earliestPitrAfterMarkerUtc = createdAt
    ? new Date(new Date(createdAt).getTime() + 1000).toISOString()
    : null;

  const result = {
    markerId: PRIMARY_MARKER_ID,
    legacyMarkerId: LEGACY_MARKER_ID,
    tenantId: TENANT_ID,
    envHost: new URL(url).host,
    verifiedAtUtc,
    mode: "read-only",
    primaryPass: primaryOk,
    legacyPresent: legacyOk,
    pass: primaryOk,
    earliestPitrAfterMarkerUtc,
    note:
      "PASS requires primary SMOKETEST-RECOVERY-MARKER lead (7-day PITR window). Legacy Jun-30 journey is informational only.",
    rows: {
      primary_fi_crm_leads: (primaryLead.error
        ? { error: primaryLead.error.message }
        : primaryLead.data) as Row | { error: string },
      legacy_fi_crm_leads: (legacyLead.error
        ? { error: legacyLead.error.message }
        : legacyLead.data) as Row | { error: string },
      legacy_fi_cases: (legacyCase.error
        ? { error: legacyCase.error.message }
        : legacyCase.data) as Row | { error: string },
      legacy_fi_patients: (legacyPatient.error
        ? { error: legacyPatient.error.message }
        : legacyPatient.data) as Row | { error: string },
      legacy_fi_bookings: (legacyBooking.error
        ? { error: legacyBooking.error.message }
        : legacyBooking.data) as Row | { error: string },
    },
  };

  console.log(JSON.stringify(result, null, 2));

  const outPath = resolve(
    process.cwd(),
    "docs/production/evidence/attachments/blk-sec-01-recovery-marker-verify.json"
  );
  writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outPath}`);

  if (!primaryOk) {
    console.error("FAIL: primary recovery marker lead missing or tenant mismatch");
    process.exit(2);
  }
  console.log("PASS: primary recovery marker present");
  if (createdAt && earliestPitrAfterMarkerUtc) {
    console.log(`Marker created_at (UTC): ${createdAt}`);
    console.log(`Earliest PITR restore timestamp (UTC, after marker): ${earliestPitrAfterMarkerUtc}`);
    console.log("Constraint: PITR timestamp must also be within 7-day retention.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
