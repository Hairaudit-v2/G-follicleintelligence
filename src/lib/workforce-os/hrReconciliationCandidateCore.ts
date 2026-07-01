import { z } from "zod";

import type { IiohrHrPortalStaffRecord } from "@/src/lib/hr/iiohrFiStaffSyncMapper";
import { normaliseStaffEmail } from "./iiohrStaffHrLinkReconciliationCore";
import type { EvolvedStaffRecord } from "./iiohrStaffHrLinkReconciliationTypes";
import { needsHrReconciliation } from "./hrReconciliationEligibleCore";
import type { StaffMemberLifecycleRow } from "./staffLifecycleTypes";

const uuidSchema = z.string().uuid();

export type HrReconciliationFeedStatus = "ok" | "empty" | "not_configured" | "error";

export function isUuidString(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return uuidSchema.safeParse(value.trim()).success;
}

/** Prefer IIOHR user UUID, then external id when it is a UUID. */
export function resolveEvolvedStaffRecordId(record: {
  external_staff_id: string;
  iiohr_user_id?: string | null;
}): string | null {
  const userId = record.iiohr_user_id?.trim();
  if (userId && isUuidString(userId)) return userId;
  const externalId = record.external_staff_id.trim();
  if (externalId && isUuidString(externalId)) return externalId;
  return null;
}

export function mapIiohrPortalStaffToEvolvedStaffRecords(
  rows: IiohrHrPortalStaffRecord[]
): {
  records: EvolvedStaffRecord[];
  skippedNonUuidCount: number;
} {
  const records: EvolvedStaffRecord[] = [];
  let skippedNonUuidCount = 0;

  for (const row of rows) {
    const id = resolveEvolvedStaffRecordId(row);
    if (!id) {
      skippedNonUuidCount += 1;
      continue;
    }
    records.push({
      id,
      external_staff_id: row.external_staff_id,
      iiohr_user_id: row.iiohr_user_id ?? null,
      full_name: row.full_name,
      email: row.email ?? null,
    });
  }

  return { records, skippedNonUuidCount };
}

export function countExactNormalizedEmailMatches(input: {
  staffMembers: StaffMemberLifecycleRow[];
  evolvedStaffRecords: EvolvedStaffRecord[];
}): number {
  const feedEmails = new Set<string>();
  for (const record of input.evolvedStaffRecords) {
    const email = normaliseStaffEmail(record.email);
    if (email) feedEmails.add(email);
  }

  let matches = 0;
  for (const member of input.staffMembers) {
    if (!needsHrReconciliation(member)) continue;
    const email = normaliseStaffEmail(member.email);
    if (email && feedEmails.has(email)) matches += 1;
  }
  return matches;
}

export function summarizeStaffMemberSourceSystems(
  members: StaffMemberLifecycleRow[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const member of members) {
    const key = member.source_system?.trim() || "(null)";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function resolveHrReconciliationFeedStatus(input: {
  feedUrlConfigured: boolean;
  feedLoadError: string | null;
  rawFeedRowCount: number;
  candidateCount: number;
}): HrReconciliationFeedStatus {
  if (!input.feedUrlConfigured) return "not_configured";
  if (input.feedLoadError) return "error";
  if (input.rawFeedRowCount === 0 || input.candidateCount === 0) return "empty";
  return "ok";
}

export function buildHrReconciliationFeedBlockedMessage(
  status: HrReconciliationFeedStatus,
  feedLoadError: string | null
): string | null {
  switch (status) {
    case "not_configured":
      return "No IIOHR staff feed URL configured. Set IIOHR_HR_PERTH_STAFF_FEED_URL (or legacy IIOHR_HR_STAFF_FEED_URL), then run staff sync.";
    case "error":
      return feedLoadError
        ? `IIOHR staff feed could not be loaded: ${feedLoadError}`
        : "IIOHR staff feed could not be loaded. Check feed URL, Bearer key, and network access.";
    case "empty":
      return "No IIOHR staff feed rows found. Run sync or check the feed endpoint returns staff with UUID ids and emails.";
    default:
      return null;
  }
}
