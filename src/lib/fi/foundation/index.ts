/**
 * Follicle Intelligence Foundation Layer — server-side resolution helpers (Stage 1E),
 * event-ingest dual-write (Stage 1F), integrity dashboard (Stage 1G), universal patient record (Stage 1H),
 * universal case record (Stage 1I).
 * Use only with Supabase service role / admin client from trusted server code.
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
export {
  backfillFoundationFromProcessedEvents,
  reconstructFiEventEnvelopeForDualWrite,
  type BackfillFoundationBatchResult,
} from "./backfillFoundation";
export {
  loadUniversalCaseRecord,
  type CaseSourceIdentifierRow,
  type ClinicSummary,
  type LinkedPatientBlock,
  type LoadUniversalCaseRecordParams,
  type OrganisationSummary,
  type UniversalCaseRecordNotFound,
  type UniversalCaseRecordResult,
} from "./caseRecord";
export {
  loadUniversalPatientRecord,
  type CaseFoundationRow,
  type LoadUniversalPatientRecordParams,
  type PatientResolutionRow,
  type PersonSummary,
  type PatientSummary,
  type SourceIdentifierRow,
  type TimelineEventRow,
  type UnifiedMediaRow,
  type UniversalPatientRecordNotFound,
  type UniversalPatientRecordResult,
} from "./patientRecord";
