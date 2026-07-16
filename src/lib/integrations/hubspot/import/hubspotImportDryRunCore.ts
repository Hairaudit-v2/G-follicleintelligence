/**
 * FI-HUBSPOT-IMPORT-1A — pure dry-run orchestration (no I/O, no writes).
 */

import {
  assertHubspotIdNotUsedAsFiPrimaryKey,
  privacySafeSourceIdHash,
  resolveHubspotContactImportIdentity,
  resolveHubspotOwnerImportIdentity,
  toContactDecisionRecord,
} from "./hubspotImportIdentity";
import {
  buildContactReconciliationMetrics,
  buildDryRunReport,
} from "./hubspotImportReconciliation";
import type {
  FiIdentitySnapshot,
  HubspotContactDryRunInput,
  HubspotImportDecisionRecord,
  HubspotImportDryRunReport,
  HubspotOwnerDryRunInput,
  HubspotOwnerMappingClass,
} from "./hubspotImportTypes";

export function emptyFiIdentitySnapshot(): FiIdentitySnapshot {
  return {
    externalContactToPerson: new Map(),
    externalContactToPatient: new Map(),
    externalContactToLead: new Map(),
    externalOwnerToStaff: new Map(),
    emailToPersonIds: new Map(),
    personToLeadIds: new Map(),
    personToPatientId: new Map(),
    phoneToPersonIds: new Map(),
    staffEmailToStaff: new Map(),
    leadCurrentStageSlug: new Map(),
  };
}

export type ContactDryRunCoreResult = {
  report: HubspotImportDryRunReport;
  wrongTenantCount: number;
  ownerClasses: HubspotOwnerMappingClass[];
};

/**
 * Deterministic contact dry-run. Sorting by source id makes replay stable.
 */
export function runContactsImportDryRunCore(input: {
  tenantId: string;
  integrationId: string;
  contacts: HubspotContactDryRunInput[];
  snapshot: FiIdentitySnapshot;
  ownerClasses?: HubspotOwnerMappingClass[];
  generatedAt?: string;
}): ContactDryRunCoreResult {
  const sorted = [...input.contacts].sort((a, b) =>
    a.hubspotContactId.localeCompare(b.hubspotContactId)
  );

  const decisions: HubspotImportDecisionRecord[] = [];
  let wrongTenantCount = 0;

  for (const contact of sorted) {
    const resolved = resolveHubspotContactImportIdentity(contact, input.snapshot, {
      expectedTenantId: input.tenantId,
    });
    if (resolved.wrongTenant) wrongTenantCount += 1;
    assertHubspotIdNotUsedAsFiPrimaryKey(contact.hubspotContactId, resolved.proposedFiEntityId);
    decisions.push(toContactDecisionRecord(contact, resolved));
  }

  const metrics = buildContactReconciliationMetrics({
    decisions,
    sourceIds: sorted.map((c) => c.hubspotContactId),
    wrongTenantCount,
    ownerClasses: input.ownerClasses ?? [],
  });

  const report = buildDryRunReport({
    tenantId: input.tenantId,
    integrationId: input.integrationId,
    dataset: "contacts",
    decisions,
    metrics,
    generatedAt: input.generatedAt,
  });

  return { report, wrongTenantCount, ownerClasses: input.ownerClasses ?? [] };
}

export type OwnerDryRunCoreResult = {
  classifications: Array<{
    hubspotOwnerIdHash: string;
    classification: HubspotOwnerMappingClass;
    reasonCode: string;
    staffId: string | null;
  }>;
  ownerClasses: HubspotOwnerMappingClass[];
};

export function runOwnersImportDryRunCore(input: {
  tenantId: string;
  owners: HubspotOwnerDryRunInput[];
  snapshot: FiIdentitySnapshot;
}): OwnerDryRunCoreResult {
  const sorted = [...input.owners].sort((a, b) => a.hubspotOwnerId.localeCompare(b.hubspotOwnerId));
  const classifications: OwnerDryRunCoreResult["classifications"] = [];
  const ownerClasses: HubspotOwnerMappingClass[] = [];

  for (const owner of sorted) {
    const resolved = resolveHubspotOwnerImportIdentity(owner, input.snapshot, {
      expectedTenantId: input.tenantId,
    });
    ownerClasses.push(resolved.classification);
    classifications.push({
      hubspotOwnerIdHash: privacySafeSourceIdHash(owner.hubspotOwnerId),
      classification: resolved.classification,
      reasonCode: resolved.reasonCode,
      staffId: resolved.staffId,
    });
  }

  return { classifications, ownerClasses };
}

/** Stratify up to `limit` contacts across decision-relevant cohorts for production sampling. */
export function selectStratifiedContactCohort(
  contacts: HubspotContactDryRunInput[],
  snapshot: FiIdentitySnapshot,
  limit: number
): HubspotContactDryRunInput[] {
  const buckets: Record<string, HubspotContactDryRunInput[]> = {
    already_mapped: [],
    email_lead: [],
    likely_new: [],
    missing_identity: [],
    unmapped_owner: [],
    archived: [],
    test_smoke: [],
    other: [],
  };

  for (const c of contacts) {
    if (c.isTestOrSmoke) {
      buckets.test_smoke.push(c);
      continue;
    }
    if (c.archived) {
      buckets.archived.push(c);
      continue;
    }
    if (!c.hubspotContactId) {
      buckets.missing_identity.push(c);
      continue;
    }
    if (
      snapshot.externalContactToLead.has(c.hubspotContactId) ||
      snapshot.externalContactToPerson.has(c.hubspotContactId)
    ) {
      buckets.already_mapped.push(c);
      continue;
    }
    if (c.emailNormalized && (snapshot.emailToPersonIds.get(c.emailNormalized)?.length ?? 0) > 0) {
      buckets.email_lead.push(c);
      continue;
    }
    if (c.hubspotOwnerId && !snapshot.externalOwnerToStaff.has(c.hubspotOwnerId)) {
      buckets.unmapped_owner.push(c);
      continue;
    }
    if (c.emailNormalized || c.hubspotContactId) {
      buckets.likely_new.push(c);
      continue;
    }
    buckets.other.push(c);
  }

  const order = [
    "already_mapped",
    "email_lead",
    "likely_new",
    "unmapped_owner",
    "missing_identity",
    "archived",
    "test_smoke",
    "other",
  ] as const;

  const selected: HubspotContactDryRunInput[] = [];
  const perBucket = Math.max(1, Math.floor(limit / order.length));

  for (const key of order) {
    const slice = buckets[key].slice(0, perBucket);
    selected.push(...slice);
  }

  // Fill remaining from likely_new then already_mapped.
  if (selected.length < limit) {
    const seen = new Set(selected.map((c) => c.hubspotContactId));
    for (const c of [...buckets.likely_new, ...buckets.already_mapped, ...buckets.email_lead]) {
      if (selected.length >= limit) break;
      if (seen.has(c.hubspotContactId)) continue;
      selected.push(c);
      seen.add(c.hubspotContactId);
    }
  }

  return selected.slice(0, limit);
}
