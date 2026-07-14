#!/usr/bin/env tsx
/**
 * BLK-SEC-01 E4 — seed a non-PHI recovery marker lead on Evolved production.
 *
 * Inserts (or reuses) a clearly tagged SMOKETEST fi_crm_leads row so PITR drills
 * have a recoverability probe within the current 7-day retention window.
 *
 * Usage:
 *   node scripts/run-with-system-ca.mjs node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/seed-blk-sec-01-recovery-marker.ts
 *   ... --commit
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Never restores; never writes real PHI.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { createCrmLeadWithPerson } from "../src/lib/crm/leads";
import { ensureDefaultPipelineStages } from "../src/lib/crm/pipeline";

const TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const MARKER_ID = "SMOKETEST-RECOVERY-MARKER-20260714";
const SUMMARY = `${MARKER_ID} SMOKETEST-LEAD recovery probe (non-PHI)`;
const DEMO_EMAIL = "recovery-marker.smoketest-20260714@evolved-smoketest.invalid";
const DEMO_PHONE = "0000000000";
const DEMO_NAME = "SMOKETEST-Recovery Marker";

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

const commit = process.argv.includes("--commit");

async function main(): Promise<void> {
  const sb = supabaseAdmin();
  const envHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()).host;

  const { data: existing, error: existingErr } = await sb
    .from("fi_crm_leads")
    .select("id, tenant_id, summary, created_at")
    .eq("tenant_id", TENANT_ID)
    .ilike("summary", `${MARKER_ID}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingErr) throw new Error(existingErr.message);

  if (existing?.id) {
    const result = {
      markerId: MARKER_ID,
      tenantId: TENANT_ID,
      envHost,
      mode: "idempotent-reuse",
      lead: existing,
      committed: false,
    };
    console.log(JSON.stringify(result, null, 2));
    writeManifest(result);
    console.log(`Reused existing marker lead ${existing.id} (created_at=${existing.created_at})`);
    return;
  }

  if (!commit) {
    console.log(
      JSON.stringify(
        {
          markerId: MARKER_ID,
          tenantId: TENANT_ID,
          envHost,
          mode: "dry-run",
          wouldInsert: { summary: SUMMARY, email: DEMO_EMAIL, displayName: DEMO_NAME },
        },
        null,
        2
      )
    );
    console.log("DRY-RUN: re-run with --commit to insert the recovery marker lead.");
    return;
  }

  await ensureDefaultPipelineStages({ tenantId: TENANT_ID }, sb);
  const lead = await createCrmLeadWithPerson(
    {
      tenantId: TENANT_ID,
      summary: SUMMARY,
      metadata: {
        smoketest: true,
        recovery_marker: true,
        marker_id: MARKER_ID,
        drill: "BLK-SEC-01",
      },
      person: {
        display_name: DEMO_NAME,
        email: DEMO_EMAIL,
        phone: DEMO_PHONE,
      },
    },
    sb
  );

  const { data: row, error: rowErr } = await sb
    .from("fi_crm_leads")
    .select("id, tenant_id, summary, created_at")
    .eq("id", lead.id)
    .single();
  if (rowErr) throw new Error(rowErr.message);

  const result = {
    markerId: MARKER_ID,
    tenantId: TENANT_ID,
    envHost,
    mode: "inserted",
    lead: row,
    committed: true,
  };
  console.log(JSON.stringify(result, null, 2));
  writeManifest(result);
  console.log(`PASS: inserted recovery marker lead ${row.id} at ${row.created_at}`);
}

function writeManifest(result: unknown): void {
  const outPath = resolve(
    process.cwd(),
    "docs/production/evidence/attachments/blk-sec-01-recovery-marker-seed.json"
  );
  writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
