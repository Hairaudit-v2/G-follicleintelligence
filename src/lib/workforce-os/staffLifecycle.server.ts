import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  composeFullName,
  filterProfilePatchForSource,
  shouldDeactivateOnEmploymentChange,
} from "@/src/lib/workforce-os/staffLifecycleCore";
import type {
  EmploymentStatusChangeInput,
  StaffMemberLifecycleRow,
  StaffProfileEditInput,
} from "@/src/lib/workforce-os/staffLifecycleTypes";
import { STAFF_LIFECYCLE_AUDIT_EVENTS } from "@/src/lib/workforce-os/staffLifecycleTypes";
import {
  ensureStaffMemberProjection,
  loadStaffMemberLifecycle,
  loadStaffMemberLifecycleByFiStaffId,
  mapLifecycleRow,
} from "@/src/lib/workforce-os/hrReconciliation.server";

const LIFECYCLE_SOURCE = "workforce_os_staff_lifecycle";

async function insertAudit(
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
    source: LIFECYCLE_SOURCE,
    metadata: row.metadata ?? {},
  });
  if (error) throw new Error(error.message);
}

async function syncFiStaffFromMember(
  supabase: SupabaseClient,
  tenantId: string,
  member: StaffMemberLifecycleRow,
  patch: Record<string, unknown>
): Promise<void> {
  if (!member.fi_staff_id) return;
  const { error } = await supabase
    .from("fi_staff")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", member.fi_staff_id);
  if (error) throw new Error(error.message);
}

export async function updateStaffProfile(input: {
  tenantId: string;
  staffMemberId: string;
  patch: StaffProfileEditInput;
  actorUserId?: string | null;
  client?: SupabaseClient;
}): Promise<StaffMemberLifecycleRow> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const staffMemberId = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const existing = await loadStaffMemberLifecycle(tid, staffMemberId, supabase);
  if (!existing) throw new Error("Staff member not found.");
  if (existing.archived_at) throw new Error("Cannot edit archived staff.");

  const allowed = filterProfilePatchForSource(existing, input.patch);
  const dbPatch: Record<string, unknown> = { updated_at: now, last_manual_profile_update: now };

  if (allowed.first_name !== undefined) dbPatch.first_name = allowed.first_name?.trim() || null;
  if (allowed.last_name !== undefined) dbPatch.last_name = allowed.last_name?.trim() || null;
  if (allowed.professional_title !== undefined)
    dbPatch.professional_title = allowed.professional_title?.trim() || null;
  if (allowed.email !== undefined) dbPatch.email = allowed.email?.trim() || null;
  if (allowed.phone !== undefined) dbPatch.phone = allowed.phone?.trim() || null;
  if (allowed.role_code !== undefined) dbPatch.role_code = allowed.role_code?.trim() || null;
  if (allowed.employment_type !== undefined)
    dbPatch.employment_type = allowed.employment_type?.trim() || null;
  if (allowed.employment_status !== undefined) dbPatch.employment_status = allowed.employment_status;
  if (allowed.timezone !== undefined) dbPatch.timezone = allowed.timezone?.trim() || null;
  if (allowed.clinic_id !== undefined) dbPatch.clinic_id = allowed.clinic_id?.trim() || null;
  if (allowed.notes !== undefined) dbPatch.notes = allowed.notes?.trim() || null;
  if (allowed.internal_tags !== undefined) dbPatch.internal_tags = allowed.internal_tags ?? [];

  const firstName =
    allowed.first_name !== undefined ? (allowed.first_name?.trim() || null) : existing.first_name;
  const lastName =
    allowed.last_name !== undefined ? (allowed.last_name?.trim() || null) : existing.last_name;
  const composed = composeFullName(firstName, lastName);
  if (composed) dbPatch.full_name = composed;

  const { data, error } = await supabase
    .from("fi_staff_members")
    .update(dbPatch)
    .eq("tenant_id", tid)
    .eq("id", staffMemberId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const updated = mapLifecycleRow(data as Record<string, unknown>);
  const fiPatch: Record<string, unknown> = {};
  if (updated.full_name) fiPatch.full_name = updated.full_name;
  if (allowed.email !== undefined) fiPatch.email = updated.email;
  if (allowed.phone !== undefined) fiPatch.mobile = updated.phone;
  if (allowed.role_code !== undefined) fiPatch.staff_role = updated.role_code;
  if (allowed.timezone !== undefined) fiPatch.default_timezone = updated.timezone;
  if (allowed.professional_title !== undefined) fiPatch.professional_title = updated.professional_title;
  if (allowed.employment_status !== undefined) {
    fiPatch.employment_status = updated.employment_status;
    fiPatch.is_active = updated.employment_status === "active";
  }
  if (Object.keys(fiPatch).length) {
    await syncFiStaffFromMember(supabase, tid, updated, fiPatch);
  }

  await insertAudit(supabase, {
    tenant_id: tid,
    staff_member_id: staffMemberId,
    event_type: STAFF_LIFECYCLE_AUDIT_EVENTS.PROFILE_UPDATED,
    metadata: { actor_user_id: input.actorUserId ?? null, fields: Object.keys(allowed) },
  });

  return updated;
}

export async function changeStaffEmploymentStatus(input: {
  tenantId: string;
  staffMemberId: string;
  change: EmploymentStatusChangeInput;
  actorUserId?: string | null;
  client?: SupabaseClient;
}): Promise<StaffMemberLifecycleRow> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const staffMemberId = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const existing = await loadStaffMemberLifecycle(tid, staffMemberId, supabase);
  if (!existing) throw new Error("Staff member not found.");

  const deactivate = shouldDeactivateOnEmploymentChange(
    input.change.employment_status,
    input.change.archive_from_active
  );

  const dbPatch: Record<string, unknown> = {
    employment_status: input.change.employment_status,
    employment_status_reason: input.change.reason.trim(),
    employment_status_changed_at: input.change.effective_date,
    employment_status_changed_by: input.actorUserId ?? null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("fi_staff_members")
    .update(dbPatch)
    .eq("tenant_id", tid)
    .eq("id", staffMemberId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const updated = mapLifecycleRow(data as Record<string, unknown>);
  await syncFiStaffFromMember(supabase, tid, updated, {
    employment_status: input.change.employment_status,
    employment_status_reason: input.change.reason.trim(),
    employment_status_changed_at: input.change.effective_date,
    employment_status_changed_by: input.actorUserId ?? null,
    is_active: !deactivate,
  });

  await insertAudit(supabase, {
    tenant_id: tid,
    staff_member_id: staffMemberId,
    event_type: STAFF_LIFECYCLE_AUDIT_EVENTS.EMPLOYMENT_STATUS_CHANGED,
    metadata: {
      actor_user_id: input.actorUserId ?? null,
      previous_status: existing.employment_status,
      new_status: input.change.employment_status,
      reason: input.change.reason.trim(),
      effective_date: input.change.effective_date,
      deactivated: deactivate,
    },
  });

  return updated;
}

export async function archiveStaffMember(input: {
  tenantId: string;
  staffMemberId: string;
  actorUserId?: string | null;
  client?: SupabaseClient;
}): Promise<StaffMemberLifecycleRow> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const staffMemberId = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("fi_staff_members")
    .update({ archived_at: now, updated_at: now })
    .eq("tenant_id", tid)
    .eq("id", staffMemberId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const updated = mapLifecycleRow(data as Record<string, unknown>);
  await syncFiStaffFromMember(supabase, tid, updated, {
    archived_at: now,
    is_active: false,
  });

  await insertAudit(supabase, {
    tenant_id: tid,
    staff_member_id: staffMemberId,
    event_type: STAFF_LIFECYCLE_AUDIT_EVENTS.ARCHIVED,
    metadata: { actor_user_id: input.actorUserId ?? null },
  });

  return updated;
}

export async function restoreStaffMember(input: {
  tenantId: string;
  staffMemberId: string;
  actorUserId?: string | null;
  client?: SupabaseClient;
}): Promise<StaffMemberLifecycleRow> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const staffMemberId = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("fi_staff_members")
    .update({ archived_at: null, updated_at: now })
    .eq("tenant_id", tid)
    .eq("id", staffMemberId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const updated = mapLifecycleRow(data as Record<string, unknown>);
  const isActive = updated.employment_status === "active";
  await syncFiStaffFromMember(supabase, tid, updated, {
    archived_at: null,
    is_active: isActive,
  });

  await insertAudit(supabase, {
    tenant_id: tid,
    staff_member_id: staffMemberId,
    event_type: STAFF_LIFECYCLE_AUDIT_EVENTS.RESTORED,
    metadata: { actor_user_id: input.actorUserId ?? null },
  });

  return updated;
}

export async function loadStaffLifecycleForFiStaff(
  tenantId: string,
  fiStaffId: string,
  client?: SupabaseClient
): Promise<StaffMemberLifecycleRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(fiStaffId, "fiStaffId");
  const supabase = client ?? supabaseAdmin();

  let row = await loadStaffMemberLifecycleByFiStaffId(tid, sid, supabase);
  if (!row) row = await ensureStaffMemberProjection(tid, sid, supabase);
  return row;
}

export async function loadStaffMemberAuditTimeline(
  tenantId: string,
  staffMemberId: string,
  client?: SupabaseClient
): Promise<
  {
    id: string;
    event_type: string;
    source: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }[]
> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_staff_member_audit_events")
    .select("id, event_type, source, metadata, created_at")
    .eq("tenant_id", tid)
    .eq("staff_member_id", staffMemberId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const md = r.metadata;
    return {
      id: String(r.id),
      event_type: String(r.event_type),
      source: String(r.source),
      metadata:
        md && typeof md === "object" && !Array.isArray(md)
          ? (md as Record<string, unknown>)
          : {},
      created_at: String(r.created_at),
    };
  });
}

export {
  ensureStaffMemberProjection,
  loadStaffMemberLifecycle,
  syncAllStaffProjectionsForTenant,
} from "@/src/lib/workforce-os/hrReconciliation.server";
