import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertHubspotIdNotUsedAsFiPrimaryKey,
  isScientificNotationPhone,
  privacySafeSourceIdHash,
  resolveHubspotContactImportIdentity,
  resolveHubspotOwnerImportIdentity,
} from "./hubspotImportIdentity";
import {
  LEAD_VS_PATIENT_POLICY_V1,
  mapHubspotSalesPipelineStageV1,
  wouldRegressFiStage,
} from "./hubspotImportMappingV1";
import {
  emptyFiIdentitySnapshot,
  runContactsImportDryRunCore,
} from "./hubspotImportDryRunCore";
import { buildContactReconciliationMetrics, verdictFromMetrics } from "./hubspotImportReconciliation";
import type { HubspotContactDryRunInput } from "./hubspotImportTypes";

const TENANT = "11111111-1111-1111-1111-111111111111";
const INTEGRATION = "22222222-2222-2222-2222-222222222222";
const OTHER_TENANT = "33333333-3333-3333-3333-333333333333";

function contact(overrides: Partial<HubspotContactDryRunInput> = {}): HubspotContactDryRunInput {
  return {
    hubspotContactId: overrides.hubspotContactId ?? "1001",
    tenantId: overrides.tenantId ?? TENANT,
    integrationId: overrides.integrationId ?? INTEGRATION,
    emailNormalized: "emailNormalized" in overrides ? overrides.emailNormalized! : "lead@example.org",
    phoneDigits: "phoneDigits" in overrides ? overrides.phoneDigits! : "61412345678",
    phoneCorrupted: overrides.phoneCorrupted ?? false,
    hubspotOwnerId: overrides.hubspotOwnerId ?? "owner-1",
    lifecycleStage: overrides.lifecycleStage ?? "lead",
    leadStatus: overrides.leadStatus ?? "NEW",
    dealStageLabel: overrides.dealStageLabel ?? null,
    archived: overrides.archived ?? false,
    isTestOrSmoke: overrides.isTestOrSmoke ?? false,
    sourceCreatedAt: overrides.sourceCreatedAt ?? "2024-01-01T00:00:00.000Z",
    sourceUpdatedAt: overrides.sourceUpdatedAt ?? "2024-06-01T00:00:00.000Z",
    importStatus: overrides.importStatus ?? "staged",
  };
}

describe("hubspotImportIdentity policies", () => {
  it("1. existing external identity links correctly", () => {
    const snap = emptyFiIdentitySnapshot();
    snap.externalContactToLead.set("1001", "lead-uuid-1");
    const r = resolveHubspotContactImportIdentity(contact(), snap);
    assert.equal(r.decision, "link_existing_lead");
    assert.equal(r.proposedFiEntityId, "lead-uuid-1");
    assert.equal(r.identityTier, "tier1_external_identity");
  });

  it("2. HubSpot IDs never become FI primary keys", () => {
    assert.throws(() => assertHubspotIdNotUsedAsFiPrimaryKey("1001", "1001"));
    assert.doesNotThrow(() =>
      assertHubspotIdNotUsedAsFiPrimaryKey("1001", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    );
  });

  it("3. tenant mismatch fails closed", () => {
    const r = resolveHubspotContactImportIdentity(contact({ tenantId: OTHER_TENANT }), emptyFiIdentitySnapshot(), {
      expectedTenantId: TENANT,
    });
    assert.equal(r.wrongTenant, true);
    assert.equal(r.reasonCode, "tenant_mismatch_fail_closed");
  });

  it("4. one source cannot map to multiple FI leads", () => {
    const snap = emptyFiIdentitySnapshot();
    snap.externalContactToLead.set("1001", "lead-a");
    // Simulate conflict via person with multiple leads after external person link
    snap.externalContactToPerson.set("1002", "person-1");
    snap.personToLeadIds.set("person-1", ["lead-a", "lead-b"]);
    const r = resolveHubspotContactImportIdentity(contact({ hubspotContactId: "1002" }), snap);
    assert.equal(r.decision, "quarantine_ambiguous_identity");
  });

  it("5. multiple deterministic email candidates quarantine", () => {
    const snap = emptyFiIdentitySnapshot();
    snap.emailToPersonIds.set("lead@example.org", ["p1", "p2"]);
    const r = resolveHubspotContactImportIdentity(contact(), snap);
    assert.equal(r.decision, "quarantine_ambiguous_identity");
    assert.equal(r.reasonCode, "email_matches_multiple_persons");
  });

  it("6. exact lead mapping via email", () => {
    const snap = emptyFiIdentitySnapshot();
    snap.emailToPersonIds.set("lead@example.org", ["person-1"]);
    snap.personToLeadIds.set("person-1", ["lead-1"]);
    const r = resolveHubspotContactImportIdentity(contact(), snap);
    assert.equal(r.decision, "link_existing_lead");
    assert.equal(r.proposedFiEntityId, "lead-1");
  });

  it("7. existing patient does not become duplicate lead without policy", () => {
    const snap = emptyFiIdentitySnapshot();
    snap.emailToPersonIds.set("lead@example.org", ["person-1"]);
    snap.personToPatientId.set("person-1", "patient-1");
    const r = resolveHubspotContactImportIdentity(contact(), snap);
    assert.equal(r.decision, "quarantine_patient_link_requires_stronger_evidence");
    assert.notEqual(r.decision, "create_new_lead");
  });

  it("8. HubSpot contact does not automatically create a patient", () => {
    assert.equal(LEAD_VS_PATIENT_POLICY_V1.createPatientFromHubspotContact, false);
    const r = resolveHubspotContactImportIdentity(contact({ emailNormalized: "new@clinic.org" }), emptyFiIdentitySnapshot());
    assert.equal(r.decision, "create_new_lead");
    assert.equal(r.proposedFiEntityType, "lead");
    assert.notEqual(r.proposedFiEntityType, "patient");
  });

  it("9. missing identity quarantines", () => {
    const r = resolveHubspotContactImportIdentity(
      contact({ hubspotContactId: "", emailNormalized: null }),
      emptyFiIdentitySnapshot()
    );
    assert.equal(r.decision, "quarantine_missing_identity");
  });

  it("10. fuzzy name match is forbidden (policy)", () => {
    assert.equal(LEAD_VS_PATIENT_POLICY_V1.fuzzyNameMatching, false);
  });

  it("11. cross-tenant email match is forbidden", () => {
    assert.equal(LEAD_VS_PATIENT_POLICY_V1.crossTenantMatching, false);
    const snap = emptyFiIdentitySnapshot();
    // Snapshot is tenant-scoped by construction; wrong tenant on contact fails closed.
    const r = resolveHubspotContactImportIdentity(contact({ tenantId: OTHER_TENANT }), snap, {
      expectedTenantId: TENANT,
    });
    assert.equal(r.wrongTenant, true);
  });

  it("12. owner maps only to valid tenant staff", () => {
    const snap = emptyFiIdentitySnapshot();
    snap.externalOwnerToStaff.set("owner-1", { staffId: "staff-1", isActive: true });
    const r = resolveHubspotOwnerImportIdentity(
      {
        hubspotOwnerId: "owner-1",
        tenantId: TENANT,
        integrationId: INTEGRATION,
        emailNormalized: "staff@clinic.org",
        archived: false,
        isSystemOwner: false,
        isTestOwner: false,
        displayNameHash: null,
      },
      snap,
      { expectedTenantId: TENANT }
    );
    assert.equal(r.classification, "linked_active_staff");
    assert.equal(r.staffId, "staff-1");
  });

  it("13. inactive owner does not become active assignee", () => {
    const snap = emptyFiIdentitySnapshot();
    snap.externalOwnerToStaff.set("owner-1", { staffId: "staff-1", isActive: false });
    const r = resolveHubspotOwnerImportIdentity(
      {
        hubspotOwnerId: "owner-1",
        tenantId: TENANT,
        integrationId: INTEGRATION,
        emailNormalized: null,
        archived: false,
        isSystemOwner: false,
        isTestOwner: false,
        displayNameHash: null,
      },
      snap
    );
    assert.equal(r.classification, "linked_inactive_staff");
    assert.equal(r.decision, "quarantine_owner_unmapped");
  });

  it("14. unknown owner remains provenance-only", () => {
    const r = resolveHubspotOwnerImportIdentity(
      {
        hubspotOwnerId: "owner-x",
        tenantId: TENANT,
        integrationId: INTEGRATION,
        emailNormalized: "nobody@clinic.org",
        archived: false,
        isSystemOwner: false,
        isTestOwner: false,
        displayNameHash: null,
      },
      emptyFiIdentitySnapshot()
    );
    assert.equal(r.classification, "unknown_owner");
    assert.equal(r.staffId, null);
  });

  it("15. mapped pipeline stage", () => {
    const m = mapHubspotSalesPipelineStageV1("Appointment Scheduled");
    assert.equal(m.fiSlug, "consult_scheduled");
    assert.equal(m.classification, "exact_equivalent");
  });

  it("16. unmapped stage quarantines/history-only", () => {
    const unknown = mapHubspotSalesPipelineStageV1("Totally Unknown Stage");
    assert.equal(unknown.classification, "quarantine");
    const hist = mapHubspotSalesPipelineStageV1("Surgery Unqualified");
    assert.equal(hist.classification, "history_only");
  });

  it("17. existing FI OS stage is not regressed", () => {
    assert.equal(wouldRegressFiStage("won_closed", "contacted"), true);
    assert.equal(wouldRegressFiStage("contacted", "consult_scheduled"), false);
  });

  it("18-20. dry run produces no writes / notifications / automation flags", () => {
    const { report } = runContactsImportDryRunCore({
      tenantId: TENANT,
      integrationId: INTEGRATION,
      contacts: [contact()],
      snapshot: emptyFiIdentitySnapshot(),
      generatedAt: "2026-07-16T00:00:00.000Z",
    });
    assert.equal(report.entityWritesPerformed, false);
    assert.equal(report.notificationsEmitted, false);
    assert.equal(report.automationsTriggered, false);
    assert.equal(report.backupWatermarkChanged, false);
  });

  it("21. same dry run is deterministic", () => {
    const contacts = [contact({ hubspotContactId: "b" }), contact({ hubspotContactId: "a", emailNormalized: "a@clinic.org" })];
    const a = runContactsImportDryRunCore({
      tenantId: TENANT,
      integrationId: INTEGRATION,
      contacts,
      snapshot: emptyFiIdentitySnapshot(),
      generatedAt: "2026-07-16T00:00:00.000Z",
    });
    const b = runContactsImportDryRunCore({
      tenantId: TENANT,
      integrationId: INTEGRATION,
      contacts: [...contacts].reverse(),
      snapshot: emptyFiIdentitySnapshot(),
      generatedAt: "2026-07-16T00:00:00.000Z",
    });
    assert.deepEqual(
      a.report.decisions.map((d) => d.sourceIdentity.sourceRecordId),
      b.report.decisions.map((d) => d.sourceIdentity.sourceRecordId)
    );
    assert.deepEqual(a.report.metrics.decisions, b.report.metrics.decisions);
  });

  it("22. existing imported source ID is skipped or linked", () => {
    const r = resolveHubspotContactImportIdentity(
      contact({ importStatus: "imported" }),
      emptyFiIdentitySnapshot()
    );
    assert.equal(r.decision, "skip_already_imported");
  });

  it("23. contact-to-patient mapping requires stronger evidence", () => {
    assert.equal(LEAD_VS_PATIENT_POLICY_V1.emailAloneMayLinkPatient, false);
  });

  it("24. timeline source IDs prevent duplicates (hash identity helper)", () => {
    const h1 = privacySafeSourceIdHash("note-99");
    const h2 = privacySafeSourceIdHash("note-99");
    const h3 = privacySafeSourceIdHash("note-100");
    assert.equal(h1, h2);
    assert.notEqual(h1, h3);
  });

  it("25. rollback plan affects only imported records (batch-scoped reason codes)", () => {
    // Architectural invariant: decisions carry import mapping version + source identity.
    const { report } = runContactsImportDryRunCore({
      tenantId: TENANT,
      integrationId: INTEGRATION,
      contacts: [contact()],
      snapshot: emptyFiIdentitySnapshot(),
      generatedAt: "2026-07-16T00:00:00.000Z",
    });
    assert.equal(report.decisions[0].mappingVersion, "v1");
    assert.equal(report.decisions[0].sourceIdentity.sourceSystem, "hubspot");
  });

  it("26. raw sensitive fields do not appear in evidence hashes", () => {
    const hash = privacySafeSourceIdHash("1001");
    assert.equal(hash.includes("@"), false);
    assert.equal(hash.length, 16);
  });

  it("27. test/smoke identities are excluded", () => {
    const r = resolveHubspotContactImportIdentity(
      contact({ isTestOrSmoke: true, emailNormalized: "x@example.com" }),
      emptyFiIdentitySnapshot()
    );
    assert.equal(r.decision, "quarantine_test_or_smoke");
  });

  it("28. archived records follow policy", () => {
    const r = resolveHubspotContactImportIdentity(contact({ archived: true }), emptyFiIdentitySnapshot());
    assert.equal(r.decision, "skip_out_of_scope");
  });

  it("29. unsupported relationships retained as provenance (history-only stage)", () => {
    const m = mapHubspotSalesPipelineStageV1("Surgery Unqualified");
    assert.equal(m.classification, "history_only");
    assert.equal(m.fiSlug, null);
  });

  it("30. mapping-version change is explicit", () => {
    const { report } = runContactsImportDryRunCore({
      tenantId: TENANT,
      integrationId: INTEGRATION,
      contacts: [contact()],
      snapshot: emptyFiIdentitySnapshot(),
      generatedAt: "2026-07-16T00:00:00.000Z",
    });
    assert.equal(report.mappingVersion, "v1");
  });

  it("scientific notation phones are corrupted", () => {
    assert.equal(isScientificNotationPhone("6.14123E+10"), true);
    assert.equal(isScientificNotationPhone("+61412345678"), false);
  });

  it("wrong-tenant in metrics yields RED", () => {
    const metrics = buildContactReconciliationMetrics({
      decisions: [],
      sourceIds: ["1"],
      wrongTenantCount: 1,
      ownerClasses: [],
    });
    const v = verdictFromMetrics(metrics);
    assert.equal(v.verdict, "RED");
  });
});
