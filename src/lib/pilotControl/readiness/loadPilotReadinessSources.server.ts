/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.2 — load tenant-scoped source bag (read-only).
 * Prefer batch helpers where available. Never writes. Never infers enrolment.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { loadClinicJourneyReadiness } from "@/src/lib/patientJourneyControl/clinicJourneyReadiness.server";
import { loadBookingsForPatient } from "@/src/lib/bookings/bookings";

import type { PilotEnrolmentRecord } from "../pilotCohortQuery.server";
import type { PilotReadinessSourceBag } from "./readinessSourceBag";
import { DEFAULT_PILOT_ESCALATION_THRESHOLDS } from "../pilotControlContracts";

export type LoadReadinessSourcesOptions = {
  supabase?: SupabaseClient;
  evaluatedAt?: string;
  realPatientInvitesEnabled?: boolean;
};

async function countAppLinkage(
  supabase: SupabaseClient,
  tenantId: string,
  authUserId: string | null
): Promise<number> {
  if (!authUserId) return 0;
  const { count, error } = await supabase
    .from("fi_patients")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("portal_auth_user_id", authUserId);
  if (error) return 0;
  return count ?? 0;
}

async function countActiveEnrolments(
  supabase: SupabaseClient,
  args: { tenantId: string; programmeId: string; patientId: string }
): Promise<number> {
  const { count, error } = await supabase
    .from("fi_pilot_enrolments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", args.tenantId)
    .eq("programme_id", args.programmeId)
    .eq("patient_id", args.patientId)
    .in("enrolment_status", ["approved", "invited", "activated", "active", "paused"]);
  if (error) return 0;
  return count ?? 0;
}

/**
 * Build a readiness source bag for one explicitly enrolled patient.
 * Always re-asserts tenant_id on every query. Fail-closed defaults for missing sources.
 */
export async function loadPilotReadinessSourceBag(
  args: {
    tenantId: string;
    enrolment: PilotEnrolmentRecord;
  },
  options: LoadReadinessSourcesOptions = {}
): Promise<PilotReadinessSourceBag> {
  const supabase = options.supabase ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const enrolment = args.enrolment;
  if (enrolment.tenantId !== tid) {
    throw new Error("loadPilotReadinessSourceBag: enrolment tenant mismatch");
  }
  const patientId = assertNonEmptyUuid(enrolment.patientId, "patientId");
  const evaluatedAt = options.evaluatedAt ?? new Date().toISOString();

  const { data: patientRow, error: patientErr } = await supabase
    .from("fi_patients")
    .select("id, tenant_id, person_id, portal_auth_user_id, patient_status")
    .eq("tenant_id", tid)
    .eq("id", patientId)
    .maybeSingle();

  // Cross-tenant probe: if id exists under another tenant, flag critical.
  let crossTenantMapping = false;
  if (!patientRow && !patientErr) {
    const { data: other } = await supabase
      .from("fi_patients")
      .select("id, tenant_id")
      .eq("id", patientId)
      .maybeSingle();
    if (other && String((other as { tenant_id: string }).tenant_id) !== tid) {
      crossTenantMapping = true;
    }
  }

  const patientFound = Boolean(patientRow) && !patientErr;
  const appAuthUserId =
    patientRow?.portal_auth_user_id != null
      ? String(patientRow.portal_auth_user_id)
      : null;

  const [appLinkagePatientCount, activeEnrolmentCount, clinic, bookings] =
    await Promise.all([
      countAppLinkage(supabase, tid, appAuthUserId),
      countActiveEnrolments(supabase, {
        tenantId: tid,
        programmeId: enrolment.programmeId,
        patientId,
      }),
      loadClinicJourneyReadiness(
        { tenantId: tid, patientId },
        { supabase, nowIso: evaluatedAt }
      ).catch(() => null),
      loadBookingsForPatient(tid, patientId, supabase).catch(() => []),
    ]);

  const { data: milestones } = await supabase
    .from("fi_patient_journey_milestones")
    .select("milestone_key, status, updated_at")
    .eq("tenant_id", tid)
    .eq("patient_id", patientId);

  const { data: pathReq } = await supabase
    .from("fi_pathology_requests")
    .select("id, workflow_status, issued_at, created_at")
    .eq("tenant_id", tid)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(2);

  const { data: pathRes } = await supabase
    .from("fi_pathology_results")
    .select(
      "id, clearance_status, patient_summary_approved_at, status, created_at, request_id"
    )
    .eq("tenant_id", tid)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(2);

  const latestReq = (pathReq ?? [])[0] as
    | { id?: string; workflow_status?: string; issued_at?: string }
    | undefined;
  const latestRes = (pathRes ?? [])[0] as
    | {
        id?: string;
        clearance_status?: string;
        patient_summary_approved_at?: string | null;
        status?: string;
      }
    | undefined;
  const superseded =
    (pathRes ?? []).length > 1 &&
    String((pathRes as { status?: string }[])[0]?.status ?? "") === "archived";

  const pathologyRequired =
    latestReq != null || clinic?.pathologyStatus != null
      ? true
      : clinic?.pathologyStatus === null && !latestReq
        ? false
        : null;

  const { data: quote } = await supabase
    .from("fi_crm_quotes")
    .select("id, status, patient_id")
    .eq("tenant_id", tid)
    .eq("patient_id", patientId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: clearance } = await supabase
    .from("fi_financial_clearance_snapshots")
    .select("id, clearance_state, patient_id, updated_at")
    .eq("tenant_id", tid)
    .eq("patient_id", patientId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: packets } = await supabase
    .from("fi_patient_document_packets")
    .select("id, status")
    .eq("tenant_id", tid)
    .eq("patient_id", patientId)
    .order("updated_at", { ascending: false })
    .limit(5);

  const packetIds = (packets ?? []).map((p) => String((p as { id: string }).id));
  let mandatoryConsentSatisfied: boolean | null = null;
  let mandatoryConsentUnknown = false;
  let optionalDocumentMissing = false;
  const packetId: string | null = packetIds[0] ?? null;

  if (packetIds.length > 0) {
    const { data: sections } = await supabase
      .from("fi_patient_document_sections")
      .select("packet_id, status, is_required, section_key")
      .eq("tenant_id", tid)
      .in("packet_id", packetIds);

    const required = (sections ?? []).filter(
      (s) => Boolean((s as { is_required?: boolean }).is_required)
    );
    const optional = (sections ?? []).filter(
      (s) => !Boolean((s as { is_required?: boolean }).is_required)
    );
    if (required.length === 0) {
      mandatoryConsentSatisfied = true;
    } else {
      mandatoryConsentSatisfied = required.every(
        (s) => String((s as { status?: string }).status) === "completed"
      );
    }
    optionalDocumentMissing = optional.some(
      (s) => String((s as { status?: string }).status) !== "completed"
    );
  } else {
    // No packets — consent state unknown at procedure stage; adapter applies stage rules.
    mandatoryConsentUnknown = true;
    mandatoryConsentSatisfied = null;
  }

  const { data: images } = await supabase
    .from("fi_patient_images")
    .select("id, image_role, image_status")
    .eq("tenant_id", tid)
    .eq("patient_id", patientId)
    .eq("image_status", "active");

  const satisfiedRoles = [
    ...new Set(
      (images ?? [])
        .map((i) => String((i as { image_role?: string }).image_role ?? ""))
        .filter(Boolean)
    ),
  ];

  const { count: failedPushCount } = await supabase
    .from("fi_patient_notification_dispatch_log")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .eq("patient_id", patientId)
    .eq("status", "failed");

  const clearancePatientId =
    clearance?.patient_id != null ? String(clearance.patient_id) : null;

  const bookingRows = Array.isArray(bookings) ? bookings : [];

  return {
    tenantId: tid,
    programmeId: enrolment.programmeId,
    enrolmentId: enrolment.id,
    patientId,
    enrolmentStatus: enrolment.enrolmentStatus,
    evaluatedAt,
    patientInactiveAttentionDays:
      DEFAULT_PILOT_ESCALATION_THRESHOLDS.patient_inactive_attention_days,
    technicalFailureEscalateThreshold: 3,
    identity: {
      patientFound,
      patientTenantId: patientRow
        ? String((patientRow as { tenant_id: string }).tenant_id)
        : null,
      patientId: patientFound ? patientId : null,
      personId: patientRow?.person_id != null ? String(patientRow.person_id) : null,
      ambiguousPatient: false,
      appAuthUserId,
      appLinkagePatientCount,
      crossTenantMapping,
      activeEnrolmentCountForProgrammePatient: activeEnrolmentCount,
      crmLeadPatientIdConflict: false,
      sourcePatientIdMismatch: false,
    },
    journey: {
      milestones: (milestones ?? []).map((m) => ({
        milestoneKey: String((m as { milestone_key: string }).milestone_key),
        status: String((m as { status: string }).status),
        updatedAt:
          (m as { updated_at?: string }).updated_at != null
            ? String((m as { updated_at: string }).updated_at)
            : undefined,
      })),
      openPatientActions: clinic?.openPatientActions ?? 0,
      waitingOnClinicActions: clinic?.waitingOnClinicActions ?? 0,
      overduePatientActions: clinic?.overdueActions ?? 0,
      overdueClinicActions: clinic?.waitingOnClinicActions ?? 0,
      patientInactiveDays: null,
    },
    pathology: {
      required: pathologyRequired,
      requestId: latestReq?.id != null ? String(latestReq.id) : null,
      requestWorkflowStatus: latestReq?.workflow_status
        ? String(latestReq.workflow_status)
        : null,
      resultId: latestRes?.id != null ? String(latestRes.id) : null,
      clearanceStatus: latestRes?.clearance_status
        ? String(latestRes.clearance_status)
        : clinic?.pathologyStatus ?? null,
      reviewed: Boolean(latestRes?.patient_summary_approved_at),
      superseded: Boolean(superseded),
      clinicalEscalationActive: (clinic?.waitingOnClinicActions ?? 0) > 0 &&
        (clinic?.documentPacketStatus === "rejected_needs_correction"),
      clinicalApprovalState:
        (milestones ?? []).some(
          (m) =>
            String((m as { milestone_key: string }).milestone_key) ===
              "clinical_review_completed" &&
            String((m as { status: string }).status) === "completed"
        )
          ? "approved"
          : clinic == null
            ? "unknown"
            : "pending",
      consultationComplete: (milestones ?? []).some(
        (m) =>
          String((m as { milestone_key: string }).milestone_key) ===
            "consultation_completed" &&
          String((m as { status: string }).status) === "completed"
      ),
    },
    financial: {
      quoteId: quote?.id != null ? String(quote.id) : null,
      quoteStatus: quote?.status != null ? String(quote.status) : clinic?.quoteStatus ?? null,
      quotePatientId: quote?.patient_id != null ? String(quote.patient_id) : patientId,
      clearanceState: (clearance?.clearance_state as PilotReadinessSourceBag["financial"]["clearanceState"]) ??
        (clinic == null ? null : null),
      clearanceSourceRecordId: clearance?.id != null ? String(clearance.id) : null,
      depositVerified:
        String(clearance?.clearance_state ?? "") === "deposit_ready" ||
        String(clearance?.clearance_state ?? "") === "financially_cleared" ||
        String(clearance?.clearance_state ?? "") === "paid_in_full",
      depositRequired: true,
      unallocatedPaymentPresent: false,
      paymentPatientIdMismatch:
        clearancePatientId != null && clearancePatientId !== patientId,
      reconciliationException:
        String(clearance?.clearance_state ?? "") === "attention_required",
      paymentPlanActive: false,
      paymentPlanSatisfiesClearance: false,
      stripeEnabled: false,
      stripeBranchOnlyCapability: false,
      dualPaymentSourceUnresolved: false,
    },
    consentDocuments: {
      mandatoryConsentSatisfied,
      mandatoryConsentUnknown,
      consentWrongPatient: false,
      optionalDocumentMissing,
      packetId,
    },
    images: {
      requiredRoles: [],
      satisfiedRoles,
      missingRoles: [],
    },
    appointments: {
      bookings: bookingRows.map((b) => ({
        id: String(b.id),
        patientId: String(b.patient_id ?? patientId),
        bookingType: String(b.booking_type ?? "unknown"),
        bookingStatus: String(b.booking_status ?? "unknown"),
        startAt: b.start_at != null ? String(b.start_at) : null,
      })),
      staffAssignmentKnown: false,
      staffAssigned: false,
    },
    technical: {
      failedPushCount: failedPushCount ?? 0,
      repeatedFailureCount: failedPushCount ?? 0,
      expectedSuccessEventPresent: null,
      crossPatientTechnicalLinkage: false,
      lastSuccessfulJourneyEventAt: null,
    },
  };
}
