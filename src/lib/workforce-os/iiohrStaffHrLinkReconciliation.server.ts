import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { planIiohrStaffHrLinkReconciliation } from "@/src/lib/workforce-os/iiohrStaffHrLinkReconciliationCore";
import type {
  EvolvedStaffRecord,
  FiStaffMemberReconciliationRow,
  IiohrStaffHrLinkReconciliationSummary,
} from "@/src/lib/workforce-os/iiohrStaffHrLinkReconciliationTypes";
import {
  IIOHR_EVOLVED_HR_SOURCE_SYSTEM,
  IIOHR_HR_STAFF_RECONCILIATION_SOURCE,
  STAFF_SYNCED_FROM_IIOHR_EVENT,
} from "@/src/lib/workforce-os/iiohrStaffHrLinkReconciliationTypes";

function mapStaffMemberRow(raw: Record<string, unknown>): FiStaffMemberReconciliationRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    email: raw.email != null ? String(raw.email) : null,
    full_name: String(raw.full_name ?? ""),
    iiohr_staff_record_id:
      raw.iiohr_staff_record_id != null ? String(raw.iiohr_staff_record_id) : null,
    archived_at: raw.archived_at != null ? String(raw.archived_at) : null,
  };
}

function trimUuid(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function buildSourceSnapshot(record: EvolvedStaffRecord): Record<string, unknown> {
  return { ...record };
}

async function loadStaffMembersForReconciliation(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FiStaffMemberReconciliationRow[]> {
  const { data, error } = await supabase
    .from("fi_staff_members")
    .select("id, tenant_id, email, full_name, iiohr_staff_record_id, archived_at")
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapStaffMemberRow);
}

/**
 * Links existing `fi_staff_members` rows to IIOHR Evolved HR feed records using exact
 * case-insensitive email match only. Never creates staff rows or name-based links.
 */
export async function reconcileExistingStaffWithIiohrHrLinks(input: {
  tenantId: string;
  evolvedStaffRecords: EvolvedStaffRecord[];
  client?: SupabaseClient;
  syncedAt?: string;
}): Promise<IiohrStaffHrLinkReconciliationSummary> {
  const tenantId = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();
  const syncedAt = input.syncedAt ?? new Date().toISOString();

  const staffMembers = await loadStaffMembersForReconciliation(supabase, tenantId);
  const planned = planIiohrStaffHrLinkReconciliation({
    staffMembers,
    evolvedStaffRecords: input.evolvedStaffRecords,
  });

  let linked = 0;
  const warnings = [...planned.summary.warnings];

  for (const link of planned.links) {
    const iiohrStaffRecordId = trimUuid(link.evolvedRecord.id);
    if (!iiohrStaffRecordId) {
      warnings.push(`Skipped staff ${link.staffMemberId}: IIOHR feed row missing id.`);
      continue;
    }

    const iiohrUserId = trimUuid(link.evolvedRecord.iiohr_user_id);
    const sourceSnapshot = buildSourceSnapshot(link.evolvedRecord);

    const { error: updateError } = await supabase
      .from("fi_staff_members")
      .update({
        iiohr_staff_record_id: iiohrStaffRecordId,
        iiohr_user_id: iiohrUserId,
        source_system: IIOHR_EVOLVED_HR_SOURCE_SYSTEM,
        source_synced_at: syncedAt,
        source_snapshot: sourceSnapshot,
        updated_at: syncedAt,
      })
      .eq("tenant_id", tenantId)
      .eq("id", link.staffMemberId)
      .is("iiohr_staff_record_id", null);

    if (updateError) {
      warnings.push(
        `Failed to link staff ${link.staffMemberId} to IIOHR record ${iiohrStaffRecordId}: ${updateError.message}`
      );
      continue;
    }

    const { error: auditError } = await supabase.from("fi_staff_member_audit_events").insert({
      tenant_id: tenantId,
      staff_member_id: link.staffMemberId,
      event_type: STAFF_SYNCED_FROM_IIOHR_EVENT,
      source: IIOHR_HR_STAFF_RECONCILIATION_SOURCE,
      metadata: {
        iiohr_staff_record_id: iiohrStaffRecordId,
        iiohr_user_id: iiohrUserId,
        source_system: IIOHR_EVOLVED_HR_SOURCE_SYSTEM,
        source_synced_at: syncedAt,
      },
    });

    if (auditError) {
      warnings.push(
        `Linked staff ${link.staffMemberId} but audit event failed: ${auditError.message}`
      );
    }

    linked += 1;
  }

  return {
    ...planned.summary,
    linked,
    warnings,
  };
}

export type { EvolvedStaffRecord, IiohrStaffHrLinkReconciliationSummary };
