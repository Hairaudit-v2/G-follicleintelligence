/**
 * Pure read models for FI Admin staff readiness dashboard (no secrets, no I/O).
 */

import { canPerformHrSyncHealthAdminAction } from "@/src/lib/hr/hrStaffSyncHealthDashboard";
import type { StaffPayrollSourceDisplay } from "@/src/lib/staff/staffPayrollSourceDisplay";
import { parseStaffProfileExtras } from "@/src/lib/staff/staffProfileExtras";
import {
  isStaffBookableForClinicalWorkflow,
  isStaffRoleNeedsReview,
} from "@/src/lib/staff/staffRolePolicy";
import {
  buildStaffHrNotificationNoLinkSummary,
  type StaffHrNotificationSummary,
  STAFF_HR_SENSITIVE_METADATA_KEYS,
} from "@/src/lib/staff/staffHrNotificationSummary";
import {
  formatStaffWeeklyHoursSummary,
  parseStaffWeeklyHours,
} from "@/src/lib/staff/staffWeeklyHours";

/** Roles that deliver clinical care — HR/training policy blocks clinical availability. */
export const CLINICAL_PROVIDER_STAFF_ROLES = ["surgeon", "consultant", "nurse", "technician"] as const;

export type StaffReadinessState =
  | "ready"
  | "needs_role"
  | "needs_hr_info"
  | "needs_training"
  | "missing_working_hours"
  | "inactive"
  | "no_hr_link"
  | "hr_sync_stale";

export const STAFF_READINESS_STATE_LABELS: Record<StaffReadinessState, string> = {
  ready: "Ready",
  needs_role: "Needs role",
  needs_hr_info: "Needs HR info",
  needs_training: "Needs training",
  missing_working_hours: "Missing working hours",
  inactive: "Inactive",
  no_hr_link: "No HR link",
  hr_sync_stale: "HR sync stale",
};

export type StaffReadinessFilter =
  | "all"
  | "ready"
  | "needs_action"
  | "needs_role"
  | "hr_incomplete"
  | "training_incomplete"
  | "missing_working_hours"
  | "payroll_imported"
  | "no_hr_link"
  | "inactive";

export const STAFF_READINESS_FILTER_LABELS: Record<StaffReadinessFilter, string> = {
  all: "All staff",
  ready: "Ready",
  needs_action: "Needs action",
  needs_role: "Needs role",
  hr_incomplete: "HR incomplete",
  training_incomplete: "Training incomplete",
  missing_working_hours: "Missing working hours",
  payroll_imported: "Payroll imported",
  no_hr_link: "No HR link",
  inactive: "Inactive",
};

export type StaffReadinessOverview = {
  totalActiveStaff: number;
  needsRoleAssignment: number;
  hrOnboardingIncomplete: number;
  trainingIncomplete: number;
  clinicallyAvailableStaff: number;
  inactiveStaff: number;
};

export type StaffReadinessTableRow = {
  staffId: string;
  fullName: string;
  staffRole: string;
  positionTitle: string | null;
  primaryClinicId: string | null;
  primaryClinicName: string | null;
  payrollLinkStatus: "linked" | "not_linked";
  hrLinkStatus: "linked" | "not_linked";
  hrOnboardingStatus: StaffHrNotificationSummary["onboardingStatus"];
  trainingRequiredCount: number | null;
  certificatesOutstandingCount: number | null;
  workingHoursStatus: "configured" | "missing";
  workingHoursSummary: string | null;
  clinicalAvailabilityStatus: "available" | "unavailable";
  clinicalAvailabilityReason: string | null;
  lastHrSyncAt: string | null;
  readinessState: StaffReadinessState;
  readinessStateLabel: string;
  hrPortalUrl: string | null;
  isActive: boolean;
  needsRoleReview: boolean;
  hasPayrollLink: boolean;
  isHrOnboardingIncomplete: boolean;
  isTrainingIncomplete: boolean;
  isClinicallyAvailable: boolean;
};

export function isClinicalProviderStaffRole(staffRole: string | null | undefined): boolean {
  const role = String(staffRole ?? "").trim().toLowerCase();
  return (CLINICAL_PROVIDER_STAFF_ROLES as readonly string[]).includes(role);
}

export function staffHasConfiguredWorkingHours(
  workingHours: Record<string, unknown> | null | undefined
): boolean {
  const weekly = parseStaffWeeklyHours(workingHours);
  return formatStaffWeeklyHoursSummary(weekly).length > 0;
}

export function isHrOnboardingIncomplete(hr: StaffHrNotificationSummary): boolean {
  return (
    hr.onboardingStatus === "incomplete" ||
    (hr.required_documents_missing_count != null && hr.required_documents_missing_count > 0)
  );
}

export function isTrainingIncomplete(hr: StaffHrNotificationSummary): boolean {
  return (
    (hr.training_required_count != null && hr.training_required_count > 0) ||
    (hr.certificates_outstanding_count != null && hr.certificates_outstanding_count > 0)
  );
}

export function isBlockedByHrTrainingPolicyForClinicalRole(input: {
  staff_role: string | null | undefined;
  hr: StaffHrNotificationSummary;
}): boolean {
  if (!isClinicalProviderStaffRole(input.staff_role)) return false;
  return isHrOnboardingIncomplete(input.hr) || isTrainingIncomplete(input.hr);
}

/**
 * Clinical availability: active, role assigned, working hours set, HR/training clear for clinical roles,
 * and HR sync fresh when an HR source exists.
 */
export function isStaffClinicallyAvailable(input: {
  is_active: boolean;
  staff_role: string | null | undefined;
  working_hours: Record<string, unknown> | null | undefined;
  hr: StaffHrNotificationSummary;
}): boolean {
  if (!isStaffBookableForClinicalWorkflow({
    is_active: input.is_active,
    staff_role: input.staff_role,
  })) {
    return false;
  }
  if (!staffHasConfiguredWorkingHours(input.working_hours)) return false;
  if (input.hr.hasHrLink && input.hr.isSyncStale) return false;
  if (isBlockedByHrTrainingPolicyForClinicalRole({
    staff_role: input.staff_role,
    hr: input.hr,
  })) {
    return false;
  }
  return true;
}

export function staffClinicalAvailabilityReason(input: {
  full_name: string;
  is_active: boolean;
  staff_role: string | null | undefined;
  working_hours: Record<string, unknown> | null | undefined;
  hr: StaffHrNotificationSummary;
}): string | null {
  if (!input.is_active) return "Inactive";
  if (isStaffRoleNeedsReview(input.staff_role)) return "Role needs review";
  if (!staffHasConfiguredWorkingHours(input.working_hours)) return "Working hours not configured";
  if (input.hr.hasHrLink && input.hr.isSyncStale) return "HR sync stale";
  if (isHrOnboardingIncomplete(input.hr)) return "HR/onboarding incomplete";
  if (isTrainingIncomplete(input.hr)) return "Training or certificates outstanding";
  return null;
}

/** Primary readiness state — highest-priority blocker wins. */
export function deriveStaffReadinessState(input: {
  is_active: boolean;
  staff_role: string | null | undefined;
  working_hours: Record<string, unknown> | null | undefined;
  hr: StaffHrNotificationSummary;
}): StaffReadinessState {
  if (!input.is_active) return "inactive";
  if (isStaffRoleNeedsReview(input.staff_role)) return "needs_role";
  if (!input.hr.hasHrLink) return "no_hr_link";
  if (input.hr.isSyncStale) return "hr_sync_stale";
  if (isHrOnboardingIncomplete(input.hr)) return "needs_hr_info";
  if (isTrainingIncomplete(input.hr)) return "needs_training";
  if (!staffHasConfiguredWorkingHours(input.working_hours)) return "missing_working_hours";
  return "ready";
}

export function staffReadinessNeedsAction(state: StaffReadinessState): boolean {
  return state !== "ready" && state !== "inactive";
}

export function buildStaffReadinessTableRow(input: {
  staff: {
    id: string;
    full_name: string;
    staff_role: string;
    working_hours: Record<string, unknown>;
    is_active: boolean;
  };
  hr: StaffHrNotificationSummary;
  payroll: StaffPayrollSourceDisplay | null;
  clinicNameById: Record<string, string>;
}): StaffReadinessTableRow {
  const extras = parseStaffProfileExtras(input.staff.working_hours);
  const weekly = parseStaffWeeklyHours(input.staff.working_hours);
  const hoursSummary = formatStaffWeeklyHoursSummary(weekly);
  const hasHours = hoursSummary.length > 0;
  const readinessState = deriveStaffReadinessState({
    is_active: input.staff.is_active,
    staff_role: input.staff.staff_role,
    working_hours: input.staff.working_hours,
    hr: input.hr,
  });
  const clinicallyAvailable = isStaffClinicallyAvailable({
    is_active: input.staff.is_active,
    staff_role: input.staff.staff_role,
    working_hours: input.staff.working_hours,
    hr: input.hr,
  });
  const clinicId = extras.primary_clinic_id;
  const hrOnboardingIncomplete = isHrOnboardingIncomplete(input.hr);
  const trainingIncomplete = isTrainingIncomplete(input.hr);

  return {
    staffId: input.staff.id,
    fullName: input.staff.full_name,
    staffRole: input.staff.staff_role,
    positionTitle: extras.position_title,
    primaryClinicId: clinicId,
    primaryClinicName: clinicId ? (input.clinicNameById[clinicId] ?? null) : null,
    payrollLinkStatus: input.payroll ? "linked" : "not_linked",
    hrLinkStatus: input.hr.hasHrLink ? "linked" : "not_linked",
    hrOnboardingStatus: input.hr.onboardingStatus,
    trainingRequiredCount: input.hr.training_required_count,
    certificatesOutstandingCount: input.hr.certificates_outstanding_count,
    workingHoursStatus: hasHours ? "configured" : "missing",
    workingHoursSummary: hasHours ? hoursSummary : null,
    clinicalAvailabilityStatus: clinicallyAvailable ? "available" : "unavailable",
    clinicalAvailabilityReason: staffClinicalAvailabilityReason({
      full_name: input.staff.full_name,
      is_active: input.staff.is_active,
      staff_role: input.staff.staff_role,
      working_hours: input.staff.working_hours,
      hr: input.hr,
    }),
    lastHrSyncAt: input.hr.last_synced_at,
    readinessState,
    readinessStateLabel: STAFF_READINESS_STATE_LABELS[readinessState],
    hrPortalUrl: input.hr.hr_portal_url,
    isActive: input.staff.is_active,
    needsRoleReview: isStaffRoleNeedsReview(input.staff.staff_role),
    hasPayrollLink: Boolean(input.payroll),
    isHrOnboardingIncomplete: hrOnboardingIncomplete,
    isTrainingIncomplete: trainingIncomplete,
    isClinicallyAvailable: clinicallyAvailable,
  };
}

export function buildStaffReadinessTableRows(input: {
  staff: Array<{
    id: string;
    full_name: string;
    staff_role: string;
    working_hours: Record<string, unknown>;
    is_active: boolean;
  }>;
  hrByStaffId: Record<string, StaffHrNotificationSummary>;
  payrollByStaffId: Record<string, StaffPayrollSourceDisplay | null>;
  clinicNameById: Record<string, string>;
}): StaffReadinessTableRow[] {
  const rows = input.staff.map((s) =>
    buildStaffReadinessTableRow({
      staff: s,
      hr: input.hrByStaffId[s.id] ?? buildStaffHrNotificationNoLinkSummary(),
      payroll: input.payrollByStaffId[s.id] ?? null,
      clinicNameById: input.clinicNameById,
    })
  );
  rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
  return rows;
}

export function buildStaffReadinessOverview(rows: StaffReadinessTableRow[]): StaffReadinessOverview {
  let totalActiveStaff = 0;
  let needsRoleAssignment = 0;
  let hrOnboardingIncomplete = 0;
  let trainingIncomplete = 0;
  let clinicallyAvailableStaff = 0;
  let inactiveStaff = 0;

  for (const row of rows) {
    if (row.isActive) {
      totalActiveStaff += 1;
      if (row.needsRoleReview) needsRoleAssignment += 1;
      if (row.isHrOnboardingIncomplete) hrOnboardingIncomplete += 1;
      if (row.isTrainingIncomplete) trainingIncomplete += 1;
      if (row.isClinicallyAvailable) clinicallyAvailableStaff += 1;
    } else {
      inactiveStaff += 1;
    }
  }

  return {
    totalActiveStaff,
    needsRoleAssignment,
    hrOnboardingIncomplete,
    trainingIncomplete,
    clinicallyAvailableStaff,
    inactiveStaff,
  };
}

export function filterStaffReadinessRows(
  rows: StaffReadinessTableRow[],
  filter: StaffReadinessFilter
): StaffReadinessTableRow[] {
  if (filter === "all") return rows;
  return rows.filter((row) => {
    switch (filter) {
      case "ready":
        return row.readinessState === "ready";
      case "needs_action":
        return staffReadinessNeedsAction(row.readinessState);
      case "needs_role":
        return row.readinessState === "needs_role";
      case "hr_incomplete":
        return row.isHrOnboardingIncomplete || row.readinessState === "needs_hr_info";
      case "training_incomplete":
        return row.isTrainingIncomplete || row.readinessState === "needs_training";
      case "missing_working_hours":
        return row.workingHoursStatus === "missing";
      case "payroll_imported":
        return row.hasPayrollLink;
      case "no_hr_link":
        return row.hrLinkStatus === "not_linked";
      case "inactive":
        return !row.isActive;
      default:
        return true;
    }
  });
}

/** Safe CSV export — operational readiness fields only. */
export function buildStaffReadinessCsvExport(rows: StaffReadinessTableRow[]): string {
  const header = [
    "staff_id",
    "full_name",
    "staff_role",
    "position_title",
    "primary_clinic",
    "payroll_link_status",
    "hr_link_status",
    "hr_onboarding_status",
    "training_required_count",
    "certificates_outstanding_count",
    "working_hours_status",
    "clinical_availability_status",
    "readiness_state",
    "last_hr_sync_at",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.staffId,
        r.fullName,
        r.staffRole,
        r.positionTitle ?? "",
        r.primaryClinicName ?? "",
        r.payrollLinkStatus,
        r.hrLinkStatus,
        r.hrOnboardingStatus,
        r.trainingRequiredCount ?? "",
        r.certificatesOutstandingCount ?? "",
        r.workingHoursStatus,
        r.clinicalAvailabilityStatus,
        r.readinessStateLabel,
        r.lastHrSyncAt ?? "",
      ]
        .map((cell) => {
          const s = String(cell ?? "");
          if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(",")
    );
  }
  return lines.join("\n");
}

/** Ensures CSV export never includes sensitive key names (defence in depth). */
export function staffReadinessCsvIsSafe(csv: string): boolean {
  const lower = csv.toLowerCase();
  const blocked = [
    ...STAFF_HR_SENSITIVE_METADATA_KEYS,
    "bank",
    "tfn",
    "super",
    "pay_rate",
    "tax_details",
    "date_of_birth",
    "home_address",
    "salary",
    "email",
    "mobile",
    "hr_portal_url",
  ];
  return !blocked.some((k) => lower.includes(k));
}

/** Pure gate mirror for staff readiness admin mutations. */
export function canPerformStaffReadinessAdminAction(input: {
  userRole: string | null | undefined;
  isPlatformAdmin: boolean;
  hasValidAdminKey: boolean;
}): boolean {
  return canPerformHrSyncHealthAdminAction(input);
}
