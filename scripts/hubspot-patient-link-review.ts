/**
 * FI-HUBSPOT-IMPORT-1E-P — read-only patient-link clinical identity interim review.
 * Never applies patient links. Next gate after approval: FI-HUBSPOT-IMPORT-1E-Q.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const INTEGRATION_ID = "ade8a7d0-ad45-4fd7-8d53-61d4806b95f6";
const FIXED_INVENTORY_CHECKSUM =
  "93823b3d3a322ca23abd85bea8439a0188ac71fdc1c5f8420965a34e16b10451";
const BASE_INVENTORY_CHECKSUM =
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
  const [{ supabaseAdmin }, review] = await Promise.all([
    import("@/lib/supabaseAdmin"),
    import("@/src/lib/integrations/hubspot/import/hubspotPatientLinkReview.server"),
  ]);
  const supabase = supabaseAdmin();
  const output = value("--output-json");
  const mode = ["inventory", "classify", "preview", "apply"].find((candidate) =>
    has(`--${candidate}`)
  );
  if (!mode) throw new Error("Choose a 1E-P mode: --inventory | --classify | --preview | --apply");

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
      "fi_patient_source_ids",
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
    const { count: patientMappings, error: patientMapError } = await supabase
      .from("fi_external_record_mappings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .eq("integration_id", INTEGRATION_ID)
      .eq("source_provider", "hubspot")
      .eq("source_entity_type", "contact")
      .eq("fi_entity_type", "patient");
    if (patientMapError) throw new Error(patientMapError.message);
    const { data: watermarks, error: watermarkError } = await supabase
      .from("fi_external_hubspot_backup_watermarks")
      .select("source_system,dataset,watermark_timestamp,version")
      .eq("tenant_id", TENANT_ID)
      .order("dataset");
    if (watermarkError) throw new Error(watermarkError.message);
    return {
      counts,
      mappings: mappings ?? 0,
      patientMappings: patientMappings ?? 0,
      watermarks: watermarks ?? [],
    };
  };

  const before = await snapshot();
  const common = {
    tenantId: TENANT_ID,
    integrationId: INTEGRATION_ID,
    fixedInventoryChecksum: FIXED_INVENTORY_CHECKSUM,
    sourceCutoff: SOURCE_CUTOFF,
    operatorLabel: "1e-p-interim-operator",
    actorRole: "clinic_admin",
  };

  let result: unknown;
  if (mode === "inventory") {
    result = await review.buildPatientLinkReviewWorkspace(supabase, common);
  } else if (mode === "classify") {
    result = await review.persistPatientLinkReview(supabase, common);
  } else if (mode === "preview") {
    result = await review.previewPatientLinkBatch(supabase, common);
  } else {
    const checksum = value("--checksum");
    if (!checksum) throw new Error("--checksum required for apply probe");
    try {
      await review.applyPatientLinkBatch(supabase, {
        explicitHumanApproval: has("--explicit-human-approval"),
        approvalToken: value("--approval-token"),
        expectedChecksum: checksum,
        reviewChecksum: checksum,
      });
    } catch (error) {
      result = {
        blocked: true,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const after = await snapshot();
  for (const table of [
    "fi_patients",
    "fi_patient_source_ids",
    "fi_crm_leads",
    "fi_persons",
    "fi_person_source_ids",
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
  if (after.mappings !== before.mappings || after.patientMappings !== before.patientMappings) {
    throw new Error("SIDE_EFFECT_GUARD: mapping counts changed during 1E-P interim");
  }
  if (JSON.stringify(after.watermarks) !== JSON.stringify(before.watermarks)) {
    throw new Error(`WATERMARK_GUARD: dataset watermark changed during ${mode}`);
  }

  const privacySafeResult = (() => {
    if (mode !== "inventory" && mode !== "classify" && mode !== "preview") return result;
    const workspace = result as {
      inventoryChecksum?: string;
      reviewChecksum?: string;
      stateCounts?: Record<string, number>;
      frozenContactIds?: string[];
      mutationPlan?: unknown;
      rows?: Array<Record<string, unknown>>;
      approvedForLaterApply?: unknown;
      proposedProductionLinkCount?: number;
      applyEnabled?: boolean;
      nextGate?: string;
      plainLanguage?: unknown;
    };
    const rows = (workspace.rows ?? []).map((row) => ({
      hubspotContactId: row.hubspotContactId,
      displayNameMasked: row.displayNameMasked,
      emailPresent: row.emailPresent,
      phonePresent: row.phonePresent,
      state: row.state,
      reasonCode: row.reasonCode,
      confidence: row.confidence,
      approvedForApply: row.approvedForApply,
      possiblePatientTargetId: row.possiblePatientTargetId,
      relatedLeadId: row.relatedLeadId,
      plainLanguageEvidence: row.plainLanguageEvidence,
      warnings: row.warnings,
      sourceUpdatedAt: row.sourceUpdatedAt,
      sourcePayloadChecksum: row.sourcePayloadChecksum,
      inventoryReasonCode: row.inventoryReasonCode,
      operatorLabel: row.operatorLabel,
      reviewedAt: row.reviewedAt,
      checks: row.checks,
    }));
    return {
      inventoryChecksum: workspace.inventoryChecksum,
      reviewChecksum: workspace.reviewChecksum,
      stateCounts: workspace.stateCounts,
      frozenContactIds: workspace.frozenContactIds,
      mutationPlan: workspace.mutationPlan,
      approvedForLaterApply: workspace.approvedForLaterApply,
      proposedProductionLinkCount: workspace.proposedProductionLinkCount,
      applyEnabled: workspace.applyEnabled ?? false,
      nextGate: workspace.nextGate ?? "FI-HUBSPOT-IMPORT-1E-Q",
      plainLanguage: workspace.plainLanguage,
      rows,
    };
  })();

  const report = {
    milestone: "FI-HUBSPOT-IMPORT-1E-P",
    mode,
    tenantId: TENANT_ID,
    integrationId: INTEGRATION_ID,
    fixedInventoryChecksum: FIXED_INVENTORY_CHECKSUM,
    baseInventoryChecksum: BASE_INVENTORY_CHECKSUM,
    sourceCutoff: SOURCE_CUTOFF,
    before,
    after,
    delta: {
      patients: 0,
      leads: 0,
      mappings: 0,
      patientMappings: 0,
    },
    result: privacySafeResult,
    approvalRequired: true,
    nextGate: "FI-HUBSPOT-IMPORT-1E-Q",
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
