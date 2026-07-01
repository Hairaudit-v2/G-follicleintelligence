import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { IIOHR_EVOLVED_HR_SOURCE_SYSTEM } from "@/src/lib/workforce-os/iiohrStaffHrLinkReconciliationTypes";
import type { StaffMemberSnapshot } from "@/src/lib/workforce/identityReconciliationCore";
import {
  calculateStaffIdentityMatchScore,
  findExistingStaffMatch,
  loadIdentityLinksForTenant,
  loadStaffMembersForReconciliation,
  normalizeEmail,
  upsertStaffIdentityLink,
} from "@/src/lib/workforce/identityReconciliation.server";
import { loadHrSyncHealthSummary } from "@/src/lib/workforce/hrSyncAudit.server";
import {
  WORKFORCE_PHASE_1C_AUDIT_EVENTS,
  WORKFORCE_PHASE_1C_AUDIT_SOURCE,
} from "@/src/lib/workforce/workforcePhase1cAudit";

export type ExternalStaffIdentityOption = {
  sourceSystem: string;
  externalId: string;
  externalEmail: string | null;
  externalName: string | null;
};

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
};

const ACTIVE_EMPLOYMENT_STATUSES = new Set([
  "active",
  "pending_onboarding",
  "on_leave",
]);

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

function isActiveUnlinkedMember(
  member: StaffMemberSnapshot & { employmentStatus?: string | null },
  linkedMemberIds: Set<string>
): boolean {
  if (member.archivedAt || member.mergedInto) return false;
  if (linkedMemberIds.has(member.id)) return false;
  const status = (member.employmentStatus ?? "active").toLowerCase();
  return ACTIVE_EMPLOYMENT_STATUSES.has(status);
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

  const [members, identityLinks, memberStatusRes, sourceIdRes] = await Promise.all([
    loadStaffMembersForReconciliation(tid, supabase),
    loadIdentityLinksForTenant(tid, supabase),
    supabase
      .from("fi_staff_members")
      .select("id, employment_status")
      .eq("tenant_id", tid),
    supabase
      .from("fi_staff_source_ids")
      .select("source_system, source_staff_id, metadata")
      .eq("tenant_id", tid)
      .limit(500),
  ]);

  if (memberStatusRes.error) throw new Error(memberStatusRes.error.message);

  const statusById = new Map(
    ((memberStatusRes.data ?? []) as { id: string; employment_status: string }[]).map((r) => [
      String(r.id),
      String(r.employment_status ?? "active"),
    ])
  );

  const linkedExternalKeys = new Set(
    identityLinks.map((l) => `${l.sourceSystem}:${l.externalId}`)
  );
  const linkedMemberIds = new Set(identityLinks.map((l) => l.staffMemberId));

  const externalByKey = new Map<string, ExternalStaffIdentityOption>();

  for (const m of members) {
    if (!m.sourceExternalId) continue;
    const sys = IIOHR_EVOLVED_HR_SOURCE_SYSTEM;
    const key = `${sys}:${m.sourceExternalId}`;
    if (linkedExternalKeys.has(key)) continue;
    externalByKey.set(key, {
      sourceSystem: sys,
      externalId: m.sourceExternalId,
      externalEmail: normalizeEmail(m.email),
      externalName: m.fullName || null,
    });
  }

  if (!sourceIdRes.error && sourceIdRes.data) {
    for (const raw of sourceIdRes.data as Record<string, unknown>[]) {
      const sys = String(raw.source_system ?? "").trim();
      const extId = String(raw.source_staff_id ?? "").trim();
      if (!sys || !extId) continue;
      if (!sys.includes("iiohr") && !sys.includes("hr")) continue;
      const key = `${sys}:${extId}`;
      if (linkedExternalKeys.has(key)) continue;
      const md = raw.metadata;
      const meta =
        md && typeof md === "object" && !Array.isArray(md)
          ? (md as Record<string, unknown>)
          : {};
      externalByKey.set(key, {
        sourceSystem: sys,
        externalId: extId,
        externalEmail: normalizeEmail(
          meta.email != null ? String(meta.email) : null
        ),
        externalName:
          meta.full_name != null
            ? String(meta.full_name)
            : meta.name != null
              ? String(meta.name)
              : null,
      });
    }
  }

  const availableExternalIdentities = [...externalByKey.values()].sort((a, b) =>
    (a.externalName ?? a.externalId).localeCompare(b.externalName ?? b.externalId)
  );

  const enrichedMembers = members.map((m) => ({
    ...m,
    employmentStatus: statusById.get(m.id) ?? "active",
  }));

  const unlinkedStaff: UnlinkedActiveStaffRow[] = enrichedMembers
    .filter((m) => isActiveUnlinkedMember(m, linkedMemberIds))
    .map((m) => {
      const suggestions = availableExternalIdentities
        .map((ext) => ({
          externalId: ext.externalId,
          externalName: ext.externalName,
          externalEmail: ext.externalEmail,
          sourceSystem: ext.sourceSystem,
          score: calculateStaffIdentityMatchScore(m, {
            sourceSystem: ext.sourceSystem,
            externalId: ext.externalId,
            email: ext.externalEmail,
            fullName: ext.externalName ?? "",
          }),
        }))
        .filter((s) => s.score >= 60)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

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

  return { unlinkedStaff, availableExternalIdentities };
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