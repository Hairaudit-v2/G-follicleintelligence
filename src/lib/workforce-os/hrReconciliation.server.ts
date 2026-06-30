import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { normaliseStaffEmail } from "@/src/lib/workforce-os/iiohrStaffHrLinkReconciliationCore";
import { planIiohrStaffHrLinkReconciliation } from "@/src/lib/workforce-os/iiohrStaffHrLinkReconciliationCore";
import type { EvolvedStaffRecord } from "@/src/lib/workforce-os/iiohrStaffHrLinkReconciliationTypes";
import {
  IIOHR_EVOLVED_HR_SOURCE_SYSTEM,
  IIOHR_HR_STAFF_RECONCILIATION_SOURCE,
} from "@/src/lib/workforce-os/iiohrStaffHrLinkReconciliationTypes";
import {
  buildReconciliationSuggestions,
  composeFullName,
  parseStaffEmploymentStatus,
  parseStaffIdentitySource,
  splitFullName,
} from "@/src/lib/workforce-os/staffLifecycleCore";
import type {
  HrReconciliationSuggestion,
  StaffMemberLifecycleRow,
} from "@/src/lib/workforce-os/staffLifecycleTypes";
import { STAFF_LIFECYCLE_AUDIT_EVENTS } from "@/src/lib/workforce-os/staffLifecycleTypes";

const LIFECYCLE_SOURCE = "workforce_os_staff_lifecycle";

function mapLifecycleRow(raw: Record<string, unknown>): StaffMemberLifecycleRow {
  const names = splitFullName(String(raw.full_name ?? ""));
  const tags = raw.internal_tags;
  const internal_tags = Array.isArray(tags)
    ? tags.map((t) => String(t)).filter(Boolean)
    : [];
  const snapshot = raw.source_snapshot;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    fi_staff_id: raw.fi_staff_id != null ? String(raw.fi_staff_id) : null,
    first_name: raw.first_name != null ? String(raw.first_name) : names.first_name || null,
    last_name: raw.last_name != null ? String(raw.last_name) : names.last_name || null,
    full_name: String(raw.full_name ?? ""),
    email: raw.email != null ? String(raw.email) : null,
    professional_title: raw.professional_title != null ? String(raw.professional_title) : null,
    phone: raw.phone != null ? String(raw.phone) : null,
    role_code: raw.role_code != null ? String(raw.role_code) : null,
    employment_type: raw.employment_type != null ? String(raw.employment_type) : null,
    employment_status: parseStaffEmploymentStatus(raw.employment_status),
    timezone: raw.timezone != null ? String(raw.timezone) : null,
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    notes: raw.notes != null ? String(raw.notes) : null,
    identity_source: parseStaffIdentitySource(raw.identity_source ?? raw.source_system),
    internal_tags,
    iiohr_staff_record_id:
      raw.iiohr_staff_record_id != null ? String(raw.iiohr_staff_record_id) : null,
    iiohr_user_id: raw.iiohr_user_id != null ? String(raw.iiohr_user_id) : null,
    source_system: raw.source_system != null ? String(raw.source_system) : null,
    source_synced_at: raw.source_synced_at != null ? String(raw.source_synced_at) : null,
    source_snapshot:
      snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
        ? (snapshot as Record<string, unknown>)
        : {},
    archived_at: raw.archived_at != null ? String(raw.archived_at) : null,
    employment_status_reason:
      raw.employment_status_reason != null ? String(raw.employment_status_reason) : null,
    employment_status_changed_at:
      raw.employment_status_changed_at != null ? String(raw.employment_status_changed_at) : null,
    employment_status_changed_by:
      raw.employment_status_changed_by != null ? String(raw.employment_status_changed_by) : null,
    last_manual_profile_update:
      raw.last_manual_profile_update != null ? String(raw.last_manual_profile_update) : null,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

async function insertStaffMemberAudit(
  supabase: SupabaseClient,
  row: {
    tenant_id: string;
    staff_member_id: string;
    event_type: string;
    metadata?: Record<string, unknown>;
    source?: string;
  }
): Promise<void> {
  const { error } = await supabase.from("fi_staff_member_audit_events").insert({
    tenant_id: row.tenant_id,
    staff_member_id: row.staff_member_id,
    event_type: row.event_type,
    source: row.source ?? LIFECYCLE_SOURCE,
    metadata: row.metadata ?? {},
  });
  if (error) throw new Error(error.message);
}

/** Ensures a fi_staff_members projection exists for an operational fi_staff row. */
export async function ensureStaffMemberProjection(
  tenantId: string,
  fiStaffId: string,
  client?: SupabaseClient
): Promise<StaffMemberLifecycleRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(fiStaffId, "fiStaffId");
  const supabase = client ?? supabaseAdmin();

  const { data: existing, error: existingError } = await supabase
    .from("fi_staff_members")
    .select("*")
    .eq("tenant_id", tid)
    .eq("fi_staff_id", sid)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return mapLifecycleRow(existing as Record<string, unknown>);

  const { data: staff, error: staffError } = await supabase
    .from("fi_staff")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", sid)
    .maybeSingle();
  if (staffError) throw new Error(staffError.message);
  if (!staff) throw new Error("Staff not found.");

  const s = staff as Record<string, unknown>;
  const names = splitFullName(String(s.full_name ?? ""));
  const now = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("fi_staff_members")
    .insert({
      tenant_id: tid,
      fi_staff_id: sid,
      full_name: String(s.full_name ?? ""),
      first_name: names.first_name || null,
      last_name: names.last_name || null,
      email: s.email != null ? String(s.email) : null,
      phone: s.mobile != null ? String(s.mobile) : null,
      role_code: String(s.staff_role ?? "consultant"),
      timezone: s.default_timezone != null ? String(s.default_timezone) : null,
      professional_title: s.professional_title != null ? String(s.professional_title) : null,
      employment_status: parseStaffEmploymentStatus(s.employment_status ?? (s.is_active ? "active" : "inactive")),
      identity_source: parseStaffIdentitySource(s.identity_source),
      archived_at: s.archived_at ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (insertError) throw new Error(insertError.message);
  return mapLifecycleRow(inserted as Record<string, unknown>);
}

export async function loadStaffMemberLifecycle(
  tenantId: string,
  staffMemberId: string,
  client?: SupabaseClient
): Promise<StaffMemberLifecycleRow | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_members")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", staffMemberId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapLifecycleRow(data as Record<string, unknown>);
}

export async function loadStaffMemberLifecycleByFiStaffId(
  tenantId: string,
  fiStaffId: string,
  client?: SupabaseClient
): Promise<StaffMemberLifecycleRow | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_members")
    .select("*")
    .eq("tenant_id", tid)
    .eq("fi_staff_id", fiStaffId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapLifecycleRow(data as Record<string, unknown>);
}

export async function findUnlinkedWorkforceStaff(
  tenantId: string,
  client?: SupabaseClient
): Promise<StaffMemberLifecycleRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_members")
    .select("*")
    .eq("tenant_id", tid)
    .is("archived_at", null)
    .is("iiohr_staff_record_id", null)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapLifecycleRow);
}

export async function findMatchingIiohrHrRecords(
  tenantId: string,
  evolvedStaffRecords: EvolvedStaffRecord[]
): Promise<Map<string, EvolvedStaffRecord>> {
  void tenantId;
  const out = new Map<string, EvolvedStaffRecord>();
  for (const record of evolvedStaffRecords) {
    const emailKey = normaliseStaffEmail(record.email);
    if (!emailKey || out.has(emailKey)) continue;
    out.set(emailKey, record);
  }
  return out;
}

export async function buildReconciliationSuggestionsForTenant(input: {
  tenantId: string;
  evolvedStaffRecords: EvolvedStaffRecord[];
  client?: SupabaseClient;
}): Promise<HrReconciliationSuggestion[]> {
  const unlinked = await findUnlinkedWorkforceStaff(input.tenantId, input.client);
  return buildReconciliationSuggestions({
    staffMembers: unlinked,
    evolvedStaffRecords: input.evolvedStaffRecords,
  });
}

export async function approveStaffHrLink(input: {
  tenantId: string;
  staffMemberId: string;
  iiohrStaffRecordId: string;
  iiohrUserId?: string | null;
  sourceSnapshot?: Record<string, unknown>;
  actorUserId?: string | null;
  client?: SupabaseClient;
}): Promise<void> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const staffMemberId = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const iiohrStaffRecordId = assertNonEmptyUuid(input.iiohrStaffRecordId, "iiohrStaffRecordId");
  const supabase = input.client ?? supabaseAdmin();
  const syncedAt = new Date().toISOString();

  const row = await loadStaffMemberLifecycle(tid, staffMemberId, supabase);
  if (!row) throw new Error("Staff member not found.");
  if (row.archived_at) throw new Error("Cannot link archived staff.");

  const { error: updateError } = await supabase
    .from("fi_staff_members")
    .update({
      iiohr_staff_record_id: iiohrStaffRecordId,
      iiohr_user_id: input.iiohrUserId?.trim() || null,
      source_system: IIOHR_EVOLVED_HR_SOURCE_SYSTEM,
      identity_source: "iiohr_evolved_hr",
      source_synced_at: syncedAt,
      source_snapshot: input.sourceSnapshot ?? {},
      updated_at: syncedAt,
    })
    .eq("tenant_id", tid)
    .eq("id", staffMemberId);

  if (updateError) throw new Error(updateError.message);

  if (row.fi_staff_id) {
    await supabase
      .from("fi_staff")
      .update({
        identity_source: "iiohr_evolved_hr",
        updated_at: syncedAt,
      })
      .eq("tenant_id", tid)
      .eq("id", row.fi_staff_id);
  }

  await insertStaffMemberAudit(supabase, {
    tenant_id: tid,
    staff_member_id: staffMemberId,
    event_type: STAFF_LIFECYCLE_AUDIT_EVENTS.HR_RECONCILED,
    metadata: {
      iiohr_staff_record_id: iiohrStaffRecordId,
      iiohr_user_id: input.iiohrUserId ?? null,
      actor_user_id: input.actorUserId ?? null,
      source_system: IIOHR_EVOLVED_HR_SOURCE_SYSTEM,
    },
  });
}

export async function rejectReconciliationSuggestion(input: {
  tenantId: string;
  staffMemberId: string;
  reason?: string;
  client?: SupabaseClient;
}): Promise<void> {
  void input;
  // Rejection is a UI-only dismiss — no DB mutation required.
}

export async function manuallyLinkStaffHrIdentity(input: {
  tenantId: string;
  staffMemberId: string;
  iiohrStaffRecordId: string;
  iiohrUserId?: string | null;
  sourceSnapshot?: Record<string, unknown>;
  actorUserId?: string | null;
  client?: SupabaseClient;
}): Promise<void> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();

  await approveStaffHrLink({
    ...input,
    client: supabase,
  });

  await insertStaffMemberAudit(supabase, {
    tenant_id: tid,
    staff_member_id: input.staffMemberId,
    event_type: STAFF_LIFECYCLE_AUDIT_EVENTS.HR_LINKED_MANUALLY,
    metadata: {
      iiohr_staff_record_id: input.iiohrStaffRecordId,
      actor_user_id: input.actorUserId ?? null,
    },
  });
}

export async function removeStaffHrLink(input: {
  tenantId: string;
  staffMemberId: string;
  actorUserId?: string | null;
  client?: SupabaseClient;
}): Promise<void> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const staffMemberId = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const row = await loadStaffMemberLifecycle(tid, staffMemberId, supabase);
  if (!row) throw new Error("Staff member not found.");

  const { error } = await supabase
    .from("fi_staff_members")
    .update({
      iiohr_staff_record_id: null,
      iiohr_user_id: null,
      source_system: null,
      identity_source: "local",
      source_synced_at: null,
      source_snapshot: {},
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", staffMemberId);
  if (error) throw new Error(error.message);

  if (row.fi_staff_id) {
    await supabase
      .from("fi_staff")
      .update({ identity_source: "local", updated_at: now })
      .eq("tenant_id", tid)
      .eq("id", row.fi_staff_id);
  }

  await insertStaffMemberAudit(supabase, {
    tenant_id: tid,
    staff_member_id: staffMemberId,
    event_type: STAFF_LIFECYCLE_AUDIT_EVENTS.HR_LINK_REMOVED,
    metadata: { actor_user_id: input.actorUserId ?? null },
  });
}

export async function syncAllStaffProjectionsForTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<number> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase.from("fi_staff").select("id").eq("tenant_id", tid);
  if (error) throw new Error(error.message);
  let count = 0;
  for (const row of data ?? []) {
    await ensureStaffMemberProjection(tid, String((row as { id: string }).id), supabase);
    count += 1;
  }
  return count;
}

export async function runEmailReconciliationForTenant(input: {
  tenantId: string;
  evolvedStaffRecords: EvolvedStaffRecord[];
  client?: SupabaseClient;
}): Promise<{ linked: number; suggestions: HrReconciliationSuggestion[] }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();
  await syncAllStaffProjectionsForTenant(tid, supabase);

  const staffMembers = await findUnlinkedWorkforceStaff(tid, supabase);
  const planned = planIiohrStaffHrLinkReconciliation({
    staffMembers: staffMembers.map((r) => ({
      id: r.id,
      tenant_id: r.tenant_id,
      email: r.email,
      full_name: r.full_name,
      iiohr_staff_record_id: r.iiohr_staff_record_id,
      archived_at: r.archived_at,
    })),
    evolvedStaffRecords: input.evolvedStaffRecords,
  });

  let linked = 0;
  for (const link of planned.links) {
    await approveStaffHrLink({
      tenantId: tid,
      staffMemberId: link.staffMemberId,
      iiohrStaffRecordId: String(link.evolvedRecord.id),
      iiohrUserId: link.evolvedRecord.iiohr_user_id != null ? String(link.evolvedRecord.iiohr_user_id) : null,
      sourceSnapshot: { ...link.evolvedRecord },
      client: supabase,
    });
    linked += 1;
  }

  const suggestions = await buildReconciliationSuggestionsForTenant({
    tenantId: tid,
    evolvedStaffRecords: input.evolvedStaffRecords,
    client: supabase,
  });

  return { linked, suggestions };
}

export { mapLifecycleRow, composeFullName, IIOHR_HR_STAFF_RECONCILIATION_SOURCE };
