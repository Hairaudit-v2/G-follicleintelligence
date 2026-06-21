/**
 * Client-safe read model for workforce identity link status (no secrets, no server-only imports).
 */

import { STAFF_HR_SYNC_STALE_DAYS } from "@/src/lib/staff/staffHrNotificationSummary";
import {
  canonicaliseWorkforceSourceSystem,
  WORKFORCE_IDENTITY_SOURCE_SYSTEMS,
  workforceIdentitySourceSystemLabel,
} from "@/src/lib/workforce-os/workforceIdentitySources";
import {
  parseWorkforceIdentitySyncStatus,
  type WorkforceIdentitySyncStatus,
} from "@/src/lib/workforce-os/workforceIdentityMetadata";

export type WorkforceIdentityLinkStatus = {
  sourceSystem: string;
  sourceSystemLabel: string;
  linked: boolean;
  sourceStaffId: string | null;
  syncStatus: WorkforceIdentitySyncStatus | null;
  lastSyncedAt: string | null;
  isSyncStale: boolean;
};

export type WorkforceIdentitySummary = {
  hr: WorkforceIdentityLinkStatus;
  academy: WorkforceIdentityLinkStatus;
  nexus: WorkforceIdentityLinkStatus;
  /** Any identity link with stale metadata sync. */
  hasStaleIdentitySync: boolean;
  /** Count of canonical identity systems linked (HR, Academy, Nexus). */
  linkedIdentityCount: number;
};

export type WorkforceIdentitySourceRowInput = {
  source_system: string;
  source_staff_id?: string;
  metadata?: Record<string, unknown> | null;
};

function emptyLinkStatus(sourceSystem: string): WorkforceIdentityLinkStatus {
  return {
    sourceSystem: sourceSystem,
    sourceSystemLabel: workforceIdentitySourceSystemLabel(sourceSystem),
    linked: false,
    sourceStaffId: null,
    syncStatus: null,
    lastSyncedAt: null,
    isSyncStale: false,
  };
}

function isSyncStale(lastSyncedAt: string | null, now: Date): boolean {
  if (!lastSyncedAt) return false;
  const t = Date.parse(lastSyncedAt);
  if (Number.isNaN(t)) return false;
  const ageMs = now.getTime() - t;
  return ageMs > STAFF_HR_SYNC_STALE_DAYS * 86_400_000;
}

function buildLinkStatusFromRow(
  row: WorkforceIdentitySourceRowInput | undefined,
  canonicalSystem: string,
  now: Date
): WorkforceIdentityLinkStatus {
  if (!row) return emptyLinkStatus(canonicalSystem);

  const lastSyncedAt =
    row.metadata?.last_synced_at != null ? String(row.metadata.last_synced_at).trim() || null : null;
  const syncStatus = parseWorkforceIdentitySyncStatus(row.metadata?.sync_status) ?? null;

  return {
    sourceSystem: canonicalSystem,
    sourceSystemLabel: workforceIdentitySourceSystemLabel(canonicalSystem),
    linked: true,
    sourceStaffId: row.source_staff_id?.trim() || null,
    syncStatus,
    lastSyncedAt,
    isSyncStale: isSyncStale(lastSyncedAt, now),
  };
}

function pickRowForSystem(
  rows: WorkforceIdentitySourceRowInput[],
  canonicalSystem: string
): WorkforceIdentitySourceRowInput | undefined {
  return rows.find((r) => canonicaliseWorkforceSourceSystem(r.source_system) === canonicalSystem);
}

/**
 * Builds a bounded identity summary from `fi_staff_source_ids` rows for admin UI.
 */
export function buildWorkforceIdentitySummaryFromSourceRows(
  rows: WorkforceIdentitySourceRowInput[],
  now?: Date
): WorkforceIdentitySummary {
  const at = now ?? new Date();
  const hr = buildLinkStatusFromRow(
    pickRowForSystem(rows, WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_HR),
    WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_HR,
    at
  );
  const academy = buildLinkStatusFromRow(
    pickRowForSystem(rows, WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_ACADEMY),
    WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_ACADEMY,
    at
  );
  const nexus = buildLinkStatusFromRow(
    pickRowForSystem(rows, WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_NEXUS),
    WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_NEXUS,
    at
  );

  const links = [hr, academy, nexus];
  const linkedIdentityCount = links.filter((l) => l.linked).length;
  const hasStaleIdentitySync = links.some((l) => l.linked && l.isSyncStale);

  return {
    hr,
    academy,
    nexus,
    hasStaleIdentitySync,
    linkedIdentityCount,
  };
}
