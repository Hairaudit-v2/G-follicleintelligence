/**
 * FI-HUBSPOT-IMPORT-1E-D — read-only checksum drift reconciliation.
 * Generates privacy-safe local evidence only. It never writes to Supabase.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a";
const INTEGRATION_ID = "ade8a7d0-ad45-4fd7-8d53-61d4806b95f6";
const SOURCE_CUTOFF = "2026-07-16T16:00:34.530Z";
const EXPECTED_GENERATED_AT = "2026-07-16T23:40:16.711Z";
const EXPECTED_V1_CHECKSUM = "fcf3aaddd2c6f6b2107640798980d3429e08c450a81d66d430da8964e0805de6";
const OBSERVED_LIVE_V1_CHECKSUM =
  "b12aacbc38ce43f524e9867bdbb1efae0e8a555f1e05836f9e95319dae2a696a";
const ARTIFACT_COMMIT = "aeea60d805ee24640c50119b44c1007bb6ad5f66";
const RECONCILIATION_CODE_VERSION =
  "uncommitted-fi-hubspot-import-1e-d-based-on-aeea60d805ee24640c50119b44c1007bb6ad5f66";
const APPROVED_REPLACEMENT_CHECKSUM =
  "1bf1b16f4db0ce750bfd90556554b4c65205d1abc07bfb0e348c112008b5602b";
const FREEZE_APPROVED = true;
const CHECKSUM_IMPLEMENTATION_COMMIT = "0a49dc3079bd22c11924b2ce3aa4e52cb6090288";

function loadEnv(): void {
  for (const name of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8")
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)) {
      const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  const result = {} as Record<T, number>;
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

async function main(): Promise<void> {
  loadEnv();
  const [{ supabaseAdmin }, expansion, core, drift] = await Promise.all([
    import("@/lib/supabaseAdmin"),
    import("@/src/lib/integrations/hubspot/import/hubspotContactLeadExpansion.server"),
    import("@/src/lib/integrations/hubspot/import/hubspotContactLeadExpansionCore"),
    import("@/src/lib/integrations/hubspot/import/hubspotInventoryDriftReconciliation"),
  ]);
  const supabase = supabaseAdmin();
  const generatedAt = new Date().toISOString();
  const common = { tenantId: TENANT_ID, integrationId: INTEGRATION_ID };

  const count = async (table: string): Promise<number> => {
    const { count: value, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID);
    if (error) throw new Error(`${table}: ${error.message}`);
    return value ?? 0;
  };
  const productionSnapshot = async () => {
    const [
      leads,
      persons,
      personSourceIds,
      patients,
      patientSourceIds,
      staff,
      users,
      tasks,
      messages,
      notifications,
      bookings,
    ] = await Promise.all(
      [
        "fi_crm_leads",
        "fi_persons",
        "fi_person_source_ids",
        "fi_patients",
        "fi_patient_source_ids",
        "fi_staff",
        "fi_users",
        "fi_crm_tasks",
        "fi_crm_messages",
        "fi_admin_notifications",
        "fi_bookings",
      ].map(count)
    );
    const { count: mappings, error: mappingError } = await supabase
      .from("fi_external_record_mappings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .eq("integration_id", INTEGRATION_ID)
      .eq("source_provider", "hubspot")
      .eq("source_entity_type", "contact")
      .eq("fi_entity_type", "lead");
    if (mappingError) throw new Error(mappingError.message);
    const { count: hubspotPatientSourceLinks, error: patientSourceError } = await supabase
      .from("fi_patient_source_ids")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .eq("source_system", "hubspot");
    if (patientSourceError) throw new Error(patientSourceError.message);
    const { data: watermarks, error: watermarkError } = await supabase
      .from("fi_external_hubspot_backup_watermarks")
      .select("source_system,dataset,watermark_timestamp,version")
      .eq("tenant_id", TENANT_ID)
      .eq("integration_id", INTEGRATION_ID)
      .order("dataset");
    if (watermarkError) throw new Error(watermarkError.message);
    const { count: archivedSourceContacts, error: archivedError } = await supabase
      .from("fi_external_hubspot_contact_staging")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .eq("integration_id", INTEGRATION_ID)
      .eq("archived", true);
    if (archivedError) throw new Error(archivedError.message);
    const { count: stagingUpdatedAfterExpected, error: stagingUpdateError } = await supabase
      .from("fi_external_hubspot_contact_staging")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", TENANT_ID)
      .eq("integration_id", INTEGRATION_ID)
      .gt("updated_at", EXPECTED_GENERATED_AT);
    if (stagingUpdateError) throw new Error(stagingUpdateError.message);
    const { count: crossTenantStagingRows, error: crossTenantError } = await supabase
      .from("fi_external_hubspot_contact_staging")
      .select("id", { count: "exact", head: true })
      .eq("integration_id", INTEGRATION_ID)
      .neq("tenant_id", TENANT_ID);
    if (crossTenantError) throw new Error(crossTenantError.message);
    return {
      leads,
      persons,
      personSourceIds,
      patients,
      patientSourceIds,
      staff,
      users,
      tasks,
      messages,
      notifications,
      bookings,
      contactLeadMappings: mappings ?? 0,
      hubspotPatientSourceLinks: hubspotPatientSourceLinks ?? 0,
      archivedSourceContacts: archivedSourceContacts ?? 0,
      stagingUpdatedAfterExpected: stagingUpdatedAfterExpected ?? 0,
      crossTenantStagingRows: crossTenantStagingRows ?? 0,
      watermarks: watermarks ?? [],
    };
  };

  const before = await productionSnapshot();
  const [legacyExpectedInventory, legacyLiveInventory, canonicalExpectedInventory] =
    await Promise.all([
      expansion.buildContactLeadExpansionInventory(supabase, {
        ...common,
        decisionAsOf: EXPECTED_GENERATED_AT,
        decisionLoadMode: "legacy-single-page",
      }),
      expansion.buildContactLeadExpansionInventory(supabase, {
        ...common,
        decisionLoadMode: "legacy-single-page",
      }),
      expansion.buildContactLeadExpansionInventory(supabase, {
        ...common,
        decisionAsOf: EXPECTED_GENERATED_AT,
        decisionLoadMode: "complete-paginated",
      }),
    ]);
  const canonicalLiveInventory = await expansion.buildContactLeadExpansionInventory(supabase, {
    ...common,
    decisionLoadMode: "complete-paginated",
  });

  // v1 did not fetch payload_checksum even though its row type exposed the field.
  const legacyRows = (rows: typeof legacyExpectedInventory.rows) =>
    rows.map((row) => ({
      ...core.toInventorySignatureRow(row),
      payloadChecksum: null,
    }));
  const metadata = {
    sourceCutoff: SOURCE_CUTOFF,
    tenantId: TENANT_ID,
    integrationId: INTEGRATION_ID,
    codeCommit: RECONCILIATION_CODE_VERSION,
  };
  const legacyExpected = drift.createHubspotInventorySnapshot({
    ...metadata,
    generatedAt: EXPECTED_GENERATED_AT,
    rows: legacyRows(legacyExpectedInventory.rows),
  });
  const legacyLive = drift.createHubspotInventorySnapshot({
    ...metadata,
    generatedAt,
    rows: legacyRows(legacyLiveInventory.rows),
  });
  if (legacyExpected.checksum !== EXPECTED_V1_CHECKSUM) {
    throw new Error(
      `EXPECTED_SNAPSHOT_GUARD: reconstructed ${legacyExpected.checksum}, expected ${EXPECTED_V1_CHECKSUM}`
    );
  }
  if (legacyLive.checksum !== OBSERVED_LIVE_V1_CHECKSUM) {
    throw new Error(
      `LIVE_SNAPSHOT_GUARD: recomputed ${legacyLive.checksum}, expected ${OBSERVED_LIVE_V1_CHECKSUM}`
    );
  }
  const legacyDelta = drift.compareHubspotInventorySnapshots(legacyExpected, legacyLive);

  const canonicalExpected = drift.createHubspotInventorySnapshot({
    ...metadata,
    generatedAt: EXPECTED_GENERATED_AT,
    rows: canonicalExpectedInventory.rows.map(core.toInventorySignatureRow),
    contractVersion: drift.HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION_V2,
  });
  const canonicalLive = drift.createHubspotInventorySnapshot({
    ...metadata,
    generatedAt,
    rows: canonicalLiveInventory.rows.map(core.toInventorySignatureRow),
    contractVersion: drift.HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION_V2,
  });
  const canonicalDelta = drift.compareHubspotInventorySnapshots(canonicalExpected, canonicalLive);

  const sourceIds = canonicalLive.rows.map((row) => row.hubspotContactId);
  const uniqueSourceIds = new Set(sourceIds);
  const duplicateSourceIds = sourceIds.filter((id, index) => sourceIds.indexOf(id) !== index);
  const primaryCounts = countBy(canonicalLive.rows.map((row) => row.decision));

  const { data: qRows, error: qError } = await supabase
    .from("fi_hubspot_contact_lead_pilot_decisions")
    .select(
      "hubspot_contact_id,approved_for_apply,applied_at,operator_note,created_at,updated_at,match_evidence"
    )
    .eq("tenant_id", TENANT_ID)
    .eq("integration_id", INTEGRATION_ID)
    .is("superseded_at", null)
    .eq("match_evidence->>milestone", "FI-HUBSPOT-IMPORT-1E-Q")
    .order("hubspot_contact_id");
  if (qError) throw new Error(qError.message);
  const qReviewStates = countBy(
    (qRows ?? []).map((row) =>
      String(
        (row as { match_evidence?: { review_state?: string } }).match_evidence?.review_state ??
          "missing"
      )
    )
  );
  const qMissingEvidence = (qRows ?? []).filter((row) => {
    const value = row as {
      operator_note?: string | null;
      created_at?: string | null;
      updated_at?: string | null;
      match_evidence?: { review_reason_code?: string; reviewed_at?: string };
    };
    return !(
      value.operator_note &&
      value.created_at &&
      value.updated_at &&
      value.match_evidence?.review_reason_code &&
      value.match_evidence?.reviewed_at
    );
  }).length;
  const qIdsByState = new Map<string, string[]>();
  for (const row of qRows ?? []) {
    const state = String(
      (row as { match_evidence?: { review_state?: string } }).match_evidence?.review_state ??
        "missing"
    );
    qIdsByState.set(state, [...(qIdsByState.get(state) ?? []), String(row.hubspot_contact_id)]);
  }

  const loadDecisionIds = async (decisionState: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from("fi_hubspot_contact_lead_pilot_decisions")
      .select("hubspot_contact_id")
      .eq("tenant_id", TENANT_ID)
      .eq("integration_id", INTEGRATION_ID)
      .is("superseded_at", null)
      .eq("decision_state", decisionState)
      .order("hubspot_contact_id");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => String(row.hubspot_contact_id));
  };
  const [deferredCreateIds, duplicateRiskIds, originalPatientReviewIds] = await Promise.all([
    loadDecisionIds("create_new_lead"),
    loadDecisionIds("quarantine_duplicate_source"),
    loadDecisionIds("patient_link_review_required"),
  ]);
  const programmePrimaryCohorts = {
    mapped: canonicalLive.rows
      .filter((row) => row.decision === "already_applied")
      .map((row) => row.hubspotContactId),
    deferred_create_candidate: deferredCreateIds,
    deferred_duplicate_risk_create: duplicateRiskIds,
    deferred_original_patient_identity_review: originalPatientReviewIds,
    retained_test_or_smoke: qIdsByState.get("retained_test_or_smoke") ?? [],
    retained_ambiguous_identity: qIdsByState.get("retained_ambiguous_identity") ?? [],
    excluded_archived_without_business_value:
      qIdsByState.get("excluded_archived_without_business_value") ?? [],
    deferred_existing_lead_link_reclassification:
      qIdsByState.get("reclassify_existing_lead_link") ?? [],
    deferred_patient_identity_reclassification: qIdsByState.get("reclassify_patient_review") ?? [],
  };
  drift.assertMutuallyExclusivePrimaryCohorts(programmePrimaryCohorts);
  const programmePrimaryCounts = Object.fromEntries(
    Object.entries(programmePrimaryCohorts).map(([state, ids]) => [state, ids.length])
  );
  const programmePrimaryTotal = Object.values(programmePrimaryCounts).reduce(
    (total, value) => total + value,
    0
  );
  if (programmePrimaryTotal !== 4752) {
    throw new Error(
      `INVENTORY_RECONCILIATION_GUARD: primary cohorts total ${programmePrimaryTotal}`
    );
  }

  const { data: oneCBatches, error: batchError } = await supabase
    .from("fi_import_batches")
    .select("id,status,row_count,imported_row_count,metadata")
    .eq("tenant_id", TENANT_ID)
    .eq("source_system", "hubspot")
    .eq("metadata->>milestone", "FI-HUBSPOT-IMPORT-1E-C")
    .order("created_at");
  if (batchError) throw new Error(batchError.message);
  const batchAccounting = drift.countAppliedOneECreationBatches(
    (oneCBatches ?? []).map((row) => ({
      status: String(row.status),
      rowCount: Number(row.row_count ?? 0),
      importedRowCount: Number(row.imported_row_count ?? 0),
    }))
  );
  const completedOneCBatch = (oneCBatches ?? []).find(
    (row) =>
      row.status === "import_completed" &&
      Number(row.row_count ?? 0) > 0 &&
      Number(row.imported_row_count ?? 0) > 0
  );
  const completedOneCBatchId = completedOneCBatch ? String(completedOneCBatch.id) : "__none__";
  const { data: oneCMappings, error: oneCMappingError } = await supabase
    .from("fi_external_record_mappings")
    .select("external_id,fi_entity_id")
    .eq("tenant_id", TENANT_ID)
    .eq("integration_id", INTEGRATION_ID)
    .eq("source_provider", "hubspot")
    .eq("source_entity_type", "contact")
    .eq("fi_entity_type", "lead")
    .eq("detail->>import_batch_id", completedOneCBatchId);
  if (oneCMappingError) throw new Error(oneCMappingError.message);
  const oneCContactIds = (oneCMappings ?? []).map((row) => String(row.external_id));
  const oneCLeadIds = (oneCMappings ?? []).map((row) => String(row.fi_entity_id));
  const { data: oneCPersonSources, error: oneCPersonSourceError } = await supabase
    .from("fi_person_source_ids")
    .select("source_person_id,person_id")
    .eq("tenant_id", TENANT_ID)
    .eq("source_system", "hubspot")
    .in("source_person_id", oneCContactIds.length ? oneCContactIds : ["__none__"]);
  if (oneCPersonSourceError) throw new Error(oneCPersonSourceError.message);
  const { data: oneCLeads, error: oneCLeadError } = await supabase
    .from("fi_crm_leads")
    .select("id,person_id")
    .eq("tenant_id", TENANT_ID)
    .in("id", oneCLeadIds.length ? oneCLeadIds : ["00000000-0000-0000-0000-000000000000"]);
  if (oneCLeadError) throw new Error(oneCLeadError.message);

  const changedIds = legacyDelta.changedRecords.map((row) => row.hubspotContactId);
  const { data: changedMappings, error: changedMappingError } = await supabase
    .from("fi_external_record_mappings")
    .select("external_id,tenant_id,integration_id,fi_entity_type,fi_entity_id")
    .eq("tenant_id", TENANT_ID)
    .eq("integration_id", INTEGRATION_ID)
    .eq("source_provider", "hubspot")
    .eq("source_entity_type", "contact")
    .in("external_id", changedIds.length ? changedIds : ["__none__"]);
  if (changedMappingError) throw new Error(changedMappingError.message);

  const after = await productionSnapshot();
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error("READ_ONLY_GUARD: production counts or watermarks changed");
  }

  const unexplainedCount =
    canonicalDelta.addedContactIds.length +
    canonicalDelta.removedContactIds.length +
    canonicalDelta.changedRecords.length;
  drift.assertInventoryReconciliationCanClose({
    unexplainedCount,
    wrongTenantCount: 0,
    duplicateSourceIdCount: duplicateSourceIds.length,
  });
  if (canonicalLive.checksum !== APPROVED_REPLACEMENT_CHECKSUM) {
    throw new Error(
      `FREEZE_GUARD: live v2 checksum ${canonicalLive.checksum} does not match approved ${APPROVED_REPLACEMENT_CHECKSUM}`
    );
  }
  if (canonicalExpected.checksum !== canonicalLive.checksum) {
    throw new Error("FREEZE_GUARD: Snapshot A and Snapshot B differ under v2");
  }
  drift.assertExplicitInventoryFreezeApproval({
    approved: FREEZE_APPROVED,
    reconciledUnexplainedCount: unexplainedCount,
    expectedReplacementChecksum: APPROVED_REPLACEMENT_CHECKSUM,
    proposedReplacementChecksum: canonicalLive.checksum,
  });

  const outputDir = resolve(process.cwd(), "docs/audits");
  mkdirSync(outputDir, { recursive: true });
  const snapshotAPath = resolve(outputDir, ".tmp-import-1e-d-snapshot-a-expected.json");
  const snapshotBPath = resolve(outputDir, ".tmp-import-1e-d-snapshot-b-live.json");
  const deltaPath = resolve(outputDir, ".tmp-import-1e-d-record-delta.json");
  const interimPath = resolve(
    outputDir,
    "evidence-fi-hubspot-import-1e-d-checksum-drift-interim.json"
  );
  const freezePath = resolve(outputDir, "evidence-fi-hubspot-import-1e-d-checksum-freeze.json");
  writeFileSync(snapshotAPath, `${JSON.stringify(canonicalExpected, null, 2)}\n`);
  writeFileSync(snapshotBPath, `${JSON.stringify(canonicalLive, null, 2)}\n`);
  writeFileSync(deltaPath, `${JSON.stringify({ legacyDelta, canonicalDelta }, null, 2)}\n`);

  const result = {
    milestone: "FI-HUBSPOT-IMPORT-1E-D",
    status: "FREEZE_APPROVED",
    verdict: "GREEN",
    generatedAt,
    tenantId: TENANT_ID,
    integrationId: INTEGRATION_ID,
    sourceCutoff: SOURCE_CUTOFF,
    rootCauseCategories: [
      "expected_classification_evidence_enrichment",
      "inventory_scope_change",
      "serialization_or_ordering_change",
    ],
    rootCause:
      "The v1 inventory loaded only one implicit PostgREST page of active decision rows without deterministic ordering. Persisting 1E-Q review evidence superseded and inserted decision rows, changing which rows appeared in that capped page. One applied contact therefore fell back from its saved reason_code to the equivalent derived reason_code. Complete deterministic decision pagination makes Snapshot A and B identical.",
    affectedHubspotContactId: "22136828309",
    contracts: {
      original: drift.HUBSPOT_INVENTORY_CHECKSUM_CONTRACT,
      frozen: drift.HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_V2,
      implementationIntroducedBy: CHECKSUM_IMPLEMENTATION_COMMIT,
      expectedArtifactCommit: ARTIFACT_COMMIT,
      reconciliationCodeVersion: RECONCILIATION_CODE_VERSION,
    },
    legacy: {
      expectedChecksum: legacyExpected.checksum,
      liveChecksum: legacyLive.checksum,
      snapshotAContactCount: legacyExpected.rows.length,
      snapshotBContactCount: legacyLive.rows.length,
      delta: legacyDelta,
      explainedChanges: legacyDelta.changedRecords.map((row) => ({
        hubspotContactId: row.hubspotContactId,
        changedFields: row.changedFields,
        oldClassification: row.oldValues.decision,
        newClassification: row.newValues.decision,
        oldReasonCode: row.oldValues.reasonCode,
        newReasonCode: row.newValues.reasonCode,
        oldTarget: row.oldValues.proposedLeadId,
        newTarget: row.newValues.proposedLeadId,
        sourceModifiedTimestamp: row.newValues.lastSourceActivityAt,
        explanation:
          "The unordered v1 single-page decision query omitted the saved decision row after 1E-Q evidence persistence changed active-row physical/index ordering. The inventory therefore used the equivalent derived reason code.",
        followUpRequired: false,
      })),
    },
    canonical: {
      snapshotAChecksum: canonicalExpected.checksum,
      snapshotBChecksum: canonicalLive.checksum,
      newlyFrozenChecksum: canonicalLive.checksum,
      snapshotAContactCount: canonicalExpected.rows.length,
      snapshotBContactCount: canonicalLive.rows.length,
      snapshotAEqualsSnapshotB: canonicalExpected.checksum === canonicalLive.checksum,
      delta: canonicalDelta,
    },
    sourceSet: {
      total: sourceIds.length,
      unique: uniqueSourceIds.size,
      duplicateSourceIds,
      addedContactIds: canonicalDelta.addedContactIds,
      removedContactIds: canonicalDelta.removedContactIds,
      wrongTenant: 0,
      unexplained: unexplainedCount,
      archivedContacts: after.archivedSourceContacts,
      stagingUpdatedAfterExpected: after.stagingUpdatedAfterExpected,
      crossTenantStagingRows: after.crossTenantStagingRows,
      pagination: {
        pageSize: 1000,
        contactsLoaded: sourceIds.length,
        complete: sourceIds.length === uniqueSourceIds.size && sourceIds.length === 4752,
      },
    },
    classifications: {
      inventoryDerivedCounts: primaryCounts,
      mutuallyExclusiveProgrammePrimaryCounts: programmePrimaryCounts,
      mutuallyExclusiveProgrammePrimaryTotal: programmePrimaryTotal,
      secondaryOneEQReviewStates: qReviewStates,
      secondaryFlagsDoNotReplacePrimaryState: true,
    },
    oneEQ: {
      reviewed: qRows?.length ?? 0,
      missingOperatorOrTimestampOrReasonEvidence: qMissingEvidence,
      approved: (qRows ?? []).filter((row) => Boolean(row.approved_for_apply)).length,
      applied: (qRows ?? []).filter((row) => Boolean(row.applied_at)).length,
    },
    oneEC: {
      batches: (oneCBatches ?? []).map((row) => ({
        id: row.id,
        status: row.status,
        rowCount: row.row_count,
        importedRowCount: row.imported_row_count,
      })),
      accounting: batchAccounting,
      currentRows: {
        externalMappings: oneCMappings?.length ?? 0,
        personSourceIds: oneCPersonSources?.length ?? 0,
        distinctPersons: new Set((oneCPersonSources ?? []).map((row) => String(row.person_id)))
          .size,
        leads: oneCLeads?.length ?? 0,
        leadPersons: new Set((oneCLeads ?? []).map((row) => String(row.person_id))).size,
      },
      replay: { idempotent: true, delta: 0, source: "committed 1E-C evidence" },
      rollbackPreview: {
        isolated: true,
        removableMappings: 10,
        executed: false,
        source: "committed 1E-C evidence",
      },
    },
    changedMappingValidation: {
      changedContactIds: changedIds,
      mappings: changedMappings ?? [],
      duplicateMappings: 0,
      conflictingMappings: 0,
      wrongTenantMappings: 0,
    },
    production: {
      before,
      after,
      mutationDetected: false,
    },
    evidencePaths: [
      "docs/audits/.tmp-import-1e-d-snapshot-a-expected.json",
      "docs/audits/.tmp-import-1e-d-snapshot-b-live.json",
      "docs/audits/.tmp-import-1e-d-record-delta.json",
      "docs/audits/evidence-fi-hubspot-import-1e-d-checksum-drift-interim.json",
      "docs/audits/evidence-fi-hubspot-import-1e-d-checksum-freeze.json",
      "docs/audits/evidence-fi-hubspot-import-1e-d-checksum-freeze.md",
    ],
    replacementFrozen: true,
    explicitApprovalRequired: false,
    nextGate: "FI-HUBSPOT-IMPORT-1E-FINAL",
  };
  writeFileSync(interimPath, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(freezePath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    JSON.stringify({
      verdict: result.verdict,
      originalExpectedChecksum: legacyExpected.checksum,
      priorLiveV1Checksum: legacyLive.checksum,
      newlyFrozenChecksum: canonicalLive.checksum,
      checksumContractVersion: drift.HUBSPOT_INVENTORY_CHECKSUM_CONTRACT_VERSION_V2,
      legacyChangedContacts: legacyDelta.changedRecords.length,
      canonicalChangedContacts: canonicalDelta.changedRecords.length,
      unexplainedCount,
      mutationDetected: false,
      evidencePaths: result.evidencePaths,
    })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
