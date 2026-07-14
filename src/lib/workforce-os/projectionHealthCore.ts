/**
 * Read-only HR projection health helpers — no DB writes.
 */

export type HrProjectionHealth = {
  operationalFiStaffCount: number;
  linkedProjectionCount: number;
  missingProjectionCount: number;
  staleProjectionCount: number;
  needsRepair: boolean;
  lastProjectionSyncAt: string | null;
  lastProjectionSyncCount: number | null;
};

export function buildHrProjectionHealth(input: {
  operationalFiStaffCount: number;
  linkedProjectionCount: number;
  missingProjectionCount: number;
  staleProjectionCount: number;
  lastProjectionSyncAt?: string | null;
  lastProjectionSyncCount?: number | null;
}): HrProjectionHealth {
  const missingProjectionCount = Math.max(0, input.missingProjectionCount);
  const staleProjectionCount = Math.max(0, input.staleProjectionCount);
  return {
    operationalFiStaffCount: input.operationalFiStaffCount,
    linkedProjectionCount: input.linkedProjectionCount,
    missingProjectionCount,
    staleProjectionCount,
    needsRepair: missingProjectionCount > 0 || staleProjectionCount > 0,
    lastProjectionSyncAt: input.lastProjectionSyncAt ?? null,
    lastProjectionSyncCount: input.lastProjectionSyncCount ?? null,
  };
}

export function countMissingStaffProjections(input: {
  fiStaffIds: readonly string[];
  linkedFiStaffIds: readonly string[];
}): number {
  const linked = new Set(input.linkedFiStaffIds.filter(Boolean));
  return input.fiStaffIds.filter((id) => !linked.has(id)).length;
}

export function countStaleStaffProjections(input: {
  fiStaffUpdatedAtById: Readonly<Record<string, string>>;
  memberRows: readonly { fi_staff_id: string | null; updated_at: string }[];
}): number {
  let stale = 0;
  for (const member of input.memberRows) {
    const fiStaffId = member.fi_staff_id?.trim();
    if (!fiStaffId) continue;
    const staffUpdatedAt = input.fiStaffUpdatedAtById[fiStaffId];
    if (!staffUpdatedAt) continue;
    const staffMs = Date.parse(staffUpdatedAt);
    const memberMs = Date.parse(member.updated_at);
    if (Number.isFinite(staffMs) && Number.isFinite(memberMs) && staffMs > memberMs) {
      stale += 1;
    }
  }
  return stale;
}
