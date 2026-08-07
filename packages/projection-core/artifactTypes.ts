/**
 * Shared artifact-type rules for FiOS / HairAudit / PatientOS.
 * Extracted from HairAudit artifactTypes patterns — do not couple to HA tables.
 */

export const PROJECTION_ARTIFACT_TYPES = [
  "graft_allocation_map",
  "proposed_hairline_design",
  "illustrative_projected_outcome",
] as const;

export type ProjectionArtifactType = (typeof PROJECTION_ARTIFACT_TYPES)[number];

export const PROJECTION_ARTIFACT_TYPE_LABELS: Record<ProjectionArtifactType, string> = {
  graft_allocation_map: "Graft Allocation Map",
  proposed_hairline_design: "Proposed Hairline Design",
  illustrative_projected_outcome: "Illustrative Projected Outcome",
};

export const ILLUSTRATIVE_PROJECTED_OUTCOME_DISCLAIMER =
  "This image is an illustrative projection based on the proposed surgical plan and selected assumptions. It is not a guarantee of density, growth, coverage or final appearance. Actual outcomes vary with healing, graft survival, hair characteristics, progression of native hair loss and adherence to aftercare." as const;

export const PROJECTED_OUTCOME_PROVIDER_UNAVAILABLE_MESSAGE =
  "Projected-outcome generation is unavailable because the imaging provider is not configured." as const;

export const FORBIDDEN_ALLOCATION_MAP_LABELS = [
  /projected result/i,
  /projected outcome/i,
  /hair-growth simulation/i,
  /hair growth simulation/i,
] as const;

/** Providers that may only emit overlay / planning artifacts — never photoreal outcomes. */
export const OVERLAY_ONLY_PROVIDER_PREFIXES = [
  "local-illustrative",
  "stub",
  "disabled",
  "allocation-map",
  "hairline-overlay",
] as const;

/** Providers that may emit illustrative_projected_outcome (when operational). */
export const PHOTOREAL_PROVIDER_PREFIXES = ["openai", "imagingos", "openai-gpt-image"] as const;

export function isProjectionArtifactType(value: unknown): value is ProjectionArtifactType {
  return (
    typeof value === "string" &&
    (PROJECTION_ARTIFACT_TYPES as readonly string[]).includes(value)
  );
}

export function isOverlayRendererArtifact(artifactType: ProjectionArtifactType): boolean {
  return (
    artifactType === "graft_allocation_map" || artifactType === "proposed_hairline_design"
  );
}

export function isIllustrativeProjectedOutcome(
  artifactType: ProjectionArtifactType
): boolean {
  return artifactType === "illustrative_projected_outcome";
}

export function providerLooksLikeOverlayOnly(providerId: string | null | undefined): boolean {
  const p = (providerId ?? "").toLowerCase();
  return OVERLAY_ONLY_PROVIDER_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix));
}

export function providerLooksLikePhotoreal(providerId: string | null | undefined): boolean {
  const p = (providerId ?? "").toLowerCase();
  return PHOTOREAL_PROVIDER_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix));
}

/**
 * Resolve artifact type. Overlay / unknown providers NEVER become illustrative outcomes.
 */
export function resolveProjectionArtifactType(input: {
  artifactType?: string | null;
  providerId?: string | null;
}): ProjectionArtifactType {
  if (isProjectionArtifactType(input.artifactType)) {
    if (
      input.artifactType === "illustrative_projected_outcome" &&
      providerLooksLikeOverlayOnly(input.providerId)
    ) {
      return "graft_allocation_map";
    }
    return input.artifactType;
  }
  if (providerLooksLikePhotoreal(input.providerId)) {
    return "illustrative_projected_outcome";
  }
  if (providerLooksLikeOverlayOnly(input.providerId)) {
    return "graft_allocation_map";
  }
  return "graft_allocation_map";
}

/**
 * Hard gate: overlay / stub renderers must not mint illustrative_projected_outcome.
 */
export function assertProviderMayEmitArtifact(input: {
  providerId: string;
  artifactType: ProjectionArtifactType;
}): void {
  if (
    input.artifactType === "illustrative_projected_outcome" &&
    providerLooksLikeOverlayOnly(input.providerId)
  ) {
    throw new Error(
      `Provider "${input.providerId}" is an overlay/stub renderer and cannot create illustrative_projected_outcome`
    );
  }
}

export function assertAllocationMapLabelSafe(label: string): void {
  for (const pattern of FORBIDDEN_ALLOCATION_MAP_LABELS) {
    if (pattern.test(label)) {
      throw new Error(`Allocation map label must not include: ${pattern.source}`);
    }
  }
}

export function labelForArtifactType(artifactType: ProjectionArtifactType): string {
  return PROJECTION_ARTIFACT_TYPE_LABELS[artifactType];
}
