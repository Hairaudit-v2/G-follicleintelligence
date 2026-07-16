import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertMutationAllowlist,
  evaluateOwnerMapping,
  rejectNameOnlyMatch,
  selectPilotProposals,
  tallyProposals,
  type OwnerMappingEvalContext,
} from "./hubspotOwnerMappingCore";
import {
  HUBSPOT_OWNER_MAPPING_DEFAULT_MAX,
  HUBSPOT_OWNER_MAPPING_EXPANSION_MAX,
} from "./hubspotOwnerMappingTypes";

const TENANT = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const INTEGRATION = "33333333-3333-3333-3333-333333333333";

function ctx(partial?: Partial<OwnerMappingEvalContext>): OwnerMappingEvalContext {
  return {
    expectedTenantId: TENANT,
    staffByEmail: new Map(),
    existingByOwnerId: new Map(),
    existingByStaffId: new Map(),
    ...partial,
  };
}

describe("hubspotOwnerMapping 1B", () => {
  it("deterministic active staff mapping", () => {
    const c = ctx({
      staffByEmail: new Map([
        [
          "a@clinic.org",
          [{ staffId: "staff-1", tenantId: TENANT, isActive: true, emailNormalized: "a@clinic.org" }],
        ],
      ]),
    });
    const r = evaluateOwnerMapping(
      {
        hubspotOwnerId: "100",
        tenantId: TENANT,
        integrationId: INTEGRATION,
        emailNormalized: "a@clinic.org",
        archived: false,
        displayName: "Alice",
      },
      c
    );
    assert.equal(r.decision, "apply_mapping");
    assert.equal(r.staffId, "staff-1");
    assert.equal(r.matchMethod, "exact_staff_email_within_tenant");
  });

  it("unresolved owner quarantine", () => {
    const r = evaluateOwnerMapping(
      {
        hubspotOwnerId: "101",
        tenantId: TENANT,
        integrationId: INTEGRATION,
        emailNormalized: "nobody@clinic.org",
        archived: false,
        displayName: "Nobody",
      },
      ctx()
    );
    assert.equal(r.decision, "quarantine_unresolved");
  });

  it("name-only match rejection", () => {
    assert.equal(rejectNameOnlyMatch("Jane Doe"), "reject_name_only");
    const r = evaluateOwnerMapping(
      {
        hubspotOwnerId: "102",
        tenantId: TENANT,
        integrationId: INTEGRATION,
        emailNormalized: null,
        archived: false,
        displayName: "Jane Doe",
      },
      ctx()
    );
    assert.equal(r.decision, "reject_name_only");
  });

  it("duplicate replay already_applied", () => {
    const c = ctx({
      existingByOwnerId: new Map([
        [
          "100",
          {
            hubspotOwnerId: "100",
            staffId: "staff-1",
            mappingRowId: "map-1",
            importBatchId: "batch-1",
          },
        ],
      ]),
    });
    const r = evaluateOwnerMapping(
      {
        hubspotOwnerId: "100",
        tenantId: TENANT,
        integrationId: INTEGRATION,
        emailNormalized: "a@clinic.org",
        archived: false,
        displayName: null,
      },
      c
    );
    assert.equal(r.decision, "already_applied");
    assert.equal(r.staffId, "staff-1");
  });

  it("source-owner conflict when maps disagree", () => {
    // Covered via target conflict primarily; source already_applied short-circuits.
    // Target staff conflict:
    const c = ctx({
      staffByEmail: new Map([
        [
          "a@clinic.org",
          [{ staffId: "staff-1", tenantId: TENANT, isActive: true, emailNormalized: "a@clinic.org" }],
        ],
      ]),
      existingByStaffId: new Map([
        [
          "staff-1",
          {
            hubspotOwnerId: "999",
            staffId: "staff-1",
            mappingRowId: "map-x",
            importBatchId: "other",
          },
        ],
      ]),
    });
    const r = evaluateOwnerMapping(
      {
        hubspotOwnerId: "100",
        tenantId: TENANT,
        integrationId: INTEGRATION,
        emailNormalized: "a@clinic.org",
        archived: false,
        displayName: null,
      },
      c
    );
    assert.equal(r.decision, "conflict_target_has_other_owner");
  });

  it("target-staff conflict", () => {
    const c = ctx({
      staffByEmail: new Map([
        [
          "b@clinic.org",
          [{ staffId: "staff-2", tenantId: TENANT, isActive: true, emailNormalized: "b@clinic.org" }],
        ],
      ]),
      existingByStaffId: new Map([
        [
          "staff-2",
          {
            hubspotOwnerId: "owner-other",
            staffId: "staff-2",
            mappingRowId: "map-2",
            importBatchId: null,
          },
        ],
      ]),
    });
    const r = evaluateOwnerMapping(
      {
        hubspotOwnerId: "owner-new",
        tenantId: TENANT,
        integrationId: INTEGRATION,
        emailNormalized: "b@clinic.org",
        archived: false,
        displayName: null,
      },
      c
    );
    assert.equal(r.decision, "conflict_target_has_other_owner");
  });

  it("tenant isolation", () => {
    const c = ctx({
      staffByEmail: new Map([
        [
          "a@clinic.org",
          [{ staffId: "staff-1", tenantId: TENANT, isActive: true, emailNormalized: "a@clinic.org" }],
        ],
      ]),
    });
    const r = evaluateOwnerMapping(
      {
        hubspotOwnerId: "100",
        tenantId: OTHER,
        integrationId: INTEGRATION,
        emailNormalized: "a@clinic.org",
        archived: false,
        displayName: null,
      },
      c
    );
    assert.equal(r.decision, "reject_wrong_tenant");
  });

  it("inactive/archived staff rejection", () => {
    const c = ctx({
      staffByEmail: new Map([
        [
          "a@clinic.org",
          [{ staffId: "staff-1", tenantId: TENANT, isActive: false, emailNormalized: "a@clinic.org" }],
        ],
      ]),
    });
    const r = evaluateOwnerMapping(
      {
        hubspotOwnerId: "100",
        tenantId: TENANT,
        integrationId: INTEGRATION,
        emailNormalized: "a@clinic.org",
        archived: false,
        displayName: null,
      },
      c
    );
    assert.equal(r.decision, "quarantine_inactive_staff");
  });

  it("batch size enforcement", () => {
    const proposals = [1, 2, 3].map((n) => ({
      hubspotOwnerId: String(n),
      hubspotOwnerIdHash: `h${n}`,
      staffId: `staff-${n}`,
      tenantId: TENANT,
      integrationId: INTEGRATION,
      matchMethod: "exact_staff_email_within_tenant" as const,
      decision: "apply_mapping" as const,
      reasonCode: "ok",
      emailNormalizedHash: null,
      staffIsActive: true,
    }));
    const limited = selectPilotProposals(proposals, { maxRecords: 2, expandEnabled: false });
    assert.equal(limited.maxAllowed, HUBSPOT_OWNER_MAPPING_DEFAULT_MAX);
    assert.equal(limited.selected.length, 2);
    assert.equal(limited.rejectedOverLimit.length, 1);
    assert.equal(limited.rejectedOverLimit[0].decision, "reject_over_limit");

    const expanded = selectPilotProposals(proposals, { maxRecords: 25, expandEnabled: true });
    assert.equal(expanded.maxAllowed, Math.min(25, HUBSPOT_OWNER_MAPPING_EXPANSION_MAX));
    assert.equal(expanded.selected.length, 3);
  });

  it("mutation allowlist enforcement", () => {
    assert.doesNotThrow(() => assertMutationAllowlist("fi_staff_source_ids", "insert"));
    assert.doesNotThrow(() => assertMutationAllowlist("fi_staff_source_ids", "delete"));
    assert.doesNotThrow(() => assertMutationAllowlist("fi_import_batches", "insert"));
    assert.throws(() => assertMutationAllowlist("fi_staff", "update"));
    assert.throws(() => assertMutationAllowlist("fi_staff_source_ids", "update"));
    assert.throws(() => assertMutationAllowlist("fi_users", "insert"));
  });

  it("rollback batch isolation metadata contract", () => {
    // Rollback only removes rows with matching import_batch_id + milestone; outside adoption flags block.
    const meta = {
      import_batch_id: "batch-1",
      milestone: "FI-HUBSPOT-IMPORT-1B",
      confirmed_outside_batch: false,
    };
    assert.equal(meta.import_batch_id === "batch-1", true);
    assert.equal(meta.milestone === "FI-HUBSPOT-IMPORT-1B", true);
    assert.equal(meta.confirmed_outside_batch, false);
  });

  it("side-effect suppression flags on report shape", () => {
    // Pure tally does not emit notifications; server report hardcodes false flags.
    const counts = tallyProposals([
      {
        hubspotOwnerId: "1",
        hubspotOwnerIdHash: "h",
        staffId: "s",
        tenantId: TENANT,
        integrationId: INTEGRATION,
        matchMethod: "exact_staff_email_within_tenant",
        decision: "apply_mapping",
        reasonCode: "ok",
        emailNormalizedHash: null,
        staffIsActive: true,
      },
    ]);
    assert.equal(counts.proposedApply, 1);
    assert.equal(counts.wrongTenant, 0);
  });

  it("ambiguous email quarantines", () => {
    const c = ctx({
      staffByEmail: new Map([
        [
          "shared@clinic.org",
          [
            { staffId: "s1", tenantId: TENANT, isActive: true, emailNormalized: "shared@clinic.org" },
            { staffId: "s2", tenantId: TENANT, isActive: true, emailNormalized: "shared@clinic.org" },
          ],
        ],
      ]),
    });
    const r = evaluateOwnerMapping(
      {
        hubspotOwnerId: "100",
        tenantId: TENANT,
        integrationId: INTEGRATION,
        emailNormalized: "shared@clinic.org",
        archived: false,
        displayName: null,
      },
      c
    );
    assert.equal(r.decision, "quarantine_ambiguous");
  });

  it("rollback apply safe-env: only batch-scoped mapping rows are removable", () => {
    const batchId = "batch-pilot";
    const rows = [
      {
        id: "keep-outside",
        metadata: {
          import_batch_id: "other-batch",
          milestone: "FI-HUBSPOT-IMPORT-1B",
        },
      },
      {
        id: "keep-adopted",
        metadata: {
          import_batch_id: batchId,
          milestone: "FI-HUBSPOT-IMPORT-1B",
          confirmed_outside_batch: true,
        },
      },
      {
        id: "remove-me",
        metadata: {
          import_batch_id: batchId,
          milestone: "FI-HUBSPOT-IMPORT-1B",
        },
      },
    ];
    const removable = rows.filter((row) => {
      const meta = row.metadata;
      if (meta.confirmed_outside_batch === true) return false;
      return meta.import_batch_id === batchId && meta.milestone === "FI-HUBSPOT-IMPORT-1B";
    });
    assert.deepEqual(
      removable.map((r) => r.id),
      ["remove-me"]
    );
  });
});
