/**
 * FI-PATIENT-APP-1D — patient gateway journey read model.
 * Identity/tenant always come from PatientGatewayContext (never client patientId).
 * P1: enriches with milestones + primary action override (never fails base journey).
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBookingsForPatient } from "@/src/lib/bookings/bookings";
import { isBookingCancelled } from "@/src/lib/bookings/bookingPolicy";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import {
  derivePatientJourneyStateFromSignals,
  type PatientJourneyState,
} from "@/src/lib/patientJourney/patientJourneyStateCore";
import { loadPatientJourneySignals } from "@/src/lib/patientJourney/patientJourneyState.server";
import { loadPatientJourneyStateRow } from "@/src/lib/patientJourney/patientJourneyStateMutations.server";
import { listPatientActionsForGateway } from "@/src/lib/patientJourneyControl/patientActionEngine.server";
import { nextActionTypeFromKind } from "@/src/lib/patientJourneyControl/patientActionEngineCore";
import { derivePatientJourneyMilestones } from "@/src/lib/patientJourneyControl/patientJourneyMilestoneCore";

import { writePatientGatewayAudit } from "./patientGatewayAudit.server";
import { patientGatewayDeny } from "./patientGatewayGateCore";
import {
  buildPatientGatewayJourneyResponse,
  type PatientGatewayJourneyAppointmentHint,
  type PatientGatewayJourneyResponse,
  type PatientGatewayMilestone,
  type PatientGatewayNextAction,
} from "./patientGatewayJourneyCore";
import type { PatientGatewayContext, PatientGatewayDeny } from "./patientGatewayTypes";

export type LoadPatientGatewayJourneyOptions = {
  supabase?: SupabaseClient;
  writeAudit?: boolean;
  nowIso?: string;
  loadSignals?: typeof loadPatientJourneySignals;
  loadPersisted?: typeof loadPatientJourneyStateRow;
  loadBookings?: typeof loadBookingsForPatient;
};

type JourneyWorkflowFlags = {
  quoteDelivered: boolean;
  quoteViewed: boolean;
  bloodRequestIssued: boolean;
  resultsReceived: boolean;
  clinicalReviewComplete: boolean;
  documentsComplete: boolean;
  pathologyCleared: boolean;
};

function resolveJourneyState(
  derived: PatientJourneyState,
  persisted: Awaited<ReturnType<typeof loadPatientJourneyStateRow>>
): PatientJourneyState {
  if (!persisted) return derived;
  const overrideActive =
    Boolean(persisted.manuallyOverriddenBy) &&
    (!persisted.overrideExpiresAt || Date.parse(persisted.overrideExpiresAt) > Date.now());
  return overrideActive ? persisted.currentState : derived;
}

function upcomingHintsFromBookings(
  rows: Awaited<ReturnType<typeof loadBookingsForPatient>>,
  nowIso: string
): PatientGatewayJourneyAppointmentHint[] {
  const nowMs = Date.parse(nowIso);
  return rows
    .filter((b) => {
      if (isBookingCancelled(b)) return false;
      const st = b.booking_status.trim().toLowerCase();
      if (st === "completed" || st === "no_show") return false;
      const startMs = Date.parse(b.start_at);
      return Number.isFinite(startMs) && startMs >= nowMs;
    })
    .map((b) => ({
      id: b.id,
      startAt: b.start_at,
      type: b.booking_type,
      title: b.title?.trim() || bookingTypeLabel(b.booking_type),
    }));
}

/**
 * Best-effort workflow flags from quotes / pathology / documents.
 * Never throws — missing tables/columns yield safe defaults.
 */
async function loadJourneyWorkflowFlags(
  tenantId: string,
  patientId: string,
  supabase: SupabaseClient
): Promise<JourneyWorkflowFlags> {
  const flags: JourneyWorkflowFlags = {
    quoteDelivered: false,
    quoteViewed: false,
    bloodRequestIssued: false,
    resultsReceived: false,
    clinicalReviewComplete: false,
    documentsComplete: false,
    pathologyCleared: false,
  };

  try {
    const { data: quotes } = await supabase
      .from("fi_crm_quotes")
      .select("status, delivered_at, first_viewed_at, last_viewed_at, sent_at, patient_id")
      .eq("tenant_id", tenantId)
      .eq("patient_id", patientId)
      .order("updated_at", { ascending: false })
      .limit(5);
    for (const q of quotes ?? []) {
      const row = q as Record<string, unknown>;
      if (row.delivered_at || row.sent_at) flags.quoteDelivered = true;
      if (row.first_viewed_at || row.last_viewed_at) flags.quoteViewed = true;
    }
  } catch {
    /* ignore */
  }

  try {
    const { data: requests } = await supabase
      .from("fi_pathology_requests")
      .select("issued_at, workflow_status, status, created_at")
      .eq("tenant_id", tenantId)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(5);
    for (const r of requests ?? []) {
      const row = r as Record<string, unknown>;
      if (row.issued_at || row.workflow_status || row.status) flags.bloodRequestIssued = true;
    }
  } catch {
    /* ignore */
  }

  try {
    const { data: results } = await supabase
      .from("fi_pathology_results")
      .select(
        "patient_summary_approved_at, clearance_status, clinical_review_completed_at, status"
      )
      .eq("tenant_id", tenantId)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(5);
    for (const r of results ?? []) {
      const row = r as Record<string, unknown>;
      flags.resultsReceived = true;
      if (row.patient_summary_approved_at || row.clinical_review_completed_at) {
        flags.clinicalReviewComplete = true;
      }
      const clearance = String(row.clearance_status ?? "").toLowerCase();
      if (clearance === "cleared" || clearance === "clear") flags.pathologyCleared = true;
    }
  } catch {
    /* ignore */
  }

  try {
    const { data: packets } = await supabase
      .from("fi_patient_document_packets")
      .select("status, signed_at")
      .eq("tenant_id", tenantId)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(5);
    for (const p of packets ?? []) {
      const row = p as Record<string, unknown>;
      const st = String(row.status ?? "").toLowerCase();
      if (row.signed_at || st === "signed" || st === "completed") {
        flags.documentsComplete = true;
      }
    }
  } catch {
    /* ignore */
  }

  return flags;
}

/**
 * Load a deterministic patient-safe journey for the authenticated gateway patient.
 */
export async function loadPatientGatewayJourney(
  ctx: PatientGatewayContext,
  options?: LoadPatientGatewayJourneyOptions
): Promise<PatientGatewayJourneyResponse | PatientGatewayDeny> {
  const writeAudit = options?.writeAudit !== false;
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const loadSignals = options?.loadSignals ?? loadPatientJourneySignals;
  const loadPersisted = options?.loadPersisted ?? loadPatientJourneyStateRow;
  const loadBookings = options?.loadBookings ?? loadBookingsForPatient;

  try {
    const [signals, persisted, bookings] = await Promise.all([
      loadSignals(ctx.tenantId, ctx.patientId, options?.supabase),
      loadPersisted(ctx.tenantId, ctx.patientId, options?.supabase),
      loadBookings(ctx.tenantId, ctx.patientId, options?.supabase),
    ]);

    const derived = derivePatientJourneyStateFromSignals(signals);
    const state = resolveJourneyState(derived, persisted);

    let milestones: PatientGatewayMilestone[] = [];
    let primaryActionOverride: PatientGatewayNextAction | undefined;

    try {
      const supabase = options?.supabase ?? supabaseAdmin();
      const flags = await loadJourneyWorkflowFlags(ctx.tenantId, ctx.patientId, supabase);

      let quoteReviewOpen = false;
      let depositActionOpen = false;
      let bloodActionOpen = false;
      let documentActionOpen = false;
      let pathologyAwaitingClinic = false;

      const actionsResult = await listPatientActionsForGateway(ctx, {
        supabase,
        nowIso,
      });

      if (actionsResult.ok) {
        const openKinds = new Set(
          [...actionsResult.actionRequired, ...actionsResult.upcoming]
            .filter((a) => a.status === "open" || a.status === "in_progress")
            .map((a) => a.kind)
        );
        quoteReviewOpen =
          openKinds.has("review_quote") || openKinds.has("accept_quote");
        depositActionOpen = openKinds.has("pay_deposit");
        bloodActionOpen = openKinds.has("complete_blood_tests");
        documentActionOpen = openKinds.has("sign_document");
        pathologyAwaitingClinic = openKinds.has("await_pathology_review");

        const primary = actionsResult.primaryAction;
        if (primary) {
          primaryActionOverride = {
            type: nextActionTypeFromKind(primary.kind),
            label: primary.title,
            dueAt: primary.dueAt,
            actionKey: `action:${primary.id}`,
            actionId: primary.id,
            deepLinkKey: primary.deepLinkKey ?? undefined,
            resourceId: primary.resourceId ?? undefined,
          };
        }
      }

      milestones = derivePatientJourneyMilestones({
        signals: {
          consultCompleted: signals.consultCompleted,
          treatmentRecommended: signals.treatmentRecommended,
          quoteDelivered: flags.quoteDelivered || signals.quoteSent,
          quoteAccepted: signals.quoteAccepted,
          depositPaid: signals.depositPaid,
          bloodRequestIssued: flags.bloodRequestIssued,
          pathologyResultsReceived: flags.resultsReceived,
          clinicalReviewCompleted: flags.clinicalReviewComplete,
          surgeryBooked: signals.surgeryBooked,
          preSurgeryDocumentsCompleted: flags.documentsComplete,
          surgeryReadinessReady: signals.surgeryReadinessReady,
          quoteReviewOpen,
          depositActionOpen,
          bloodActionOpen,
          documentActionOpen,
          pathologyAwaitingClinic,
        },
        nowIso,
      });
    } catch {
      // Never fail base journey on enrichment errors.
      milestones = [];
      primaryActionOverride = undefined;
    }

    const response = buildPatientGatewayJourneyResponse({
      state,
      signals,
      upcomingAppointments: upcomingHintsFromBookings(bookings, nowIso),
      nowIso,
      milestones,
      primaryActionOverride,
    });

    if (writeAudit) {
      writePatientGatewayAudit({
        action: "journey_read_success",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "journey",
      });
    }

    return response;
  } catch {
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "journey_read_denied",
        outcome: "deny",
        code: "misconfigured",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "journey",
      });
    }
    return patientGatewayDeny("misconfigured", 500, "Could not load journey.");
  }
}
