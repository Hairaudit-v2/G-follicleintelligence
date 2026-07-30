/**
 * Contract fixture mirroring HairAudit imagingOsProvider buildRequestBody.
 * Keep in sync with G:\hairaudit-v2\src\lib\preSurgeryIntelligence\projection\imagingOsProvider.ts
 */

export const HA_PROJECTION_REQUEST_SCHEMA_VERSION =
  "ha-imagingos-pre-surgery-projection-request-v1" as const;

export const HA_CANONICAL_SCHEMA_VERSION =
  "ha-pre-surgery-canonical-projection-request-v1" as const;

export function buildHairAuditProjectionFixture(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const caseId = "case-ha-001";
  const base = {
    schemaVersion: HA_PROJECTION_REQUEST_SCHEMA_VERSION,
    idempotencyKey: "idem-fixture-001",
    inputChecksum: "a".repeat(64),
    modelVersion: "imagingos-projection-v1",
    mode: "planned",
    caseId,
    sourceImageId: "img-001",
    sourceImageRef: "case-files/case-ha-001/img-001.jpg",
    approvedGraftPlanId: "plan-001",
    approvedGraftPlanVersion: 3,
    approvedGraftPlanChecksum: "b".repeat(64),
    approvedAnnotationIds: ["ann-1", "ann-2"],
    constraints: [
      "Do not change facial identity, reshape the face, or alter skin tone.",
      "Do not create hair outside approved recipient zones.",
    ],
    deterministicSeed: "seed-1",
    canonical: {
      schemaVersion: HA_CANONICAL_SCHEMA_VERSION,
      caseId,
      sourceImageIds: ["img-001"],
      primarySourceImageId: "img-001",
      imageRoles: [
        {
          imageId: "img-001",
          assignedRole: "front",
          orientationDegrees: 0,
          mirrored: false,
        },
      ],
      approvedObservationIds: ["obs-1"],
      approvedGraftPlanId: "plan-001",
      approvedGraftPlanVersion: 3,
      approvedGraftPlanChecksum: "b".repeat(64),
      projectionMode: "planned",
      geometry: {
        hairlineAnnotationIds: ["ann-1"],
        recipientZoneAnnotationIds: ["ann-2"],
        deferredZones: ["crown"],
        excludedZones: [],
        zoneGraftTargets: [{ zone: "frontal", grafts: 800, priority: "primary" }],
      },
      providerId: "imagingos-v1",
      modelVersion: "imagingos-projection-v1",
      safetyLabelVersion: "safety-v1",
      generationPolicyVersion: "policy-v1",
      engineVersion: "engine-v1",
      sourceImageRefs: [{ imageId: "img-001", storageRef: "case-files/case-ha-001/img-001.jpg" }],
      approvedAnnotationIds: ["ann-1", "ann-2"],
    },
  };
  return { ...base, ...overrides };
}
