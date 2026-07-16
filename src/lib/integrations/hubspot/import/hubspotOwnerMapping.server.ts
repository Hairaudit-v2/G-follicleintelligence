/**
 * FI-HUBSPOT-IMPORT-1B — owner→staff mapping preview / apply / rollback (service role).
 *
 * Allowlisted mutations only:
 * - fi_import_batches insert/update
 * - fi_staff_source_ids insert/delete (batch-scoped)
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";
import { privacySafeSourceIdHash } from "./hubspotImportIdentity";
import {
  assertMutationAllowlist,
  evaluateOwnerMapping,
  selectPilotProposals,
  tallyProposals,
  type ExistingOwnerMapping,
  type OwnerCandidateInput,
  type OwnerMappingEvalContext,
  type StaffCandidate,
} from "./hubspotOwnerMappingCore";
import {
  HUBSPOT_OWNER_MAPPING_DEFAULT_MAX,
  HUBSPOT_OWNER_MAPPING_EXPANSION_MAX,
  HUBSPOT_OWNER_MAPPING_KIND,
  HUBSPOT_OWNER_MAPPING_MILESTONE,
  HUBSPOT_OWNER_SOURCE_OBJECT_TYPE,
  HUBSPOT_OWNER_SOURCE_SYSTEM,
  type HubspotOwnerMappingBatchReport,
  type HubspotOwnerMappingMutationRecord,
  type HubspotOwnerMappingProposal,
} from "./hubspotOwnerMappingTypes";

export type OwnerMappingRunOptions = {
  tenantId: string;
  integrationId: string;
  maxRecords?: number;
  expandEnabled?: boolean;
  approvedBatchId?: string;
  actorLabel?: string;
  generatedAt?: string;
};

function prop(raw: Record<string, unknown> | null | undefined, ...keys: string[]): string | null {
  if (!raw) return null;
  for (const key of keys) {
    const v = raw[key];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

async function readWatermark(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_external_hubspot_backup_watermarks")
    .select("watermark_timestamp")
    .eq("tenant_id", tenantId)
    .eq("dataset", "notes")
    .maybeSingle();
  if (error) throw new Error(`watermark: ${error.message}`);
  return data ? String((data as { watermark_timestamp: string }).watermark_timestamp) : null;
}

async function loadOwners(
  supabase: SupabaseClient,
  tenantId: string,
  integrationId: string
): Promise<OwnerCandidateInput[]> {
  const { data, error } = await supabase
    .from("fi_external_hubspot_owner_inventory")
    .select("hubspot_owner_id, archived, raw_payload, tenant_id, integration_id")
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId)
    .limit(500);
  if (error) throw new Error(`owner inventory: ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as {
      hubspot_owner_id: string;
      archived: boolean;
      raw_payload: Record<string, unknown>;
      tenant_id: string;
      integration_id: string;
    };
    const email = normalizeEmail(prop(r.raw_payload, "email"));
    const first = prop(r.raw_payload, "firstName", "first_name");
    const last = prop(r.raw_payload, "lastName", "last_name");
    const displayName = [first, last].filter(Boolean).join(" ") || prop(r.raw_payload, "email");
    return {
      hubspotOwnerId: String(r.hubspot_owner_id),
      tenantId: String(r.tenant_id),
      integrationId: String(r.integration_id),
      emailNormalized: email,
      archived: Boolean(r.archived),
      displayName,
    };
  });
}

async function loadEvalContext(
  supabase: SupabaseClient,
  tenantId: string
): Promise<OwnerMappingEvalContext> {
  const { data: staffRows, error: staffErr } = await supabase
    .from("fi_staff")
    .select("id, tenant_id, email, is_active")
    .eq("tenant_id", tenantId)
    .limit(5000);
  if (staffErr) throw new Error(`fi_staff: ${staffErr.message}`);

  const staffByEmail = new Map<string, StaffCandidate[]>();
  for (const row of staffRows ?? []) {
    const r = row as { id: string; tenant_id: string; email?: string | null; is_active: boolean };
    const email = normalizeEmail(r.email ?? null);
    if (!email) continue;
    const list = staffByEmail.get(email) ?? [];
    list.push({
      staffId: String(r.id),
      tenantId: String(r.tenant_id),
      isActive: Boolean(r.is_active),
      emailNormalized: email,
    });
    staffByEmail.set(email, list);
  }

  const { data: sourceRows, error: srcErr } = await supabase
    .from("fi_staff_source_ids")
    .select("id, staff_id, source_staff_id, metadata")
    .eq("tenant_id", tenantId)
    .eq("source_system", HUBSPOT_OWNER_SOURCE_SYSTEM)
    .limit(5000);
  if (srcErr) throw new Error(`fi_staff_source_ids: ${srcErr.message}`);

  const existingByOwnerId = new Map<string, ExistingOwnerMapping>();
  const existingByStaffId = new Map<string, ExistingOwnerMapping>();
  for (const row of sourceRows ?? []) {
    const r = row as {
      id: string;
      staff_id: string;
      source_staff_id: string;
      metadata?: { import_batch_id?: string };
    };
    const mapping: ExistingOwnerMapping = {
      hubspotOwnerId: String(r.source_staff_id),
      staffId: String(r.staff_id),
      mappingRowId: String(r.id),
      importBatchId: r.metadata?.import_batch_id ? String(r.metadata.import_batch_id) : null,
    };
    existingByOwnerId.set(mapping.hubspotOwnerId, mapping);
    existingByStaffId.set(mapping.staffId, mapping);
  }

  return {
    expectedTenantId: tenantId,
    staffByEmail,
    existingByOwnerId,
    existingByStaffId,
  };
}

function buildReport(partial: Omit<HubspotOwnerMappingBatchReport, "evidenceType" | "milestone" | "staffRowsMutated" | "userRowsMutated" | "notificationsEmitted" | "backupWatermarkChanged">): HubspotOwnerMappingBatchReport {
  return {
    evidenceType: "hubspot_owner_staff_mapping_1b",
    milestone: HUBSPOT_OWNER_MAPPING_MILESTONE,
    staffRowsMutated: false,
    userRowsMutated: false,
    notificationsEmitted: false,
    backupWatermarkChanged: false,
    ...partial,
  };
}

export async function previewHubspotOwnerStaffMapping(
  supabase: SupabaseClient,
  opts: OwnerMappingRunOptions
): Promise<HubspotOwnerMappingBatchReport> {
  const maxRecords = opts.maxRecords ?? HUBSPOT_OWNER_MAPPING_DEFAULT_MAX;
  const expandEnabled = Boolean(opts.expandEnabled);
  if (!expandEnabled && maxRecords > HUBSPOT_OWNER_MAPPING_DEFAULT_MAX) {
    throw new Error(
      `MAX_RECORDS_GUARD: default max is ${HUBSPOT_OWNER_MAPPING_DEFAULT_MAX}; pass expandEnabled for up to ${HUBSPOT_OWNER_MAPPING_EXPANSION_MAX}`
    );
  }
  if (expandEnabled && maxRecords > HUBSPOT_OWNER_MAPPING_EXPANSION_MAX) {
    throw new Error(`MAX_RECORDS_GUARD: expansion max is ${HUBSPOT_OWNER_MAPPING_EXPANSION_MAX}`);
  }

  const watermarkBefore = await readWatermark(supabase, opts.tenantId);
  const owners = await loadOwners(supabase, opts.tenantId, opts.integrationId);
  const ctx = await loadEvalContext(supabase, opts.tenantId);

  const allProposals = owners
    .map((o) => evaluateOwnerMapping(o, ctx))
    .sort((a, b) => a.hubspotOwnerId.localeCompare(b.hubspotOwnerId));

  const { selected, rejectedOverLimit, maxAllowed } = selectPilotProposals(allProposals, {
    maxRecords,
    expandEnabled,
  });

  // Persist preview batch (audit only — allowlisted).
  assertMutationAllowlist("fi_import_batches", "insert");
  const dryRunReport = {
    milestone: HUBSPOT_OWNER_MAPPING_MILESTONE,
    selected,
    rejectedOverLimit,
    allDecisionCounts: tallyProposals(allProposals),
    maxAllowed,
    expandEnabled,
  };

  const { data: batch, error: batchErr } = await supabase
    .from("fi_import_batches")
    .insert({
      tenant_id: opts.tenantId,
      source_system: HUBSPOT_OWNER_SOURCE_SYSTEM,
      kind: HUBSPOT_OWNER_MAPPING_KIND,
      status: "dry_run_passed",
      dry_run_passed: true,
      dry_run_at: new Date().toISOString(),
      dry_run_report: dryRunReport,
      row_count: selected.length,
      imported_row_count: 0,
      metadata: {
        milestone: HUBSPOT_OWNER_MAPPING_MILESTONE,
        integration_id: opts.integrationId,
        dataset: "owners",
        mode: "preview",
        actor_label: opts.actorLabel ?? "import-1b-preview",
        selected_owner_ids: selected.map((s) => s.hubspotOwnerId),
        selected_staff_ids: selected.map((s) => s.staffId),
      },
    })
    .select("id")
    .single();
  if (batchErr) throw new Error(`fi_import_batches insert: ${batchErr.message}`);

  const batchId = String((batch as { id: string }).id);
  const mutations: HubspotOwnerMappingMutationRecord[] = [
    { table: "fi_import_batches", operation: "insert", rowId: batchId, allowlisted: true },
  ];

  const proposals = [
    ...allProposals.map((p) => {
      const over = rejectedOverLimit.find((r) => r.hubspotOwnerId === p.hubspotOwnerId);
      return over ?? p;
    }),
  ];

  const counts = tallyProposals(proposals);
  const watermarkAfter = await readWatermark(supabase, opts.tenantId);

  return buildReport({
    mode: "preview",
    tenantId: opts.tenantId,
    integrationId: opts.integrationId,
    batchId,
    maxRecords: maxAllowed,
    expandEnabled,
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    proposals,
    counts,
    mutations,
    watermarkBefore,
    watermarkAfter,
    ok: counts.wrongTenant === 0 && counts.conflicts === 0 && selected.length > 0,
    failClosedReasons:
      selected.length === 0 ? ["no_deterministic_mappings_selected"] : [],
  });
}

export async function applyHubspotOwnerStaffMapping(
  supabase: SupabaseClient,
  opts: OwnerMappingRunOptions & { approvedBatchId: string; confirmToken: string }
): Promise<HubspotOwnerMappingBatchReport> {
  if (!opts.approvedBatchId?.trim()) {
    throw new Error("APPLY_GUARD: --approved-batch-id is required");
  }
  if (opts.confirmToken !== opts.approvedBatchId) {
    throw new Error(
      "APPLY_GUARD: FI_HUBSPOT_OWNER_MAP_CONFIRM must equal the approved batch id (fail closed)"
    );
  }

  const watermarkBefore = await readWatermark(supabase, opts.tenantId);

  const { data: batch, error: batchErr } = await supabase
    .from("fi_import_batches")
    .select("id, tenant_id, kind, status, dry_run_passed, dry_run_report, metadata, imported_row_count")
    .eq("id", opts.approvedBatchId)
    .maybeSingle();
  if (batchErr) throw new Error(`load batch: ${batchErr.message}`);
  if (!batch) throw new Error("APPLY_GUARD: approved batch not found");

  const b = batch as {
    id: string;
    tenant_id: string;
    kind: string;
    status: string;
    dry_run_passed: boolean;
    dry_run_report: {
      selected?: HubspotOwnerMappingProposal[];
    };
    metadata: Record<string, unknown>;
    imported_row_count: number;
  };

  if (b.tenant_id !== opts.tenantId) {
    throw new Error("APPLY_GUARD: batch tenant mismatch (fail closed)");
  }
  if (b.kind !== HUBSPOT_OWNER_MAPPING_KIND) {
    throw new Error(`APPLY_GUARD: unexpected batch kind ${b.kind}`);
  }
  if (!b.dry_run_passed) {
    throw new Error("APPLY_GUARD: batch dry_run_passed is false");
  }
  if (b.status === "rolled_back") {
    throw new Error("APPLY_GUARD: batch already rolled back");
  }

  const selected = b.dry_run_report?.selected ?? [];
  if (!selected.length) {
    throw new Error("APPLY_GUARD: batch has no selected mappings");
  }

  const maxAllowed = opts.expandEnabled
    ? HUBSPOT_OWNER_MAPPING_EXPANSION_MAX
    : HUBSPOT_OWNER_MAPPING_DEFAULT_MAX;
  if (selected.length > maxAllowed) {
    throw new Error(`APPLY_GUARD: selected ${selected.length} exceeds max ${maxAllowed}`);
  }

  // Re-evaluate live to fail closed on drift.
  const ctx = await loadEvalContext(supabase, opts.tenantId);
  const owners = await loadOwners(supabase, opts.tenantId, opts.integrationId);
  const ownerById = new Map(owners.map((o) => [o.hubspotOwnerId, o]));

  const liveProposals: HubspotOwnerMappingProposal[] = [];
  const toInsert: HubspotOwnerMappingProposal[] = [];
  let alreadyApplied = 0;

  for (const planned of selected) {
    if (planned.decision !== "apply_mapping" && planned.decision !== "already_applied") {
      throw new Error(`APPLY_GUARD: non-applicable decision in batch: ${planned.decision}`);
    }
    const owner = ownerById.get(planned.hubspotOwnerId);
    if (!owner) {
      throw new Error(`APPLY_GUARD: owner ${planned.hubspotOwnerId} missing from inventory`);
    }
    const live = evaluateOwnerMapping(owner, ctx);
    liveProposals.push(live);

    if (live.decision === "already_applied") {
      if (live.staffId !== planned.staffId) {
        throw new Error("APPLY_GUARD: already_applied mapping points to different staff");
      }
      alreadyApplied += 1;
      continue;
    }
    if (live.decision !== "apply_mapping") {
      throw new Error(
        `APPLY_GUARD: live decision ${live.decision} for owner hash ${live.hubspotOwnerIdHash}`
      );
    }
    if (live.staffId !== planned.staffId) {
      throw new Error("APPLY_GUARD: staff target drifted since preview");
    }
    if (!live.staffIsActive) {
      throw new Error("APPLY_GUARD: staff inactive");
    }
    toInsert.push(live);
  }

  const mutations: HubspotOwnerMappingMutationRecord[] = [];
  let applied = 0;

  // Idempotent replay: nothing to insert.
  if (toInsert.length === 0 && alreadyApplied === selected.length) {
    assertMutationAllowlist("fi_import_batches", "update");
    await supabase
      .from("fi_import_batches")
      .update({
        status: "import_completed",
        metadata: {
          ...b.metadata,
          last_replay_at: new Date().toISOString(),
          replay_already_applied: alreadyApplied,
        },
      })
      .eq("id", b.id);
    mutations.push({
      table: "fi_import_batches",
      operation: "update",
      rowId: b.id,
      allowlisted: true,
    });

    const watermarkAfter = await readWatermark(supabase, opts.tenantId);
    const counts = tallyProposals(liveProposals);
    counts.alreadyApplied = alreadyApplied;
    counts.applied = 0;

    return buildReport({
      mode: "replay",
      tenantId: opts.tenantId,
      integrationId: opts.integrationId,
      batchId: b.id,
      maxRecords: maxAllowed,
      expandEnabled: Boolean(opts.expandEnabled),
      generatedAt: opts.generatedAt ?? new Date().toISOString(),
      proposals: liveProposals,
      counts,
      mutations,
      watermarkBefore,
      watermarkAfter,
      ok: true,
      failClosedReasons: [],
    });
  }

  assertMutationAllowlist("fi_import_batches", "update");
  await supabase
    .from("fi_import_batches")
    .update({ status: "importing" })
    .eq("id", b.id);

  try {
    for (const proposal of toInsert) {
      assertMutationAllowlist("fi_staff_source_ids", "insert");
      const { data: inserted, error: insErr } = await supabase
        .from("fi_staff_source_ids")
        .insert({
          tenant_id: opts.tenantId,
          staff_id: proposal.staffId!,
          source_system: HUBSPOT_OWNER_SOURCE_SYSTEM,
          source_staff_id: proposal.hubspotOwnerId,
          metadata: {
            milestone: HUBSPOT_OWNER_MAPPING_MILESTONE,
            import_batch_id: b.id,
            integration_id: opts.integrationId,
            source_object_type: HUBSPOT_OWNER_SOURCE_OBJECT_TYPE,
            match_method: proposal.matchMethod,
            hubspot_owner_id_hash: proposal.hubspotOwnerIdHash,
            email_normalized_hash: proposal.emailNormalizedHash,
            actor_label: opts.actorLabel ?? "import-1b-apply",
            created_by_pilot: true,
          },
        })
        .select("id")
        .single();
      if (insErr) throw new Error(`fi_staff_source_ids insert: ${insErr.message}`);
      mutations.push({
        table: "fi_staff_source_ids",
        operation: "insert",
        rowId: String((inserted as { id: string }).id),
        allowlisted: true,
      });
      applied += 1;
    }

    assertMutationAllowlist("fi_import_batches", "update");
    await supabase
      .from("fi_import_batches")
      .update({
        status: "import_completed",
        imported_at: new Date().toISOString(),
        imported_row_count: (b.imported_row_count ?? 0) + applied,
        metadata: {
          ...b.metadata,
          applied_at: new Date().toISOString(),
          applied_count: applied,
          already_applied_count: alreadyApplied,
          mapping_row_ids: mutations
            .filter((m) => m.table === "fi_staff_source_ids")
            .map((m) => m.rowId),
        },
      })
      .eq("id", b.id);
    mutations.push({
      table: "fi_import_batches",
      operation: "update",
      rowId: b.id,
      allowlisted: true,
    });
  } catch (err) {
    await supabase
      .from("fi_import_batches")
      .update({
        status: "import_failed",
        metadata: {
          ...b.metadata,
          apply_error: String(err instanceof Error ? err.message : err),
        },
      })
      .eq("id", b.id);
    throw err;
  }

  const watermarkAfter = await readWatermark(supabase, opts.tenantId);
  if (watermarkBefore !== watermarkAfter) {
    throw new Error("WATERMARK_GUARD: notes watermark changed during owner mapping apply");
  }

  const counts = tallyProposals(liveProposals);
  counts.applied = applied;
  counts.alreadyApplied = alreadyApplied;

  return buildReport({
    mode: alreadyApplied > 0 && applied === 0 ? "replay" : "apply",
    tenantId: opts.tenantId,
    integrationId: opts.integrationId,
    batchId: b.id,
    maxRecords: maxAllowed,
    expandEnabled: Boolean(opts.expandEnabled),
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    proposals: liveProposals,
    counts,
    mutations,
    watermarkBefore,
    watermarkAfter,
    ok: true,
    failClosedReasons: [],
  });
}

export async function previewRollbackHubspotOwnerStaffMapping(
  supabase: SupabaseClient,
  opts: { tenantId: string; batchId: string }
): Promise<HubspotOwnerMappingBatchReport> {
  const watermarkBefore = await readWatermark(supabase, opts.tenantId);

  const { data: batch, error } = await supabase
    .from("fi_import_batches")
    .select("id, tenant_id, kind, status, metadata")
    .eq("id", opts.batchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!batch) throw new Error("ROLLBACK_PREVIEW: batch not found");
  const b = batch as {
    id: string;
    tenant_id: string;
    kind: string;
    status: string;
    metadata: { mapping_row_ids?: string[]; integration_id?: string };
  };
  if (b.tenant_id !== opts.tenantId) throw new Error("ROLLBACK_PREVIEW: tenant mismatch");
  if (b.kind !== HUBSPOT_OWNER_MAPPING_KIND) throw new Error("ROLLBACK_PREVIEW: wrong kind");

  const { data: rows, error: rowErr } = await supabase
    .from("fi_staff_source_ids")
    .select("id, staff_id, source_staff_id, metadata")
    .eq("tenant_id", opts.tenantId)
    .eq("source_system", HUBSPOT_OWNER_SOURCE_SYSTEM)
    .contains("metadata", { import_batch_id: opts.batchId });
  if (rowErr) throw new Error(rowErr.message);

  // Exclude mappings adopted/confirmed outside the batch.
  const removable = (rows ?? []).filter((row) => {
    const meta = (row as { metadata?: Record<string, unknown> }).metadata ?? {};
    if (meta.confirmed_outside_batch === true) return false;
    if (meta.adopted_outside_batch === true) return false;
    return meta.import_batch_id === opts.batchId && meta.milestone === HUBSPOT_OWNER_MAPPING_MILESTONE;
  });

  const proposals: HubspotOwnerMappingProposal[] = removable.map((row) => {
    const r = row as { id: string; staff_id: string; source_staff_id: string };
    return {
      hubspotOwnerId: String(r.source_staff_id),
      hubspotOwnerIdHash: privacySafeSourceIdHash(String(r.source_staff_id)),
      staffId: String(r.staff_id),
      tenantId: opts.tenantId,
      integrationId: String(b.metadata.integration_id ?? ""),
      matchMethod: "existing_staff_source_id",
      decision: "already_applied",
      reasonCode: "rollback_candidate",
      emailNormalizedHash: null,
      staffIsActive: null,
    };
  });

  const counts = tallyProposals(proposals);
  counts.alreadyApplied = proposals.length;

  return buildReport({
    mode: "rollback_preview",
    tenantId: opts.tenantId,
    integrationId: String(b.metadata.integration_id ?? ""),
    batchId: b.id,
    maxRecords: proposals.length,
    expandEnabled: false,
    generatedAt: new Date().toISOString(),
    proposals,
    counts,
    mutations: removable.map((row) => ({
      table: "fi_staff_source_ids" as const,
      operation: "delete" as const,
      rowId: String((row as { id: string }).id),
      allowlisted: true as const,
    })),
    watermarkBefore,
    watermarkAfter: watermarkBefore,
    ok: true,
    failClosedReasons: [],
  });
}

export async function applyRollbackHubspotOwnerStaffMapping(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    batchId: string;
    confirmToken: string;
    reason: string;
    actorLabel?: string;
  }
): Promise<HubspotOwnerMappingBatchReport> {
  if (opts.confirmToken !== opts.batchId) {
    throw new Error("ROLLBACK_GUARD: confirm token must equal batch id");
  }
  if (!opts.reason?.trim()) {
    throw new Error("ROLLBACK_GUARD: reason required");
  }

  const preview = await previewRollbackHubspotOwnerStaffMapping(supabase, {
    tenantId: opts.tenantId,
    batchId: opts.batchId,
  });

  const mutations: HubspotOwnerMappingMutationRecord[] = [];
  let rolledBack = 0;

  for (const m of preview.mutations) {
    if (m.table !== "fi_staff_source_ids" || m.operation !== "delete") {
      throw new Error("ROLLBACK_GUARD: non-allowlisted mutation in preview");
    }
    assertMutationAllowlist("fi_staff_source_ids", "delete");
    const { error } = await supabase
      .from("fi_staff_source_ids")
      .delete()
      .eq("id", m.rowId)
      .eq("tenant_id", opts.tenantId)
      .contains("metadata", { import_batch_id: opts.batchId });
    if (error) throw new Error(`rollback delete: ${error.message}`);
    mutations.push(m);
    rolledBack += 1;
  }

  assertMutationAllowlist("fi_import_batches", "update");
  await supabase
    .from("fi_import_batches")
    .update({
      status: "rolled_back",
      rolled_back_at: new Date().toISOString(),
      metadata: {
        rollback_actor: opts.actorLabel ?? "import-1b-rollback",
        rollback_reason: opts.reason,
        rollback_at: new Date().toISOString(),
        rolled_back_mapping_ids: mutations.map((m) => m.rowId),
      },
    })
    .eq("id", opts.batchId)
    .eq("tenant_id", opts.tenantId);
  mutations.push({
    table: "fi_import_batches",
    operation: "update",
    rowId: opts.batchId,
    allowlisted: true,
  });

  const watermarkAfter = await readWatermark(supabase, opts.tenantId);
  const counts = { ...preview.counts, rolledBack, applied: 0 };

  return buildReport({
    mode: "rollback_apply",
    tenantId: opts.tenantId,
    integrationId: preview.integrationId,
    batchId: opts.batchId,
    maxRecords: preview.maxRecords,
    expandEnabled: false,
    generatedAt: new Date().toISOString(),
    proposals: preview.proposals,
    counts,
    mutations,
    watermarkBefore: preview.watermarkBefore,
    watermarkAfter,
    ok: true,
    failClosedReasons: [],
  });
}

/** Count hubspot staff source ids for tenant (verification). */
export async function countHubspotStaffSourceIds(
  supabase: SupabaseClient,
  tenantId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("fi_staff_source_ids")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("source_system", HUBSPOT_OWNER_SOURCE_SYSTEM);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
