import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadEvolvedPerthHrStaffRecordsForFiPush } from "@/src/lib/hr/loadEvolvedPerthHrStaffSnapshot.server";
import { IIOHR_HR_SOURCE_SYSTEM } from "@/src/lib/staffImport/iiohrHrStaffImportPlan";
import { isHrStaffSourceSystem } from "@/src/lib/staff/hrStaffReadinessMetadata";
import {
  findExistingStaffMatch,
  loadIdentityLinksForTenant,
  loadStaffMembersForReconciliation,
  normalizeEmail,
  upsertStaffIdentityLink,
} from "@/src/lib/workforce/identityReconciliation.server";
import {
  buildDuplicateStaffContexts,
  buildLinkedExternalKeySet,
  buildLinkedMemberIdSet,
  buildReconciliationDiagnostics,
  extractEmailFromSourceMetadata,
  extractNameFromSourceMetadata,
  findBestExternalMatch,
  isActiveUnlinkedStaff,
  mergeExternalIdentities,
  scoreExternalMatch,
  type ExternalStaffIdentityOption,
  type ReconciliationMemberContext,
  type ReconciliationPipelineDiagnostics,
} from "@/src/lib/workforce/staffReconciliationDataCore";
import { loadHrSyncHealthSummary } from "@/src/lib/workforce/hrSyncAudit.server";
import {
  WORKFORCE_PHASE_1C_AUDIT_EVENTS,
  WORKFORCE_PHASE_1C_AUDIT_SOURCE,
} from "@/src/lib/workforce/workforcePhase1cAudit";

export type { ExternalStaffIdentityOption, ReconciliationPipelineDiagnostics };

export type UnlinkedActiveStaffRow = {
  id: string;
  fullName: string;
  email: string | null;
  roleCode: string | null;
  employmentStatus: string;
  fiStaffId: string | null;
  matchSuggestions: {
    externalId: string;
    externalName: string | null;
    externalEmail: string | null;
    score: number;
    sourceSystem: string;
  }[];
};

export type StaffReconciliationPageModel = {
  unlinkedStaff: UnlinkedActiveStaffRow[];
  availableExternalIdentities: ExternalStaffIdentityOption[];
  diagnostics: ReconciliationPipelineDiagnostics;
};

export type { StaffReconciliationDecisionCard } from "@/src/lib/workforce/staffReconciliationRecommendation.server";

async function insertWorkforceAudit(
  supabase: SupabaseClient,
  row: {
    tenant_id: string;
    staff_member_id: string;
    event_type: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from("fi_staff_member_audit_events").insert({
    tenant_id: row.tenant_id,
    staff_member_id: row.staff_member_id,
    event_type: row.event_type,
    source: WORKFORCE_PHASE_1C_AUDIT_SOURCE,
    metadata: row.metadata ?? {},
  });
  if (error) throw new Error(error.message);
}

async function loadIiohrHrFeedExternalIdentities(): Promise<ExternalStaffIdentityOption[]> {
  try {
    const feedRows = await loadEvolvedPerthHrStaffRecordsForFiPush();
    return feedRows.map((row) => ({
      sourceSystem: IIOHR_HR_SOURCE_SYSTEM,
      externalId: row.external_staff_id,
      externalEmail: normalizeEmail(row.email),
      externalName: row.full_name,
    }));
  } catch {
    return [];
  }
}

function mapSourceIdRowsToExternalIdentities(
  rows: Record<string, unknown>[],
  linkedExternalKeys: Set<string>
): ExternalStaffIdentityOption[] {
  const identities: ExternalStaffIdentityOption[] = [];
  for (const raw of rows) {
    const sys = String(raw.source_system ?? "").trim();
    const extId = String(raw.source_staff_id ?? "").trim();
    if (!sys || !extId || !isHrStaffSourceSystem(sys)) continue;
    const key = `${sys}:${extId}`;
    if (linkedExternalKeys.has(key)) continue;
    const md = raw.metadata;
    const meta =
      md && typeof md === "object" && !Array.isArray(md)
        ? (md as Record<string, unknown>)
        : {};
    identities.push({
      sourceSystem: sys,
      externalId: extId,
      externalEmail: extractEmailFromSourceMetadata(meta),
      externalName: extractNameFromSourceMetadata(meta),
    });
  }
  return identities;
}

export async function loadUnlinkedActiveStaff(
  tenantId: string,
  client?: SupabaseClient
): Promise<UnlinkedActiveStaffRow[]> {
  const queue = await loadStaffReconciliationQueue(tenantId, client);
  return queue.unlinkedStaff;
}

export async function loadAvailableExternalStaffIdentities(
  tenantId: string,
  client?: SupabaseClient
): Promise<ExternalStaffIdentityOption[]> {
  const queue = await loadStaffReconciliationQueue(tenantId, client);
  return queue.availableExternalIdentities;
}

export async function loadStaffReconciliationQueue(
  tenantId: string,
  client?: SupabaseClient
): Promise<StaffReconciliationPageModel> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();

  const [members, identityLinks, memberStatusRes, sourceIdRes, feedIdentities] =
    await Promise.all([
      loadStaffMembersForReconciliation(tid, supabase),
      loadIdentityLinksForTenant(tid, supabase),
      supabase
        .from("fi_staff_members")
        .select("id, employment_status")
        .eq("tenant_id", tid),
      supabase
        .from("fi_staff_source_ids")
        .select("source_system, source_staff_id, metadata")
        .eq("tenant_id", tid),
      loadIiohrHrFeedExternalIdentities(),
    ]);

  if (memberStatusRes.error) throw new Error(memberStatusRes.error.message);
  if (sourceIdRes.error) throw new Error(sourceIdRes.error.message);

  const statusById = new Map(
    ((memberStatusRes.data ?? []) as { id: string; employment_status: string }[]).map((r) => [
      String(r.id),
      String(r.employment_status ?? "active"),
    ])
  );

  const linkedExternalKeys = buildLinkedExternalKeySet(identityLinks);
  const linkedMemberIds = buildLinkedMemberIdSet(identityLinks);

  const availableExternalIdentities = mergeExternalIdentities([
    ...feedIdentities,
    ...mapSourceIdRowsToExternalIdentities(
      (sourceIdRes.data ?? []) as Record<string, unknown>[],
      linkedExternalKeys
    ),
  ]);

  const enrichedMembers: ReconciliationMemberContext[] = members.map((m) => ({
    ...m,
    employmentStatus: statusById.get(m.id) ?? "active",
    iiohrStaffRecordId: m.iiohrStaffRecordId ?? null,
  }));

  const duplicateContexts = buildDuplicateStaffContexts(enrichedMembers);

  const unlinkedStaff: UnlinkedActiveStaffRow[] = enrichedMembers
    .filter((m) => isActiveUnlinkedStaff({ member: m, linkedMemberIds }))
    .map((m) => {
      const suggestions = availableExternalIdentities
        .map((ext) => scoreExternalMatch(m, ext))
        .filter((s) => s.score >= 60)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((s) => ({
          externalId: s.externalId,
          externalName: s.externalName,
          externalEmail: s.externalEmail,
          sourceSystem: s.sourceSystem,
          score: s.score,
        }));

      return {
        id: m.id,
        fullName: m.fullName,
        email: m.email,
        roleCode: m.roleCode,
        employmentStatus: m.employmentStatus ?? "active",
        fiStaffId: m.fiStaffId,
        matchSuggestions: suggestions,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const diagnostics = buildReconciliationDiagnostics({
    members: enrichedMembers,
    externals: availableExternalIdentities,
    linkedMemberIds,
    unlinkedMembers: enrichedMembers.filter((m) =>
      isActiveUnlinkedStaff({ member: m, linkedMemberIds })
    ),
    duplicateContexts,
  });

  return { unlinkedStaff, availableExternalIdentities, diagnostics };
}

export async function loadStaffReconciliationDecisionQueue(
  tenantId: string,
  client?: SupabaseClient
): Promise<{
  decisionCards: import("@/src/lib/workforce/staffReconciliationRecommendation.server").StaffReconciliationDecisionCard[];
  diagnostics: ReconciliationPipelineDiagnostics;
}> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const queue = await loadStaffReconciliationQueue(tid, supabase);

  const { buildReconciliationDecisionCard, formatRecommendationLabel } =
    await import("@/src/lib/workforce/staffReconciliationRecommendation.server");
  const { loadStaffOperationalHistory } =
    await import("@/src/lib/workforce/staffOperationalHistory.server");
  const { generateStaffReconciliationRecommendation } =
    await import("@/src/lib/workforce/staffReconciliationRecommendationCore");

  const decisionCards = [];
  const members = await loadStaffMembersForReconciliation(tid, supabase);
  const memberById = new Map(members.map((m) => [m.id, m]));
  const duplicateContexts = buildDuplicateStaffContexts(
    members.map((m) => ({
      ...m,
      employmentStatus: queue.unlinkedStaff.find((row) => row.id === m.id)?.employmentStatus ?? "active",
      iiohrStaffRecordId: m.iiohrStaffRecordId ?? null,
    }))
  );

  for (const row of queue.unlinkedStaff) {
    const member = memberById.get(row.id);
    const duplicateContext = duplicateContexts.get(row.id);

    if (duplicateContext && duplicateContext.canonicalStaffMemberId !== row.id) {
      const fiRecord = await loadStaffOperationalHistory(tid, row.id, supabase);
      const canonicalRecord = await loadStaffOperationalHistory(
        tid,
        duplicateContext.canonicalStaffMemberId,
        supabase
      );
      const duplicateRecommendation = {
        recommendation: "MERGE_INTO_EXISTING" as const,
        confidence: 90,
        reasoning: [
          "Duplicate FI staff record shares email with another active member",
          `Canonical survivor: ${canonicalRecord.fullName}`,
          "Resolve duplicate before or alongside IIOHR identity linking",
        ],
        suggestedExternalId: null,
        suggestedTargetStaffMemberId: duplicateContext.canonicalStaffMemberId,
        suggestedSourceStaffMemberId: row.id,
      };

      decisionCards.push({
        staffMemberId: row.id,
        fiRecord,
        iiohrRecord: null,
        recommendation: duplicateRecommendation,
        recommendationLabel: formatRecommendationLabel(duplicateRecommendation.recommendation),
      });
      continue;
    }

    const best = member
      ? findBestExternalMatch(member, queue.availableExternalIdentities)
      : null;
    const fallback = row.matchSuggestions[0];
    const matchCandidate =
      best && (best.score >= (fallback?.score ?? 0) || best.emailExactMatch)
        ? best
        : fallback
          ? {
              externalId: fallback.externalId,
              externalName: fallback.externalName,
              externalEmail: fallback.externalEmail,
              sourceSystem: fallback.sourceSystem,
              score: fallback.score,
              emailExactMatch:
                normalizeEmail(member?.email) === normalizeEmail(fallback.externalEmail),
              nameMatch: fallback.score >= 75,
            }
          : null;

    if (!matchCandidate || matchCandidate.score < 1) {
      const fiRecord = await loadStaffOperationalHistory(tid, row.id, supabase);
      const recommendation = generateStaffReconciliationRecommendation({
        fiRecord,
        iiohrMatch: null,
        match: { emailExactMatch: false, nameMatch: false, matchScore: 0, hasConflicts: false },
      });
      decisionCards.push({
        staffMemberId: row.id,
        fiRecord,
        iiohrRecord: null,
        recommendation,
        recommendationLabel: formatRecommendationLabel(recommendation.recommendation),
      });
      continue;
    }

    const card = await buildReconciliationDecisionCard({
      tenantId: tid,
      staffMemberId: row.id,
      externalId: matchCandidate.externalId,
      sourceSystem: matchCandidate.sourceSystem,
      externalEmail: matchCandidate.externalEmail,
      externalName: matchCandidate.externalName,
      matchScore: matchCandidate.score,
      emailMatch:
        ("emailExactMatch" in matchCandidate && matchCandidate.emailExactMatch) ||
        normalizeEmail(member?.email) === normalizeEmail(matchCandidate.externalEmail),
      nameMatch:
        ("nameMatch" in matchCandidate && matchCandidate.nameMatch) ||
        (matchCandidate.score >= 75 &&
          normalizeEmail(member?.email) !== normalizeEmail(matchCandidate.externalEmail)),
      client: supabase,
    });
    decisionCards.push(card);
  }

  return { decisionCards, diagnostics: queue.diagnostics };
}

export async function manuallyLinkStaffIdentity(input: {
  tenantId: string;
  staffMemberId: string;
  sourceSystem: string;
  externalId: string;
  linkedBy?: string | null;
  client?: SupabaseClient;
}): Promise<{ linked: boolean }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const staffMemberId = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const sourceSystem = input.sourceSystem.trim();
  const externalId = input.externalId.trim();
  if (!sourceSystem || !externalId) {
    throw new Error("sourceSystem and externalId are required.");
  }

  const supabase = input.client ?? supabaseAdmin();

  const [members, identityLinks] = await Promise.all([
    loadStaffMembersForReconciliation(tid, supabase),
    loadIdentityLinksForTenant(tid, supabase),
  ]);

  const member = members.find((m) => m.id === staffMemberId);
  if (!member || member.archivedAt || member.mergedInto) {
    throw new Error("Staff member not found or not eligible for linking.");
  }

  const existingLink = identityLinks.find(
    (l) => l.sourceSystem === sourceSystem && l.externalId === externalId
  );
  if (existingLink && existingLink.staffMemberId !== staffMemberId) {
    throw new Error("External identity is already linked to another staff member.");
  }

  const extOption = (await loadAvailableExternalStaffIdentities(tid, supabase)).find(
    (e) => e.sourceSystem === sourceSystem && e.externalId === externalId
  );

  const match = findExistingStaffMatch({
    tenantId: tid,
    sourceSystem,
    externalId,
    email: extOption?.externalEmail ?? member.email,
    fullName: extOption?.externalName ?? member.fullName,
    staffMembers: members,
    identityLinks,
  });

  if (match.requiresManualReview && match.staffMemberId && match.staffMemberId !== staffMemberId) {
    throw new Error(match.conflictReason ?? "Manual review required before linking.");
  }

  await upsertStaffIdentityLink(
    {
      tenantId: tid,
      staffMemberId,
      sourceSystem,
      externalId,
      externalEmail: extOption?.externalEmail ?? member.email,
      externalName: extOption?.externalName ?? member.fullName,
      identityConfidence: 1,
      matchMethod: "manual",
      linkedBy: input.linkedBy ?? null,
    },
    supabase
  );

  const now = new Date().toISOString();
  await supabase
    .from("fi_staff_members")
    .update({
      source_system: sourceSystem,
      source_external_id: externalId,
      source_synced_at: now,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", staffMemberId);

  await insertWorkforceAudit(supabase, {
    tenant_id: tid,
    staff_member_id: staffMemberId,
    event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.MANUAL_IDENTITY_LINKED,
    metadata: {
      source_system: sourceSystem,
      external_id: externalId,
      linked_by: input.linkedBy ?? null,
    },
  });

  await loadHrSyncHealthSummary(tid, supabase);

  return { linked: true };
}