/**
 * IIOHR HR → FI staff sync contract (Stage 1). HR remains SoR; FI holds operational projection + bounded metadata on `fi_staff_source_ids`.
 */

import type { IiohrHrStaffImportRunResult } from "@/src/lib/staffImport/iiohrHrStaffImportRunner";

/** Preview = dry-run; commit = apply (requires confirm). */
export type IiohrHrStaffSyncMode = "preview" | "commit";

/**
 * One producer row (webhook/API/export). Maps to `IiohrHrStaffImportRow` for the existing planner;
 * `metadata_snapshot` is merged only into `fi_staff_source_ids.metadata` (never materialises HR documents in FI).
 */
export type IiohrHrStaffSyncRow = {
  external_staff_id: string;
  full_name: string;
  email?: string | null;
  staff_role?: string | null;
  employment_status?: string | null;
  source_url?: string | null;
  default_timezone?: string | null;
  working_hours?: unknown;
  /** Correlates with IIOHR identity when known; stored in source-id metadata via import planner. */
  iiohr_user_id?: string | null;
  /** HR onboarding readiness (also accepted inside `metadata_snapshot`). */
  onboarding_status?: string | null;
  onboarding_completed_at?: string | null;
  required_documents_missing_count?: number | null;
  training_required_count?: number | null;
  certificates_outstanding_count?: number | null;
  /** Preferred HR profile deep link; `source_url` is used when omitted. */
  hr_profile_url?: string | null;
  /**
   * Optional bounded JSON merged into `fi_staff_source_ids.metadata` at sync time (e.g. training/compliance summaries).
   * Must not be used to duplicate full HR document stores in FI.
   */
  metadata_snapshot?: Record<string, unknown> | null;
};

export type IiohrHrStaffSyncPayload = {
  rows: IiohrHrStaffSyncRow[];
};

/** Result wrapper returned by `syncIiohrHrStaffForTenant` and the server action. */
export type IiohrHrStaffSyncSummary = {
  mode: IiohrHrStaffSyncMode;
  /** ISO timestamp stamped onto each affected `fi_staff_source_ids.metadata.last_synced_at`. */
  lastSyncedAt: string;
  result: IiohrHrStaffImportRunResult;
};

export type SyncIiohrHrStaffForTenantInput = {
  tenantId: string;
  payload: IiohrHrStaffSyncPayload;
  mode: IiohrHrStaffSyncMode;
  /** Required when `mode === "commit"`. */
  confirm?: boolean;
  adminKey?: string | null;
  authUserId?: string | null;
  /**
   * When true, skips `assertIiohrHrStaffImportAllowed` inside the runner — caller must have enforced access
   * (e.g. `assertCrmTenantWriteAllowed` in server actions).
   */
  skipImportAuthCheck?: boolean;
  /** Fixed clock for tests; defaults to `new Date().toISOString()`. */
  lastSyncedAt?: string;
};
