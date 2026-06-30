import type {
  EvolvedStaffRecord,
  FiStaffMemberReconciliationRow,
  IiohrStaffHrLinkReconciliationLink,
  IiohrStaffHrLinkReconciliationSummary,
} from "./iiohrStaffHrLinkReconciliationTypes";

export function normaliseStaffEmail(email: string | null | undefined): string | null {
  if (email == null) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
}

function isArchived(row: FiStaffMemberReconciliationRow): boolean {
  return row.archived_at != null && String(row.archived_at).trim() !== "";
}

function recordId(record: EvolvedStaffRecord): string | null {
  const id = String(record.id ?? "").trim();
  return id || null;
}

export type PlanIiohrStaffHrLinkReconciliationInput = {
  staffMembers: FiStaffMemberReconciliationRow[];
  evolvedStaffRecords: EvolvedStaffRecord[];
};

export type PlanIiohrStaffHrLinkReconciliationResult = {
  summary: IiohrStaffHrLinkReconciliationSummary;
  links: IiohrStaffHrLinkReconciliationLink[];
};

/**
 * Plans safe email-only reconciliation links between existing FI staff members and IIOHR feed rows.
 * Does not match by name and never creates new staff rows.
 */
export function planIiohrStaffHrLinkReconciliation(
  input: PlanIiohrStaffHrLinkReconciliationInput
): PlanIiohrStaffHrLinkReconciliationResult {
  const warnings: string[] = [];
  const links: IiohrStaffHrLinkReconciliationLink[] = [];

  let skipped_blank_email = 0;
  let skipped_no_match = 0;
  let already_linked = 0;

  const feedByEmail = new Map<string, EvolvedStaffRecord>();
  for (const record of input.evolvedStaffRecords) {
    const emailKey = normaliseStaffEmail(record.email);
    if (!emailKey) continue;
    if (feedByEmail.has(emailKey)) {
      warnings.push(
        `Duplicate IIOHR feed email "${emailKey}"; using first feed row (${recordId(feedByEmail.get(emailKey)!) ?? "unknown"}).`
      );
      continue;
    }
    feedByEmail.set(emailKey, record);
  }

  const linkedIiohrIds = new Set<string>();
  for (const row of input.staffMembers) {
    if (isArchived(row)) continue;
    const existingIiohrId = row.iiohr_staff_record_id?.trim();
    if (existingIiohrId) {
      already_linked += 1;
      linkedIiohrIds.add(existingIiohrId);
    }
  }

  const claimedStaffEmails = new Set<string>();
  const activeStaff = input.staffMembers.filter((row) => !isArchived(row));

  for (const row of activeStaff) {
    if (row.iiohr_staff_record_id?.trim()) continue;

    const emailKey = normaliseStaffEmail(row.email);
    if (!emailKey) {
      skipped_blank_email += 1;
      continue;
    }

    if (claimedStaffEmails.has(emailKey)) {
      warnings.push(
        `Duplicate FI staff email "${emailKey}"; only the first unlinked staff member will be reconciled.`
      );
      skipped_no_match += 1;
      continue;
    }
    claimedStaffEmails.add(emailKey);

    const feedRow = feedByEmail.get(emailKey);
    if (!feedRow) {
      skipped_no_match += 1;
      continue;
    }

    const iiohrStaffRecordId = recordId(feedRow);
    if (!iiohrStaffRecordId) {
      warnings.push(`IIOHR feed row for "${emailKey}" is missing id; skipping link.`);
      skipped_no_match += 1;
      continue;
    }

    if (linkedIiohrIds.has(iiohrStaffRecordId)) {
      warnings.push(
        `IIOHR staff record ${iiohrStaffRecordId} is already linked in this tenant; skipping staff ${row.id}.`
      );
      skipped_no_match += 1;
      continue;
    }

    links.push({ staffMemberId: row.id, evolvedRecord: feedRow });
    linkedIiohrIds.add(iiohrStaffRecordId);
  }

  return {
    summary: {
      matched: links.length,
      linked: 0,
      skipped_blank_email,
      skipped_no_match,
      already_linked,
      warnings,
    },
    links,
  };
}
