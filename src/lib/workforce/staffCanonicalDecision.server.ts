import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  determineCanonicalStaffRecord,
  type CanonicalStaffDecision,
} from "@/src/lib/workforce/staffCanonicalDecisionCore";
import { loadStaffOperationalHistory } from "@/src/lib/workforce/staffOperationalHistory.server";

export type { CanonicalStaffDecision };

export async function determineCanonicalStaffRecordForMembers(
  tenantId: string,
  staffMemberIds: string[],
  client?: SupabaseClient
): Promise<CanonicalStaffDecision | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const candidates = [];
  for (const id of staffMemberIds) {
    const history = await loadStaffOperationalHistory(tid, id, client);
    candidates.push({ ...history, label: history.fullName });
  }
  return determineCanonicalStaffRecord(candidates);
}