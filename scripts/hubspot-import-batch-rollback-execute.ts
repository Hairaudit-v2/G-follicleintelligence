/**
 * Destructive rollback for a HubSpot Stage 1 batch — ONLY when audit is clean.
 *
 *   FI_HUBSPOT_ROLLBACK_CONFIRM=<batchId> npx tsx scripts/hubspot-import-batch-rollback-execute.ts <batchId>
 *
 * Never targets protected pilot batch(es). Refuses if FI_HUBSPOT_ROLLBACK_CONFIRM !== batchId
 * or if clinical/booking anchors exist (same rules as rollback plan).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import {
  PROTECTED_HUBSPOT_IMPORT_BATCH_IDS,
  auditHubspotImportBatch,
  chunks,
  loadPersonPatientLeadIdsForImportBatch,
} from "./hubspotImportBatchRollbackShared";

const CHUNK = 100;

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
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const batchId = (process.argv[2] ?? "").trim();
  if (!batchId) {
    console.error("Usage: FI_HUBSPOT_ROLLBACK_CONFIRM=<batchId> npx tsx scripts/hubspot-import-batch-rollback-execute.ts <batchId>");
    process.exit(1);
  }

  const bidLower = batchId.toLowerCase();
  if (PROTECTED_HUBSPOT_IMPORT_BATCH_IDS.has(bidLower)) {
    console.error(
      JSON.stringify(
        {
          error: "This batch id is protected and cannot be rolled back by this script.",
          batch_id: batchId,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const confirm = process.env.FI_HUBSPOT_ROLLBACK_CONFIRM?.trim() ?? "";
  if (confirm !== batchId) {
    console.error(
      JSON.stringify(
        {
          error: "FI_HUBSPOT_ROLLBACK_CONFIRM must exactly equal the batch UUID (argv).",
          batch_id: batchId,
          FI_HUBSPOT_ROLLBACK_CONFIRM: confirm || null,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const preAudit = await auditHubspotImportBatch(supabase, batchId);
  if (preAudit.batch_status === "rolled_back") {
    console.log(
      JSON.stringify(
        {
          ok: true,
          skipped: "batch_already_rolled_back",
          pre_rollback_audit: preAudit,
        },
        null,
        2
      )
    );
    return;
  }
  if (!preAudit.safe_to_rollback) {
    console.error(
      JSON.stringify(
        {
          error: "Pre-rollback audit failed: not safe_to_rollback (see plan output).",
          ...preAudit,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const { data: batchRow, error: be } = await supabase
    .from("fi_import_batches")
    .select("tenant_id, metadata")
    .eq("id", batchId)
    .single();
  if (be) throw new Error(be.message);
  const tenantId = String((batchRow as { tenant_id: string }).tenant_id);
  const prevMeta =
    (batchRow as { metadata?: unknown }).metadata && typeof (batchRow as { metadata: unknown }).metadata === "object" &&
    !Array.isArray((batchRow as { metadata: unknown }).metadata)
      ? ((batchRow as { metadata: Record<string, unknown> }).metadata as Record<string, unknown>)
      : {};

  const { personIds, patientIds, leadIds } = await loadPersonPatientLeadIdsForImportBatch(supabase, tenantId, batchId);

  for (const slice of chunks(leadIds, CHUNK)) {
    const { error } = await supabase.from("fi_reminder_jobs").delete().eq("tenant_id", tenantId).in("lead_id", slice);
    if (error) throw new Error(`fi_reminder_jobs (lead_id): ${error.message}`);
  }
  for (const slice of chunks(personIds, CHUNK)) {
    const { error } = await supabase.from("fi_reminder_jobs").delete().eq("tenant_id", tenantId).in("person_id", slice);
    if (error) throw new Error(`fi_reminder_jobs (person_id): ${error.message}`);
  }

  const { error: stgErr } = await supabase.from("stg_hubspot_contacts_imports").delete().eq("import_batch_id", batchId);
  if (stgErr && stgErr.code !== "42P01") {
    throw new Error(`stg_hubspot_contacts_imports: ${stgErr.message}`);
  }

  for (const slice of chunks(leadIds, CHUNK)) {
    const { error } = await supabase.from("fi_crm_leads").delete().eq("tenant_id", tenantId).in("id", slice);
    if (error) throw new Error(`fi_crm_leads: ${error.message}`);
  }

  for (const slice of chunks(patientIds, CHUNK)) {
    const { error } = await supabase.from("fi_patients").delete().eq("tenant_id", tenantId).in("id", slice);
    if (error) throw new Error(`fi_patients: ${error.message}`);
  }

  for (const slice of chunks(personIds, CHUNK)) {
    const { error } = await supabase.from("fi_persons").delete().eq("tenant_id", tenantId).in("id", slice);
    if (error) throw new Error(`fi_persons: ${error.message}`);
  }

  const rolledIso = new Date().toISOString();
  const { error: ue } = await supabase
    .from("fi_import_batches")
    .update({
      status: "rolled_back",
      rolled_back_at: rolledIso,
      metadata: {
        ...prevMeta,
        rollback: {
          script: "hubspot-import-batch-rollback-execute",
          rolled_back_at: rolledIso,
          prior_status: preAudit.batch_status,
        },
      },
    })
    .eq("id", batchId)
    .eq("tenant_id", tenantId);
  if (ue) throw new Error(ue.message);

  const postAudit = await auditHubspotImportBatch(supabase, batchId);

  console.log(
    JSON.stringify(
      {
        ok: true,
        batch_id: batchId,
        pre_rollback_audit: preAudit,
        post_rollback_audit: postAudit,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
