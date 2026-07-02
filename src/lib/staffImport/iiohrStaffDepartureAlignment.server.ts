import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  isAlreadyOffboardedEmploymentStatus,
  isIiohrFullOffboardHrStatus,
  mapHrEmploymentToFiDepartureStatus,
  resolveIiohrDepartureAlignmentKind,
} from "@/src/lib/staffImport/iiohrStaffDepartureCore";
import { IIOHR_EVOLVED_HR_SOURCE_SYSTEM } from "@/src/lib/workforce-os/iiohrStaffHrLinkReconciliationTypes";
import { parseStaffEmploymentStatus } from "@/src/lib/workforce-os/staffLifecycleCore";
import {
  OFFBOARDING_CENTRE_EMPLOYMENT_STATUSES,
  STAFF_LIFECYCLE_AUDIT_EVENTS,
  type StaffEmploymentStatus,
} from "@/src/lib/workforce-os/staffLifecycleTypes";
import { applyStaffDepartureSideEffects } from "@/src/lib/workforce/staffDepartureSideEffects.server";
import { offboardStaffMember } from "@/src/lib/workforce/staffOffboarding.server";
import {
  WORKFORCE_PHASE_1C_AUDIT_EVENTS,
  WORKFORCE_PHASE_1C_AUDIT_SOURCE,
} from "@/src/lib/workforce/workforcePhase1cAudit";

const LIFECYCLE_SOURCE = "workforce_os_staff_lifecycle";

export type AlignIiohrStaffDepartureResult = {
  fiStaffId: string;
  staffMemberId: string | null;
  action: "full_offboard" | "deactivate_only" | "skipped_already_offboarded" | "queued";
  employmentStatus: StaffEmploymentStatus | null;
};

async function insertLifecycleAudit(
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

async function queuePendingIiohrDepartureAlignment(
  supabase: SupabaseClient,
  tenantId: string,
  staffMemberId: string,
  fiStaffId: string,
  hrEmploymentStatus: string,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("fi_staff_compliance_alerts").upsert(
    {
      tenant_id: tenantId,
      staff_member_id: staffMemberId,
      alert_type: "pending_iiohr_departure_alignment",
      severity: "high",
      message: `IIOHR reported ${hrEmploymentStatus} for staff but automatic departure alignment could not complete: ${reason}`,
      resolved: false,
      updated_at: now,
    },
    { onConflict: "tenant_id,staff_member_id,alert_type" }
  );
  if (error) throw new Error(error.message);

  await insertWorkforceAudit(supabase, {
    tenant_id: tenantId,
    staff_member_id: staffMemberId,
    event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.IIOHR_DEPARTURE_QUEUED,
    metadata: {
      fi_staff_id: fiStaffId,
      hr_employment_status: hrEmploymentStatus,
      reason,
      source_system: IIOHR_EVOLVED_HR_SOURCE_SYSTEM,
    },
  });
}

async function alignInactiveFromIiohr(
  supabase: SupabaseClient,
  tenantId: string,
  fiStaffId: string,
  staffMember: Record<string, unknown> | null,
  hrEmploymentStatus: string
): Promise<AlignIiohrStaffDepartureResult> {
  const now = new Date().toISOString();
  const exitReason = `IIOHR HR feed: ${hrEmploymentStatus}`;

  const { error: fiStaffError } = await supabase
    .from("fi_staff")
    .update({
      is_active: false,
      employment_status: "inactive",
      employment_status_reason: exitReason,
      employment_status_changed_at: now,
      updated_at: now,
    })
    .eq("tenant_id", tenantId)
    .eq("id", fiStaffId);
  if (fiStaffError) throw new Error(fiStaffError.message);

  const staffMemberId =
    staffMember != null ? String(staffMember.id) : null;

  if (staffMemberId && staffMember) {
    const previousStatus = String(staffMember.employment_status ?? "active");
    const { error: memberError } = await supabase
      .from("fi_staff_members")
      .update({
        employment_status: "inactive",
        employment_status_reason: exitReason,
        employment_status_changed_at: now,
        updated_at: now,
      })
      .eq("tenant_id", tenantId)
      .eq("id", staffMemberId);
    if (memberError) throw new Error(memberError.message);

    await insertLifecycleAudit(supabase, {
      tenant_id: tenantId,
      staff_member_id: staffMemberId,
      event_type: STAFF_LIFECYCLE_AUDIT_EVENTS.EMPLOYMENT_STATUS_CHANGED,
      metadata: {
        previous_status: previousStatus,
        new_status: "inactive",
        reason: exitReason,
        source_system: IIOHR_EVOLVED_HR_SOURCE_SYSTEM,
        externally_sourced: true,
        full_offboard: false,
      },
    });
  }

  return {
    fiStaffId,
    staffMemberId,
    action: "deactivate_only",
    employmentStatus: "inactive",
  };
}

/**
 * Aligns FI workforce lifecycle state when IIOHR HR feed reports a staff departure.
 * Full offboard statuses invoke the same side-effect engine as HR OS Offboarding Centre.
 */
export async function alignIiohrStaffDeparture(input: {
  tenantId: string;
  fiStaffId: string;
  hrEmploymentStatus: string;
  client?: SupabaseClient;
}): Promise<AlignIiohrStaffDepartureResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const fiStaffId = assertNonEmptyUuid(input.fiStaffId, "fiStaffId");
  const hrEmploymentStatus = input.hrEmploymentStatus.trim();
  const supabase = input.client ?? supabaseAdmin();
  const alignmentKind = resolveIiohrDepartureAlignmentKind(hrEmploymentStatus);

  if (alignmentKind === "none") {
    return {
      fiStaffId,
      staffMemberId: null,
      action: "skipped_already_offboarded",
      employmentStatus: null,
    };
  }

  const { data: staffMember, error: memberError } = await supabase
    .from("fi_staff_members")
    .select("*")
    .eq("tenant_id", tid)
    .eq("fi_staff_id", fiStaffId)
    .is("archived_at", null)
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);

  const staffMemberId = staffMember != null ? String(staffMember.id) : null;
  const currentStatus = staffMember != null
    ? parseStaffEmploymentStatus(staffMember.employment_status)
    : null;

  if (currentStatus != null && isAlreadyOffboardedEmploymentStatus(currentStatus)) {
    return {
      fiStaffId,
      staffMemberId,
      action: "skipped_already_offboarded",
      employmentStatus: currentStatus,
    };
  }

  if (alignmentKind === "deactivate_only") {
    return alignInactiveFromIiohr(
      supabase,
      tid,
      fiStaffId,
      staffMember as Record<string, unknown> | null,
      hrEmploymentStatus
    );
  }

  const targetStatus = mapHrEmploymentToFiDepartureStatus(hrEmploymentStatus);
  if (!targetStatus || !OFFBOARDING_CENTRE_EMPLOYMENT_STATUSES.has(targetStatus)) {
    return {
      fiStaffId,
      staffMemberId,
      action: "skipped_already_offboarded",
      employmentStatus: null,
    };
  }

  const exitReason = `IIOHR HR feed: ${hrEmploymentStatus}`;

  if (staffMemberId) {
    try {
      await offboardStaffMember({
        tenantId: tid,
        staffId: staffMemberId,
        exitReason,
        employmentStatus: targetStatus,
        departureSource: "iiohr_hr",
        client: supabase,
      });

      await insertWorkforceAudit(supabase, {
        tenant_id: tid,
        staff_member_id: staffMemberId,
        event_type: WORKFORCE_PHASE_1C_AUDIT_EVENTS.IIOHR_DEPARTURE_ALIGNED,
        metadata: {
          fi_staff_id: fiStaffId,
          hr_employment_status: hrEmploymentStatus,
          employment_status: targetStatus,
          source_system: IIOHR_EVOLVED_HR_SOURCE_SYSTEM,
          externally_sourced: true,
        },
      });

      return {
        fiStaffId,
        staffMemberId,
        action: "full_offboard",
        employmentStatus: targetStatus,
      };
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      await queuePendingIiohrDepartureAlignment(
        supabase,
        tid,
        staffMemberId,
        fiStaffId,
        hrEmploymentStatus,
        reason
      );
      return {
        fiStaffId,
        staffMemberId,
        action: "queued",
        employmentStatus: targetStatus,
      };
    }
  }

  // No fi_staff_members projection — apply fi_staff + side effects directly.
  if (!isIiohrFullOffboardHrStatus(hrEmploymentStatus)) {
    return {
      fiStaffId,
      staffMemberId: null,
      action: "skipped_already_offboarded",
      employmentStatus: null,
    };
  }

  const now = new Date().toISOString();
  const { error: fiStaffError } = await supabase
    .from("fi_staff")
    .update({
      employment_status: targetStatus,
      is_active: false,
      employment_status_reason: exitReason,
      employment_status_changed_at: now,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", fiStaffId);
  if (fiStaffError) throw new Error(fiStaffError.message);

  await applyStaffDepartureSideEffects({
    tenantId: tid,
    fiStaffId,
    client: supabase,
    now,
  });

  return {
    fiStaffId,
    staffMemberId: null,
    action: "full_offboard",
    employmentStatus: targetStatus,
  };
}
