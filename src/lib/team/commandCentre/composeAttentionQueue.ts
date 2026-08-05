/**
 * Flatten person attention reasons into a Team attention queue.
 * Preserves originating domain source + severity from the B1.6 profile contract.
 */

import { isAttentionActionAllowed } from "@/src/lib/team/commandCentre/commandCentreActionFlags";
import type {
  CommandCentreStaffSummary,
  TeamAttentionQueueItem,
} from "@/src/lib/team/commandCentre/types";
import type { StaffIdentity } from "@/src/lib/team/identity/types";
import type { StaffProfileAttentionSeverity } from "@/src/lib/team/profile/types";

const SEVERITY_RANK: Record<StaffProfileAttentionSeverity, number> = {
  blocking: 0,
  warning: 1,
  info: 2,
};

export function composeAttentionQueue(input: {
  staff: readonly CommandCentreStaffSummary[];
  identitiesByPersonKey: ReadonlyMap<string, StaffIdentity>;
  limit?: number;
}): TeamAttentionQueueItem[] {
  const limit = input.limit ?? 50;
  const items: TeamAttentionQueueItem[] = [];

  for (const summary of input.staff) {
    const identity = input.identitiesByPersonKey.get(summary.identity.personKey);
    const identitySafe = identity ? isAttentionActionAllowed(identity) : false;

    for (const reason of summary.attentionReasons) {
      const integrityHardStop =
        reason.code === "cross_tenant_mismatch" || reason.code === "identity_invalid";
      const actionAllowed = identitySafe && !integrityHardStop;

      items.push({
        personKey: summary.identity.personKey,
        displayName: summary.identity.displayName,
        source: reason.source,
        reasonCode: reason.code,
        severity: reason.severity,
        label: reason.label,
        // Cross-tenant / invalid retain integrity destinations for repair routing,
        // but destructive/domain actions stay suppressed via actionAllowed=false.
        href: reason.href,
        actionAllowed,
      });
    }
  }

  return items
    .sort((a, b) => {
      const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.displayName.localeCompare(b.displayName) || a.reasonCode.localeCompare(b.reasonCode);
    })
    .slice(0, limit);
}
