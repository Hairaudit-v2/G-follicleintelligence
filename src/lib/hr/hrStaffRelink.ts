/**
 * Builds bounded IIOHR HR sync payloads for staff re-link actions (email or source_staff_id).
 */

import type { IiohrHrStaffSyncRow } from "@/src/lib/staffImport/iiohrHrStaffSyncTypes";
import { normalizeFiStaffSourceStaffId } from "@/src/lib/staff/staffSourceIdsNormalize";
import { isHrStaffSourceSystem } from "@/src/lib/staff/hrStaffReadinessMetadata";

function emailKey(email: string | null | undefined): string | null {
  if (email == null) return null;
  const t = email.trim().toLowerCase();
  return t || null;
}

export function buildRelinkSyncRowsByEmail(input: {
  staff: Array<{ id: string; email: string | null }>;
  feedRows: IiohrHrStaffSyncRow[];
}): { rows: IiohrHrStaffSyncRow[]; matchedStaffIds: string[] } {
  const feedByEmail = new Map<string, IiohrHrStaffSyncRow>();
  for (const row of input.feedRows) {
    const k = emailKey(row.email);
    if (k && !feedByEmail.has(k)) feedByEmail.set(k, row);
  }

  const rows: IiohrHrStaffSyncRow[] = [];
  const matchedStaffIds: string[] = [];
  const seenExt = new Set<string>();

  for (const s of input.staff) {
    const k = emailKey(s.email);
    if (!k) continue;
    const row = feedByEmail.get(k);
    if (!row) continue;
    const ext = normalizeFiStaffSourceStaffId(row.external_staff_id);
    if (!ext || seenExt.has(ext)) continue;
    seenExt.add(ext);
    rows.push(row);
    matchedStaffIds.push(s.id);
  }

  return { rows, matchedStaffIds };
}

export function buildRelinkSyncRowsBySourceStaffId(input: {
  staff: Array<{ id: string; email: string | null }>;
  sourceIds: Array<{ staff_id: string; source_system: string; source_staff_id: string }>;
  feedRows: IiohrHrStaffSyncRow[];
}): { rows: IiohrHrStaffSyncRow[]; matchedStaffIds: string[] } {
  const staffById = new Map(input.staff.map((s) => [s.id, s]));
  const hrExtByStaffId = new Map<string, string>();
  for (const sid of input.sourceIds) {
    if (!isHrStaffSourceSystem(sid.source_system)) continue;
    const ext = normalizeFiStaffSourceStaffId(sid.source_staff_id);
    if (ext) hrExtByStaffId.set(sid.staff_id.trim(), ext);
  }

  const feedByExt = new Map<string, IiohrHrStaffSyncRow>();
  for (const row of input.feedRows) {
    const ext = normalizeFiStaffSourceStaffId(row.external_staff_id);
    if (ext && !feedByExt.has(ext)) feedByExt.set(ext, row);
  }

  const rows: IiohrHrStaffSyncRow[] = [];
  const matchedStaffIds: string[] = [];
  const seenExt = new Set<string>();

  for (const [staffId, ext] of hrExtByStaffId) {
    if (!staffById.has(staffId)) continue;
    const row = feedByExt.get(ext);
    if (!row) continue;
    if (seenExt.has(ext)) continue;
    seenExt.add(ext);
    rows.push(row);
    matchedStaffIds.push(staffId);
  }

  // Also match feed rows to staff by email when no HR source id yet
  const emailRelink = buildRelinkSyncRowsByEmail({
    staff: input.staff.filter((s) => !matchedStaffIds.includes(s.id)),
    feedRows: input.feedRows.filter((r) => !seenExt.has(normalizeFiStaffSourceStaffId(r.external_staff_id))),
  });
  for (const row of emailRelink.rows) {
    const ext = normalizeFiStaffSourceStaffId(row.external_staff_id);
    if (ext) seenExt.add(ext);
    rows.push(row);
  }
  matchedStaffIds.push(...emailRelink.matchedStaffIds);

  return { rows, matchedStaffIds };
}
