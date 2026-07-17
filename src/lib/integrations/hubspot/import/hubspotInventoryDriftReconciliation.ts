import { createHash } from "node:crypto";

import type { HubspotContactLeadInventorySignatureRow } from "./hubspotContactLeadExpansionCore";

export const HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION =
  "fi-hubspot-contact-inventory-v1" as const;
/** Approved and frozen by FI-HUBSPOT-IMPORT-1E-D. */
export const HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION_V2 =
  "fi-hubspot-contact-inventory-v2" as const;
/** @deprecated Use HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION_V2. */
export const HUBSPOT_INVENTORY_CHECKSUM_PROPOSED_CONTRACT_VERSION =
  HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION_V2;

export const HUBSPOT_INVENTORY_CHECKSUM_CONTRACT = {
  version: HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION,
  entityType: "hubspot_contact",
  hashAlgorithm: "sha256",
  serialization: "pipe-delimited fields, newline-delimited rows",
  contactOrdering: "lexicographic sort of complete canonical row strings",
  fieldOrdering: [
    "hubspotContactId",
    "decision",
    "reasonCode",
    "proposedLeadId",
    "patientProtectionWarning",
    "quarantineReason",
    "identityTier",
    "payloadChecksum",
    "lastSourceActivityAt",
  ],
  nullHandling: "null and undefined serialize as an empty string",
  blankHandling: "blank strings serialize as an empty string",
  timestampFormatting: "no transformation; source string is serialized verbatim",
  directEmailField: false,
  directPhoneField: false,
  upstreamNormalization:
    "email uses normalizeEmail and phone uses normalizePhoneDigits before identity classification; normalized values are not serialized directly",
  sourceCutoffInHash: false,
  tenantInHash: false,
  integrationInHash: false,
  versionInHash: false,
} as const;

export const HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_V2 = {
  ...HUBSPOT_INVENTORY_CHECKSUM_CONTRACT,
  version: HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION_V2,
  serialization: "JSON arrays with fixed field positions",
  contactOrdering: "hubspotContactId ascending",
  timestampFormatting: "valid timestamps canonicalized with Date.toISOString()",
  sourceCutoffInHash: true,
  tenantInHash: true,
  integrationInHash: true,
  versionInHash: true,
  payloadChecksumInHash: true,
} as const;
/** @deprecated Use HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_V2. */
export const HUBSPOT_INVENTORY_CHECKSUM_PROPOSED_CONTRACT = HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_V2;

export type HubspotInventorySnapshot = {
  contractVersion:
    | typeof HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION
    | typeof HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION_V2;
  generatedAt: string;
  sourceCutoff: string;
  tenantId: string;
  integrationId: string;
  codeCommit: string;
  rows: HubspotContactLeadInventorySignatureRow[];
  checksum: string;
};

export type HubspotInventoryChangedField = keyof HubspotContactLeadInventorySignatureRow;

export type HubspotInventoryRecordDelta = {
  hubspotContactId: string;
  changedFields: HubspotInventoryChangedField[];
  oldValues: HubspotContactLeadInventorySignatureRow;
  newValues: HubspotContactLeadInventorySignatureRow;
  classificationChanged: boolean;
  reasonCodeChanged: boolean;
  mappingTargetChanged: boolean;
  patientReviewChanged: boolean;
  sourceFieldChanged: boolean;
  quarantineReasonChanged: boolean;
};

const SIGNATURE_FIELDS: HubspotInventoryChangedField[] = [
  "decision",
  "reasonCode",
  "proposedLeadId",
  "patientProtectionWarning",
  "quarantineReason",
  "identityTier",
  "payloadChecksum",
  "lastSourceActivityAt",
];

function value(value: string | null | undefined): string {
  return value ?? "";
}

export function canonicalizeHubspotInventoryV1(
  rows: HubspotContactLeadInventorySignatureRow[]
): string {
  return [...rows]
    .map((row) =>
      [
        row.hubspotContactId,
        row.decision,
        row.reasonCode,
        value(row.proposedLeadId),
        value(row.patientProtectionWarning),
        value(row.quarantineReason),
        row.identityTier,
        value(row.payloadChecksum),
        value(row.lastSourceActivityAt),
      ].join("|")
    )
    .sort()
    .join("\n");
}

export function computeHubspotInventoryChecksumV1(
  rows: HubspotContactLeadInventorySignatureRow[]
): string {
  return createHash("sha256").update(canonicalizeHubspotInventoryV1(rows)).digest("hex");
}

function canonicalTimestamp(valueToNormalize: string | null | undefined): string {
  if (!valueToNormalize) return "";
  const milliseconds = Date.parse(valueToNormalize);
  if (!Number.isFinite(milliseconds)) {
    throw new Error("INVENTORY_RECONCILIATION_GUARD: invalid source timestamp");
  }
  return new Date(milliseconds).toISOString();
}

export function canonicalizeHubspotInventoryV2(input: {
  tenantId: string;
  integrationId: string;
  sourceCutoff: string;
  rows: HubspotContactLeadInventorySignatureRow[];
}): string {
  const rows = [...input.rows]
    .sort((a, b) => a.hubspotContactId.localeCompare(b.hubspotContactId))
    .map((row) => [
      row.hubspotContactId,
      row.decision,
      row.reasonCode,
      value(row.proposedLeadId),
      value(row.patientProtectionWarning),
      value(row.quarantineReason),
      row.identityTier,
      value(row.payloadChecksum),
      canonicalTimestamp(row.lastSourceActivityAt),
    ]);
  return JSON.stringify([
    HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION_V2,
    "hubspot_contact",
    input.tenantId,
    input.integrationId,
    canonicalTimestamp(input.sourceCutoff),
    rows,
  ]);
}

export function computeHubspotInventoryChecksumV2(input: {
  tenantId: string;
  integrationId: string;
  sourceCutoff: string;
  rows: HubspotContactLeadInventorySignatureRow[];
}): string {
  return createHash("sha256").update(canonicalizeHubspotInventoryV2(input)).digest("hex");
}

export function assertUniqueHubspotInventoryIds(
  rows: HubspotContactLeadInventorySignatureRow[]
): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.hubspotContactId)) duplicates.add(row.hubspotContactId);
    seen.add(row.hubspotContactId);
  }
  if (duplicates.size) {
    throw new Error(
      `INVENTORY_RECONCILIATION_GUARD: duplicate HubSpot contact IDs: ${[...duplicates]
        .sort()
        .join(",")}`
    );
  }
}

export function createHubspotInventorySnapshot(input: {
  generatedAt: string;
  sourceCutoff: string;
  tenantId: string;
  integrationId: string;
  codeCommit: string;
  rows: HubspotContactLeadInventorySignatureRow[];
  contractVersion?:
    | typeof HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION
    | typeof HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION_V2;
}): HubspotInventorySnapshot {
  assertUniqueHubspotInventoryIds(input.rows);
  const rows = [...input.rows].sort((a, b) => a.hubspotContactId.localeCompare(b.hubspotContactId));
  const contractVersion = input.contractVersion ?? HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION;
  return {
    contractVersion,
    generatedAt: input.generatedAt,
    sourceCutoff: input.sourceCutoff,
    tenantId: input.tenantId,
    integrationId: input.integrationId,
    codeCommit: input.codeCommit,
    rows,
    checksum:
      contractVersion === HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION_V2
        ? computeHubspotInventoryChecksumV2({
            tenantId: input.tenantId,
            integrationId: input.integrationId,
            sourceCutoff: input.sourceCutoff,
            rows,
          })
        : computeHubspotInventoryChecksumV1(rows),
  };
}

export function assertComparableHubspotInventorySnapshots(
  expected: HubspotInventorySnapshot,
  current: HubspotInventorySnapshot
): void {
  if (expected.contractVersion !== current.contractVersion) {
    throw new Error("INVENTORY_RECONCILIATION_GUARD: checksum contract version mismatch");
  }
  if (expected.codeCommit !== current.codeCommit) {
    throw new Error(
      "INVENTORY_RECONCILIATION_GUARD: code version mismatch; canonical recomputation required"
    );
  }
  if (expected.tenantId !== current.tenantId || expected.integrationId !== current.integrationId) {
    throw new Error("INVENTORY_RECONCILIATION_GUARD: tenant or integration mismatch");
  }
  if (expected.sourceCutoff !== current.sourceCutoff) {
    throw new Error("INVENTORY_RECONCILIATION_GUARD: source cutoff mismatch");
  }
}

export function compareHubspotInventorySnapshots(
  expected: HubspotInventorySnapshot,
  current: HubspotInventorySnapshot
): {
  addedContactIds: string[];
  removedContactIds: string[];
  changedRecords: HubspotInventoryRecordDelta[];
  classificationChangeCount: number;
  reasonCodeChangeCount: number;
  mappingTargetChangeCount: number;
  patientReviewChangeCount: number;
  sourceFieldChangeCount: number;
  quarantineReasonChangeCount: number;
  checksumOnlyOrderingOrSerializationDifferences: number;
} {
  assertComparableHubspotInventorySnapshots(expected, current);
  const before = new Map(expected.rows.map((row) => [row.hubspotContactId, row]));
  const after = new Map(current.rows.map((row) => [row.hubspotContactId, row]));
  const addedContactIds = [...after.keys()].filter((id) => !before.has(id)).sort();
  const removedContactIds = [...before.keys()].filter((id) => !after.has(id)).sort();
  const changedRecords: HubspotInventoryRecordDelta[] = [];

  for (const [hubspotContactId, newValues] of after) {
    const oldValues = before.get(hubspotContactId);
    if (!oldValues) continue;
    const changedFields = SIGNATURE_FIELDS.filter(
      (field) => value(oldValues[field]) !== value(newValues[field])
    );
    if (!changedFields.length) continue;
    changedRecords.push({
      hubspotContactId,
      changedFields,
      oldValues,
      newValues,
      classificationChanged: changedFields.includes("decision"),
      reasonCodeChanged: changedFields.includes("reasonCode"),
      mappingTargetChanged: changedFields.includes("proposedLeadId"),
      patientReviewChanged: changedFields.includes("patientProtectionWarning"),
      sourceFieldChanged:
        changedFields.includes("payloadChecksum") || changedFields.includes("lastSourceActivityAt"),
      quarantineReasonChanged: changedFields.includes("quarantineReason"),
    });
  }
  changedRecords.sort((a, b) => a.hubspotContactId.localeCompare(b.hubspotContactId));

  return {
    addedContactIds,
    removedContactIds,
    changedRecords,
    classificationChangeCount: changedRecords.filter((row) => row.classificationChanged).length,
    reasonCodeChangeCount: changedRecords.filter((row) => row.reasonCodeChanged).length,
    mappingTargetChangeCount: changedRecords.filter((row) => row.mappingTargetChanged).length,
    patientReviewChangeCount: changedRecords.filter((row) => row.patientReviewChanged).length,
    sourceFieldChangeCount: changedRecords.filter((row) => row.sourceFieldChanged).length,
    quarantineReasonChangeCount: changedRecords.filter((row) => row.quarantineReasonChanged).length,
    checksumOnlyOrderingOrSerializationDifferences:
      expected.checksum !== current.checksum &&
      addedContactIds.length === 0 &&
      removedContactIds.length === 0 &&
      changedRecords.length === 0
        ? 1
        : 0,
  };
}

export function countAppliedOneECreationBatches(
  batches: Array<{ status: string; rowCount: number; importedRowCount: number }>
): {
  completedNonEmpty: number;
  zeroRowRolledBack: number;
  createdRows: number;
} {
  return {
    completedNonEmpty: batches.filter(
      (batch) =>
        batch.status === "import_completed" && batch.rowCount > 0 && batch.importedRowCount > 0
    ).length,
    zeroRowRolledBack: batches.filter(
      (batch) =>
        batch.status === "rolled_back" && batch.rowCount === 0 && batch.importedRowCount === 0
    ).length,
    createdRows: batches
      .filter((batch) => batch.status === "import_completed" && batch.rowCount > 0)
      .reduce((total, batch) => total + batch.importedRowCount, 0),
  };
}

export function assertMutuallyExclusivePrimaryCohorts(cohorts: Record<string, string[]>): void {
  const ownerByContact = new Map<string, string>();
  for (const [cohort, ids] of Object.entries(cohorts)) {
    for (const id of ids) {
      const prior = ownerByContact.get(id);
      if (prior) {
        throw new Error(
          `INVENTORY_RECONCILIATION_GUARD: contact ${id} overlaps ${prior} and ${cohort}`
        );
      }
      ownerByContact.set(id, cohort);
    }
  }
}

export function assertInventoryReconciliationCanClose(input: {
  unexplainedCount: number;
  wrongTenantCount: number;
  duplicateSourceIdCount: number;
}): void {
  if (input.unexplainedCount !== 0) {
    throw new Error("INVENTORY_RECONCILIATION_GUARD: unexplained contacts remain");
  }
  if (input.wrongTenantCount !== 0) {
    throw new Error("INVENTORY_RECONCILIATION_GUARD: wrong-tenant contacts remain");
  }
  if (input.duplicateSourceIdCount !== 0) {
    throw new Error("INVENTORY_RECONCILIATION_GUARD: duplicate source IDs remain");
  }
}

export function assertExplicitInventoryFreezeApproval(input: {
  approved: boolean;
  reconciledUnexplainedCount: number;
  expectedReplacementChecksum: string;
  proposedReplacementChecksum: string;
}): void {
  if (!input.approved) {
    throw new Error("INVENTORY_FREEZE_GUARD: explicit approval is required");
  }
  if (input.reconciledUnexplainedCount !== 0) {
    throw new Error("INVENTORY_FREEZE_GUARD: unexplained deltas remain");
  }
  if (input.expectedReplacementChecksum !== input.proposedReplacementChecksum) {
    throw new Error("INVENTORY_FREEZE_GUARD: replacement checksum mismatch");
  }
}
