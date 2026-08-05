import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadAllStaffForTenant, type FiStaffRow } from "@/src/lib/staff/staff.server";
import {
  indexRosterMemberContextByStaffId,
  projectRosterStaffEntry,
  type RosterStaffAttentionReason,
  type RosterStaffEntry,
} from "@/src/lib/team/roster";
import { resolveStaffIdentities } from "@/src/lib/team/identity/server";
import {
  buildRosterStaffEligibilityContext,
  type RosterIneligibleStaffOption,
  type RosterStaffEligibilityContext,
} from "@/src/lib/workforce-os/rosterEligibleStaffCore";

export type { RosterIneligibleStaffOption, RosterStaffEligibilityContext };
export {
  buildRosterStaffEligibilityContext,
  listRosterEligibleStaffMissingStandardHours,
  resolveDefaultRosterStaffIds,
} from "@/src/lib/workforce-os/rosterEligibleStaffCore";

type AvailabilityBlockRow = {
  staff_id: string;
  block_type: string;
  starts_at: string;
  ends_at: string;
  status?: string | null;
};

export type RosterStaffEligibilityContextWithIdentity = RosterStaffEligibilityContext & {
  /** Identity projections keyed by scheduling staffId — ordering matches staffRows. */
  rosterStaffEntries: RosterStaffEntry[];
  attentionByStaffId: Map<string, RosterStaffAttentionReason[]>;
};

/**
 * Load roster eligibility for the tenant.
 *
 * Query budget (no N+1 identity loop):
 * 1. one scheduling staff load (`loadAllStaffForTenant` / optional injected rows)
 * 2. one `resolveStaffIdentities({ by: "staffId" })` batch sequence
 * 3. domain eligibility evaluation in memory (behaviourally unchanged)
 *
 * Identity attention / action flags are layered on top; they do not replace
 * competency, leave, clinic, or employment ineligibility reasons. Unsafe new
 * assignments are rejected at the mutation boundary.
 */
export async function loadRosterStaffEligibilityContext(
  tenantId: string,
  input: {
    periodDayDates: string[];
    availabilityBlocks?: AvailabilityBlockRow[];
    staffRows?: FiStaffRow[];
    client?: SupabaseClient;
  }
): Promise<RosterStaffEligibilityContextWithIdentity> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const staffRows = input.staffRows
    ? input.staffRows
    : await loadAllStaffForTenant(tid, input.client);

  const staffIds = staffRows.map((row) => String(row.id));

  /**
   * Fixed query budget for identity: batch resolve uses bounded `.in(...)` loads
   * (not one query per staff member). Scheduling rows remain the roster source;
   * lifecycle-only people are never invented as roster resources.
   */
  const identityBatch = await resolveStaffIdentities(
    {
      tenantId: tid,
      by: "staffId",
      staffIds,
    },
    { client: input.client }
  );

  const membersByFiStaffId = indexRosterMemberContextByStaffId(identityBatch.byKey);

  const eligibility = buildRosterStaffEligibilityContext({
    staffRows,
    membersByFiStaffId,
    periodDayDates: input.periodDayDates,
    availabilityBlocks: input.availabilityBlocks,
  });

  const rosterStaffEntries: RosterStaffEntry[] = [];
  const attentionByStaffId = new Map<string, RosterStaffAttentionReason[]>();

  for (const staff of staffRows) {
    const staffId = String(staff.id);
    const identity = identityBatch.byKey.get(staffId) ?? null;
    if (!identity) continue;

    const domainEligible = eligibility.eligibilityByStaffId.get(staffId)?.eligible === true;
    const entry = projectRosterStaffEntry(identity, {
      domainEligible,
      schedulingActive: Boolean(staff.is_active),
    });
    if (!entry) continue;

    rosterStaffEntries.push(entry);
    if (entry.attentionReasons.length) {
      attentionByStaffId.set(staffId, entry.attentionReasons);
    }
  }

  return {
    ...eligibility,
    rosterStaffEntries,
    attentionByStaffId,
  };
}
