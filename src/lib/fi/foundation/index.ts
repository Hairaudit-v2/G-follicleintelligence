/**
 * Follicle Intelligence Foundation Layer — server-side resolution helpers (Stage 1E) and
 * event-ingest dual-write (Stage 1F). Use only with Supabase service role / admin client from trusted server code.
 */

export { normalizeEmail, normalizeWhitespaceName, isPlaceholderEmail } from "./normalize";
export type {
  CreateMediaAssetInput,
  CreateMediaAssetResult,
  CreateTimelineEventInput,
  CreateTimelineEventResult,
  FiCaseRowMinimal,
  FiClinicRow,
  FiOrganisationRow,
  FiPatientRow,
  FiPersonRow,
  FoundationSupabase,
  OrganisationType,
  ResolveCaseFoundationInput,
  ResolveCaseFoundationResult,
  ResolveClinicInput,
  ResolveClinicResult,
  ResolveOrganisationInput,
  ResolveOrganisationResult,
  ResolvePatientInput,
  ResolvePatientResult,
  ResolvePersonInput,
  ResolvePersonResult,
} from "./types";
export { resolveOrCreateOrganisation } from "./resolveOrganisation";
export { resolveOrCreateClinic } from "./resolveClinic";
export { resolveOrCreatePerson } from "./resolvePerson";
export { resolveOrCreatePatient } from "./resolvePatient";
export { resolveOrCreateCaseFoundation } from "./resolveCaseFoundation";
export { createTimelineEvent } from "./createTimelineEvent";
export { createMediaAsset } from "./createMediaAsset";
export {
  dualWriteFoundationFromFiEvent,
  type DualWriteFoundationFromFiEventParams,
  type DualWriteFoundationFromFiEventResult,
  type DualWriteFoundationResolution,
} from "./dualWriteEvent";
export {
  getFoundationCaseTypeForEvent,
  getFoundationTimelineSpec,
  getHairAuditImagesTimelineSpec,
  mapHairAuditImageToAssetType,
  mapHliDocumentKindToMediaAssetType,
  type FoundationCaseType,
  type FoundationTimelineSpec,
} from "./eventMapping";
