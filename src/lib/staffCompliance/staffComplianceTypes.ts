/**
 * Read-only training / compliance view derived from `fi_staff_source_ids.metadata`.
 * Not the system of record — see module comments in `staffComplianceSummary.ts`.
 */

export type StaffComplianceStatus = "current" | "due_soon" | "expired" | "missing" | "unknown";

export type StaffComplianceItem = {
  id: string;
  label: string;
  status: StaffComplianceStatus;
  sourceSystem: string;
  completedAt?: string | null;
  expiresAt?: string | null;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export type StaffComplianceCounts = {
  current: number;
  due_soon: number;
  expired: number;
  missing: number;
  unknown: number;
};

export type StaffComplianceSummary = {
  overallStatus: StaffComplianceStatus;
  items: StaffComplianceItem[];
  counts: StaffComplianceCounts;
  lastSyncedAt?: string | null;
};
