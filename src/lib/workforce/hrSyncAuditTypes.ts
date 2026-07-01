export type HrSyncRunStatus = "running" | "success" | "failed" | "partial";

export type HrSyncRunCounts = {
  recordsReceived: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsLinked: number;
  duplicatesDetected: number;
  recordsSkipped: number;
};

export type HrSyncHealthSummary = {
  lastSyncTime: string | null;
  lastStatus: HrSyncRunStatus | null;
  recordsReceived: number;
  created: number;
  updated: number;
  linked: number;
  skipped: number;
  duplicatesDetected: number;
  warningCount: number;
  errorCount: number;
  unlinkedActiveStaffCount: number;
  openDuplicateCandidatesCount: number;
};

export type FiHrSyncRunRow = {
  id: string;
  tenantId: string;
  runId: string;
  sourceSystem: string;
  startedAt: string;
  completedAt: string | null;
  status: HrSyncRunStatus;
  recordsReceived: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsLinked: number;
  duplicatesDetected: number;
  recordsSkipped: number;
  warnings: string[];
  errors: string[];
};