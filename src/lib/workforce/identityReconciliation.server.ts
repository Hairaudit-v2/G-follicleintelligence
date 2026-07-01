import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type { IiohrHrStaffImportRow } from "@/src/lib/staffImport/iiohrHrStaffImportTypes";
import {
  normalizeEmail,
  reconcileInboundStaffIdentity,
  type IdentityLinkSnapshot,
  type InboundStaffIdentity,
  type StaffMemberSnapshot,
  type StaffIdentityMatchMethod,
} from "@/src/lib/workforce/identityReconciliationCore";

export type UpsertStaffIdentityLinkInput = {
  tenantId: string;
  staffMemberId: string;
  sourceSystem: string;
  externalId: string;
  externalEmail?: string | null;
  externalName?: string | null;
  identityConfidence?: number;
  matchMethod?: StaffIdentityMatchMethod | string | null;
  linkedBy?: string | null;
};

function mapStaffMemberRow(raw: Record<string, unknown>): StaffMemberSnapshot {
  return {
    id: String(raw.id),
    tenantId: String(raw.tenant_id),
    fullName: String(raw.full_name ?? ""),
    email: raw.email != null ? String(raw.email) : null,
    phone: raw.phone != null ? String(raw.phone) : null,
    roleCode: raw.role_code != null ? String(raw.role_code) : null,
    fiStaffId: raw.fi_staff_id != null ? String(raw.fi_staff_id) : null,
    sourceExternalId: raw.source_external_id != null ? String(raw.source_external_id) : null,
    iiohrStaffRecordId:
      raw.iiohr_staff_record_id != null ? String(raw.iiohr_staff_record_id) : null,
    sourceSystem: raw.source_system != null ? String(raw.source_system) : null,
    mergedInto: raw.merged_into != null ? String(raw.merged_into) : null,
    archivedAt: raw.archived_at != null ? String(raw.archived_at) : null,
  };
}

function mapIdentityLinkRow(raw: Record<string, unknown>): IdentityLinkSnapshot {
  return {
    staffMemberId: String(raw.staff_member_id),
    sourceSystem: String(raw.source_system),
    externalId: String(raw.external_id),
    externalEmail: raw.external_email != null ? String(raw.external_email) : null,
    externalName: raw.external_name != null ? String(raw.external_name) : null,
  };
}

export async function loadStaffMembersForReconciliation(
  tenantId: string,
  client?: SupabaseClient
): Promise<StaffMemberSnapshot[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_members")
    .select(
      "id, tenant_id, full_name, email, phone, role_code, fi_staff_id, source_external_id, iiohr_staff_record_id, source_system, merged_into, archived_at"
    )
    .eq("tenant_id", tid);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapStaffMemberRow);
}

export async function loadIdentityLinksForTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<IdentityLinkSnapshot[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_identity_links")
    .select("staff_member_id, source_system, external_id, external_email, external_name")
    .eq("tenant_id", tid);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapIdentityLinkRow);
}

export async function upsertStaffIdentityLink(
  input: UpsertStaffIdentityLinkInput,
  client?: SupabaseClient
): Promise<void> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const staffMemberId = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const sourceSystem = input.sourceSystem.trim();
  const externalId = input.externalId.trim();
  if (!sourceSystem || !externalId) throw new Error("sourceSystem and externalId are required.");

  const now = new Date().toISOString();
  const supabase = client ?? supabaseAdmin();
  const row = {
    tenant_id: tid,
    staff_member_id: staffMemberId,
    source_system: sourceSystem,
    external_id: externalId,
    external_email: normalizeEmail(input.externalEmail) ?? null,
    external_name: input.externalName?.trim() || null,
    identity_confidence: input.identityConfidence ?? 1,
    match_method: input.matchMethod ?? null,
    linked_at: now,
    linked_by: input.linkedBy?.trim() || null,
    updated_at: now,
  };

  const { error } = await supabase
    .from("fi_staff_identity_links")
    .upsert(row, { onConflict: "tenant_id,source_system,external_id" });
  if (error) throw new Error(error.message);
}

export type ReconcileInboundStaffIdentityApplyResult = {
  staffMemberId: string | null;
  matchMethod: string;
  linked: boolean;
  created: boolean;
  updated: boolean;
  requiresManualReview: boolean;
  warning: string | null;
};

export async function reconcileInboundStaffIdentityApply(input: {
  tenantId: string;
  inbound: InboundStaffIdentity;
  syncedAt?: string;
  client?: SupabaseClient;
}): Promise<ReconcileInboundStaffIdentityApplyResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();
  const syncedAt = input.syncedAt ?? new Date().toISOString();

  const [staffMembers, identityLinks] = await Promise.all([
    loadStaffMembersForReconciliation(tid, supabase),
    loadIdentityLinksForTenant(tid, supabase),
  ]);

  const plan = reconcileInboundStaffIdentity({
    tenantId: tid,
    inbound: input.inbound,
    staffMembers,
    identityLinks,
  });

  if (plan.requiresManualReview) {
    return {
      staffMemberId: plan.staffMemberId,
      matchMethod: plan.matchMethod,
      linked: false,
      created: false,
      updated: false,
      requiresManualReview: true,
      warning: plan.conflictReason,
    };
  }

  if (plan.shouldUpdate && plan.staffMemberId) {
    const member = staffMembers.find((m) => m.id === plan.staffMemberId);
    const patch: Record<string, unknown> = {
      source_system: input.inbound.sourceSystem,
      source_external_id: input.inbound.externalId,
      source_synced_at: syncedAt,
      updated_at: syncedAt,
    };
    const inboundEmail = normalizeEmail(input.inbound.email);
    const existingEmail = normalizeEmail(member?.email ?? null);
    if (inboundEmail && !existingEmail) patch.email = inboundEmail;

    const { error: updateError } = await supabase
      .from("fi_staff_members")
      .update(patch)
      .eq("tenant_id", tid)
      .eq("id", plan.staffMemberId);
    if (updateError) throw new Error(updateError.message);

    await upsertStaffIdentityLink(
      {
        tenantId: tid,
        staffMemberId: plan.staffMemberId,
        sourceSystem: input.inbound.sourceSystem,
        externalId: input.inbound.externalId,
        externalEmail: input.inbound.email,
        externalName: input.inbound.fullName,
        identityConfidence: plan.confidence,
        matchMethod: plan.matchMethod,
      },
      supabase
    );

    return {
      staffMemberId: plan.staffMemberId,
      matchMethod: plan.matchMethod,
      linked: true,
      created: false,
      updated: true,
      requiresManualReview: false,
      warning: null,
    };
  }

  if (plan.shouldCreate) {
    const { data, error } = await supabase
      .from("fi_staff_members")
      .insert({
        tenant_id: tid,
        full_name: input.inbound.fullName.trim() || "Staff",
        email: normalizeEmail(input.inbound.email),
        role_code: input.inbound.roleCode?.trim() || null,
        phone: input.inbound.phone?.trim() || null,
        source_system: input.inbound.sourceSystem,
        source_external_id: input.inbound.externalId,
        source_synced_at: syncedAt,
        identity_source: "iiohr_evolved_hr",
        employment_status: "active",
        created_at: syncedAt,
        updated_at: syncedAt,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const staffMemberId = String((data as { id: string }).id);

    await upsertStaffIdentityLink(
      {
        tenantId: tid,
        staffMemberId,
        sourceSystem: input.inbound.sourceSystem,
        externalId: input.inbound.externalId,
        externalEmail: input.inbound.email,
        externalName: input.inbound.fullName,
        identityConfidence: 1,
        matchMethod: "none",
      },
      supabase
    );

    return {
      staffMemberId,
      matchMethod: "none",
      linked: false,
      created: true,
      updated: false,
      requiresManualReview: false,
      warning: null,
    };
  }

  return {
    staffMemberId: null,
    matchMethod: plan.matchMethod,
    linked: false,
    created: false,
    updated: false,
    requiresManualReview: false,
    warning: null,
  };
}

/** Enriches fi_staff import snapshots with workforce identity link mappings. */
export async function enrichImportSnapshotsWithIdentityLinks(
  tenantId: string,
  inboundRows: IiohrHrStaffImportRow[],
  sourceSystem: string,
  snapshots: {
    existingStaffSourceIds: {
      id: string;
      staff_id: string;
      source_system: string;
      source_staff_id: string;
      source_url: string | null;
      metadata: Record<string, unknown>;
    }[];
  }
): Promise<{ injectedSourceIds: number; linkedStaffMemberIds: string[] }> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const [staffMembers, identityLinks] = await Promise.all([
    loadStaffMembersForReconciliation(tid),
    loadIdentityLinksForTenant(tid),
  ]);

  const fiStaffByMemberId = new Map(
    staffMembers.filter((m) => m.fiStaffId).map((m) => [m.id, m.fiStaffId!])
  );
  const existingExtKeys = new Set(
    snapshots.existingStaffSourceIds.map(
      (s) => `${s.source_system}:${s.source_staff_id}`
    )
  );

  let injected = 0;
  const linkedMemberIds: string[] = [];

  for (const row of inboundRows) {
    const match = reconcileInboundStaffIdentity({
      tenantId: tid,
      inbound: {
        sourceSystem,
        externalId: row.external_staff_id,
        email: row.email ?? null,
        fullName: row.full_name,
      },
      staffMembers,
      identityLinks,
    });

    if (!match.staffMemberId || match.requiresManualReview) continue;
    const fiStaffId = fiStaffByMemberId.get(match.staffMemberId);
    if (!fiStaffId) continue;

    const key = `${sourceSystem}:${row.external_staff_id}`;
    if (existingExtKeys.has(key)) continue;

    snapshots.existingStaffSourceIds.push({
      id: `workforce-injected-${row.external_staff_id}`,
      staff_id: fiStaffId,
      source_system: sourceSystem,
      source_staff_id: row.external_staff_id,
      source_url: null,
      metadata: { injected_by: "workforce_identity_reconciliation" },
    });
    existingExtKeys.add(key);
    injected += 1;
    linkedMemberIds.push(match.staffMemberId);
  }

  return { injectedSourceIds: injected, linkedStaffMemberIds: linkedMemberIds };
}

export {
  normalizeEmail,
  normalizeName,
  calculateStaffIdentityMatchScore,
  findExistingStaffMatch,
  reconcileInboundStaffIdentity,
} from "@/src/lib/workforce/identityReconciliationCore";