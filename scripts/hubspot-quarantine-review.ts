/**
 * FI-HUBSPOT-IMPORT-1E-Q — quarantine/exclusion classification assurance gate.
 * Never applies FI leads/mappings/patients. Next gate: FI-HUBSPOT-IMPORT-1E-FINAL.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const INTEGRATION_ID = "ade8a7d0-ad45-4fd7-8d53-61d4806b95f6";
const ORIGINAL_EXPECTED_V1_INVENTORY_CHECKSUM =
  "fcf3aaddd2c6f6b2107640798980d3429e08c450a81d66d430da8964e0805de6";
const PRIOR_LIVE_V1_INVENTORY_CHECKSUM =
  "b12aacbc38ce43f524e9867bdbb1efae0e8a555f1e05836f9e95319dae2a696a";
const FIXED_INVENTORY_CHECKSUM = "1bf1b16f4db0ce750bfd90556554b4c65205d1abc07bfb0e348c112008b5602b";
const CHECKSUM_CONTRACT_VERSION = "fi-hubspot-contact-inventory-v2";
const POST_1EC_INVENTORY_CHECKSUM =
  "93823b3d3a322ca23abd85bea8439a0188ac71fdc1c5f8420965a34e16b10451";
const BASE_INVENTORY_CHECKSUM = "3d380a980ad1a0a2ba246742c9ccee5ba7f37a39c3f29e15e572fb175365079c";
const SOURCE_CUTOFF = "2026-07-16T16:00:34.530Z";

function loadEnv(): void {
  for (const name of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8")
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)) {
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
    import("@/src/lib/integrations/hubspot/import/hubspotQuarantineReview.server"),
  ]);
  const supabase = supabaseAdmin();
  const output = value("--output-json");
  const mode = ["inventory", "classify", "replay", "apply"].find((candidate) =>
    has(`--${candidate}`)
  );
  if (!mode) {
    throw new Error("Choose a 1E-Q mode: --inventory | --classify | --replay | --apply");
  }

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
    const { count: staging, error: stagingError } = await supabase
      .from("fi_external_hubspot_contact_staging")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .eq("integration_id", INTEGRATION_ID);
    if (stagingError) throw new Error(stagingError.message);
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
      staging: staging ?? 0,
      watermarks: watermarks ?? [],
    };
  };

  const before = await snapshot();
  const common = {
    tenantId: TENANT_ID,
    integrationId: INTEGRATION_ID,
    fixedInventoryChecksum: FIXED_INVENTORY_CHECKSUM,
    checksumContractVersion: CHECKSUM_CONTRACT_VERSION,
    sourceCutoff: SOURCE_CUTOFF,
    operatorLabel: "1e-q-operator",
    actorRole: "clinic_admin",
  };

  let result: unknown;
  if (mode === "inventory") {
    result = await review.buildQuarantineReviewWorkspace(supabase, common);
  } else if (mode === "classify") {
    result = await review.persistQuarantineReview(supabase, common);
  } else if (mode === "replay") {
    const checksum = value("--checksum");
    if (!checksum) throw new Error("--checksum required for replay");
    result = await review.replayQuarantineReview(supabase, {
      ...common,
      expectedReviewChecksum: checksum,
    });
  } else {
    try {
      await review.applyQuarantineReviewBatch(supabase, {
        explicitHumanApproval: has("--explicit-human-approval"),
        approvalToken: value("--approval-token"),
        expectedChecksum: value("--checksum") ?? undefined,
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
    throw new Error("SIDE_EFFECT_GUARD: mapping counts changed during 1E-Q");
  }
  if (after.staging !== before.staging) {
    throw new Error("SIDE_EFFECT_GUARD: staging row count changed during 1E-Q");
  }
  if (JSON.stringify(after.watermarks) !== JSON.stringify(before.watermarks)) {
    throw new Error(`WATERMARK_GUARD: dataset watermark changed during ${mode}`);
  }

  const privacySafeResult = (() => {
    if (mode === "apply") return result;
    if (mode === "replay") {
      const replay = result as {
        first: Record<string, unknown>;
        second: Record<string, unknown>;
        mutationDeltaOutsideReviewState: number;
        idempotent: boolean;
      };
      const sanitize = (workspace: Record<string, unknown>) => {
        const rows = ((workspace.rows as Array<Record<string, unknown>>) ?? []).map((row) => ({
          hubspotContactId: row.hubspotContactId,
          displayNameMasked: row.displayNameMasked,
          emailPresent: row.emailPresent,
          phonePresent: row.phonePresent,
          originalBucket: row.originalBucket,
          originalDecision: row.originalDecision,
          originalReasonCode: row.originalReasonCode,
          state: row.state,
          reasonCode: row.reasonCode,
          approvedForApply: row.approvedForApply,
          possibleLegitimateContact: row.possibleLegitimateContact,
          plainLanguageEvidence: row.plainLanguageEvidence,
          warnings: row.warnings,
          sourceUpdatedAt: row.sourceUpdatedAt,
          sourcePayloadChecksum: row.sourcePayloadChecksum,
          operatorLabel: row.operatorLabel,
          reviewedAt: row.reviewedAt,
          checks: row.checks,
        }));
        return {
          inventoryChecksum: workspace.inventoryChecksum,
          checksumContractVersion: workspace.checksumContractVersion,
          reviewChecksum: workspace.reviewChecksum,
          stateCounts: workspace.stateCounts,
          frozenContactIds: workspace.frozenContactIds,
          frozenQuarantinedIds: workspace.frozenQuarantinedIds,
          frozenExcludedIds: workspace.frozenExcludedIds,
          summary: workspace.summary,
          reconciliation: workspace.reconciliation,
          applyEnabled: false,
          nextGate: workspace.nextGate ?? "FI-HUBSPOT-IMPORT-1E-FINAL",
          rows,
        };
      };
      return {
        first: sanitize(replay.first),
        second: sanitize(replay.second),
        mutationDeltaOutsideReviewState: replay.mutationDeltaOutsideReviewState,
        idempotent: replay.idempotent,
      };
    }
    const workspace = result as {
      inventoryChecksum?: string;
      checksumContractVersion?: string;
      reviewChecksum?: string;
      stateCounts?: Record<string, number>;
      frozenContactIds?: string[];
      frozenQuarantinedIds?: string[];
      frozenExcludedIds?: string[];
      summary?: unknown;
      reconciliation?: unknown;
      rows?: Array<Record<string, unknown>>;
      applyEnabled?: boolean;
      nextGate?: string;
    };
    const rows = (workspace.rows ?? []).map((row) => ({
      hubspotContactId: row.hubspotContactId,
      displayNameMasked: row.displayNameMasked,
      emailPresent: row.emailPresent,
      phonePresent: row.phonePresent,
      originalBucket: row.originalBucket,
      originalDecision: row.originalDecision,
      originalReasonCode: row.originalReasonCode,
      state: row.state,
      reasonCode: row.reasonCode,
      approvedForApply: row.approvedForApply,
      possibleLegitimateContact: row.possibleLegitimateContact,
      plainLanguageEvidence: row.plainLanguageEvidence,
      warnings: row.warnings,
      sourceUpdatedAt: row.sourceUpdatedAt,
      sourcePayloadChecksum: row.sourcePayloadChecksum,
      operatorLabel: row.operatorLabel,
      reviewedAt: row.reviewedAt,
      checks: row.checks,
    }));
    return {
      inventoryChecksum: workspace.inventoryChecksum,
      checksumContractVersion: workspace.checksumContractVersion,
      reviewChecksum: workspace.reviewChecksum,
      stateCounts: workspace.stateCounts,
      frozenContactIds: workspace.frozenContactIds,
      frozenQuarantinedIds: workspace.frozenQuarantinedIds,
      frozenExcludedIds: workspace.frozenExcludedIds,
      summary: workspace.summary,
      reconciliation: workspace.reconciliation,
      applyEnabled: workspace.applyEnabled ?? false,
      nextGate: workspace.nextGate ?? "FI-HUBSPOT-IMPORT-1E-FINAL",
      rows,
    };
  })();

  const report = {
    milestone: "FI-HUBSPOT-IMPORT-1E-Q",
    mode,
    tenantId: TENANT_ID,
    integrationId: INTEGRATION_ID,
    fixedInventoryChecksum: FIXED_INVENTORY_CHECKSUM,
    checksumContractVersion: CHECKSUM_CONTRACT_VERSION,
    originalExpectedV1InventoryChecksum: ORIGINAL_EXPECTED_V1_INVENTORY_CHECKSUM,
    priorLiveV1InventoryChecksum: PRIOR_LIVE_V1_INVENTORY_CHECKSUM,
    post1ecInventoryChecksum: POST_1EC_INVENTORY_CHECKSUM,
    baseInventoryChecksum: BASE_INVENTORY_CHECKSUM,
    sourceCutoff: SOURCE_CUTOFF,
    before,
    after,
    delta: {
      patients: 0,
      leads: 0,
      mappings: 0,
      patientMappings: 0,
      staging: 0,
    },
    result: privacySafeResult,
    approvalRequired: true,
    nextGate: "FI-HUBSPOT-IMPORT-1E-FINAL",
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
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
