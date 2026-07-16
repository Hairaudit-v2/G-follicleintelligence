/**
 * FI-HUBSPOT-IMPORT-1C — owner-resolution workspace data + apply from saved decisions.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";
import {
  assertMutationAllowlist,
  evaluateOwnerMapping,
  type OwnerMappingEvalContext,
} from "./hubspotOwnerMappingCore";
import {
  assertBatchSizeLimits,
  computeOwnerResolutionChecksum,
  deriveResolutionState,
  filterOwnerRows,
  rankStaffCandidates,
  sortOwnerRows,
  sortPriorityForRow,
  summarizeOwnerWorkspace,
  canAutoApplyCandidate,
} from "./hubspotOwnerResolutionCore";
import {
  HUBSPOT_OWNER_RESOLUTION_BATCH_MAX,
  HUBSPOT_OWNER_RESOLUTION_KIND,
  HUBSPOT_OWNER_RESOLUTION_MILESTONE,
  type HubspotOwnerResolutionDecisionInput,
  type HubspotOwnerResolutionFilter,
  type HubspotOwnerResolutionState,
  type HubspotOwnerWorkspaceRow,
  type HubspotOwnerWorkspaceSummary,
} from "./hubspotOwnerResolutionTypes";
import {
  HUBSPOT_OWNER_SOURCE_OBJECT_TYPE,
  HUBSPOT_OWNER_SOURCE_SYSTEM,
} from "./hubspotOwnerMappingTypes";
import { privacySafeSourceIdHash } from "./hubspotImportIdentity";

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

async function countByOwnerColumn(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  integrationId: string,
  ownerIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!ownerIds.length) return counts;

  // Sample via staged rows' raw_payload owner id (bounded).
  const { data, error } = await supabase
    .from(table)
    .select("raw_payload")
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId)
    .limit(5000);
  if (error) {
    // Table may not expose raw_payload the same way — fail soft.
    return counts;
  }
  for (const row of data ?? []) {
    const raw = (row as { raw_payload?: Record<string, unknown> }).raw_payload;
    const oid =
      prop(raw, "hubspot_owner_id") ??
      prop((raw?.properties as Record<string, unknown>) ?? null, "hubspot_owner_id");
    if (!oid) continue;
    counts.set(oid, (counts.get(oid) ?? 0) + 1);
  }
  return counts;
}

export async function loadOwnerResolutionWorkspace(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    filter?: HubspotOwnerResolutionFilter;
    search?: string;
  }
): Promise<{
  summary: HubspotOwnerWorkspaceSummary;
  rows: HubspotOwnerWorkspaceRow[];
  filter: HubspotOwnerResolutionFilter;
  oneOwnerPerStaffPolicy: {
    retained: true;
    rationale: string;
  };
}> {
  const { tenantId, integrationId } = input;
  const filter = input.filter ?? "needs_attention";

  const { data: owners, error: ownerErr } = await supabase
    .from("fi_external_hubspot_owner_inventory")
    .select("hubspot_owner_id, archived, raw_payload")
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId)
    .limit(500);
  if (ownerErr) throw new Error(ownerErr.message);

  const { data: staffRows, error: staffErr } = await supabase
    .from("fi_staff")
    .select("id, full_name, staff_role, email, is_active")
    .eq("tenant_id", tenantId)
    .limit(5000);
  if (staffErr) throw new Error(staffErr.message);

  const { data: sourceRows } = await supabase
    .from("fi_staff_source_ids")
    .select("staff_id, source_staff_id")
    .eq("tenant_id", tenantId)
    .eq("source_system", HUBSPOT_OWNER_SOURCE_SYSTEM);

  const ownerToStaff = new Map<string, string>();
  const staffToOwner = new Map<string, string>();
  for (const row of sourceRows ?? []) {
    const r = row as { staff_id: string; source_staff_id: string };
    ownerToStaff.set(String(r.source_staff_id), String(r.staff_id));
    staffToOwner.set(String(r.staff_id), String(r.source_staff_id));
  }

  const { data: decisions } = await supabase
    .from("fi_hubspot_owner_resolution_decisions")
    .select(
      "id, hubspot_owner_id, resolution_state, target_staff_id, operator_note, match_evidence, applied_at"
    )
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId)
    .is("superseded_at", null);

  const decisionByOwner = new Map(
    (decisions ?? []).map((d) => [
      String((d as { hubspot_owner_id: string }).hubspot_owner_id),
      d as {
        id: string;
        resolution_state: HubspotOwnerResolutionState;
        target_staff_id: string | null;
        operator_note: string | null;
      },
    ])
  );

  const staffList = (staffRows ?? []).map((s) => {
    const r = s as {
      id: string;
      full_name: string;
      staff_role: string;
      email: string | null;
      is_active: boolean;
    };
    return {
      staffId: String(r.id),
      fullName: String(r.full_name),
      role: String(r.staff_role ?? ""),
      isActive: Boolean(r.is_active),
      email: r.email,
      alreadyHasHubspotOwner: staffToOwner.has(String(r.id)),
      existingHubspotOwnerId: staffToOwner.get(String(r.id)) ?? null,
    };
  });

  const staffNameById = new Map(staffList.map((s) => [s.staffId, s.fullName]));

  const contactCounts = await countByOwnerColumn(
    supabase,
    "fi_external_hubspot_contact_staging",
    tenantId,
    integrationId,
    []
  );
  const dealCounts = await countByOwnerColumn(
    supabase,
    "fi_external_hubspot_deal_staging",
    tenantId,
    integrationId,
    []
  );

  const rows: HubspotOwnerWorkspaceRow[] = [];

  for (const row of owners ?? []) {
    const r = row as {
      hubspot_owner_id: string;
      archived: boolean;
      raw_payload: Record<string, unknown>;
    };
    const ownerId = String(r.hubspot_owner_id);
    const email = normalizeEmail(prop(r.raw_payload, "email"));
    const first = prop(r.raw_payload, "firstName", "first_name");
    const last = prop(r.raw_payload, "lastName", "last_name");
    const displayName =
      [first, last].filter(Boolean).join(" ").trim() || email || `Owner ${ownerId}`;

    const candidates = rankStaffCandidates({
      ownerEmail: email,
      ownerDisplayName: displayName,
      staff: staffList,
    });

    let conflictReason: string | null = null;
    const appliedStaff = ownerToStaff.get(ownerId) ?? null;
    const saved = decisionByOwner.get(ownerId) ?? null;

    // Staff already mapped to another owner while a candidate wants this staff.
    for (const c of candidates) {
      if (
        c.alreadyHasHubspotOwner &&
        c.existingHubspotOwnerId &&
        c.existingHubspotOwnerId !== ownerId &&
        canAutoApplyCandidate({ ...c, alreadyHasHubspotOwner: false })
      ) {
        conflictReason = `Suggested staff already linked to HubSpot owner ${c.existingHubspotOwnerId}`;
      }
    }

    const state = deriveResolutionState({
      hasAppliedMapping: Boolean(appliedStaff),
      savedState: saved?.resolution_state ?? null,
      archived: Boolean(r.archived),
      candidates,
      conflictReason,
    });

    const ownedContacts = contactCounts.get(ownerId) ?? 0;
    const ownedDeals = dealCounts.get(ownerId) ?? 0;
    const ownedTasks = 0;
    const ownedActivities = ownedContacts + ownedDeals;
    const inMigrationCohort = ownedContacts + ownedDeals > 0;

    const targetStaffId = appliedStaff ?? saved?.target_staff_id ?? null;

    rows.push({
      hubspotOwnerId: ownerId,
      displayName,
      email,
      archived: Boolean(r.archived),
      resolutionState: state,
      decisionId: saved?.id ?? null,
      targetStaffId,
      targetStaffName: targetStaffId ? staffNameById.get(targetStaffId) ?? null : null,
      operatorNote: saved?.operator_note ?? null,
      ownedContacts,
      ownedDeals,
      ownedTasks,
      ownedActivities,
      lastOwnedActivityAt: null,
      inMigrationCohort,
      candidates,
      conflictReason,
      sortPriority: sortPriorityForRow({
        state,
        inMigrationCohort,
        hasDeterministicSuggestion: candidates.some(canAutoApplyCandidate),
        archived: Boolean(r.archived),
        ownedTotal: ownedActivities,
      }),
    });
  }

  let filtered = filterOwnerRows(sortOwnerRows(rows), filter);
  if (input.search?.trim()) {
    const q = input.search.trim().toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.displayName.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        r.hubspotOwnerId.includes(q) ||
        (r.targetStaffName ?? "").toLowerCase().includes(q)
    );
  }

  return {
    summary: summarizeOwnerWorkspace(rows),
    rows: filtered,
    filter,
    oneOwnerPerStaffPolicy: {
      retained: true,
      rationale:
        "Unique (tenant, staff, hubspot) retained for 1C. Multiple historical HubSpot owner IDs for one staff remain quarantined as conflicts pending a later approved identity model.",
    },
  };
}

export async function saveOwnerResolutionDecision(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    decision: HubspotOwnerResolutionDecisionInput;
    operatorFiUserId: string | null;
  }
): Promise<{ decisionId: string }> {
  const { tenantId, integrationId, decision, operatorFiUserId } = input;
  const state = decision.resolutionState;

  if (
    (state === "proposed" || state === "mapped" || state === "already_applied") &&
    !decision.targetStaffId
  ) {
    throw new Error("Staff selection is required for mapping decisions.");
  }

  if (state === "proposed" || state === "mapped") {
    // Validate staff tenant + active (inactive needs explicit note override).
    const { data: staff, error } = await supabase
      .from("fi_staff")
      .select("id, tenant_id, is_active")
      .eq("id", decision.targetStaffId!)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!staff || String((staff as { tenant_id: string }).tenant_id) !== tenantId) {
      throw new Error("That staff member is not in this clinic.");
    }
    const active = Boolean((staff as { is_active: boolean }).is_active);
    const override = Boolean(
      decision.matchEvidence && (decision.matchEvidence as { inactive_override?: boolean }).inactive_override
    );
    if (!active && !override) {
      throw new Error("Inactive staff need an explicit approved override before mapping.");
    }

    const { data: existing } = await supabase
      .from("fi_staff_source_ids")
      .select("source_staff_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", HUBSPOT_OWNER_SOURCE_SYSTEM)
      .eq("staff_id", decision.targetStaffId!)
      .maybeSingle();
    if (
      existing &&
      String((existing as { source_staff_id: string }).source_staff_id) !== decision.hubspotOwnerId
    ) {
      throw new Error("This staff member already has a different HubSpot owner mapping.");
    }
  }

  // Supersede prior active decision.
  const { data: prior } = await supabase
    .from("fi_hubspot_owner_resolution_decisions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId)
    .eq("hubspot_owner_id", decision.hubspotOwnerId)
    .is("superseded_at", null)
    .maybeSingle();

  if (prior) {
    await supabase
      .from("fi_hubspot_owner_resolution_decisions")
      .update({ superseded_at: new Date().toISOString() })
      .eq("id", String((prior as { id: string }).id));
  }

  const { data: inserted, error: insErr } = await supabase
    .from("fi_hubspot_owner_resolution_decisions")
    .insert({
      tenant_id: tenantId,
      integration_id: integrationId,
      hubspot_owner_id: decision.hubspotOwnerId,
      resolution_state: state,
      target_staff_id: decision.targetStaffId ?? null,
      match_evidence: {
        milestone: HUBSPOT_OWNER_RESOLUTION_MILESTONE,
        ...(decision.matchEvidence ?? {}),
      },
      operator_fi_user_id: operatorFiUserId,
      operator_note: decision.operatorNote ?? null,
      previous_decision_id: prior ? String((prior as { id: string }).id) : null,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);
  return { decisionId: String((inserted as { id: string }).id) };
}

export async function previewOwnerResolutionApplyBatch(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    maxMappings?: number;
    operatorLabel?: string;
  }
): Promise<{
  batchId: string;
  checksum: string;
  mappingsToCreate: Array<{ hubspotOwnerId: string; staffId: string; staffName: string }>;
  classifications: Record<string, number>;
  plainLanguage: {
    primaryAction: "Apply approved owner mappings";
    staffUsersLeadsPatientsUnchanged: true;
    tablesThatWillChange: string[];
  };
}> {
  const { data: proposed, error } = await supabase
    .from("fi_hubspot_owner_resolution_decisions")
    .select("id, hubspot_owner_id, target_staff_id, resolution_state, match_evidence")
    .eq("tenant_id", input.tenantId)
    .eq("integration_id", input.integrationId)
    .eq("resolution_state", "proposed")
    .is("superseded_at", null)
    .is("applied_at", null);
  if (error) throw new Error(error.message);

  const mappings = (proposed ?? [])
    .filter((p) => (p as { target_staff_id: string | null }).target_staff_id)
    .map((p) => ({
      hubspotOwnerId: String((p as { hubspot_owner_id: string }).hubspot_owner_id),
      staffId: String((p as { target_staff_id: string }).target_staff_id),
      decisionId: String((p as { id: string }).id),
      operatorConfirmed: Boolean(
        ((p as { match_evidence?: { operator_confirmed?: boolean } }).match_evidence ?? {})
          .operator_confirmed
      ),
    }));

  const max = input.maxMappings ?? 10;
  assertBatchSizeLimits(Math.min(mappings.length, max), 0);
  const selected = mappings.slice(0, max);

  // Live re-check deterministic policy via 1B evaluator.
  const { data: staffRows } = await supabase
    .from("fi_staff")
    .select("id, full_name, email, is_active, tenant_id")
    .eq("tenant_id", input.tenantId);
  const staffByEmail = new Map<string, Array<{ staffId: string; tenantId: string; isActive: boolean; emailNormalized: string | null }>>();
  const staffName = new Map<string, string>();
  for (const s of staffRows ?? []) {
    const r = s as { id: string; full_name: string; email: string | null; is_active: boolean; tenant_id: string };
    staffName.set(String(r.id), String(r.full_name));
    const em = normalizeEmail(r.email);
    if (!em) continue;
    const list = staffByEmail.get(em) ?? [];
    list.push({
      staffId: String(r.id),
      tenantId: String(r.tenant_id),
      isActive: Boolean(r.is_active),
      emailNormalized: em,
    });
    staffByEmail.set(em, list);
  }

  const { data: sourceRows } = await supabase
    .from("fi_staff_source_ids")
    .select("staff_id, source_staff_id, id, metadata")
    .eq("tenant_id", input.tenantId)
    .eq("source_system", HUBSPOT_OWNER_SOURCE_SYSTEM);

  const ctx: OwnerMappingEvalContext = {
    expectedTenantId: input.tenantId,
    staffByEmail,
    existingByOwnerId: new Map(
      (sourceRows ?? []).map((row) => {
        const r = row as { id: string; staff_id: string; source_staff_id: string; metadata?: { import_batch_id?: string } };
        return [
          String(r.source_staff_id),
          {
            hubspotOwnerId: String(r.source_staff_id),
            staffId: String(r.staff_id),
            mappingRowId: String(r.id),
            importBatchId: r.metadata?.import_batch_id ?? null,
          },
        ];
      })
    ),
    existingByStaffId: new Map(
      (sourceRows ?? []).map((row) => {
        const r = row as { id: string; staff_id: string; source_staff_id: string; metadata?: { import_batch_id?: string } };
        return [
          String(r.staff_id),
          {
            hubspotOwnerId: String(r.source_staff_id),
            staffId: String(r.staff_id),
            mappingRowId: String(r.id),
            importBatchId: r.metadata?.import_batch_id ?? null,
          },
        ];
      })
    ),
  };

  const { data: ownerInv } = await supabase
    .from("fi_external_hubspot_owner_inventory")
    .select("hubspot_owner_id, archived, raw_payload")
    .eq("tenant_id", input.tenantId)
    .eq("integration_id", input.integrationId);

  const ownerById = new Map(
    (ownerInv ?? []).map((o) => [
      String((o as { hubspot_owner_id: string }).hubspot_owner_id),
      o as { hubspot_owner_id: string; archived: boolean; raw_payload: Record<string, unknown> },
    ])
  );

  const applySelected = [];
  for (const m of selected) {
    const inv = ownerById.get(m.hubspotOwnerId);
    if (!inv) throw new Error(`Owner ${m.hubspotOwnerId} missing from inventory`);
    const email = normalizeEmail(prop(inv.raw_payload, "email"));
    const live = evaluateOwnerMapping(
      {
        hubspotOwnerId: m.hubspotOwnerId,
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        emailNormalized: email,
        archived: Boolean(inv.archived),
        displayName: null,
      },
      ctx
    );
    if (live.decision === "already_applied") continue;

    const staffOk =
      live.decision === "apply_mapping" && live.staffId === m.staffId
        ? true
        : m.operatorConfirmed &&
          !ctx.existingByStaffId.has(m.staffId) &&
          Boolean(
            (staffRows ?? []).find(
              (s) =>
                String((s as { id: string }).id) === m.staffId &&
                Boolean((s as { is_active: boolean }).is_active)
            )
          );

    if (!staffOk) {
      throw new Error(
        `Preview stale or unsafe for owner ${m.hubspotOwnerId}: live=${live.decision}`
      );
    }
    const deterministicOk =
      live.decision === "apply_mapping" && live.staffId === m.staffId;
    applySelected.push({
      hubspotOwnerId: m.hubspotOwnerId,
      hubspotOwnerIdHash: live.hubspotOwnerIdHash,
      staffId: m.staffId,
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      matchMethod: deterministicOk
        ? live.matchMethod ?? "exact_staff_email_within_tenant"
        : "pre_approved_explicit_mapping",
      decision: "apply_mapping" as const,
      reasonCode: deterministicOk ? live.reasonCode : "operator_confirmed_1c",
      emailNormalizedHash: live.emailNormalizedHash,
      staffIsActive: true as boolean | null,
    });
  }

  const checksum = computeOwnerResolutionChecksum(
    selected.map((m) => ({
      hubspotOwnerId: m.hubspotOwnerId,
      targetStaffId: m.staffId,
      resolutionState: "proposed",
    }))
  );

  const { data: allDecisions } = await supabase
    .from("fi_hubspot_owner_resolution_decisions")
    .select("resolution_state")
    .eq("tenant_id", input.tenantId)
    .eq("integration_id", input.integrationId)
    .is("superseded_at", null);

  const classifications: Record<string, number> = {};
  for (const d of allDecisions ?? []) {
    const st = String((d as { resolution_state: string }).resolution_state);
    classifications[st] = (classifications[st] ?? 0) + 1;
  }

  assertMutationAllowlist("fi_import_batches", "insert");
  const { data: batch, error: batchErr } = await supabase
    .from("fi_import_batches")
    .insert({
      tenant_id: input.tenantId,
      source_system: HUBSPOT_OWNER_SOURCE_SYSTEM,
      kind: HUBSPOT_OWNER_RESOLUTION_KIND,
      status: "dry_run_passed",
      dry_run_passed: true,
      dry_run_at: new Date().toISOString(),
      dry_run_report: {
        milestone: HUBSPOT_OWNER_RESOLUTION_MILESTONE,
        checksum,
        selected: applySelected,
        decisionIds: selected.map((s) => s.decisionId),
        selected_owner_ids: selected.map((s) => s.hubspotOwnerId),
        selected_staff_ids: selected.map((s) => s.staffId),
      },
      row_count: applySelected.length,
      imported_row_count: 0,
      metadata: {
        milestone: HUBSPOT_OWNER_RESOLUTION_MILESTONE,
        integration_id: input.integrationId,
        checksum,
        actor_label: input.operatorLabel ?? "1c-preview",
      },
    })
    .select("id")
    .single();
  if (batchErr) throw new Error(batchErr.message);

  return {
    batchId: String((batch as { id: string }).id),
    checksum,
    mappingsToCreate: selected.map((m) => ({
      hubspotOwnerId: m.hubspotOwnerId,
      staffId: m.staffId,
      staffName: staffName.get(m.staffId) ?? m.staffId,
    })),
    classifications,
    plainLanguage: {
      primaryAction: "Apply approved owner mappings",
      staffUsersLeadsPatientsUnchanged: true,
      tablesThatWillChange:
        applySelected.length > 0
          ? ["fi_staff_source_ids", "fi_import_batches", "fi_hubspot_owner_resolution_decisions"]
          : ["fi_import_batches"],
    },
  };
}

async function readNotesWatermark(
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

/**
 * Apply a 1C preview batch with allowlisted source-id writes only.
 * Supports deterministic email matches and explicit operator-confirmed proposals.
 */
export async function applyOwnerResolutionBatch(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    integrationId: string;
    approvedBatchId: string;
    confirmToken: string;
    expectedChecksum: string;
    actorLabel?: string;
  }
): Promise<{
  ok: boolean;
  applied: number;
  alreadyApplied: number;
  mode: "apply" | "replay";
  watermarkBefore: string | null;
  watermarkAfter: string | null;
  mappingRowIds: string[];
}> {
  if (input.confirmToken !== input.approvedBatchId) {
    throw new Error("APPLY_GUARD: confirmation must equal the approved batch id");
  }

  const watermarkBefore = await readNotesWatermark(supabase, input.tenantId);

  const { data: batch, error } = await supabase
    .from("fi_import_batches")
    .select("id, tenant_id, kind, status, dry_run_report, metadata, imported_row_count")
    .eq("id", input.approvedBatchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!batch) throw new Error("Approved batch not found");

  const b = batch as {
    id: string;
    tenant_id: string;
    kind: string;
    status: string;
    dry_run_report: {
      checksum?: string;
      selected?: Array<{
        hubspotOwnerId: string;
        staffId?: string | null;
        decision: string;
        hubspotOwnerIdHash?: string;
        matchMethod?: string;
        reasonCode?: string;
        emailNormalizedHash?: string | null;
      }>;
      decisionIds?: string[];
    };
    metadata: Record<string, unknown>;
    imported_row_count: number;
  };

  if (b.tenant_id !== input.tenantId) throw new Error("APPLY_GUARD: tenant mismatch");
  if (b.kind !== HUBSPOT_OWNER_RESOLUTION_KIND) {
    throw new Error(`APPLY_GUARD: unexpected kind ${b.kind}`);
  }
  if (b.status === "rolled_back") {
    throw new Error("APPLY_GUARD: batch already rolled back");
  }
  const checksum = String(b.dry_run_report?.checksum ?? b.metadata.checksum ?? "");
  if (!checksum || checksum !== input.expectedChecksum) {
    throw new Error("APPLY_GUARD: preview has changed since approval (checksum mismatch)");
  }

  const selected = b.dry_run_report.selected ?? [];
  if (selected.length > HUBSPOT_OWNER_RESOLUTION_BATCH_MAX) {
    throw new Error(
      `APPLY_GUARD: batch exceeds max ${HUBSPOT_OWNER_RESOLUTION_BATCH_MAX} mappings`
    );
  }

  if (selected.length === 0) {
    assertMutationAllowlist("fi_import_batches", "update");
    await supabase
      .from("fi_import_batches")
      .update({
        status: "import_completed",
        imported_at: new Date().toISOString(),
        metadata: { ...b.metadata, empty_apply: true, checksum },
      })
      .eq("id", b.id);
    const watermarkAfter = await readNotesWatermark(supabase, input.tenantId);
    return {
      ok: true,
      applied: 0,
      alreadyApplied: 0,
      mode: "apply",
      watermarkBefore,
      watermarkAfter,
      mappingRowIds: [],
    };
  }

  const { data: sourceRows } = await supabase
    .from("fi_staff_source_ids")
    .select("id, staff_id, source_staff_id")
    .eq("tenant_id", input.tenantId)
    .eq("source_system", HUBSPOT_OWNER_SOURCE_SYSTEM);
  const byOwner = new Map(
    (sourceRows ?? []).map((r) => [
      String((r as { source_staff_id: string }).source_staff_id),
      r as { id: string; staff_id: string; source_staff_id: string },
    ])
  );
  const byStaff = new Map(
    (sourceRows ?? []).map((r) => [
      String((r as { staff_id: string }).staff_id),
      r as { id: string; staff_id: string; source_staff_id: string },
    ])
  );

  const { data: staffRows } = await supabase
    .from("fi_staff")
    .select("id, email, is_active, tenant_id")
    .eq("tenant_id", input.tenantId);
  const staffByEmail = new Map<
    string,
    Array<{ staffId: string; tenantId: string; isActive: boolean; emailNormalized: string | null }>
  >();
  for (const s of staffRows ?? []) {
    const r = s as { id: string; email: string | null; is_active: boolean; tenant_id: string };
    const em = normalizeEmail(r.email);
    if (!em) continue;
    const list = staffByEmail.get(em) ?? [];
    list.push({
      staffId: String(r.id),
      tenantId: String(r.tenant_id),
      isActive: Boolean(r.is_active),
      emailNormalized: em,
    });
    staffByEmail.set(em, list);
  }

  const { data: ownerInv } = await supabase
    .from("fi_external_hubspot_owner_inventory")
    .select("hubspot_owner_id, archived, raw_payload")
    .eq("tenant_id", input.tenantId)
    .eq("integration_id", input.integrationId);
  const ownerById = new Map(
    (ownerInv ?? []).map((o) => [
      String((o as { hubspot_owner_id: string }).hubspot_owner_id),
      o as { hubspot_owner_id: string; archived: boolean; raw_payload: Record<string, unknown> },
    ])
  );

  const evalCtx: OwnerMappingEvalContext = {
    expectedTenantId: input.tenantId,
    staffByEmail,
    existingByOwnerId: new Map(
      [...byOwner.entries()].map(([oid, row]) => [
        oid,
        {
          hubspotOwnerId: oid,
          staffId: String(row.staff_id),
          mappingRowId: String(row.id),
          importBatchId: null,
        },
      ])
    ),
    existingByStaffId: new Map(
      [...byStaff.entries()].map(([sid, row]) => [
        sid,
        {
          hubspotOwnerId: String(row.source_staff_id),
          staffId: sid,
          mappingRowId: String(row.id),
          importBatchId: null,
        },
      ])
    ),
  };

  let alreadyApplied = 0;
  const toInsert: Array<{
    hubspotOwnerId: string;
    staffId: string;
    matchMethod: string;
    reasonCode: string;
    emailNormalizedHash: string | null;
    hubspotOwnerIdHash: string;
  }> = [];

  for (const planned of selected) {
    const staffId = planned.staffId ? String(planned.staffId) : "";
    if (!staffId) throw new Error("APPLY_GUARD: selected mapping missing staffId");
    if (planned.decision !== "apply_mapping") {
      throw new Error(`APPLY_GUARD: non-applicable decision ${planned.decision}`);
    }

    const existingOwner = byOwner.get(planned.hubspotOwnerId);
    if (existingOwner) {
      if (String(existingOwner.staff_id) !== staffId) {
        throw new Error("APPLY_GUARD: owner already mapped to another staff member");
      }
      alreadyApplied += 1;
      continue;
    }

    const existingStaff = byStaff.get(staffId);
    if (existingStaff && String(existingStaff.source_staff_id) !== planned.hubspotOwnerId) {
      throw new Error("APPLY_GUARD: staff already mapped to another HubSpot owner");
    }

    const staff = (staffRows ?? []).find((s) => String((s as { id: string }).id) === staffId);
    if (!staff || String((staff as { tenant_id: string }).tenant_id) !== input.tenantId) {
      throw new Error("APPLY_GUARD: staff belongs to another tenant");
    }
    if (!Boolean((staff as { is_active: boolean }).is_active)) {
      throw new Error("APPLY_GUARD: inactive staff requires remapping with explicit override");
    }

    const inv = ownerById.get(planned.hubspotOwnerId);
    if (!inv) throw new Error(`APPLY_GUARD: owner ${planned.hubspotOwnerId} missing from inventory`);

    const operatorConfirmed = planned.reasonCode === "operator_confirmed_1c";
    const live = evaluateOwnerMapping(
      {
        hubspotOwnerId: planned.hubspotOwnerId,
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        emailNormalized: normalizeEmail(prop(inv.raw_payload, "email")),
        archived: Boolean(inv.archived),
        displayName: null,
      },
      evalCtx
    );

    if (live.decision === "already_applied" && live.staffId === staffId) {
      alreadyApplied += 1;
      continue;
    }

    if (live.decision === "apply_mapping" && live.staffId === staffId) {
      toInsert.push({
        hubspotOwnerId: planned.hubspotOwnerId,
        staffId,
        matchMethod: live.matchMethod ?? "exact_staff_email_within_tenant",
        reasonCode: live.reasonCode,
        emailNormalizedHash: live.emailNormalizedHash,
        hubspotOwnerIdHash: live.hubspotOwnerIdHash,
      });
      continue;
    }

    if (!operatorConfirmed) {
      throw new Error(
        `APPLY_GUARD: owner ${planned.hubspotOwnerId} is not deterministic and lacks operator confirmation`
      );
    }

    toInsert.push({
      hubspotOwnerId: planned.hubspotOwnerId,
      staffId,
      matchMethod: "pre_approved_explicit_mapping",
      reasonCode: "operator_confirmed_1c",
      emailNormalizedHash: planned.emailNormalizedHash ?? null,
      hubspotOwnerIdHash:
        planned.hubspotOwnerIdHash ?? privacySafeSourceIdHash(planned.hubspotOwnerId),
    });
  }

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
          checksum,
        },
      })
      .eq("id", b.id);
    if (b.dry_run_report.decisionIds?.length) {
      await supabase
        .from("fi_hubspot_owner_resolution_decisions")
        .update({
          resolution_state: "already_applied",
          applied_at: new Date().toISOString(),
          import_batch_id: b.id,
        })
        .in("id", b.dry_run_report.decisionIds)
        .eq("tenant_id", input.tenantId);
    }
    const watermarkAfter = await readNotesWatermark(supabase, input.tenantId);
    return {
      ok: true,
      applied: 0,
      alreadyApplied,
      mode: "replay",
      watermarkBefore,
      watermarkAfter,
      mappingRowIds: [],
    };
  }

  assertMutationAllowlist("fi_import_batches", "update");
  await supabase.from("fi_import_batches").update({ status: "importing" }).eq("id", b.id);

  const mappingRowIds: string[] = [];
  try {
    for (const proposal of toInsert) {
      assertMutationAllowlist("fi_staff_source_ids", "insert");
      const { data: inserted, error: insErr } = await supabase
        .from("fi_staff_source_ids")
        .insert({
          tenant_id: input.tenantId,
          staff_id: proposal.staffId,
          source_system: HUBSPOT_OWNER_SOURCE_SYSTEM,
          source_staff_id: proposal.hubspotOwnerId,
          metadata: {
            milestone: HUBSPOT_OWNER_RESOLUTION_MILESTONE,
            import_batch_id: b.id,
            integration_id: input.integrationId,
            source_object_type: HUBSPOT_OWNER_SOURCE_OBJECT_TYPE,
            match_method: proposal.matchMethod,
            hubspot_owner_id_hash: proposal.hubspotOwnerIdHash,
            email_normalized_hash: proposal.emailNormalizedHash,
            actor_label: input.actorLabel ?? "1c-apply",
            created_by_pilot: true,
          },
        })
        .select("id")
        .single();
      if (insErr) throw new Error(`fi_staff_source_ids insert: ${insErr.message}`);
      mappingRowIds.push(String((inserted as { id: string }).id));
      byOwner.set(proposal.hubspotOwnerId, {
        id: String((inserted as { id: string }).id),
        staff_id: proposal.staffId,
        source_staff_id: proposal.hubspotOwnerId,
      });
      byStaff.set(proposal.staffId, {
        id: String((inserted as { id: string }).id),
        staff_id: proposal.staffId,
        source_staff_id: proposal.hubspotOwnerId,
      });
    }

    assertMutationAllowlist("fi_import_batches", "update");
    await supabase
      .from("fi_import_batches")
      .update({
        status: "import_completed",
        imported_at: new Date().toISOString(),
        imported_row_count: (b.imported_row_count ?? 0) + mappingRowIds.length,
        metadata: {
          ...b.metadata,
          applied_at: new Date().toISOString(),
          applied_count: mappingRowIds.length,
          already_applied_count: alreadyApplied,
          mapping_row_ids: mappingRowIds,
          checksum,
        },
      })
      .eq("id", b.id);

    if (b.dry_run_report.decisionIds?.length) {
      await supabase
        .from("fi_hubspot_owner_resolution_decisions")
        .update({
          resolution_state: "mapped",
          applied_at: new Date().toISOString(),
          import_batch_id: b.id,
        })
        .in("id", b.dry_run_report.decisionIds)
        .eq("tenant_id", input.tenantId);
    }
  } catch (err) {
    await supabase
      .from("fi_import_batches")
      .update({
        status: "import_failed",
        metadata: {
          ...b.metadata,
          apply_error: err instanceof Error ? err.message : String(err),
        },
      })
      .eq("id", b.id);
    throw err;
  }

  const watermarkAfter = await readNotesWatermark(supabase, input.tenantId);
  return {
    ok: true,
    applied: mappingRowIds.length,
    alreadyApplied,
    mode: "apply",
    watermarkBefore,
    watermarkAfter,
    mappingRowIds,
  };
}

export async function countMilestoneNewMappings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("fi_staff_source_ids")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("source_system", HUBSPOT_OWNER_SOURCE_SYSTEM)
    .contains("metadata", { milestone: HUBSPOT_OWNER_RESOLUTION_MILESTONE });
  if (error) throw new Error(error.message);
  return count ?? 0;
}
