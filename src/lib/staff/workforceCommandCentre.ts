/**
 * Workforce Command Centre v1 — client-safe read models and derived intelligence
 * from existing staff directory data (no new DB tables).
 */

import type { StaffDirectoryRowView } from "@/src/lib/staff/staffDirectoryFilters";
import type { StaffComplianceStatus } from "@/src/lib/staffCompliance/staffComplianceTypes";
import type { WorkforceReadinessBandId } from "@/src/lib/workforce-os/workforceReadinessBands";

export type WorkforceRoleSegmentId =
  | "all"
  | "clinical"
  | "surgeons"
  | "nurses"
  | "technicians"
  | "reception"
  | "consultants"
  | "management";

export const WORKFORCE_ROLE_SEGMENTS: ReadonlyArray<{ id: WorkforceRoleSegmentId; label: string }> = [
  { id: "all", label: "All" },
  { id: "clinical", label: "Clinical" },
  { id: "surgeons", label: "Surgeons" },
  { id: "nurses", label: "Nurses" },
  { id: "technicians", label: "Technicians" },
  { id: "reception", label: "Reception" },
  { id: "consultants", label: "Consultants" },
  { id: "management", label: "Management" },
];

export type StaffWorkforceIntelligence = {
  readinessScore: number | null;
  readinessBand: WorkforceReadinessBandId | null;
  readinessBandLabel: string | null;
  complianceStatus: StaffComplianceStatus | null;
  trainingRequiredCount: number | null;
  trainingProgressLabel: string;
  nextShiftLabel: string | null;
  surgeryReady: boolean;
};

export type WorkforceCommandCentreMetrics = {
  totalStaff: number;
  activeStaff: number;
  pendingOnboarding: number;
  complianceIssues: number;
  averageReadinessScore: number | null;
};

export type WorkforceIntelligencePanel = {
  workforceReadinessScore: number | null;
  surgeryReadyCount: number;
  trainingRequiredCount: number;
  complianceAttentionCount: number;
  nextAction: string;
};

export type WorkforceAttentionReason =
  | "missing_compliance"
  | "pending_onboarding"
  | "low_readiness"
  | "inactive";

export type WorkforceAttentionItem = {
  staffId: string;
  fullName: string;
  staffRole: string;
  reasons: WorkforceAttentionReason[];
  primaryLabel: string;
};

const CLINICAL_ROLES = new Set(["surgeon", "consultant", "nurse", "technician"]);
const MANAGEMENT_ROLES = new Set(["admin", "coordinator"]);
const SURGERY_READY_BANDS = new Set<WorkforceReadinessBandId>(["fully_ready", "elite_ready"]);
const LOW_READINESS_THRESHOLD = 70;

function normalizeRole(role: string | null | undefined): string {
  return String(role ?? "").trim().toLowerCase();
}

export function staffMatchesRoleSegment(staffRole: string | null | undefined, segment: WorkforceRoleSegmentId): boolean {
  if (segment === "all") return true;
  const role = normalizeRole(staffRole);
  switch (segment) {
    case "clinical":
      return CLINICAL_ROLES.has(role);
    case "surgeons":
      return role === "surgeon";
    case "nurses":
      return role === "nurse";
    case "technicians":
      return role === "technician";
    case "reception":
      return role === "reception";
    case "consultants":
      return role === "consultant";
    case "management":
      return MANAGEMENT_ROLES.has(role);
    default:
      return true;
  }
}

export function filterStaffByRoleSegment<T extends { staff_role: string }>(
  rows: T[],
  segment: WorkforceRoleSegmentId
): T[] {
  if (segment === "all") return rows;
  return rows.filter((row) => staffMatchesRoleSegment(row.staff_role, segment));
}

function isPendingOnboarding(row: StaffDirectoryRowView): boolean {
  if (row.needsReview) return true;
  if (row.hrNotification.onboardingStatus === "incomplete") return true;
  if (!row.is_active) return false;
  return row.hrNotification.hasHrLink && row.hrNotification.onboardingStatus === "unknown" && row.hrNotification.outstandingTaskCount > 0;
}

function hasComplianceIssue(status: StaffComplianceStatus | null | undefined): boolean {
  return status === "expired" || status === "missing" || status === "due_soon";
}

function deriveFallbackIntelligence(row: StaffDirectoryRowView): StaffWorkforceIntelligence {
  const hr = row.hrNotification;
  const trainingRequired = hr.training_required_count;
  const trainingProgressLabel =
    trainingRequired != null && trainingRequired > 0
      ? `${trainingRequired} required`
      : hr.onboardingStatus === "complete"
        ? "Complete"
        : hr.hasHrLink
          ? "In progress"
          : "—";

  const complianceStatus: StaffComplianceStatus | null =
    hr.required_documents_missing_count != null && hr.required_documents_missing_count > 0
      ? "missing"
      : hr.certificates_outstanding_count != null && hr.certificates_outstanding_count > 0
        ? "due_soon"
        : hr.hasHrLink
          ? "unknown"
          : null;

  return {
    readinessScore: null,
    readinessBand: null,
    readinessBandLabel: null,
    complianceStatus,
    trainingRequiredCount: trainingRequired,
    trainingProgressLabel,
    nextShiftLabel: null,
    surgeryReady: false,
  };
}

export function resolveStaffWorkforceIntelligence(
  row: StaffDirectoryRowView,
  serverIntel?: StaffWorkforceIntelligence | null
): StaffWorkforceIntelligence {
  if (serverIntel) return serverIntel;
  return deriveFallbackIntelligence(row);
}

export function buildWorkforceCommandCentreMetrics(
  rows: StaffDirectoryRowView[],
  intelligenceByStaffId: Record<string, StaffWorkforceIntelligence | undefined>
): WorkforceCommandCentreMetrics {
  const totalStaff = rows.length;
  const activeStaff = rows.filter((r) => r.is_active).length;
  const pendingOnboarding = rows.filter(isPendingOnboarding).length;

  let complianceIssues = 0;
  let readinessSum = 0;
  let readinessCount = 0;

  for (const row of rows) {
    const intel = resolveStaffWorkforceIntelligence(row, intelligenceByStaffId[row.id]);
    if (hasComplianceIssue(intel.complianceStatus)) complianceIssues += 1;
    if (intel.readinessScore != null) {
      readinessSum += intel.readinessScore;
      readinessCount += 1;
    }
  }

  return {
    totalStaff,
    activeStaff,
    pendingOnboarding,
    complianceIssues,
    averageReadinessScore: readinessCount > 0 ? Math.round(readinessSum / readinessCount) : null,
  };
}

export function buildWorkforceIntelligencePanel(
  rows: StaffDirectoryRowView[],
  intelligenceByStaffId: Record<string, StaffWorkforceIntelligence | undefined>,
  metrics: WorkforceCommandCentreMetrics
): WorkforceIntelligencePanel {
  let surgeryReadyCount = 0;
  let trainingRequiredCount = 0;
  let complianceAttentionCount = 0;

  for (const row of rows) {
    if (!row.is_active) continue;
    const intel = resolveStaffWorkforceIntelligence(row, intelligenceByStaffId[row.id]);
    if (intel.surgeryReady) surgeryReadyCount += 1;
    if ((intel.trainingRequiredCount ?? 0) > 0) trainingRequiredCount += 1;
    if (hasComplianceIssue(intel.complianceStatus)) complianceAttentionCount += 1;
  }

  const nextAction = pickNextAction({
    pendingOnboarding: metrics.pendingOnboarding,
    complianceIssues: metrics.complianceIssues,
    trainingRequiredCount,
    activeStaff: metrics.activeStaff,
    averageReadinessScore: metrics.averageReadinessScore,
  });

  return {
    workforceReadinessScore: metrics.averageReadinessScore,
    surgeryReadyCount,
    trainingRequiredCount,
    complianceAttentionCount,
    nextAction,
  };
}

function pickNextAction(input: {
  pendingOnboarding: number;
  complianceIssues: number;
  trainingRequiredCount: number;
  activeStaff: number;
  averageReadinessScore: number | null;
}): string {
  if (input.activeStaff === 0) {
    return "Add your first staff member to begin workforce readiness tracking.";
  }
  if (input.pendingOnboarding > 0) {
    return `Complete onboarding for ${input.pendingOnboarding} staff member${input.pendingOnboarding === 1 ? "" : "s"} before clinical assignment.`;
  }
  if (input.complianceIssues > 0) {
    return `Review compliance gaps across ${input.complianceIssues} staff — prioritise expired or missing credentials.`;
  }
  if (input.trainingRequiredCount > 0) {
    return `Assign or verify training for ${input.trainingRequiredCount} active staff member${input.trainingRequiredCount === 1 ? "" : "s"}.`;
  }
  if (input.averageReadinessScore != null && input.averageReadinessScore < LOW_READINESS_THRESHOLD) {
    return "Workforce readiness is below operational threshold — review Staff Twin profiles and HR sync health.";
  }
  return "Workforce is operationally clear — monitor roster coverage and upcoming shifts.";
}

export function buildWorkforceAttentionQueue(
  rows: StaffDirectoryRowView[],
  intelligenceByStaffId: Record<string, StaffWorkforceIntelligence | undefined>
): WorkforceAttentionItem[] {
  const items: WorkforceAttentionItem[] = [];

  for (const row of rows) {
    const intel = resolveStaffWorkforceIntelligence(row, intelligenceByStaffId[row.id]);
    const reasons: WorkforceAttentionReason[] = [];

    if (!row.is_active) reasons.push("inactive");
    if (isPendingOnboarding(row)) reasons.push("pending_onboarding");
    if (hasComplianceIssue(intel.complianceStatus)) reasons.push("missing_compliance");
    if (
      intel.readinessScore != null &&
      intel.readinessScore < LOW_READINESS_THRESHOLD &&
      row.is_active
    ) {
      reasons.push("low_readiness");
    } else if (
      intel.readinessScore == null &&
      row.is_active &&
      row.hrNotification.outstandingTaskCount > 0
    ) {
      reasons.push("low_readiness");
    }

    if (reasons.length === 0) continue;

    items.push({
      staffId: row.id,
      fullName: row.full_name,
      staffRole: row.staff_role,
      reasons,
      primaryLabel: formatAttentionPrimaryLabel(reasons),
    });
  }

  return items.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

function formatAttentionPrimaryLabel(reasons: WorkforceAttentionReason[]): string {
  if (reasons.includes("inactive")) return "Inactive";
  if (reasons.includes("pending_onboarding")) return "Onboarding pending";
  if (reasons.includes("missing_compliance")) return "Compliance attention";
  if (reasons.includes("low_readiness")) return "Low readiness";
  return "Needs attention";
}

export function formatComplianceStatusLabel(status: StaffComplianceStatus | null | undefined): string {
  switch (status) {
    case "current":
      return "Current";
    case "due_soon":
      return "Due soon";
    case "expired":
      return "Expired";
    case "missing":
      return "Missing";
    case "unknown":
      return "Unknown";
    default:
      return "—";
  }
}

export function complianceStatusPillClass(status: StaffComplianceStatus | null | undefined): string {
  switch (status) {
    case "current":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25";
    case "due_soon":
      return "bg-amber-500/15 text-amber-200 ring-amber-500/25";
    case "expired":
    case "missing":
      return "bg-rose-500/15 text-rose-300 ring-rose-500/25";
    default:
      return "bg-slate-500/15 text-slate-400 ring-slate-500/20";
  }
}

export function readinessScorePillClass(score: number | null): string {
  if (score == null) return "bg-slate-500/15 text-slate-400 ring-slate-500/20";
  if (score >= 85) return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25";
  if (score >= 70) return "bg-amber-500/15 text-amber-200 ring-amber-500/25";
  return "bg-rose-500/15 text-rose-300 ring-rose-500/25";
}

export function formatReadinessScore(score: number | null): string {
  return score != null ? `${score}%` : "—";
}

export function isSurgeryReadyStaff(input: {
  staffRole: string;
  isActive: boolean;
  readinessBand: WorkforceReadinessBandId | null;
}): boolean {
  if (!input.isActive) return false;
  if (normalizeRole(input.staffRole) !== "surgeon") return false;
  if (!input.readinessBand) return false;
  return SURGERY_READY_BANDS.has(input.readinessBand);
}
