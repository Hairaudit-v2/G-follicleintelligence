/**
 * Deterministic operational summary — used when LLM is off, fails, or is blocked.
 */

import type {
  PatientAiSummaryFacts,
  PatientAiSummaryLlmPayload,
  PatientAiSummaryOperationalFlag,
  PatientAiSummaryQuickLink,
  PatientAiSummaryResult,
} from "./patientAiSummaryTypes";
import {
  PATIENT_AI_SUMMARY_DISCLAIMER,
  PATIENT_AI_SUMMARY_WARM_INTRO,
} from "./patientAiSummaryTypes";

export function buildDeterministicSummaryPayload(
  facts: PatientAiSummaryFacts
): PatientAiSummaryLlmPayload {
  const name = facts.displayName?.trim() || "This patient";
  const overviewParts = [
    `${name} has an operational record in the clinic system` +
      (facts.recordCreatedOn ? ` since ${facts.recordCreatedOn}` : "") +
      (facts.patientStatus ? ` (status: ${facts.patientStatus})` : "") +
      ".",
    `Media on file: ${facts.imageCount} image(s)` +
      (facts.hasBaselinePhotos ? " including baseline-tagged photos." : "."),
    facts.upcomingAppointmentCount > 0
      ? `Upcoming appointments on the calendar: ${facts.upcomingAppointmentCount}` +
        (facts.nextAppointmentOn ? ` (next on ${facts.nextAppointmentOn}).` : ".")
      : "No upcoming appointments are currently listed.",
    facts.openCaseCount > 0
      ? `Open/linked cases: ${facts.openCaseCount}.`
      : "No open cases are currently listed.",
  ];

  const operationalFlags: PatientAiSummaryOperationalFlag[] = [];
  if (facts.imageCount === 0) {
    operationalFlags.push({
      code: "missing_photos",
      label: "No photos on file yet — imaging folder is empty",
      severity: "attention",
      hrefSuffix: "imaging",
    });
  } else if (facts.missingPhotoCategories.length > 0) {
    operationalFlags.push({
      code: "incomplete_photo_set",
      label: `Photo set may be incomplete (${facts.missingPhotoCategories.slice(0, 4).join(", ")})`,
      severity: "attention",
      hrefSuffix: "imaging",
    });
  }
  if (facts.upcomingAppointmentCount === 0 && facts.pastAppointmentCount > 0) {
    operationalFlags.push({
      code: "no_upcoming_appointment",
      label: "Past visits exist but no upcoming appointment is booked",
      severity: "info",
      hrefSuffix: "calendar",
    });
  }
  if (facts.openLeadCount > 0) {
    operationalFlags.push({
      code: "open_leads",
      label: `${facts.openLeadCount} linked open enquiry/lead record(s)`,
      severity: "info",
      hrefSuffix: "crm",
    });
  }
  if (facts.scalesRecordedFlags.length === 0) {
    operationalFlags.push({
      code: "scales_not_flagged",
      label: "No scale-field completion flags in the facts pack (forms may still exist)",
      severity: "info",
      hrefSuffix: "consultations",
    });
  }

  const suggestedNextSteps: string[] = [];
  if (facts.imageCount === 0) {
    suggestedNextSteps.push("Open the imaging folder and attach photos when media is ready.");
  }
  if (facts.upcomingAppointmentCount === 0) {
    suggestedNextSteps.push("Check Calendar if a follow-up visit should be booked operationally.");
  }
  suggestedNextSteps.push("Review the patient timeline for recent operational activity.");
  suggestedNextSteps.push("Open consultation forms if scale fields still need completing for this visit.");

  const timelineHighlights =
    facts.timelineItems.length > 0
      ? [...facts.timelineItems].slice(0, 6)
      : ([
          {
            occurredOn: facts.recordCreatedOn ?? "unknown",
            kind: "record",
            label: "Patient record created in the system",
          },
        ] as const);

  return {
    overview: overviewParts.join(" "),
    timelineHighlights: [...timelineHighlights],
    operationalFlags,
    suggestedNextSteps: suggestedNextSteps.slice(0, 5),
  };
}

export function buildQuickLinks(
  tenantId: string,
  patientId: string
): PatientAiSummaryQuickLink[] {
  const base = `/fi-admin/${tenantId.trim()}/patients/${patientId.trim()}`;
  return [
    { code: "profile", label: "Patient profile", href: base },
    { code: "imaging", label: "Imaging folder", href: `${base}/imaging` },
    { code: "timeline", label: "Timeline", href: `${base}/timeline` },
    {
      code: "calendar",
      label: "Calendar",
      href: `/fi-admin/${tenantId.trim()}/calendar`,
    },
    {
      code: "consultations",
      label: "Consultations",
      href: `/fi-admin/${tenantId.trim()}/consultations`,
    },
  ];
}

export function finalizeDeterministicResult(opts: {
  facts: PatientAiSummaryFacts;
  source: PatientAiSummaryResult["source"];
  model?: string | null;
  requiresHumanReview?: boolean;
  safetyNotes?: readonly string[];
  cacheHit?: boolean;
  expiresAtIso?: string | null;
  generatedAtIso?: string;
  payload?: PatientAiSummaryLlmPayload;
}): PatientAiSummaryResult {
  const payload = opts.payload ?? buildDeterministicSummaryPayload(opts.facts);
  return {
    tenantId: opts.facts.tenantId,
    patientId: opts.facts.patientId,
    generatedAtIso: opts.generatedAtIso ?? new Date().toISOString(),
    source: opts.source,
    model: opts.model ?? null,
    intro: PATIENT_AI_SUMMARY_WARM_INTRO,
    overview: payload.overview,
    timelineHighlights: payload.timelineHighlights,
    operationalFlags: payload.operationalFlags,
    suggestedNextSteps: payload.suggestedNextSteps,
    quickLinks: buildQuickLinks(opts.facts.tenantId, opts.facts.patientId),
    disclaimer: PATIENT_AI_SUMMARY_DISCLAIMER,
    requiresHumanReview: Boolean(opts.requiresHumanReview),
    safetyNotes: opts.safetyNotes ?? [],
    cacheHit: Boolean(opts.cacheHit),
    expiresAtIso: opts.expiresAtIso ?? null,
  };
}
