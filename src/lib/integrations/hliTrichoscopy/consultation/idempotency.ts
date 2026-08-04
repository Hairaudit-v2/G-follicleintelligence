/**
 * FI-TRICHOSCOPY-1B — consultation request idempotency and outbound payload sanitisation.
 */

import type { TrichoscopyIndicationInput, TrichoscopyRequestMode } from "./types";

const FREE_TEXT_MAX = 2000;
const NOTE_MAX = 500;

export function sanitiseFreeText(
  value: string | null | undefined,
  maxLen = FREE_TEXT_MAX
): string | null {
  if (value == null) return null;
  const cleaned = String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLen);
}

export function buildConsultationTrichoscopyIdempotencyKey(opts: {
  tenantId: string;
  patientId: string;
  consultationId: string;
  requestIntent: TrichoscopyRequestMode | string;
  clientRequestId: string;
}): string {
  return [
    opts.tenantId.trim(),
    opts.patientId.trim(),
    opts.consultationId.trim(),
    String(opts.requestIntent).trim() || "new_assessment",
    opts.clientRequestId.trim(),
  ].join(":");
}

export type FiOsToHliConsultationContextPayload = {
  tenantReference: string;
  patientIntegrationReference: string;
  consultationReference: string;
  requestingClinicianReference: string;
  consultationDate?: string | null;
  assessmentPurpose: string;
  indicationCodes: string[];
  anatomicalRegions: string[];
  symptoms?: string | null;
  onsetProgression?: string | null;
  relevantMedicalHistory?: string | null;
  existingHairLossDiagnosis?: string | null;
  currentTreatments?: string | null;
  currentMedications?: string | null;
  relevantPathologySummary?: string | null;
  clinicianQuestion?: string | null;
  consentState: {
    capture: boolean;
    transfer: boolean;
  };
  urgency: string;
  callbackCorrelationId: string;
  requestMode: TrichoscopyRequestMode;
  baselineAssessmentReference?: string | null;
};

export function buildFiOsToHliConsultationContext(input: {
  tenantId: string;
  patientId: string;
  consultationId: string;
  requestingClinicianUserId: string;
  consultationDate?: string | null;
  purpose?: string;
  indication: TrichoscopyIndicationInput;
  clientRequestId: string;
  requestMode: TrichoscopyRequestMode;
  baselineAssessmentReference?: string | null;
}): FiOsToHliConsultationContextPayload {
  const ind = input.indication;
  return {
    tenantReference: input.tenantId.trim(),
    patientIntegrationReference: input.patientId.trim(),
    consultationReference: input.consultationId.trim(),
    requestingClinicianReference: input.requestingClinicianUserId.trim(),
    consultationDate: input.consultationDate ?? null,
    assessmentPurpose: input.purpose ?? "consultation",
    indicationCodes: (ind.indicationCodes ?? []).map(String),
    anatomicalRegions: (ind.anatomicalRegions ?? []).map(String).slice(0, 32),
    symptoms: sanitiseFreeText(ind.symptoms, NOTE_MAX),
    onsetProgression: sanitiseFreeText(ind.onsetProgression, NOTE_MAX),
    relevantMedicalHistory: sanitiseFreeText(ind.knownDiagnoses, NOTE_MAX),
    existingHairLossDiagnosis: sanitiseFreeText(ind.knownDiagnoses, NOTE_MAX),
    currentTreatments: sanitiseFreeText(ind.currentTreatments, NOTE_MAX),
    currentMedications: sanitiseFreeText(ind.relevantMedications, NOTE_MAX),
    relevantPathologySummary: sanitiseFreeText(ind.availableBloodResultsSummary, NOTE_MAX),
    clinicianQuestion: sanitiseFreeText(ind.clinicianQuestion ?? ind.clinicianNote, FREE_TEXT_MAX),
    consentState: {
      capture: Boolean(ind.patientConsentCapture),
      transfer: Boolean(ind.patientConsentTransfer),
    },
    urgency: ind.urgency ?? "routine",
    callbackCorrelationId: buildConsultationTrichoscopyIdempotencyKey({
      tenantId: input.tenantId,
      patientId: input.patientId,
      consultationId: input.consultationId,
      requestIntent: input.requestMode,
      clientRequestId: input.clientRequestId,
    }),
    requestMode: input.requestMode,
    baselineAssessmentReference: input.baselineAssessmentReference ?? null,
  };
}
