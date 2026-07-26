/**
 * FI-PATIENT-APP-1D — patient gateway journey read model.
 * Identity/tenant always come from PatientGatewayContext (never client patientId).
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadBookingsForPatient } from "@/src/lib/bookings/bookings";
import { isBookingCancelled } from "@/src/lib/bookings/bookingPolicy";
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import {
  derivePatientJourneyStateFromSignals,
  type PatientJourneyState,
} from "@/src/lib/patientJourney/patientJourneyStateCore";
import { loadPatientJourneySignals } from "@/src/lib/patientJourney/patientJourneyState.server";
import { loadPatientJourneyStateRow } from "@/src/lib/patientJourney/patientJourneyStateMutations.server";

import { writePatientGatewayAudit } from "./patientGatewayAudit.server";
import { patientGatewayDeny } from "./patientGatewayGateCore";
import {
  buildPatientGatewayJourneyResponse,
  type PatientGatewayJourneyAppointmentHint,
  type PatientGatewayJourneyResponse,
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

    const response = buildPatientGatewayJourneyResponse({
      state,
      signals,
      upcomingAppointments: upcomingHintsFromBookings(bookings, nowIso),
      nowIso,
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
