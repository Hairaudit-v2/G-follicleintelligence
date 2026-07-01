import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { isClinicalProviderStaffRole } from "@/src/lib/hr/hrStaffReadinessDashboard";
import { canStaffBeAssignedClinically } from "@/src/lib/workforce-os/workforceReadinessClinicalEligibility";
import type { WorkforceReadinessScoreInput } from "@/src/lib/workforce-os/workforceReadinessEngine";
import { parseStaffEmploymentStatus } from "@/src/lib/workforce-os/staffLifecycleCore";
import { loadStaffMemberForTenant } from "@/src/lib/staff/staff.server";
import { buildStaffComplianceSummaryFromSourceRows } from "@/src/lib/staffCompliance/staffComplianceSummary";
import { pickStaffHrNotificationFromSourceRows } from "@/src/lib/staff/staffHrNotificationSummary";
import {
  calculateClinicalEligibility,
  type StaffClinicalEligibilityResult,
} from "@/src/lib/workforce/clinicalEligibilityCore";
import { loadOpenComplianceAlertsForMember } from "@/src/lib/workforce/complianceAutomation.server";
import { loadCertificationHistory } from "@/src/lib/workforce/staffCertification.server";
import { loadStaffCredentials } from "@/src/lib/workforce/staffCredentials.server";
import { resolveStaffMemberContext } from "@/src/lib/workforce/workforceStaffMemberResolve.server";

export type { StaffClinicalEligibilityResult };

export async function calculateStaffClinicalEligibility(input: {
  tenantId: string;
  staffId: string;
  client?: SupabaseClient;
}): Promise<StaffClinicalEligibilityResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();

  const memberCtx = await resolveStaffMemberContext(tid, input.staffId, supabase);
  if (!memberCtx) {
    return {
      eligible: false,
      status: "inactive",
      score: 0,
      blockingReasons: ["Staff member not found"],
      warnings: [],
    };
  }

  const fiStaffId = memberCtx.fiStaffId ?? input.staffId;
  let readinessInput: WorkforceReadinessScoreInput = {
    is_active: false,
    staff_role: "unknown",
    working_hours: {},
    hr: pickStaffHrNotificationFromSourceRows([]),
    identityRows: [],
    compliance: buildStaffComplianceSummaryFromSourceRows([], { now: new Date() }),
  };
  let isClinicalRole = true;

  const staff = await loadStaffMemberForTenant(tid, fiStaffId, supabase);
  if (staff) {
    isClinicalRole = isClinicalProviderStaffRole(staff.staff_role);
    const { data: sourceRows, error: sourceErr } = await supabase
      .from("fi_staff_source_ids")
      .select("source_system, source_staff_id, source_url, metadata")
      .eq("tenant_id", tid)
      .eq("staff_id", fiStaffId);
    if (sourceErr) throw new Error(sourceErr.message);

    const srcRows = (sourceRows ?? []).map((r) => {
      const row = r as { source_system: string; source_url: string | null; metadata: unknown };
      return {
        source_system: String(row.source_system),
        source_url: row.source_url,
        metadata:
          row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : null,
      };
    });

    const hr = pickStaffHrNotificationFromSourceRows(srcRows);
    const compliance = buildStaffComplianceSummaryFromSourceRows(
      srcRows.map((row) => ({ source_system: row.source_system, metadata: row.metadata })),
      { now: new Date() }
    );

    readinessInput = {
      is_active: staff.is_active,
      staff_role: staff.staff_role,
      working_hours: staff.working_hours,
      hr,
      identityRows: srcRows.map((row) => ({
        source_system: row.source_system,
        source_staff_id: "",
        metadata: row.metadata,
      })),
      compliance,
    };
  }

  const readiness = canStaffBeAssignedClinically(readinessInput);
  const employmentStatus = parseStaffEmploymentStatus(memberCtx.employmentStatus);

  const [credentials, certifications, alerts] = await Promise.all([
    loadStaffCredentials(tid, memberCtx.staffMemberId, supabase),
    loadCertificationHistory(tid, memberCtx.staffMemberId, supabase),
    loadOpenComplianceAlertsForMember(tid, memberCtx.staffMemberId, supabase),
  ]);

  const hr = readinessInput.hr;
  const trainingComplete =
    (hr.training_required_count ?? 0) === 0 && hr.onboardingStatus === "complete";
  const sopComplete = (hr.required_documents_missing_count ?? 0) === 0;
  const hasExpiredDocs = (hr.certificates_outstanding_count ?? 0) > 0;

  return calculateClinicalEligibility({
    employmentStatus,
    isActive: readinessInput.is_active,
    isClinicalRole,
    credentials,
    certifications,
    complianceAlerts: alerts,
    trainingComplete,
    sopAcknowledgementsComplete: sopComplete,
    managerApproved: hr.onboardingStatus === "complete",
    rolePermissionsActive: staff?.is_active !== false,
    hasExpiredComplianceDocuments: hasExpiredDocs,
    readinessEligible: readiness.eligible,
    readinessBlockingIssues: readiness.blocking_issues,
  });
}

/** @deprecated Use calculateStaffClinicalEligibility */
export async function evaluateStaffClinicalEligibilityForMember(input: {
  tenantId: string;
  staffMemberId: string;
  readinessInput: WorkforceReadinessScoreInput;
  procedurePrivilegeEligible?: boolean;
  requireVerifiedCredentials?: boolean;
  client?: SupabaseClient;
}): Promise<StaffClinicalEligibilityResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sid = assertNonEmptyUuid(input.staffMemberId, "staffMemberId");
  const supabase = input.client ?? supabaseAdmin();

  const [credentials, certifications, alerts, memberRes] = await Promise.all([
    loadStaffCredentials(tid, sid, supabase),
    loadCertificationHistory(tid, sid, supabase),
    loadOpenComplianceAlertsForMember(tid, sid, supabase),
    supabase
      .from("fi_staff_members")
      .select("employment_status, fi_staff_id")
      .eq("tenant_id", tid)
      .eq("id", sid)
      .maybeSingle(),
  ]);

  if (memberRes.error) throw new Error(memberRes.error.message);
  const employmentStatus = parseStaffEmploymentStatus(
    (memberRes.data as { employment_status?: string } | null)?.employment_status
  );

  const readiness = canStaffBeAssignedClinically(input.readinessInput);
  const hr = input.readinessInput.hr;

  return calculateClinicalEligibility({
    employmentStatus,
    isActive: input.readinessInput.is_active,
    isClinicalRole: isClinicalProviderStaffRole(input.readinessInput.staff_role),
    credentials,
    certifications,
    complianceAlerts: alerts,
    trainingComplete:
      (hr.training_required_count ?? 0) === 0 && hr.onboardingStatus === "complete",
    sopAcknowledgementsComplete: (hr.required_documents_missing_count ?? 0) === 0,
    managerApproved: hr.onboardingStatus === "complete",
    rolePermissionsActive: input.procedurePrivilegeEligible !== false,
    hasExpiredComplianceDocuments: (hr.certificates_outstanding_count ?? 0) > 0,
    readinessEligible: readiness.eligible,
    readinessBlockingIssues: readiness.blocking_issues,
  });
}