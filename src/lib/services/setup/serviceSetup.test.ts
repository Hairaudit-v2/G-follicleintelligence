import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyServiceFamilyTemplate,
  buildServiceSetupSyncPlan,
  emptyServiceSetupConfig,
  evaluateServiceSetupActivation,
  filterStaffForServiceAllocation,
  hydrateServiceSetupConfig,
  migrateLegacyServiceRoles,
  rankStaffForAllocationStrategy,
  selectAutomaticRoomAllocation,
  SERVICE_FAMILY_TEMPLATES,
  type ServiceAllocationStaffCandidate,
  type ServiceSetupConfig,
} from "@/src/lib/services/setup";

function staff(
  overrides: Partial<ServiceAllocationStaffCandidate> & Pick<ServiceAllocationStaffCandidate, "staffId" | "role">
): ServiceAllocationStaffCandidate {
  return {
    isActive: true,
    isBookable: true,
    clinicIds: ["clinic-a"],
    primaryClinicId: "clinic-a",
    hasClinicAffinity: false,
    clinicalTier: 3,
    certificationKeys: [],
    isRosteredAvailable: true,
    hasSchedulingConflict: false,
    underSupervision: false,
    isSurgeryLead: false,
    workloadScore: 2,
    continuityPatientMatch: false,
    ...overrides,
  };
}

describe("service family templates", () => {
  it("consultation template preselects consultant-first roles and required rooms", () => {
    const cfg = applyServiceFamilyTemplate("consultation");
    assert.equal(cfg.serviceFamily, "consultation");
    assert.deepEqual(cfg.eligibleRoles, SERVICE_FAMILY_TEMPLATES.consultation.eligibleRoles);
    assert.equal(cfg.staffAllocation.mode, "automatic");
    assert.equal(cfg.staffAllocation.strategy, "preferred_role_order");
    assert.equal(cfg.rooms.requirement, "required");
    assert.equal(cfg.rooms.automaticAllocation, true);
    assert.equal(cfg.surgicalTeam, null);
  });

  it("follow-up template prefers continuity of care", () => {
    const cfg = applyServiceFamilyTemplate("follow_up");
    assert.equal(cfg.staffAllocation.strategy, "continuity_of_care");
    assert.equal(cfg.rooms.requirement, "optional");
  });

  it("hair treatment template uses best availability and regenerative competency", () => {
    const cfg = applyServiceFamilyTemplate("hair_treatment");
    assert.equal(cfg.staffAllocation.strategy, "best_availability");
    assert.ok(cfg.competency.requiredCertificationKeys.includes("regenerative_treatment"));
    assert.deepEqual(cfg.eligibleRoles, ["nurse", "doctor", "technician"]);
  });

  it("surgery template includes surgical team slots and surgery lead requirement", () => {
    const cfg = applyServiceFamilyTemplate("surgery");
    assert.ok(cfg.surgicalTeam);
    assert.equal(cfg.competency.surgeryLeadRequired, true);
    assert.equal(cfg.competency.supervisionAllowed, false);
    const doctor = cfg.surgicalTeam!.find((s) => s.slot === "doctor");
    assert.equal(doctor?.required, true);
    assert.equal(doctor?.automaticallyAllocate, true);
  });
});

describe("role priority ranking", () => {
  it("orders eligible staff by preferred role order", () => {
    const config = applyServiceFamilyTemplate("consultation");
    config.staffAllocation.strategy = "preferred_role_order";
    config.staffAllocation.preferredRoleOrder = ["consultant", "doctor", "surgeon"];
    const ranked = rankStaffForAllocationStrategy(
      [
        staff({ staffId: "s1", role: "surgeon", workloadScore: 0 }),
        staff({ staffId: "s2", role: "consultant", workloadScore: 5 }),
        staff({ staffId: "s3", role: "doctor", workloadScore: 1 }),
      ],
      config
    );
    assert.deepEqual(ranked, ["s2", "s3", "s1"]);
  });
});

describe("competency filtering", () => {
  it("excludes staff below minimum clinical tier or missing certification", () => {
    const config = applyServiceFamilyTemplate("hair_treatment");
    config.eligibleRoles = ["nurse", "doctor"];
    const result = filterStaffForServiceAllocation(
      [
        staff({
          staffId: "ok",
          role: "nurse",
          clinicalTier: 3,
          certificationKeys: ["regenerative_treatment"],
        }),
        staff({
          staffId: "low-tier",
          role: "nurse",
          clinicalTier: 1,
          certificationKeys: ["regenerative_treatment"],
        }),
        staff({
          staffId: "no-cert",
          role: "nurse",
          clinicalTier: 3,
          certificationKeys: [],
        }),
      ],
      { clinicId: "clinic-a", config }
    );
    assert.deepEqual(
      result.eligible.map((e) => e.staffId),
      ["ok"]
    );
    assert.ok(
      result.rejected.find((r) => r.staffId === "low-tier")?.reasons.includes("competency_tier")
    );
    assert.ok(
      result.rejected
        .find((r) => r.staffId === "no-cert")
        ?.reasons.includes("certification_missing")
    );
  });

  it("blocks surgery allocation when surgery lead is required", () => {
    const config = applyServiceFamilyTemplate("surgery");
    const result = filterStaffForServiceAllocation(
      [
        staff({
          staffId: "surgeon",
          role: "surgeon",
          clinicalTier: 5,
          certificationKeys: ["surgery_privilege"],
          isSurgeryLead: true,
        }),
        staff({
          staffId: "assistant-surgeon",
          role: "surgeon",
          clinicalTier: 5,
          certificationKeys: ["surgery_privilege"],
          isSurgeryLead: false,
        }),
      ],
      { clinicId: "clinic-a", config }
    );
    assert.deepEqual(
      result.eligible.map((e) => e.staffId),
      ["surgeon"]
    );
  });
});

describe("sole-clinic and clinic affinity staff", () => {
  it("includes sole-clinic staff for the selected clinic", () => {
    const config = applyServiceFamilyTemplate("consultation");
    const result = filterStaffForServiceAllocation(
      [
        staff({
          staffId: "sole",
          role: "consultant",
          clinicIds: ["clinic-a"],
          primaryClinicId: null,
          hasClinicAffinity: false,
        }),
        staff({
          staffId: "other",
          role: "consultant",
          clinicIds: ["clinic-b"],
          primaryClinicId: "clinic-b",
          hasClinicAffinity: false,
        }),
        staff({
          staffId: "affinity",
          role: "consultant",
          clinicIds: [],
          primaryClinicId: null,
          hasClinicAffinity: true,
        }),
      ],
      { clinicId: "clinic-a", config }
    );
    assert.deepEqual(
      result.eligible.map((e) => e.staffId).sort(),
      ["affinity", "sole"]
    );
  });

  it("excludes inactive, unbookable, unrostered, or conflicted staff", () => {
    const config = applyServiceFamilyTemplate("consultation");
    const result = filterStaffForServiceAllocation(
      [
        staff({ staffId: "inactive", role: "consultant", isActive: false }),
        staff({ staffId: "unbookable", role: "consultant", isBookable: false }),
        staff({ staffId: "unrostered", role: "consultant", isRosteredAvailable: false }),
        staff({ staffId: "conflict", role: "consultant", hasSchedulingConflict: true }),
        staff({ staffId: "ok", role: "consultant" }),
      ],
      { clinicId: "clinic-a", config }
    );
    assert.deepEqual(
      result.eligible.map((e) => e.staffId),
      ["ok"]
    );
  });
});

describe("automatic room allocation", () => {
  it("prefers preferred room, then fallbacks, then first eligible", () => {
    const config: ServiceSetupConfig = {
      ...emptyServiceSetupConfig(),
      rooms: {
        requirement: "required",
        automaticAllocation: true,
        preferredRoomId: "room-preferred",
        fallbackRoomIds: ["room-fallback"],
        eligibleRoomIds: ["room-fallback", "room-preferred", "room-other"],
        resourceRequirementKeys: [],
      },
    };
    assert.equal(selectAutomaticRoomAllocation(config), "room-preferred");

    config.rooms.preferredRoomId = null;
    assert.equal(selectAutomaticRoomAllocation(config), "room-fallback");

    config.rooms.fallbackRoomIds = [];
    config.rooms.eligibleRoomIds = ["room-other", "room-fallback"];
    assert.equal(selectAutomaticRoomAllocation(config), "room-other");
  });

  it("returns null when rooms are not required", () => {
    const config = applyServiceFamilyTemplate("administrative");
    assert.equal(selectAutomaticRoomAllocation(config), null);
  });
});

describe("missing-resource activation warnings", () => {
  it("blocks activation when required role or room is missing", () => {
    const config = applyServiceFamilyTemplate("consultation");
    config.rooms.eligibleRoomIds = ["room-1"];
    const result = evaluateServiceSetupActivation(config, {
      staffCountByRole: { nurse: 2 },
      availableRoomIds: [],
    });
    assert.equal(result.canActivate, false);
    assert.ok(result.warnings.some((w) => w.code === "missing_eligible_role_staff"));
    assert.ok(result.warnings.some((w) => w.code === "missing_required_room"));
  });

  it("allows activation when at least one eligible role and room are covered", () => {
    const config = applyServiceFamilyTemplate("consultation");
    config.rooms.eligibleRoomIds = ["room-1"];
    const result = evaluateServiceSetupActivation(config, {
      staffCountByRole: {
        consultant: 1,
      },
      availableRoomIds: ["room-1"],
    });
    assert.equal(result.canActivate, true);
  });

  it("surfaces legacy roles as non-blocking warnings", () => {
    const config = applyServiceFamilyTemplate("custom");
    config.legacyRolesForReview = ["hair_guru"];
    config.staffAllocation.mode = "assign_later";
    config.rooms.requirement = "not_required";
    const result = evaluateServiceSetupActivation(config, {
      staffCountByRole: {},
      availableRoomIds: [],
    });
    assert.equal(result.canActivate, true);
    assert.ok(result.warnings.some((w) => w.code === "legacy_roles_pending_review"));
  });
});

describe("legacy role migration", () => {
  it("maps known aliases and preserves unknown values for review", () => {
    const migrated = migrateLegacyServiceRoles(
      "consultant, Doctor, hair_guru, RN, clinical assistant"
    );
    assert.deepEqual(migrated.canonicalRoles, [
      "consultant",
      "doctor",
      "nurse",
      "clinical_assistant",
    ]);
    assert.deepEqual(migrated.unknownLegacyRoles, ["hair_guru"]);
  });

  it("hydrates empty setup_config from legacy eligibility without dropping unknowns", () => {
    const hydrated = hydrateServiceSetupConfig({
      setupConfigRaw: {},
      bookingType: "consultation",
      serviceName: "Hair Consult",
      legacyStaffRoles: ["consultant", "mystery_role"],
      eligibleRoomIds: ["r1"],
      preferredRoomId: "r1",
    });
    assert.equal(hydrated.serviceFamily, "consultation");
    assert.ok(hydrated.eligibleRoles.includes("consultant"));
    assert.deepEqual(hydrated.legacyRolesForReview, ["mystery_role"]);
    assert.deepEqual(hydrated.rooms.eligibleRoomIds, ["r1"]);
  });
});

describe("setup sync plan", () => {
  it("emits surgical resource requirements from surgery template", () => {
    const plan = buildServiceSetupSyncPlan(applyServiceFamilyTemplate("surgery"));
    assert.ok(plan.staffRows.some((r) => r.staffRole === "surgeon"));
    assert.ok(plan.resourceRows.some((r) => r.metadata.surgical_slot === "doctor"));
    assert.ok(plan.resourceRows.some((r) => r.metadata.surgical_slot === "nurse"));
  });
});
