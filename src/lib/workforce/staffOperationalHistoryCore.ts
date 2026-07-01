/**
 * Pure operational history types and helpers (WorkforceOS Sprint 3.5).
 */

export type StaffOperationalHistory = {
  staffMemberId: string;
  fiStaffId: string | null;
  fullName: string;
  email: string | null;
  roleCode: string | null;
  employmentStatus: string;
  createdAt: string | null;
  sourceSystem: string | null;
  isIiohrLinked: boolean;
  isManuallyCreated: boolean;
  isInactive: boolean;
  trainingCount: number;
  sopAcknowledgementCount: number;
  surgeryAssignmentCount: number;
  calendarAssignmentCount: number;
  patientAssignmentCount: number;
  complianceHistoryCount: number;
  academyCompetencyCount: number;
  credentialCount: number;
  verifiedCredentialCount: number;
  certificationCount: number;
  identityLinkCount: number;
  daysSinceCreated: number;
  totalActivityCount: number;
};

export function computeTotalActivityCount(h: Pick<
  StaffOperationalHistory,
  | "trainingCount"
  | "sopAcknowledgementCount"
  | "surgeryAssignmentCount"
  | "calendarAssignmentCount"
  | "patientAssignmentCount"
  | "complianceHistoryCount"
  | "academyCompetencyCount"
  | "credentialCount"
  | "certificationCount"
  | "identityLinkCount"
>): number {
  return (
    h.trainingCount +
    h.sopAcknowledgementCount +
    h.surgeryAssignmentCount +
    h.calendarAssignmentCount +
    h.patientAssignmentCount +
    h.complianceHistoryCount +
    h.academyCompetencyCount +
    h.credentialCount +
    h.certificationCount +
    h.identityLinkCount
  );
}

export function daysSince(iso: string | null, now = new Date()): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));
}

export function isManuallyCreatedStaff(sourceSystem: string | null): boolean {
  const s = (sourceSystem ?? "").trim().toLowerCase();
  if (!s) return true;
  return s === "manual" || s === "fi_manual" || s === "fi_admin";
}

export function isIiohrSourceSystem(sourceSystem: string | null): boolean {
  const s = (sourceSystem ?? "").trim().toLowerCase();
  return s.includes("iiohr") || s.includes("evolved_hr") || s.includes("hr");
}