/**
 * FI-TRICHOSCOPY-1B — consultation integration service (server).
 * FiOS remains canonical; HLI provides versioned specialist evidence.
 */

import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireTenantModuleCapability } from "@/src/lib/entitlements/requireTenantModuleCapability";
import type { TrichoscopyCapability } from "@/src/lib/platform/entitlements/trichoscopyCapabilities";
import { requestTrichoscopy } from "../commands";
import { listEvidencePacksForLink, getTrichoscopyLinkById } from "../queries";
import { normaliseTrichoscopyFindingsFromPack } from "./findings";
import {
  assertDecisionLinkAllowed,
  assertFindingReviewAllowed,
  canTransitionAcknowledgement,
  isAcceptanceAcknowledgement,
} from "./acknowledgement";
import {
  buildConsultationTrichoscopyIdempotencyKey,
  buildFiOsToHliConsultationContext,
  sanitiseFreeText,
} from "./idempotency";
import {
  assertConsentForTrichoscopyRequest,
  assertConsultationMutationAllowed,
  resolvePackSupersessionDisposition,
  resolvePinnedPackVersion,
} from "./packPinning";
import {
  buildPatientSafeTrichoscopySummary,
  formatPatientSafeTrichoscopySummaryText,
} from "./patientSafeSummary";
import {
  getConsultationIndication,
  getConsultationTrichoscopyLink,
  getTenantConsultationRules,
  listConsultationFindingReviews,
  listConsultationFindings,
  writeConsultationTrichoscopyAudit,
  type ConsultationTrichoscopyLinkRow,
} from "./queries.server";
import {
  HLI_OUTAGE_USER_MESSAGE,
  isTrichoscopyIndicationCode,
  resolveConsultationTrichoscopyReadiness,
  resolveConsultationTrichoscopyStatus,
} from "./status";
import type {
  ConsultationTrichoscopyCardSummary,
  TrichoscopyAcknowledgementState,
  TrichoscopyDecisionKind,
  TrichoscopyIndicationCode,
  TrichoscopyIndicationInput,
  TrichoscopyInvestigationCategory,
  TrichoscopyRequestMode,
} from "./types";
import type { FiosTrichoscopyStatus, HliEntitlementContext } from "../types";
import {
  HliTrichoscopyUnavailableError,
  HliTrichoscopyValidationError,
} from "../errors";

async function requireCap(opts: {
  tenantId: string;
  userId: string;
  capability: TrichoscopyCapability;
  patientId?: string | null;
  supabaseClientForTests?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
}) {
  const access = await requireTenantModuleCapability({
    tenantId: opts.tenantId,
    userId: opts.userId,
    capability: opts.capability,
    patientId: opts.patientId,
    concealModule: true,
    supabaseClientForTests: opts.supabaseClientForTests,
    env: opts.env,
  });
  if (!access.ok) {
    throw new HliTrichoscopyUnavailableError(access.access.denialReason ?? "not_entitled");
  }
  return access;
}

async function loadConsultationPatient(opts: {
  tenantId: string;
  consultationId: string;
  supabase: SupabaseClient;
}): Promise<{ patientId: string; consultationDate: string | null; status: string }> {
  const { data, error } = await opts.supabase
    .from("fi_consultations")
    .select("id, patient_id, consultation_date, status, tenant_id")
    .eq("tenant_id", opts.tenantId.trim())
    .eq("id", opts.consultationId.trim())
    .maybeSingle();

  if (error || !data) {
    throw new HliTrichoscopyValidationError("Consultation not found for this tenant.");
  }
  const patientId = String((data as { patient_id?: string | null }).patient_id ?? "").trim();
  if (!patientId) {
    throw new HliTrichoscopyValidationError("Link a patient before requesting trichoscopy.");
  }
  return {
    patientId,
    consultationDate: (data as { consultation_date?: string | null }).consultation_date ?? null,
    status: String((data as { status?: string }).status ?? ""),
  };
}

function mapRules(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    enabled: row.enabled !== false,
    requireBeforeTreatmentCodes: Array.isArray(row.require_before_treatment_codes)
      ? (row.require_before_treatment_codes as string[])
      : [],
    blockOnScarringEscalation: row.block_on_scarring_escalation !== false,
    blockOnUrgentMedicalUnresolved: row.block_on_urgent_medical_unresolved !== false,
    blockBeforeSurgicalSuitability: Boolean(row.block_before_surgical_suitability),
    allowCompleteWhenPending: row.allow_complete_when_pending !== false,
    allowCompleteWhenHliUnavailable: row.allow_complete_when_hli_unavailable !== false,
  };
}

export async function loadConsultationTrichoscopyWorkspace(opts: {
  tenantId: string;
  consultationId: string;
  userId: string;
  supabaseClientForTests?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
}): Promise<{
  available: boolean;
  card: ConsultationTrichoscopyCardSummary;
  indication: Record<string, unknown> | null;
  consultationLink: ConsultationTrichoscopyLinkRow | null;
  findings: Array<Record<string, unknown>>;
  reviews: Array<Record<string, unknown>>;
  patientSafeSummaryText: string | null;
  canRequest: boolean;
  canReview: boolean;
  canAccept: boolean;
  historicalReadOnly: boolean;
}> {
  const access = await requireTenantModuleCapability({
    tenantId: opts.tenantId,
    userId: opts.userId,
    capability: "trichoscopy.view_status",
    concealModule: true,
    allowHistoricalReadOnly: true,
    supabaseClientForTests: opts.supabaseClientForTests,
    env: opts.env,
  });

  if (!access.ok) {
    return {
      available: false,
      card: {
        consultationStatus: "not_required",
        readinessState: "no_trichoscopy_requirement",
        blocking: false,
        blockingReasonCodes: [],
        significantFindingsCount: 0,
        unresolvedActionCount: 0,
        integrationMessage: HLI_OUTAGE_USER_MESSAGE,
        failureKind: "hli_unavailable",
      },
      indication: null,
      consultationLink: null,
      findings: [],
      reviews: [],
      patientSafeSummaryText: null,
      canRequest: false,
      canReview: false,
      canAccept: false,
      historicalReadOnly: false,
    };
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const [consultationLink, indication, rulesRow] = await Promise.all([
    getConsultationTrichoscopyLink({
      tenantId: opts.tenantId,
      consultationId: opts.consultationId,
      supabaseClientForTests: opts.supabaseClientForTests,
    }),
    getConsultationIndication({
      tenantId: opts.tenantId,
      consultationId: opts.consultationId,
      supabaseClientForTests: opts.supabaseClientForTests,
    }),
    getTenantConsultationRules({
      tenantId: opts.tenantId,
      supabaseClientForTests: opts.supabaseClientForTests,
    }),
  ]);

  let linkStatus: FiosTrichoscopyStatus | null = null;
  let lastSyncedAt: string | null = null;
  let packVersion: string | null = consultationLink?.pinned_pack_version ?? null;
  let evidenceQuality: string | null = null;

  if (consultationLink?.link_id) {
    const link = await getTrichoscopyLinkById({
      tenantId: opts.tenantId,
      linkId: consultationLink.link_id,
      supabaseClientForTests: opts.supabaseClientForTests,
    });
    linkStatus = link?.status ?? null;
    lastSyncedAt = link?.last_synced_at ?? null;
    if (link) {
      const packs = await listEvidencePacksForLink({
        tenantId: opts.tenantId,
        linkId: link.id,
        supabaseClientForTests: opts.supabaseClientForTests,
      });
      const active = packs.find((p) => p.local_state === "active") ?? packs[0];
      if (active) {
        packVersion = String(active.pack_version ?? packVersion ?? "");
        const summary = (active.findings_summary ?? {}) as Record<string, unknown>;
        evidenceQuality = summary.evidenceQuality
          ? String(summary.evidenceQuality)
          : summary.evidence_quality
            ? String(summary.evidence_quality)
            : null;
      }
    }
  }

  const findings = consultationLink
    ? await listConsultationFindings({
        tenantId: opts.tenantId,
        consultationId: opts.consultationId,
        supabaseClientForTests: opts.supabaseClientForTests,
      })
    : [];
  const reviews = consultationLink
    ? await listConsultationFindingReviews({
        tenantId: opts.tenantId,
        consultationId: opts.consultationId,
        supabaseClientForTests: opts.supabaseClientForTests,
      })
    : [];

  const significantFindingsCount = findings.filter(
    (f) => Boolean(f.is_significant) || Boolean(f.is_escalation)
  ).length;
  const reviewedFindingIds = new Set(reviews.map((r) => String(r.finding_id)));
  const unresolvedActionCount = findings.filter(
    (f) =>
      (Boolean(f.is_significant) || Boolean(f.is_escalation)) &&
      !reviewedFindingIds.has(String(f.id))
  ).length;
  const findingsReviewed =
    significantFindingsCount === 0 ||
    findings
      .filter((f) => Boolean(f.is_significant) || Boolean(f.is_escalation))
      .every((f) => reviewedFindingIds.has(String(f.id)));

  const indicationCodes = Array.isArray(indication?.indication_codes)
    ? (indication!.indication_codes as string[])
    : [];

  const consultationStatus =
    consultationLink?.consultation_status ??
    resolveConsultationTrichoscopyStatus({
      markedNotRequired: consultationLink?.consultation_status === "not_required",
      deferred: consultationLink?.consultation_status === "deferred",
      waitForTreatmentPlanning: Boolean(indication?.wait_for_treatment_planning),
      hasIndication: indicationCodes.length > 0,
      linkStatus,
      hasActiveEvidencePack: Boolean(consultationLink?.evidence_pack_id),
      findingsReviewed,
    });

  const readiness = resolveConsultationTrichoscopyReadiness({
    consultationStatus,
    rules: mapRules(rulesRow),
    indicationCodes,
    escalationUnresolved: findings.some(
      (f) =>
        Boolean(f.is_escalation) &&
        !reviews.some(
          (r) =>
            String(r.finding_id) === String(f.id) &&
            ["acknowledged", "accepted_into_assessment", "accepted_with_qualification", "escalated"].includes(
              String(r.acknowledgement_state)
            )
        )
    ),
    scarringConcern: findings.some((f) => String(f.finding_code).includes("scarring")),
    decisionsDocumented: reviews.some((r) =>
      isAcceptanceAcknowledgement(String(r.acknowledgement_state) as TrichoscopyAcknowledgementState)
    ),
  });

  const [canRequest, canReview, canAccept] = await Promise.all([
    requireTenantModuleCapability({
      tenantId: opts.tenantId,
      userId: opts.userId,
      capability: "trichoscopy.request",
      concealModule: true,
      supabaseClientForTests: opts.supabaseClientForTests,
      env: opts.env,
    }),
    requireTenantModuleCapability({
      tenantId: opts.tenantId,
      userId: opts.userId,
      capability: "trichoscopy.review_findings",
      concealModule: true,
      allowHistoricalReadOnly: true,
      supabaseClientForTests: opts.supabaseClientForTests,
      env: opts.env,
    }),
    requireTenantModuleCapability({
      tenantId: opts.tenantId,
      userId: opts.userId,
      capability: "trichoscopy.accept_findings",
      concealModule: true,
      supabaseClientForTests: opts.supabaseClientForTests,
      env: opts.env,
    }),
  ]);

  const patientSafe = buildPatientSafeTrichoscopySummary({
    performed: ["ready_for_review", "reviewed", "already_available", "insufficient"].includes(
      consultationStatus
    ),
    regionsReviewed: Array.isArray(indication?.anatomical_regions)
      ? (indication!.anatomical_regions as string[])
      : [],
    whyPerformed: indication?.clinician_note ? String(indication.clinician_note) : null,
    highLevelObservations: findings
      .filter((f) => Boolean(f.is_significant) && !Boolean(f.is_escalation))
      .slice(0, 5)
      .map((f) => String(f.finding_code).replace(/_/g, " ")),
    moreEvidenceRequired: consultationStatus === "insufficient",
    recommendedNextSteps: reviews
      .filter((r) => String(r.associated_action_type ?? ""))
      .map((r) => String(r.associated_action_type).replace(/_/g, " ")),
  });

  return {
    available: true,
    card: {
      consultationStatus,
      readinessState: readiness.state,
      blocking: readiness.blocking,
      blockingReasonCodes: readiness.blockingReasonCodes.length
        ? readiness.blockingReasonCodes
        : consultationLink?.blocking_reason_codes ?? [],
      assessmentDate: consultationLink?.pinned_at ?? lastSyncedAt,
      evidenceQuality,
      significantFindingsCount,
      unresolvedActionCount,
      evidencePackVersion: packVersion,
      pinnedPackVersion: consultationLink?.pinned_pack_version ?? null,
      lastSyncedAt,
      failureKind: consultationStatus === "failed" ? "hli_unavailable" : null,
      integrationMessage: consultationStatus === "failed" ? HLI_OUTAGE_USER_MESSAGE : null,
    },
    indication,
    consultationLink,
    findings,
    reviews,
    patientSafeSummaryText: formatPatientSafeTrichoscopySummaryText(patientSafe),
    canRequest: canRequest.ok,
    canReview: canReview.ok,
    canAccept: canAccept.ok,
    historicalReadOnly: Boolean(access.historicalReadOnly),
  };
}

export async function upsertConsultationTrichoscopyIndication(opts: {
  tenantId: string;
  consultationId: string;
  userId: string;
  indication: TrichoscopyIndicationInput;
  supabaseClientForTests?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
}): Promise<{ indicationId: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const consult = await loadConsultationPatient({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabase,
  });

  await requireCap({
    tenantId: opts.tenantId,
    userId: opts.userId,
    capability: "trichoscopy.request",
    patientId: consult.patientId,
    supabaseClientForTests: opts.supabaseClientForTests,
    env: opts.env,
  });

  const codes = (opts.indication.indicationCodes ?? []).filter(isTrichoscopyIndicationCode);
  if (!codes.length) {
    throw new HliTrichoscopyValidationError("At least one indication code is required.");
  }

  const status = resolveConsultationTrichoscopyStatus({
    hasIndication: true,
    waitForTreatmentPlanning: Boolean(opts.indication.waitForTreatmentPlanning),
  });

  const { data: linkRow, error: linkErr } = await supabase
    .from("fi_hli_trichoscopy_consultation_links")
    .upsert(
      {
        tenant_id: opts.tenantId,
        consultation_id: opts.consultationId,
        fios_patient_id: consult.patientId,
        consultation_status: status,
        request_mode: "new_assessment",
        blocking_reason_codes: opts.indication.waitForTreatmentPlanning
          ? ["trichoscopy_required_before_treatment"]
          : [],
      },
      { onConflict: "tenant_id,consultation_id" }
    )
    .select("id")
    .single();

  // Unique partial index may not support onConflict — fallback insert/update
  let consultationLinkId: string | null = linkRow ? String((linkRow as { id: string }).id) : null;
  if (linkErr || !consultationLinkId) {
    const existing = await getConsultationTrichoscopyLink({
      tenantId: opts.tenantId,
      consultationId: opts.consultationId,
      supabaseClientForTests: opts.supabaseClientForTests,
    });
    if (existing) {
      await supabase
        .from("fi_hli_trichoscopy_consultation_links")
        .update({
          consultation_status: status,
          blocking_reason_codes: opts.indication.waitForTreatmentPlanning
            ? ["trichoscopy_required_before_treatment"]
            : [],
        })
        .eq("id", existing.id)
        .eq("tenant_id", opts.tenantId);
      consultationLinkId = existing.id;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("fi_hli_trichoscopy_consultation_links")
        .insert({
          tenant_id: opts.tenantId,
          consultation_id: opts.consultationId,
          fios_patient_id: consult.patientId,
          consultation_status: status,
          request_mode: "new_assessment",
          blocking_reason_codes: opts.indication.waitForTreatmentPlanning
            ? ["trichoscopy_required_before_treatment"]
            : [],
        })
        .select("id")
        .single();
      if (insErr || !inserted) {
        throw new HliTrichoscopyValidationError(insErr?.message ?? "Failed to create consultation link.");
      }
      consultationLinkId = String((inserted as { id: string }).id);
    }
  }

  const payload = {
    tenant_id: opts.tenantId,
    consultation_id: opts.consultationId,
    consultation_link_id: consultationLinkId,
    fios_patient_id: consult.patientId,
    indication_codes: codes,
    clinician_note: sanitiseFreeText(opts.indication.clinicianNote, 500),
    urgency: opts.indication.urgency ?? "routine",
    anatomical_regions: opts.indication.anatomicalRegions ?? [],
    wait_for_treatment_planning: Boolean(opts.indication.waitForTreatmentPlanning),
    medical_review_required: Boolean(opts.indication.medicalReviewRequired),
    patient_consent_capture: Boolean(opts.indication.patientConsentCapture),
    patient_consent_transfer: Boolean(opts.indication.patientConsentTransfer),
    symptoms: sanitiseFreeText(opts.indication.symptoms, 500),
    onset_progression: sanitiseFreeText(opts.indication.onsetProgression, 500),
    known_diagnoses: sanitiseFreeText(opts.indication.knownDiagnoses, 500),
    current_treatments: sanitiseFreeText(opts.indication.currentTreatments, 500),
    relevant_medications: sanitiseFreeText(opts.indication.relevantMedications, 500),
    recent_procedures: sanitiseFreeText(opts.indication.recentProcedures, 500),
    available_blood_results_summary: sanitiseFreeText(
      opts.indication.availableBloodResultsSummary,
      500
    ),
    clinician_question: sanitiseFreeText(opts.indication.clinicianQuestion, 2000),
    created_by_user_id: opts.userId,
    updated_by_user_id: opts.userId,
  };

  const existingInd = await getConsultationIndication({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabaseClientForTests: opts.supabaseClientForTests,
  });

  let indicationId: string;
  if (existingInd?.id) {
    const { data, error } = await supabase
      .from("fi_hli_trichoscopy_indications")
      .update(payload)
      .eq("id", String(existingInd.id))
      .eq("tenant_id", opts.tenantId)
      .select("id")
      .single();
    if (error || !data) throw new HliTrichoscopyValidationError(error?.message ?? "Indication update failed.");
    indicationId = String((data as { id: string }).id);
  } else {
    const { data, error } = await supabase
      .from("fi_hli_trichoscopy_indications")
      .insert(payload)
      .select("id")
      .single();
    if (error || !data) throw new HliTrichoscopyValidationError(error?.message ?? "Indication insert failed.");
    indicationId = String((data as { id: string }).id);
  }

  await writeConsultationTrichoscopyAudit({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    patientId: consult.patientId,
    actorUserId: opts.userId,
    action: "indication_selected",
    payload: { indication_codes: codes, urgency: opts.indication.urgency ?? "routine" },
    supabaseClientForTests: opts.supabaseClientForTests,
  });

  return { indicationId };
}

export async function requestConsultationTrichoscopy(opts: {
  tenantId: string;
  consultationId: string;
  userId: string;
  requestMode?: TrichoscopyRequestMode;
  clientRequestId?: string;
  purpose?: string;
  requestedSites?: string[];
  clinicalQuestion?: string;
  urgency?: "routine" | "priority";
  capturePathway?: string;
  baselineLinkId?: string;
  existingLinkId?: string;
  supabaseClientForTests?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
}): Promise<{
  requestRowId: string;
  linkId: string;
  consultationLinkId: string;
  episodeId: string;
  idempotencyKey: string;
}> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const consult = await loadConsultationPatient({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabase,
  });

  const access = await requireCap({
    tenantId: opts.tenantId,
    userId: opts.userId,
    capability:
      opts.requestMode === "additional_evidence"
        ? "trichoscopy.request_additional_evidence"
        : "trichoscopy.request",
    patientId: consult.patientId,
    supabaseClientForTests: opts.supabaseClientForTests,
    env: opts.env,
  });

  const requestMode: TrichoscopyRequestMode = opts.requestMode ?? "new_assessment";
  const clientRequestId = (opts.clientRequestId ?? randomUUID()).trim();
  const idempotencyKey = buildConsultationTrichoscopyIdempotencyKey({
    tenantId: opts.tenantId,
    patientId: consult.patientId,
    consultationId: opts.consultationId,
    requestIntent: requestMode,
    clientRequestId,
  });

  const indication = await getConsultationIndication({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabaseClientForTests: opts.supabaseClientForTests,
  });

  const indicationInput: TrichoscopyIndicationInput = {
    indicationCodes: (Array.isArray(indication?.indication_codes)
      ? (indication!.indication_codes as string[])
      : ["clinician_concern"]
    ).filter(isTrichoscopyIndicationCode) as TrichoscopyIndicationCode[],
    clinicianNote: indication?.clinician_note ? String(indication.clinician_note) : null,
    urgency:
      opts.urgency === "priority"
        ? "priority"
        : indication?.urgency === "urgent" || indication?.urgency === "priority"
          ? (indication.urgency as "priority" | "urgent")
          : "routine",
    anatomicalRegions: opts.requestedSites?.length
      ? opts.requestedSites
      : Array.isArray(indication?.anatomical_regions)
        ? (indication!.anatomical_regions as string[])
        : [],
    waitForTreatmentPlanning: Boolean(indication?.wait_for_treatment_planning),
    medicalReviewRequired: Boolean(indication?.medical_review_required),
    patientConsentCapture: Boolean(indication?.patient_consent_capture),
    patientConsentTransfer: Boolean(indication?.patient_consent_transfer),
    symptoms: indication?.symptoms ? String(indication.symptoms) : null,
    onsetProgression: indication?.onset_progression ? String(indication.onset_progression) : null,
    knownDiagnoses: indication?.known_diagnoses ? String(indication.known_diagnoses) : null,
    currentTreatments: indication?.current_treatments ? String(indication.current_treatments) : null,
    relevantMedications: indication?.relevant_medications
      ? String(indication.relevant_medications)
      : null,
    recentProcedures: indication?.recent_procedures ? String(indication.recent_procedures) : null,
    availableBloodResultsSummary: indication?.available_blood_results_summary
      ? String(indication.available_blood_results_summary)
      : null,
    clinicianQuestion: opts.clinicalQuestion ?? (indication?.clinician_question ? String(indication.clinician_question) : null),
  };

  const consentGate = assertConsentForTrichoscopyRequest({
    patientConsentCapture: Boolean(indicationInput.patientConsentCapture),
    patientConsentTransfer: Boolean(indicationInput.patientConsentTransfer),
  });
  if (!consentGate.ok) throw new HliTrichoscopyValidationError(consentGate.reason);

  const existingLinkForRequest = await getConsultationTrichoscopyLink({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabaseClientForTests: opts.supabaseClientForTests,
  });
  const finalisedGate = assertConsultationMutationAllowed({
    consultationFinalised: Boolean(existingLinkForRequest?.consultation_finalised_at),
    mutationKind: "request",
  });
  if (!finalisedGate.ok) throw new HliTrichoscopyValidationError(finalisedGate.reason);

  const hliContext = buildFiOsToHliConsultationContext({
    tenantId: opts.tenantId,
    patientId: consult.patientId,
    consultationId: opts.consultationId,
    requestingClinicianUserId: opts.userId,
    consultationDate: consult.consultationDate,
    purpose: opts.purpose ?? "consultation",
    indication: indicationInput,
    clientRequestId,
    requestMode,
    baselineAssessmentReference: opts.baselineLinkId ?? null,
  });

  if (requestMode === "link_existing") {
    if (!opts.existingLinkId) {
      throw new HliTrichoscopyValidationError("existingLinkId is required to link an assessment.");
    }
    const existing = await getTrichoscopyLinkById({
      tenantId: opts.tenantId,
      linkId: opts.existingLinkId,
      supabaseClientForTests: opts.supabaseClientForTests,
    });
    if (!existing || existing.fios_patient_id !== consult.patientId) {
      throw new HliTrichoscopyValidationError("Assessment does not belong to this patient/tenant.");
    }

    const { data: clink, error } = await supabase
      .from("fi_hli_trichoscopy_consultation_links")
      .insert({
        tenant_id: opts.tenantId,
        consultation_id: opts.consultationId,
        fios_patient_id: consult.patientId,
        link_id: existing.id,
        request_mode: "link_existing",
        consultation_status: resolveConsultationTrichoscopyStatus({
          linkStatus: existing.status,
          hasActiveEvidencePack: Boolean(existing.active_evidence_pack_id),
        }),
        evidence_pack_id: existing.active_evidence_pack_id,
        metadata: { linked_from: existing.id },
      })
      .select("id")
      .single();

    if (error || !clink) {
      const prior = await getConsultationTrichoscopyLink({
        tenantId: opts.tenantId,
        consultationId: opts.consultationId,
        supabaseClientForTests: opts.supabaseClientForTests,
      });
      if (prior) {
        await supabase
          .from("fi_hli_trichoscopy_consultation_links")
          .update({
            link_id: existing.id,
            request_mode: "link_existing",
            consultation_status: resolveConsultationTrichoscopyStatus({
              linkStatus: existing.status,
              hasActiveEvidencePack: Boolean(existing.active_evidence_pack_id),
            }),
            evidence_pack_id: existing.active_evidence_pack_id,
          })
          .eq("id", prior.id);
      } else {
        throw new HliTrichoscopyValidationError(error?.message ?? "Failed to link assessment.");
      }
    }

    const consultationLinkId = clink
      ? String((clink as { id: string }).id)
      : (await getConsultationTrichoscopyLink({
          tenantId: opts.tenantId,
          consultationId: opts.consultationId,
          supabaseClientForTests: opts.supabaseClientForTests,
        }))!.id;

    await writeConsultationTrichoscopyAudit({
      tenantId: opts.tenantId,
      consultationId: opts.consultationId,
      patientId: consult.patientId,
      actorUserId: opts.userId,
      action: "assessment_linked",
      payload: { link_id: existing.id, idempotency_key: idempotencyKey },
      supabaseClientForTests: opts.supabaseClientForTests,
    });

    return {
      requestRowId: "",
      linkId: existing.id,
      consultationLinkId,
      episodeId: existing.hli_episode_id ?? "",
      idempotencyKey,
    };
  }

  const entitlementContext: HliEntitlementContext = {
    moduleKey: "hli_trichoscopy",
    capability: "trichoscopy.request",
    entitlementTier: access.access.capabilityTier ?? "capture",
    entitlementStatus:
      access.access.entitlementStatus === "trial" ||
      access.access.entitlementStatus === "grace_period"
        ? access.access.entitlementStatus
        : "active",
    tenantId: opts.tenantId,
  };

  const result = await requestTrichoscopy({
    request: {
      tenantId: opts.tenantId,
      fiosPatientId: consult.patientId,
      consultationId: opts.consultationId,
      purpose: "consultation",
      requestedSites: indicationInput.anatomicalRegions,
      clinicalQuestion: indicationInput.clinicianQuestion ?? undefined,
      urgency: opts.urgency === "priority" ? "priority" : "routine",
      requestedByUserId: opts.userId,
    },
    entitlementContext,
    workflowReference: idempotencyKey,
    supabaseClientForTests: opts.supabaseClientForTests,
    env: opts.env,
  });

  const consultStatus = resolveConsultationTrichoscopyStatus({
    linkStatus: "requested",
    hasIndication: true,
  });

  const existingClink = await getConsultationTrichoscopyLink({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabaseClientForTests: opts.supabaseClientForTests,
  });

  let consultationLinkId: string;
  if (existingClink) {
    await supabase
      .from("fi_hli_trichoscopy_consultation_links")
      .update({
        link_id: result.linkId,
        request_id: result.requestRowId,
        request_mode: requestMode,
        consultation_status: consultStatus,
        metadata: {
          ...(existingClink.metadata ?? {}),
          hli_context: hliContext,
          capture_pathway: opts.capturePathway ?? null,
          baseline_link_id: opts.baselineLinkId ?? null,
        },
      })
      .eq("id", existingClink.id)
      .eq("tenant_id", opts.tenantId);
    consultationLinkId = existingClink.id;
  } else {
    const { data: inserted, error } = await supabase
      .from("fi_hli_trichoscopy_consultation_links")
      .insert({
        tenant_id: opts.tenantId,
        consultation_id: opts.consultationId,
        fios_patient_id: consult.patientId,
        link_id: result.linkId,
        request_id: result.requestRowId,
        request_mode: requestMode,
        consultation_status: consultStatus,
        metadata: {
          hli_context: hliContext,
          capture_pathway: opts.capturePathway ?? null,
          baseline_link_id: opts.baselineLinkId ?? null,
        },
      })
      .select("id")
      .single();
    if (error || !inserted) {
      throw new HliTrichoscopyValidationError(error?.message ?? "Consultation link insert failed.");
    }
    consultationLinkId = String((inserted as { id: string }).id);
  }

  await writeConsultationTrichoscopyAudit({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    patientId: consult.patientId,
    actorUserId: opts.userId,
    action: "request_created",
    payload: {
      request_mode: requestMode,
      idempotency_key: idempotencyKey,
      episode_id: result.hli.episodeId,
      payload_version: "1b.1",
    },
    supabaseClientForTests: opts.supabaseClientForTests,
  });

  return {
    requestRowId: result.requestRowId,
    linkId: result.linkId,
    consultationLinkId,
    episodeId: result.hli.episodeId,
    idempotencyKey,
  };
}

export async function markConsultationTrichoscopyNotRequired(opts: {
  tenantId: string;
  consultationId: string;
  userId: string;
  reason?: string;
  supabaseClientForTests?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const consult = await loadConsultationPatient({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabase,
  });
  await requireCap({
    tenantId: opts.tenantId,
    userId: opts.userId,
    capability: "trichoscopy.request",
    patientId: consult.patientId,
    supabaseClientForTests: opts.supabaseClientForTests,
    env: opts.env,
  });

  const existing = await getConsultationTrichoscopyLink({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabaseClientForTests: opts.supabaseClientForTests,
  });

  if (existing) {
    await supabase
      .from("fi_hli_trichoscopy_consultation_links")
      .update({
        consultation_status: "not_required",
        not_required_reason: sanitiseFreeText(opts.reason, 500),
        blocking_reason_codes: [],
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("fi_hli_trichoscopy_consultation_links").insert({
      tenant_id: opts.tenantId,
      consultation_id: opts.consultationId,
      fios_patient_id: consult.patientId,
      consultation_status: "not_required",
      not_required_reason: sanitiseFreeText(opts.reason, 500),
      request_mode: "new_assessment",
    });
  }

  await writeConsultationTrichoscopyAudit({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    patientId: consult.patientId,
    actorUserId: opts.userId,
    action: "marked_not_required",
    payload: { reason: opts.reason ?? null },
    supabaseClientForTests: opts.supabaseClientForTests,
  });
}

export async function deferConsultationTrichoscopy(opts: {
  tenantId: string;
  consultationId: string;
  userId: string;
  reason?: string;
  supabaseClientForTests?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
}): Promise<void> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const consult = await loadConsultationPatient({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabase,
  });
  await requireCap({
    tenantId: opts.tenantId,
    userId: opts.userId,
    capability: "trichoscopy.request",
    patientId: consult.patientId,
    supabaseClientForTests: opts.supabaseClientForTests,
    env: opts.env,
  });

  const existing = await getConsultationTrichoscopyLink({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabaseClientForTests: opts.supabaseClientForTests,
  });

  if (existing) {
    await supabase
      .from("fi_hli_trichoscopy_consultation_links")
      .update({
        consultation_status: "deferred",
        defer_reason: sanitiseFreeText(opts.reason, 500),
        blocking_reason_codes: [],
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("fi_hli_trichoscopy_consultation_links").insert({
      tenant_id: opts.tenantId,
      consultation_id: opts.consultationId,
      fios_patient_id: consult.patientId,
      consultation_status: "deferred",
      defer_reason: sanitiseFreeText(opts.reason, 500),
      request_mode: "new_assessment",
    });
  }

  await writeConsultationTrichoscopyAudit({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    patientId: consult.patientId,
    actorUserId: opts.userId,
    action: "deferred",
    payload: { reason: opts.reason ?? null },
    supabaseClientForTests: opts.supabaseClientForTests,
  });
}

export async function reviewConsultationTrichoscopyFinding(opts: {
  tenantId: string;
  consultationId: string;
  findingId: string;
  userId: string;
  acknowledgementState: TrichoscopyAcknowledgementState;
  clinicianInterpretation?: string;
  disagreementReason?: string;
  qualificationNote?: string;
  associatedActionType?: string;
  supabaseClientForTests?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
}): Promise<{ reviewId: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const capability: TrichoscopyCapability = isAcceptanceAcknowledgement(opts.acknowledgementState)
    ? "trichoscopy.accept_findings"
    : opts.acknowledgementState === "escalated"
      ? "trichoscopy.escalate"
      : "trichoscopy.review_findings";

  const consult = await loadConsultationPatient({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabase,
  });
  await requireCap({
    tenantId: opts.tenantId,
    userId: opts.userId,
    capability,
    patientId: consult.patientId,
    supabaseClientForTests: opts.supabaseClientForTests,
    env: opts.env,
  });

  const { data: finding, error: findingErr } = await supabase
    .from("fi_hli_trichoscopy_findings")
    .select("*")
    .eq("tenant_id", opts.tenantId)
    .eq("id", opts.findingId)
    .eq("consultation_id", opts.consultationId)
    .maybeSingle();

  if (findingErr || !finding) {
    throw new HliTrichoscopyValidationError("Finding not found for this consultation.");
  }

  const clink = await getConsultationTrichoscopyLink({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabaseClientForTests: opts.supabaseClientForTests,
  });

  const gate = assertFindingReviewAllowed({
    consultationFinalised: Boolean(clink?.consultation_finalised_at),
    acknowledgementState: opts.acknowledgementState,
  });
  if (!gate.ok) throw new HliTrichoscopyValidationError(gate.reason);

  const { data: prior } = await supabase
    .from("fi_hli_trichoscopy_finding_reviews")
    .select("id, acknowledgement_state")
    .eq("tenant_id", opts.tenantId)
    .eq("consultation_id", opts.consultationId)
    .eq("finding_id", opts.findingId)
    .maybeSingle();

  if (prior) {
    const from = String(
      (prior as { acknowledgement_state: string }).acknowledgement_state
    ) as TrichoscopyAcknowledgementState;
    if (!canTransitionAcknowledgement(from, opts.acknowledgementState)) {
      throw new HliTrichoscopyValidationError(
        `Cannot transition acknowledgement from ${from} to ${opts.acknowledgementState}.`
      );
    }
  }

  const packVersion = String((finding as { pack_version: string }).pack_version);
  const evidencePackId = String((finding as { evidence_pack_id: string }).evidence_pack_id);
  const payload = {
    tenant_id: opts.tenantId,
    consultation_id: opts.consultationId,
    finding_id: opts.findingId,
    evidence_pack_id: evidencePackId,
    pack_version: packVersion,
    acknowledgement_state: opts.acknowledgementState,
    clinician_interpretation: sanitiseFreeText(opts.clinicianInterpretation, 2000),
    disagreement_reason: sanitiseFreeText(opts.disagreementReason, 1000),
    qualification_note: sanitiseFreeText(opts.qualificationNote, 1000),
    associated_action_type: opts.associatedActionType ?? null,
    reviewing_user_id: opts.userId,
    reviewed_at: new Date().toISOString(),
  };

  let reviewId: string;
  if (prior) {
    const { data, error } = await supabase
      .from("fi_hli_trichoscopy_finding_reviews")
      .update(payload)
      .eq("id", String((prior as { id: string }).id))
      .select("id")
      .single();
    if (error || !data) throw new HliTrichoscopyValidationError(error?.message ?? "Review update failed.");
    reviewId = String((data as { id: string }).id);
  } else {
    const { data, error } = await supabase
      .from("fi_hli_trichoscopy_finding_reviews")
      .insert(payload)
      .select("id")
      .single();
    if (error || !data) throw new HliTrichoscopyValidationError(error?.message ?? "Review insert failed.");
    reviewId = String((data as { id: string }).id);
  }

  // Pin evidence version on first acceptance into assessment (immutable thereafter).
  if (isAcceptanceAcknowledgement(opts.acknowledgementState) && clink) {
    const pin = resolvePinnedPackVersion({
      existingPinnedVersion: clink.pinned_pack_version,
      candidatePackVersion: packVersion,
    });
    if (pin.newlyPinned) {
      await supabase
        .from("fi_hli_trichoscopy_consultation_links")
        .update({
          pinned_evidence_pack_id: evidencePackId,
          pinned_pack_version: pin.packVersion,
          pinned_hli_assessment_id:
            (finding as { hli_assessment_id?: string | null }).hli_assessment_id ?? null,
          pinned_findings_schema_version: String(
            (finding as { findings_schema_version?: string }).findings_schema_version ?? "1b.1"
          ),
          pinned_at: new Date().toISOString(),
          pinned_by_user_id: opts.userId,
          consultation_status: "reviewed",
        })
        .eq("id", clink.id);
    }
  }

  await writeConsultationTrichoscopyAudit({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    patientId: consult.patientId,
    actorUserId: opts.userId,
    action: "finding_acknowledged",
    evidencePackId,
    packVersion,
    findingId: opts.findingId,
    payload: {
      acknowledgement_state: opts.acknowledgementState,
      review_id: reviewId,
    },
    supabaseClientForTests: opts.supabaseClientForTests,
  });

  return { reviewId };
}

export async function createConsultationTrichoscopyAction(opts: {
  tenantId: string;
  consultationId: string;
  userId: string;
  decisionKind: TrichoscopyDecisionKind;
  findingId?: string;
  findingReviewId?: string;
  targetEntityType: string;
  targetEntityId?: string;
  targetCode?: string;
  decisionSummary?: string;
  qualificationNote?: string;
  investigationCategory?: TrichoscopyInvestigationCategory;
  supabaseClientForTests?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
}): Promise<{ decisionLinkId: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const consult = await loadConsultationPatient({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabase,
  });

  await requireCap({
    tenantId: opts.tenantId,
    userId: opts.userId,
    capability:
      opts.decisionKind === "escalation" ? "trichoscopy.escalate" : "trichoscopy.accept_findings",
    patientId: consult.patientId,
    supabaseClientForTests: opts.supabaseClientForTests,
    env: opts.env,
  });

  const decisionClink = await getConsultationTrichoscopyLink({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabaseClientForTests: opts.supabaseClientForTests,
  });

  let acknowledgementState: TrichoscopyAcknowledgementState | null = null;
  let evidencePackId: string | null = null;
  let packVersion: string | null = null;

  if (opts.findingReviewId) {
    const { data: review } = await supabase
      .from("fi_hli_trichoscopy_finding_reviews")
      .select("*")
      .eq("tenant_id", opts.tenantId)
      .eq("id", opts.findingReviewId)
      .eq("consultation_id", opts.consultationId)
      .maybeSingle();
    if (review) {
      acknowledgementState = String(
        (review as { acknowledgement_state: string }).acknowledgement_state
      ) as TrichoscopyAcknowledgementState;
      evidencePackId = String((review as { evidence_pack_id: string }).evidence_pack_id);
      packVersion = String((review as { pack_version: string }).pack_version);
    }
  }

  const guard = assertDecisionLinkAllowed({
    consultationFinalised: Boolean(decisionClink?.consultation_finalised_at),
    decisionKind: opts.decisionKind,
    acknowledgementState,
  });
  if (!guard.ok) throw new HliTrichoscopyValidationError(guard.reason);

  const { data, error } = await supabase
    .from("fi_hli_trichoscopy_decision_links")
    .insert({
      tenant_id: opts.tenantId,
      consultation_id: opts.consultationId,
      finding_id: opts.findingId ?? null,
      finding_review_id: opts.findingReviewId ?? null,
      evidence_pack_id: evidencePackId,
      pack_version: packVersion,
      decision_kind: opts.decisionKind,
      target_entity_type: opts.targetEntityType,
      target_entity_id: opts.targetEntityId ?? null,
      target_code: opts.targetCode ?? opts.investigationCategory ?? null,
      decision_summary: sanitiseFreeText(opts.decisionSummary, 1000),
      qualification_note: sanitiseFreeText(opts.qualificationNote, 1000),
      accepting_user_id: opts.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new HliTrichoscopyValidationError(error?.message ?? "Decision link insert failed.");
  }

  await writeConsultationTrichoscopyAudit({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    patientId: consult.patientId,
    actorUserId: opts.userId,
    action:
      opts.decisionKind.includes("diagnosis")
        ? "diagnosis_acceptance"
        : opts.decisionKind === "investigation"
          ? "investigation_action_created"
          : "treatment_action_created",
    evidencePackId,
    packVersion,
    findingId: opts.findingId ?? null,
    payload: {
      decision_kind: opts.decisionKind,
      target_code: opts.targetCode ?? opts.investigationCategory ?? null,
    },
    supabaseClientForTests: opts.supabaseClientForTests,
  });

  return { decisionLinkId: String((data as { id: string }).id) };
}

export async function scheduleConsultationTrichoscopyFollowUp(opts: {
  tenantId: string;
  consultationId: string;
  userId: string;
  targetDate?: string;
  targetIntervalMonths?: number;
  regionsToRepeat?: string[];
  treatmentBeingMonitored?: string;
  expectedEvidenceRequirements?: string;
  patientInstructions?: string;
  responsibleTeam?: string;
  supabaseClientForTests?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
}): Promise<{ followUpId: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const consult = await loadConsultationPatient({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabase,
  });
  await requireCap({
    tenantId: opts.tenantId,
    userId: opts.userId,
    capability: "trichoscopy.request",
    patientId: consult.patientId,
    supabaseClientForTests: opts.supabaseClientForTests,
    env: opts.env,
  });

  const clink = await getConsultationTrichoscopyLink({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabaseClientForTests: opts.supabaseClientForTests,
  });

  const { data, error } = await supabase
    .from("fi_hli_trichoscopy_followups")
    .insert({
      tenant_id: opts.tenantId,
      consultation_id: opts.consultationId,
      fios_patient_id: consult.patientId,
      baseline_consultation_link_id: clink?.id ?? null,
      baseline_link_id: clink?.link_id ?? null,
      baseline_evidence_pack_id: clink?.pinned_evidence_pack_id ?? clink?.evidence_pack_id ?? null,
      target_date: opts.targetDate ?? null,
      target_interval_months: opts.targetIntervalMonths ?? null,
      regions_to_repeat: opts.regionsToRepeat ?? [],
      treatment_being_monitored: sanitiseFreeText(opts.treatmentBeingMonitored, 500),
      expected_evidence_requirements: sanitiseFreeText(opts.expectedEvidenceRequirements, 1000),
      patient_instructions: sanitiseFreeText(opts.patientInstructions, 1000),
      responsible_user_id: opts.userId,
      responsible_team: sanitiseFreeText(opts.responsibleTeam, 200),
      created_by_user_id: opts.userId,
      status: "scheduled",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new HliTrichoscopyValidationError(error?.message ?? "Follow-up insert failed.");
  }

  await writeConsultationTrichoscopyAudit({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    patientId: consult.patientId,
    actorUserId: opts.userId,
    action: "follow_up_scheduled",
    payload: {
      follow_up_id: (data as { id: string }).id,
      target_interval_months: opts.targetIntervalMonths ?? null,
      baseline_link_id: clink?.link_id ?? null,
    },
    supabaseClientForTests: opts.supabaseClientForTests,
  });

  return { followUpId: String((data as { id: string }).id) };
}

/**
 * Import normalised findings into consultation tables from an evidence pack (idempotent).
 */
export async function syncConsultationFindingsFromPack(opts: {
  tenantId: string;
  consultationId: string;
  linkId: string;
  evidencePackId: string;
  packVersion: string;
  hliAssessmentId?: string | null;
  packPayload: unknown;
  findingsSchemaVersion?: string;
  supabaseClientForTests?: SupabaseClient;
}): Promise<{ imported: number }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const normalised = normaliseTrichoscopyFindingsFromPack(opts.packPayload);
  let imported = 0;

  for (const finding of normalised) {
    const { error } = await supabase.from("fi_hli_trichoscopy_findings").upsert(
      {
        tenant_id: opts.tenantId,
        consultation_id: opts.consultationId,
        link_id: opts.linkId,
        evidence_pack_id: opts.evidencePackId,
        hli_assessment_id: opts.hliAssessmentId ?? null,
        hli_finding_id: finding.hliFindingId ?? null,
        finding_domain: finding.findingDomain,
        finding_code: finding.findingCode,
        observed_region: finding.observedRegion ?? null,
        severity: finding.severity ?? null,
        extent: finding.extent ?? null,
        confidence: finding.confidence ?? null,
        evidence_quality: finding.evidenceQuality ?? null,
        supporting_evidence_refs: finding.supportingEvidenceRefs ?? [],
        alternative_interpretations: finding.alternativeInterpretations ?? [],
        limitations: finding.limitations ?? [],
        recommended_next_step: finding.recommendedNextStep ?? null,
        is_significant: finding.isSignificant,
        is_escalation: finding.isEscalation,
        pack_version: opts.packVersion,
        findings_schema_version: opts.findingsSchemaVersion ?? "1b.1",
        received_at: new Date().toISOString(),
        raw_payload: finding.rawPayload ?? {},
      },
      {
        onConflict: "tenant_id,evidence_pack_id,coalesce(hli_finding_id, finding_code),coalesce(observed_region, '-')",
        ignoreDuplicates: true,
      }
    );
    // Unique index uses expressions — upsert onConflict may fail; fall back to insert-ignore
    if (error) {
      const { error: insErr } = await supabase.from("fi_hli_trichoscopy_findings").insert({
        tenant_id: opts.tenantId,
        consultation_id: opts.consultationId,
        link_id: opts.linkId,
        evidence_pack_id: opts.evidencePackId,
        hli_assessment_id: opts.hliAssessmentId ?? null,
        hli_finding_id: finding.hliFindingId ?? null,
        finding_domain: finding.findingDomain,
        finding_code: finding.findingCode,
        observed_region: finding.observedRegion ?? null,
        severity: finding.severity ?? null,
        extent: finding.extent ?? null,
        confidence: finding.confidence ?? null,
        evidence_quality: finding.evidenceQuality ?? null,
        supporting_evidence_refs: finding.supportingEvidenceRefs ?? [],
        alternative_interpretations: finding.alternativeInterpretations ?? [],
        limitations: finding.limitations ?? [],
        recommended_next_step: finding.recommendedNextStep ?? null,
        is_significant: finding.isSignificant,
        is_escalation: finding.isEscalation,
        pack_version: opts.packVersion,
        findings_schema_version: opts.findingsSchemaVersion ?? "1b.1",
        received_at: new Date().toISOString(),
        raw_payload: finding.rawPayload ?? {},
      });
      if (!insErr) imported += 1;
      // Unique violation = already imported
    } else {
      imported += 1;
    }
  }

  const clink = await getConsultationTrichoscopyLink({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabaseClientForTests: opts.supabaseClientForTests,
  });
  if (clink && !clink.consultation_finalised_at) {
    await supabase
      .from("fi_hli_trichoscopy_consultation_links")
      .update({
        evidence_pack_id: opts.evidencePackId,
        consultation_status: "ready_for_review",
      })
      .eq("id", clink.id);
  }

  return { imported };
}

/**
 * Freeze consultation trichoscopy evidence when the FiOS consultation is marked completed.
 * Idempotent: subsequent calls leave an existing finalisation timestamp unchanged.
 */
export async function finaliseConsultationTrichoscopyLink(opts: {
  tenantId: string;
  consultationId: string;
  actorUserId?: string | null;
  supabaseClientForTests?: SupabaseClient;
}): Promise<{ finalised: boolean; consultationLinkId: string | null }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const clink = await getConsultationTrichoscopyLink({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabaseClientForTests: opts.supabaseClientForTests,
  });
  if (!clink) {
    return { finalised: false, consultationLinkId: null };
  }
  if (clink.consultation_finalised_at) {
    return { finalised: true, consultationLinkId: clink.id };
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("fi_hli_trichoscopy_consultation_links")
    .update({ consultation_finalised_at: nowIso })
    .eq("id", clink.id)
    .eq("tenant_id", opts.tenantId.trim())
    .is("consultation_finalised_at", null);

  if (error) {
    throw new HliTrichoscopyValidationError(error.message);
  }

  await writeConsultationTrichoscopyAudit({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    patientId: clink.fios_patient_id,
    actorUserId: opts.actorUserId ?? null,
    action: "consultation_finalised",
    evidencePackId: clink.pinned_evidence_pack_id ?? clink.evidence_pack_id,
    packVersion: clink.pinned_pack_version,
    payload: {
      pinned_pack_version: clink.pinned_pack_version,
      finalised_at: nowIso,
    },
    supabaseClientForTests: opts.supabaseClientForTests,
  });

  return { finalised: true, consultationLinkId: clink.id };
}

/**
 * When a superseding pack arrives for a completed consultation: audit only, leave pin.
 * When open: allow finding sync (caller performs sync separately).
 */
export async function recordSupersedingPackAgainstConsultation(opts: {
  tenantId: string;
  consultationId: string;
  patientId?: string | null;
  evidencePackId: string;
  packVersion: string;
  linkId: string;
  supabaseClientForTests?: SupabaseClient;
}): Promise<{ disposition: ReturnType<typeof resolvePackSupersessionDisposition> }> {
  const clink = await getConsultationTrichoscopyLink({
    tenantId: opts.tenantId,
    consultationId: opts.consultationId,
    supabaseClientForTests: opts.supabaseClientForTests,
  });
  const disposition = resolvePackSupersessionDisposition({
    consultationFinalised: Boolean(clink?.consultation_finalised_at),
    pinnedPackVersion: clink?.pinned_pack_version,
    incomingPackVersion: opts.packVersion,
  });

  if (disposition === "audit_only_leave_pin") {
    await writeConsultationTrichoscopyAudit({
      tenantId: opts.tenantId,
      consultationId: opts.consultationId,
      patientId: opts.patientId ?? clink?.fios_patient_id ?? null,
      action: "superseding_pack_received_completed_consultation",
      source: "hli",
      evidencePackId: opts.evidencePackId,
      packVersion: opts.packVersion,
      payload: {
        disposition,
        pinned_pack_version: clink?.pinned_pack_version ?? null,
        incoming_pack_version: opts.packVersion,
        link_id: opts.linkId,
        note: "Completed consultation pin retained; history not rewritten.",
      },
      supabaseClientForTests: opts.supabaseClientForTests,
    });
  }

  return { disposition };
}
