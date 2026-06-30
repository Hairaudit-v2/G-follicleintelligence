/**
 * Pure readiness signals from workforce identity links — data boundary for WorkforceOS readiness v2.
 * Does not change existing readiness state machine; consumers can layer these signals later.
 */

import { STAFF_HR_SYNC_STALE_DAYS } from "@/src/lib/staff/staffHrNotificationSummary";
import {
  canonicaliseWorkforceSourceSystem,
  WORKFORCE_IDENTITY_SOURCE_SYSTEMS,
} from "@/src/lib/workforce-os/workforceIdentitySources";
import { parseWorkforceIdentitySyncStatus } from "@/src/lib/workforce-os/workforceIdentityMetadata";
import {
  buildWorkforceIdentitySummaryFromSourceRows,
  type WorkforceIdentitySourceRowInput,
} from "@/src/lib/workforce-os/workforceIdentitySummary";
import type { AcademyCompetencySignals } from "@/src/lib/academy-os/academyWorkforceSignalAdapter";

export type WorkforceIdentityReadinessSignals = {
  hasHrIdentityLink: boolean;
  hasAcademyIdentityLink: boolean;
  hasNexusIdentityLink: boolean;
  hasStaleIdentitySync: boolean;
  globalProfessionalId: string | null;
  academyProfileId: string | null;
  trainingSource: string | null;
  certificationSource: string | null;
  competencySource: string | null;
  syncStatus: string | null;
  lastSyncedAt: string | null;
  /** True when HR link exists but metadata sync is older than stale threshold. */
  isHrSyncStale: boolean;
  /** True when Nexus link exists but metadata sync is older than stale threshold. */
  isNexusSyncStale: boolean;
  /** True when Academy link exists but metadata sync is older than stale threshold. */
  isAcademySyncStale: boolean;
  /** AcademyOS competency projection signals when available; null uses legacy metadata heuristics. */
  academyCompetencySignals: AcademyCompetencySignals | null;
};

function metaStr(meta: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!meta) return null;
  const v = meta[key];
  if (v == null || v === "") return null;
  const s = String(v).trim();
  return s || null;
}

function pickRow(
  rows: WorkforceIdentitySourceRowInput[],
  system: string
): WorkforceIdentitySourceRowInput | undefined {
  return rows.find((r) => canonicaliseWorkforceSourceSystem(r.source_system) === system);
}

/**
 * Derives bounded identity readiness signals from source-id rows.
 * Backward compatible — existing HR readiness logic can ignore this until WorkforceOS v2 scoring ships.
 */
export function buildWorkforceIdentityReadinessSignals(
  rows: WorkforceIdentitySourceRowInput[],
  now?: Date,
  academyCompetencySignals?: AcademyCompetencySignals | null
): WorkforceIdentityReadinessSignals {
  const at = now ?? new Date();
  const summary = buildWorkforceIdentitySummaryFromSourceRows(rows, at);

  const hrRow = pickRow(rows, WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_HR);
  const academyRow = pickRow(rows, WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_ACADEMY);
  const nexusRow = pickRow(rows, WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_NEXUS);

  const hrMeta = hrRow?.metadata ?? null;
  const academyMeta = academyRow?.metadata ?? null;
  const nexusMeta = nexusRow?.metadata ?? null;

  const globalFromNexus =
    metaStr(nexusMeta, "global_professional_id") ?? nexusRow?.source_staff_id?.trim() ?? null;
  const globalFromHr = metaStr(hrMeta, "global_professional_id");
  const globalProfessionalId = globalFromNexus ?? globalFromHr ?? null;

  const academyProfileId =
    metaStr(academyMeta, "iiohr_academy_profile_id") ?? academyRow?.source_staff_id?.trim() ?? null;

  const trainingSource =
    metaStr(academyMeta, "training_source") ?? metaStr(hrMeta, "training_source") ?? null;
  const certificationSource =
    metaStr(academyMeta, "certification_source") ?? metaStr(hrMeta, "certification_source") ?? null;
  const competencySource =
    metaStr(hrMeta, "competency_source") ?? metaStr(nexusMeta, "competency_source") ?? null;

  const primaryMeta = nexusMeta ?? hrMeta ?? academyMeta;
  const syncStatus = parseWorkforceIdentitySyncStatus(primaryMeta?.sync_status) ?? null;
  const lastSyncedAt = metaStr(primaryMeta, "last_synced_at");

  return {
    hasHrIdentityLink: summary.hr.linked,
    hasAcademyIdentityLink: summary.academy.linked,
    hasNexusIdentityLink: summary.nexus.linked,
    hasStaleIdentitySync: summary.hasStaleIdentitySync,
    globalProfessionalId,
    academyProfileId,
    trainingSource,
    certificationSource,
    competencySource,
    syncStatus,
    lastSyncedAt,
    isHrSyncStale: summary.hr.linked && summary.hr.isSyncStale,
    isNexusSyncStale: summary.nexus.linked && summary.nexus.isSyncStale,
    isAcademySyncStale: summary.academy.linked && summary.academy.isSyncStale,
    academyCompetencySignals: academyCompetencySignals ?? null,
  };
}

/** Stale threshold in days (shared with HR notification UI). */
export const WORKFORCE_IDENTITY_SYNC_STALE_DAYS = STAFF_HR_SYNC_STALE_DAYS;
