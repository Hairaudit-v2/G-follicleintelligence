/**
 * Capability gates for surgery projection foundation (1B).
 * Patient sharing capability exists only as an explicit deny.
 */

export const SURGERY_PROJECTION_CAPABILITIES = {
  createEditHairline: "surgery_projection.hairline.create_edit",
  approveHairline: "surgery_projection.hairline.approve",
  requestGeneration: "surgery_projection.generation.request",
  inspectGeneratedImages: "surgery_projection.images.inspect",
  /** Intentionally unavailable in 1B. */
  enablePatientSharing: "surgery_projection.patient_sharing.enable",
} as const;

export type SurgeryProjectionCapability =
  (typeof SURGERY_PROJECTION_CAPABILITIES)[keyof typeof SURGERY_PROJECTION_CAPABILITIES];

const CLINICAL_APPROVER_ROLES = new Set([
  "admin",
  "fi_admin",
  "owner",
  "doctor",
  "tenant_backend",
]);

const EDITOR_ROLES = new Set([
  ...CLINICAL_APPROVER_ROLES,
  "nurse",
  "consultant",
]);

export type SurgeryProjectionActor = {
  role: string | null | undefined;
  userId: string | null | undefined;
};

export function actorHasSurgeryProjectionCapability(
  actor: SurgeryProjectionActor,
  capability: SurgeryProjectionCapability
): boolean {
  const role = (actor.role ?? "").trim().toLowerCase();
  if (capability === SURGERY_PROJECTION_CAPABILITIES.enablePatientSharing) {
    return false;
  }
  if (capability === SURGERY_PROJECTION_CAPABILITIES.approveHairline) {
    return CLINICAL_APPROVER_ROLES.has(role);
  }
  if (
    capability === SURGERY_PROJECTION_CAPABILITIES.createEditHairline ||
    capability === SURGERY_PROJECTION_CAPABILITIES.requestGeneration ||
    capability === SURGERY_PROJECTION_CAPABILITIES.inspectGeneratedImages
  ) {
    return EDITOR_ROLES.has(role);
  }
  return false;
}

export function assertSurgeryProjectionCapability(
  actor: SurgeryProjectionActor,
  capability: SurgeryProjectionCapability
): void {
  if (!actorHasSurgeryProjectionCapability(actor, capability)) {
    throw Object.assign(new Error("capability_denied"), {
      code: "capability_denied",
      capability,
    });
  }
}
