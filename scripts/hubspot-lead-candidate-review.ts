/**
 * FI-HUBSPOT-IMPORT-1E-C — controlled new-lead candidate review and first batch.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const INTEGRATION_ID = "ade8a7d0-ad45-4fd7-8d53-61d4806b95f6";
const FIXED_INVENTORY_CHECKSUM =
  "3d380a980ad1a0a2ba246742c9ccee5ba7f37a39c3f29e15e572fb175365079c";
const SOURCE_CUTOFF = "2026-07-16T16:00:34.530Z";

function loadEnv(): void {
  for (const name of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
      const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

function has(flag: string): boolean {
  return process.argv.includes(flag);
}

function value(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith("--")
    ? process.argv[index + 1]
    : null;
}

async function main(): Promise<void> {
  loadEnv();
  const [{ supabaseAdmin }, review, expansion] = await Promise.all([
    import("@/lib/supabaseAdmin"),
    import("@/src/lib/integrations/hubspot/import/hubspotLeadCandidateReview.server"),
    import("@/src/lib/integrations/hubspot/import/hubspotContactLeadExpansion.server"),
  ]);
  const supabase = supabaseAdmin();
  const output = value("--output-json");
  const mode = [
    "inventory",
    "classify",
    "preview",
    "apply",
    "replay",
    "reconcile",
    "rollback-preview",
  ].find((candidate) => has(`--${candidate}`));
  if (!mode) throw new Error("Choose a 1E-C mode");

  const count = async (table: string): Promise<number> => {
    const { count: result, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID);
    if (error) throw new Error(`${table}: ${error.message}`);
    return result ?? 0;
  };
  const snapshot = async () => {
    const tables = [
      "fi_crm_leads",
      "fi_persons",
      "fi_person_source_ids",
      "fi_patients",
      "fi_staff",
      "fi_users",
      "fi_crm_tasks",
      "fi_crm_messages",
      "fi_reception_tasks",
      "fi_admin_notifications",
      "fi_bookings",
    ] as const;
    const counts = Object.fromEntries(
      await Promise.all(tables.map(async (table) => [table, await count(table)]))
    );
    const { count: mappings, error: mappingsError } = await supabase
      .from("fi_external_record_mappings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .eq("integration_id", INTEGRATION_ID)
      .eq("source_provider", "hubspot")
      .eq("source_entity_type", "contact")
      .eq("fi_entity_type", "lead");
    if (mappingsError) throw new Error(mappingsError.message);
    const { data: watermarks, error: watermarkError } = await supabase
      .from("fi_external_hubspot_backup_watermarks")
      .select("source_system,dataset,watermark_timestamp,version")
      .eq("tenant_id", TENANT_ID)
      .order("dataset");
    if (watermarkError) throw new Error(watermarkError.message);
    return { counts, mappings: mappings ?? 0, watermarks: watermarks ?? [] };
  };

  const before = await snapshot();
  const common = {
    tenantId: TENANT_ID,
    integrationId: INTEGRATION_ID,
    fixedInventoryChecksum: FIXED_INVENTORY_CHECKSUM,
    sourceCutoff: SOURCE_CUTOFF,
  };
  let result: unknown;
  if (mode === "inventory") {
    result = await review.buildLeadCandidateReviewWorkspace(supabase, common);
  } else if (mode === "classify") {
    result = await review.persistLeadCandidateReview(supabase, {
      ...common,
      operatorLabel: "1e-c-controlled-classification",
    });
  } else if (mode === "preview") {
    result = await review.previewLeadCandidateBatch(supabase, common);
  } else if (mode === "apply") {
    const batchId = value("--batch-id");
    const checksum = value("--checksum");
    if (!batchId || !checksum) throw new Error("--batch-id and --checksum required");
    result = await review.applyLeadCandidateBatch(supabase, {
      ...common,
      batchId,
      checksum,
      confirmToken: process.env.FI_HUBSPOT_CONTACT_LEAD_EXPANSION_CONFIRM?.trim() ?? "",
      actorLabel: "1e-c-first-create-batch",
    });
  } else if (mode === "replay") {
    const batchId = value("--batch-id");
    const checksum = value("--checksum");
    if (!batchId || !checksum) throw new Error("--batch-id and --checksum required");
    result = await expansion.applyContactLeadExpansionBatch(supabase, {
      tenantId: TENANT_ID,
      integrationId: INTEGRATION_ID,
      approvedBatchId: batchId,
      confirmToken: process.env.FI_HUBSPOT_CONTACT_LEAD_EXPANSION_CONFIRM?.trim() ?? "",
      expectedChecksum: checksum,
      actorLabel: "1e-c-replay",
    });
  } else if (mode === "reconcile") {
    const batchId = value("--batch-id");
    if (!batchId) throw new Error("--batch-id required");
    result = await expansion.reconcileContactLeadExpansionBatch(supabase, {
      tenantId: TENANT_ID,
      batchId,
    });
  } else {
    const batchId = value("--batch-id");
    if (!batchId) throw new Error("--batch-id required");
    result = await expansion.previewRollbackContactLeadExpansionBatch(supabase, {
      tenantId: TENANT_ID,
      batchId,
    });
  }
  const after = await snapshot();
  const delta = {
    leads: after.counts.fi_crm_leads - before.counts.fi_crm_leads,
    persons: after.counts.fi_persons - before.counts.fi_persons,
    personSourceIds:
      after.counts.fi_person_source_ids - before.counts.fi_person_source_ids,
    mappings: after.mappings - before.mappings,
  };
  for (const table of [
    "fi_patients",
    "fi_staff",
    "fi_users",
    "fi_crm_tasks",
    "fi_crm_messages",
    "fi_reception_tasks",
    "fi_admin_notifications",
    "fi_bookings",
  ] as const) {
    if (after.counts[table] !== before.counts[table]) {
      throw new Error(`SIDE_EFFECT_GUARD: ${table} changed during ${mode}`);
    }
  }
  if (JSON.stringify(after.watermarks) !== JSON.stringify(before.watermarks)) {
    throw new Error(`WATERMARK_GUARD: dataset watermark changed during ${mode}`);
  }
  const privacySafeResult =
    mode === "inventory" || mode === "classify"
      ? {
          ...(result as {
            inventoryChecksum: string;
            candidateChecksum: string;
            stateCounts: Record<string, number>;
            rows: Array<{
              hubspotContactId: string;
              state: string;
              reasonCode: string;
              approvedForApply: boolean;
              sourceUpdatedAt: string | null;
              sourcePayloadChecksum: string | null;
              checks: Record<string, unknown>;
            }>;
          }),
          rows: (result as { rows: Array<Record<string, unknown>> }).rows.map((row) => ({
            hubspotContactId: row.hubspotContactId,
            state: row.state,
            reasonCode: row.reasonCode,
            approvedForApply: row.approvedForApply,
            sourceUpdatedAt: row.sourceUpdatedAt,
            sourcePayloadChecksum: row.sourcePayloadChecksum,
            checks: row.checks,
          })),
        }
      : result;
  const report = {
    milestone: "FI-HUBSPOT-IMPORT-1E-C",
    mode,
    tenantId: TENANT_ID,
    integrationId: INTEGRATION_ID,
    fixedInventoryChecksum: FIXED_INVENTORY_CHECKSUM,
    sourceCutoff: SOURCE_CUTOFF,
    before,
    after,
    delta,
    result: privacySafeResult,
  };
  const json = JSON.stringify(report, null, 2);
  process.stdout.write(json + "\n");
  if (output) {
    const path = resolve(process.cwd(), output);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, json, "utf8");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
