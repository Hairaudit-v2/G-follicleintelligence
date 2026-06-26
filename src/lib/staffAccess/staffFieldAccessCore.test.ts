import assert from "node:assert/strict";
import test from "node:test";

import {
  canApproveField,
  canEditField,
  canExportField,
  canViewField,
  computeEffectiveFieldAccess,
  fieldPermissionRank,
  fieldPermissionSatisfies,
  getEffectiveFieldPermission,
  getFieldMaskingStrategy,
  getFieldPermission,
  mergeRoleFieldTemplatesWithGrants,
  normalizeFieldPermissionLevel,
  redactObjectByFieldAccess,
  redactValueByFieldPermission,
  shouldMaskField,
  type StaffFieldGrantInput,
} from "@/src/lib/staffAccess/staffFieldAccessCore";
import {
  STAFF_ACCESS_FIELDS_BY_KEY,
  STAFF_FIELD_PERMISSION_LEVELS,
  STAFF_ROLE_FIELD_TEMPLATE_DEFAULTS,
  type RoleFieldTemplateMap,
} from "@/src/lib/staffAccess/staffFieldAccessRegistry";
import type { StaffAccessLevel, StaffAccessModuleKey } from "@/src/lib/staffAccess/staffAccessRegistry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function grant(
  partial: Partial<StaffFieldGrantInput> & { fieldKey: string }
): StaffFieldGrantInput {
  const def = STAFF_ACCESS_FIELDS_BY_KEY[partial.fieldKey];
  return {
    moduleKey: def?.moduleKey ?? "patient_os",
    permissionLevel: "read",
    scope: "tenant",
    revokedAt: null,
    ...partial,
  };
}

/** Module levels for a role, derived from SA-1 style defaults used in these tests. */
const ROLE_MODULE_LEVELS: Record<string, Partial<Record<StaffAccessModuleKey, StaffAccessLevel>>> = {
  doctor: {
    clinic_os: "read",
    patient_os: "edit",
    consultation_os: "edit",
    surgery_os: "approve",
    imaging_os: "edit",
  },
  reception: {
    clinic_os: "edit",
    lead_flow: "edit",
    patient_os: "edit",
    consultation_os: "read",
    financial_os: "read",
  },
  investor: {
    analytics_os: "read",
    financial_os: "read",
    investor_dashboard: "read",
    // patient_os intentionally absent → none.
  },
  owner: {
    patient_os: "admin",
    consultation_os: "admin",
    surgery_os: "admin",
    financial_os: "admin",
    analytics_os: "admin",
    investor_dashboard: "admin",
    workforce_os: "admin",
    settings: "admin",
  },
};

function fieldAccessForRole(
  role: keyof typeof ROLE_MODULE_LEVELS,
  opts?: { grants?: StaffFieldGrantInput[]; isAdminOverride?: boolean }
) {
  return computeEffectiveFieldAccess({
    moduleLevels: ROLE_MODULE_LEVELS[role],
    roleTemplate: STAFF_ROLE_FIELD_TEMPLATE_DEFAULTS[role] as RoleFieldTemplateMap,
    grants: opts?.grants ?? [],
    isAdminOverride: opts?.isAdminOverride,
  });
}

function levelOf(access: ReturnType<typeof computeEffectiveFieldAccess>, fieldKey: string) {
  return getFieldPermission(access, fieldKey).level;
}

// ---------------------------------------------------------------------------
// Hierarchy / primitives
// ---------------------------------------------------------------------------

test("field permission hierarchy: hidden < masked < summary < read < edit < approve < export", () => {
  assert.deepEqual(
    [...STAFF_FIELD_PERMISSION_LEVELS],
    ["hidden", "masked", "summary", "read", "edit", "approve", "export"]
  );
  for (let i = 1; i < STAFF_FIELD_PERMISSION_LEVELS.length; i++) {
    assert.ok(
      fieldPermissionRank(STAFF_FIELD_PERMISSION_LEVELS[i]) >
        fieldPermissionRank(STAFF_FIELD_PERMISSION_LEVELS[i - 1]),
      `${STAFF_FIELD_PERMISSION_LEVELS[i]} should outrank ${STAFF_FIELD_PERMISSION_LEVELS[i - 1]}`
    );
  }
  assert.equal(fieldPermissionSatisfies("edit", "read"), true);
  assert.equal(fieldPermissionSatisfies("read", "edit"), false);
  assert.equal(normalizeFieldPermissionLevel("bogus"), "hidden");
  assert.equal(normalizeFieldPermissionLevel("export"), "export");
});

test("predicates align with the hierarchy", () => {
  assert.equal(canViewField("read"), true);
  assert.equal(canViewField("summary"), false);
  assert.equal(canViewField("masked"), false);
  assert.equal(canEditField("edit"), true);
  assert.equal(canEditField("read"), false);
  assert.equal(canApproveField("approve"), true);
  assert.equal(canApproveField("edit"), false);
  assert.equal(canExportField("export"), true);
  assert.equal(canExportField("approve"), false);
  assert.equal(shouldMaskField("summary"), true);
  assert.equal(shouldMaskField("read"), false);
  assert.equal(getFieldMaskingStrategy("hidden"), "hidden");
  assert.equal(getFieldMaskingStrategy("masked"), "masked");
  assert.equal(getFieldMaskingStrategy("summary"), "summary_only");
  assert.equal(getFieldMaskingStrategy("edit"), "visible");
});

// ---------------------------------------------------------------------------
// Role defaults (Examples A, C, E)
// ---------------------------------------------------------------------------

test("doctor can read clinical patient fields but NOT the financial summary by default", () => {
  const access = fieldAccessForRole("doctor");
  // Clinical fields: visible/editable.
  assert.equal(canViewField(levelOf(access, "patient.medical_history")), true);
  assert.equal(canEditField(levelOf(access, "patient.medical_history")), true);
  assert.equal(canViewField(levelOf(access, "patient.medications")), true);
  assert.equal(canViewField(levelOf(access, "consultation.clinical_notes")), true);
  assert.equal(canViewField(levelOf(access, "surgery.graft_count")), true);
  // Financial summary hidden by default (financial sensitivity, no template entry).
  assert.equal(levelOf(access, "patient.financial_summary"), "hidden");
  assert.equal(canViewField(levelOf(access, "patient.financial_summary")), false);
});

test("receptionist can edit contact details but not medical history (SA-2B calibrated)", () => {
  const access = fieldAccessForRole("reception");
  const contact = getFieldPermission(access, "patient.contact_details");
  assert.equal(contact.level, "edit");
  assert.equal(canEditField(contact.level), true);
  assert.equal(contact.moduleLevel, "edit");
  assert.equal(contact.clamped, false);
  assert.equal(levelOf(access, "patient.medical_history"), "hidden");
  assert.equal(canViewField(levelOf(access, "patient.medical_history")), false);
  // financial.payment_status read (consultation_os module), financial.margin hidden (no financial_os).
  assert.equal(canViewField(levelOf(access, "financial.payment_status")), true);
  assert.equal(levelOf(access, "financial.margin"), "hidden");
});

test("investor can read investor summary but cannot see identifiable patient data", () => {
  const access = fieldAccessForRole("investor");
  assert.equal(canViewField(levelOf(access, "investor.financial_summary")), true);
  assert.equal(canViewField(levelOf(access, "investor.growth_metrics")), true);
  assert.equal(canViewField(levelOf(access, "investor.deidentified_outcomes")), true);
  // Identifiable patient data is blocked by module access (patient_os = none → hidden).
  assert.equal(levelOf(access, "patient.identity"), "hidden");
  assert.equal(levelOf(access, "patient.contact_details"), "hidden");
});

// ---------------------------------------------------------------------------
// Grants
// ---------------------------------------------------------------------------

test("explicit grant allows a doctor to read the financial summary", () => {
  const access = fieldAccessForRole("doctor", {
    grants: [grant({ fieldKey: "patient.financial_summary", permissionLevel: "read" })],
  });
  assert.equal(levelOf(access, "patient.financial_summary"), "read");
  assert.equal(canViewField(levelOf(access, "patient.financial_summary")), true);
  assert.equal(getFieldPermission(access, "patient.financial_summary").source, "grant");
});

test("revoked field grant is ignored", () => {
  const access = fieldAccessForRole("doctor", {
    grants: [
      grant({
        fieldKey: "patient.financial_summary",
        permissionLevel: "read",
        revokedAt: "2026-06-01T00:00:00Z",
      }),
    ],
  });
  assert.equal(levelOf(access, "patient.financial_summary"), "hidden");
});

test("field grant cannot exceed blocked module access (clamped to hidden)", () => {
  // Investor has NO patient_os access. Even an explicit export grant on a patient field is clamped.
  const access = fieldAccessForRole("investor", {
    grants: [grant({ fieldKey: "patient.medical_history", permissionLevel: "export" })],
  });
  const perm = getFieldPermission(access, "patient.medical_history");
  assert.equal(perm.level, "hidden");
  assert.equal(perm.requestedLevel, "export");
  assert.equal(perm.clamped, true);
});

test("field grant is clamped down to the module ceiling (read module → read field max)", () => {
  // Simulate a lower module ceiling than the role template / grant requests.
  const access = computeEffectiveFieldAccess({
    moduleLevels: { patient_os: "read" },
    roleTemplate: STAFF_ROLE_FIELD_TEMPLATE_DEFAULTS.reception as RoleFieldTemplateMap,
    grants: [grant({ fieldKey: "patient.contact_details", permissionLevel: "edit" })],
  });
  const perm = getFieldPermission(access, "patient.contact_details");
  assert.equal(perm.level, "read");
  assert.equal(perm.requestedLevel, "edit");
  assert.equal(perm.clamped, true);
});

test("mergeRoleFieldTemplatesWithGrants: active grant overrides template, revoked ignored", () => {
  const merged = mergeRoleFieldTemplatesWithGrants(
    { "patient.identity": "read" },
    [
      grant({ fieldKey: "patient.identity", permissionLevel: "edit" }),
      grant({ fieldKey: "patient.contact_details", permissionLevel: "read", revokedAt: "2026-01-01" }),
    ]
  );
  assert.equal(merged["patient.identity"].level, "edit");
  assert.equal(merged["patient.identity"].source, "grant");
  assert.equal(merged["patient.contact_details"], undefined);
});

// ---------------------------------------------------------------------------
// Export separation + admin override (Example D)
// ---------------------------------------------------------------------------

test("export requires an explicit export level (read/edit/approve are not enough)", () => {
  const field = STAFF_ACCESS_FIELDS_BY_KEY["surgery.graft_count"];
  // approve-level module + approve field → can approve but NOT export.
  const approve = getEffectiveFieldPermission({
    field,
    moduleLevel: "approve",
    merged: { level: "approve", scope: "tenant", source: "grant" },
  });
  assert.equal(canApproveField(approve.level), true);
  assert.equal(canExportField(approve.level), false);

  // export grant within an admin module → export allowed.
  const exported = getEffectiveFieldPermission({
    field,
    moduleLevel: "admin",
    merged: { level: "export", scope: "tenant", source: "grant" },
  });
  assert.equal(canExportField(exported.level), true);
});

test("admin override permits export across fields", () => {
  const access = fieldAccessForRole("reception", { isAdminOverride: true });
  // Even fields reception would never see become export under an admin override.
  assert.equal(levelOf(access, "patient.medical_history"), "export");
  assert.equal(canExportField(levelOf(access, "patient.financial_summary")), true);
  assert.equal(getFieldPermission(access, "patient.identity").source, "override");
});

test("owner (module-admin everywhere) gets export on approved fields", () => {
  const access = fieldAccessForRole("owner");
  assert.equal(canExportField(levelOf(access, "patient.identity")), true);
  assert.equal(canExportField(levelOf(access, "financial.revenue")), true);
});

// ---------------------------------------------------------------------------
// Redaction (Section 5)
// ---------------------------------------------------------------------------

test("redactValueByFieldPermission: hidden→null, masked→Restricted, summary→summary value, read→original", () => {
  assert.equal(redactValueByFieldPermission("secret", "hidden"), null);
  assert.equal(redactValueByFieldPermission("secret", "masked"), "Restricted");
  assert.equal(redactValueByFieldPermission("secret", "summary"), "Summary only");
  assert.equal(
    redactValueByFieldPermission("secret", "summary", { summary: "≈ 12 patients" }),
    "≈ 12 patients"
  );
  assert.equal(redactValueByFieldPermission("secret", "read"), "secret");
  assert.equal(redactValueByFieldPermission("secret", "export"), "secret");
});

test("masked field returns Restricted; summary field returns the summary value", () => {
  const source = { balance: 5000, conversion: 0.42 };
  const out = redactObjectByFieldAccess(
    source,
    { "patient.financial_summary": ["balance"], "analytics.conversion": ["conversion"] },
    (fk) => (fk === "patient.financial_summary" ? "masked" : "summary"),
    { summaries: { "analytics.conversion": "High" } }
  );
  assert.equal(out.balance, "Restricted");
  assert.equal(out.conversion, "High");
});

test("redaction does not mutate the original object", () => {
  const source = { first_name: "Jane", last_name: "Doe", email: "jane@example.com" };
  const snapshot = { ...source };
  const out = redactObjectByFieldAccess(
    source,
    {
      "patient.identity": ["first_name", "last_name"],
      "patient.contact_details": ["email"],
    },
    () => "hidden"
  );
  // Original untouched.
  assert.deepEqual(source, snapshot);
  // Clone redacted.
  assert.equal(out.first_name, null);
  assert.equal(out.last_name, null);
  assert.equal(out.email, null);
  assert.notEqual(out, source);
});

test("redaction leaves readable fields untouched and omits hidden when requested", () => {
  const source = { first_name: "Jane", note: "ok" };
  const out = redactObjectByFieldAccess(
    source,
    { "patient.identity": ["first_name"] },
    () => "read"
  );
  assert.equal(out.first_name, "Jane");

  const omitted = redactObjectByFieldAccess(
    { first_name: "Jane" },
    { "patient.identity": ["first_name"] },
    () => "hidden",
    { omitHidden: true }
  );
  assert.equal("first_name" in omitted, false);
});

// ---------------------------------------------------------------------------
// Example B: doctor who is also an investor
// ---------------------------------------------------------------------------

test("Example B: doctor + investor grants keep clinical access, add investor reads, hide identity in investor dashboard", () => {
  const access = computeEffectiveFieldAccess({
    moduleLevels: {
      ...ROLE_MODULE_LEVELS.doctor,
      analytics_os: "read",
      financial_os: "read",
      investor_dashboard: "read",
    },
    roleTemplate: {
      ...(STAFF_ROLE_FIELD_TEMPLATE_DEFAULTS.doctor as RoleFieldTemplateMap),
      "investor.financial_summary": "read",
      "investor.growth_metrics": "read",
    },
  });
  // Clinical access unchanged.
  assert.equal(canEditField(levelOf(access, "patient.medical_history")), true);
  // Investor reads available.
  assert.equal(canViewField(levelOf(access, "investor.financial_summary")), true);
  // Identity is still gated: investor.* fields never expose patient identity, and the patient
  // identity field has no read in the investor dashboard surface.
  assert.equal(levelOf(access, "patient.financial_summary"), "hidden");
});

// ---------------------------------------------------------------------------
// SA-2B: Reception operational access calibration regression matrix
// ---------------------------------------------------------------------------

test("SA-2B Test A: reception can edit patient contact details", () => {
  const access = fieldAccessForRole("reception");
  const perm = getFieldPermission(access, "patient.contact_details");
  assert.equal(perm.moduleLevel, "edit");
  assert.equal(perm.requestedLevel, "edit");
  assert.equal(perm.level, "edit");
  assert.equal(perm.clamped, false);
  assert.equal(canEditField(perm.level), true);
});

test("SA-2B Test B: reception cannot access medical history", () => {
  const access = fieldAccessForRole("reception");
  assert.equal(levelOf(access, "patient.medical_history"), "hidden");
  assert.equal(canViewField(levelOf(access, "patient.medical_history")), false);
});

test("SA-2B Test C: reception cannot access medications", () => {
  const access = fieldAccessForRole("reception");
  assert.equal(levelOf(access, "patient.medications"), "hidden");
  assert.equal(canViewField(levelOf(access, "patient.medications")), false);
});

test("SA-2B Test D: reception cannot access financial summary", () => {
  const access = fieldAccessForRole("reception");
  assert.equal(levelOf(access, "patient.financial_summary"), "hidden");
  assert.equal(canViewField(levelOf(access, "patient.financial_summary")), false);
});

test("SA-2B Test E: reception cannot access internal notes", () => {
  const access = fieldAccessForRole("reception");
  assert.equal(levelOf(access, "patient.internal_notes"), "hidden");
  assert.equal(canViewField(levelOf(access, "patient.internal_notes")), false);
});

test("SA-2B Test F: reception can read patient photos", () => {
  const access = fieldAccessForRole("reception");
  assert.equal(levelOf(access, "patient.photos"), "read");
  assert.equal(canViewField(levelOf(access, "patient.photos")), true);
  assert.equal(canEditField(levelOf(access, "patient.photos")), false);
});

test("SA-2B Test G: reception can read patient documents", () => {
  const access = fieldAccessForRole("reception");
  assert.equal(levelOf(access, "patient.documents"), "read");
  assert.equal(canViewField(levelOf(access, "patient.documents")), true);
});

test("SA-2B Test H: explicit financial_summary grant is clamped when module access is restricted", () => {
  // Baseline: financial summary stays hidden without any grant.
  const baseline = fieldAccessForRole("reception");
  assert.equal(levelOf(baseline, "patient.financial_summary"), "hidden");

  // Explicit edit grant cannot exceed a read module ceiling (field permission <= module permission).
  const clamped = computeEffectiveFieldAccess({
    moduleLevels: { patient_os: "read" },
    roleTemplate: STAFF_ROLE_FIELD_TEMPLATE_DEFAULTS.reception as RoleFieldTemplateMap,
    grants: [grant({ fieldKey: "patient.financial_summary", permissionLevel: "edit" })],
  });
  const perm = getFieldPermission(clamped, "patient.financial_summary");
  assert.equal(perm.requestedLevel, "edit");
  assert.equal(perm.level, "read");
  assert.equal(perm.clamped, true);
  assert.equal(canEditField(perm.level), false);
});
