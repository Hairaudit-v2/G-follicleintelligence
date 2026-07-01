import { IIOHR_EVOLVED_HR_SOURCE_SYSTEM } from "./iiohrStaffHrLinkReconciliationTypes";
import type {
  HrReconciliationArchivedRecord,
  HrReconciliationMetrics,
  StaffMemberLifecycleRow,
} from "./staffLifecycleTypes";

export function isStaffArchived(
  member: Pick<StaffMemberLifecycleRow, "archived_at">
): boolean {
  return member.archived_at != null && String(member.archived_at).trim() !== "";
}

/** Staff already linked to IIOHR — excluded from reconciliation action queue. */
export function isStaffHrLinkedForReconciliation(
  member: Pick<
    StaffMemberLifecycleRow,
    "iiohr_staff_record_id" | "iiohr_user_id" | "source_system" | "source_synced_at"
  >
): boolean {
  if (member.iiohr_staff_record_id?.trim()) return true;
  if (member.iiohr_user_id?.trim()) return true;
  if (
    member.source_system === IIOHR_EVOLVED_HR_SOURCE_SYSTEM &&
    member.source_synced_at != null &&
    String(member.source_synced_at).trim() !== ""
  ) {
    return true;
  }
  return false;
}

export function needsHrReconciliation(member: StaffMemberLifecycleRow): boolean {
  return !isStaffArchived(member) && !isStaffHrLinkedForReconciliation(member);
}

export function buildHrReconciliationMetrics(
  members: StaffMemberLifecycleRow[]
): HrReconciliationMetrics {
  let activeStaff = 0;
  let alreadyLinked = 0;
  let needsReconciliation = 0;
  let archivedExcluded = 0;

  for (const member of members) {
    if (isStaffArchived(member)) {
      archivedExcluded += 1;
      continue;
    }
    activeStaff += 1;
    if (isStaffHrLinkedForReconciliation(member)) {
      alreadyLinked += 1;
    } else {
      needsReconciliation += 1;
    }
  }

  return { activeStaff, alreadyLinked, needsReconciliation, archivedExcluded };
}

export function buildArchivedHistoricalRecords(
  members: StaffMemberLifecycleRow[]
): HrReconciliationArchivedRecord[] {
  return members.filter(isStaffArchived).map((member) => ({
    staffMemberId: member.id,
    fiOsStaffName: member.full_name,
    fiOsEmail: member.email,
  }));
}
