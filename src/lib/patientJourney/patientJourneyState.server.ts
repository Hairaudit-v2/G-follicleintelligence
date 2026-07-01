import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { calendarDateStringFromInstant } from "@/src/lib/calendar/calendarTimezone";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import {
  paymentRecordNeedsCollection,
  type PaymentRecordRow,
} from "@/src/lib/payments/paymentRecordModel";
import { hasConsultationConsentSignal } from "@/src/lib/surgery/surgeryReadinessBoardModel";
import {
  derivePatientJourneyNextBestAction,
  derivePatientJourneyStateFromSignals,
  detectPatientJourneyBlockers,
  isPatientJourneyTransitionAllowed,
  presentPatientJourneyState,
  reviewDueFromProcedureDate,
  targetStateForAutomationEvent,
  type PatientJourneyBlocker,
  type PatientJourneySignals,
  type PatientJourneyState,
} from "./patientJourneyStateCore";
import {
  applyPatientJourneyTransition,
  loadPatientJourneyStateRow,
  type PatientJourneyStateRow,
} from "./patientJourneyStateMutations.server";

export type PatientJourneySnapshot = {
  tenantId: string;
  patientId: string;
  state: PatientJourneyState;
  presentation: ReturnType<typeof presentPatientJourneyState>;
  derivedState: PatientJourneyState;
  persisted: PatientJourneyStateRow | null;
  blockers: PatientJourneyBlocker[];
  nextBestAction: { label: string; href: string; description: string };
  manuallyOverridden: boolean;
};

function quoteStatusFromConsultation(row: {
  status: string;
  quote_data: Record<string, unknown>;
}): { quoteSent: boolean; quoteAccepted: boolean; treatmentRecommended: boolean } {
  const st = row.status.trim().toLowerCase();
  const raw = row.quote_data?.quote_status;
  const qs = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const quoteSent = st === "quoted" || qs.includes("sent");
  const quoteAccepted = st === "accepted" || st === "converted_to_case" || qs.includes("accept");
  const treatmentRecommended =
    st === "completed" && Boolean(row.quote_data?.recommendation || row.quote_data?.treatment_line);
  return { quoteSent, quoteAccepted, treatmentRecommended };
}

export async function loadPatientJourneySignals(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PatientJourneySignals> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const pid = assertNonEmptyUuid(patientId, "patientId").trim();
  const supabase = client ?? supabaseAdmin();

  const calendarSettings = await loadTenantOperationalCalendarSettings(tid);
  const tz = calendarSettings.calendarTimezone;
  const todayYmd = calendarDateStringFromInstant(new Date(), tz);

  const [leadsRes, consultsRes, bookingsRes, paymentsRes, imagesRes, _casesRes] = await Promise.all([
    supabase
      .from("fi_crm_leads")
      .select("id, status")
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .limit(20),
    supabase
      .from("fi_consultations")
      .select("id, status, quote_data, recommendation_notes, consultation_date, archived_at")
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("fi_bookings")
      .select("id, booking_type, booking_status, start_at, end_at")
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .order("start_at", { ascending: false })
      .limit(40),
    supabase
      .from("fi_payment_records")
      .select("id, status, amount_expected, amount_paid, due_date, payment_context")
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("fi_patient_images")
      .select("id")
      .eq("tenant_id", tid)
      .eq("patient_id", pid)
      .limit(5),
    supabase
      .from("fi_cases")
      .select("id, case_status")
      .eq("tenant_id", tid)
      .eq("foundation_patient_id", pid)
      .is("deleted_at", null)
      .limit(10),
  ]);

  const leads = leadsRes.data ?? [];
  const consults = (consultsRes.data ?? []) as Array<{
    status: string;
    quote_data: Record<string, unknown>;
    recommendation_notes: string | null;
  }>;
  const bookings = bookingsRes.data ?? [];
  const payments = paymentsRes.data ?? [];

  const hasLead = leads.length > 0;
  const leadLost = leads.some((l) => String((l as { status?: string }).status ?? "").toLowerCase() === "lost");

  const consultBooked = bookings.some((b) => {
    const type = String((b as { booking_type?: string }).booking_type ?? "").toLowerCase();
    const st = String((b as { booking_status?: string }).booking_status ?? "").toLowerCase();
    return type.includes("consult") && ["scheduled", "confirmed", "arrived"].includes(st);
  });

  const consultCompleted = consults.some((c) =>
    ["completed", "quoted", "accepted", "converted_to_case"].includes(c.status.trim().toLowerCase())
  );

  let quoteSent = false;
  let quoteAccepted = false;
  let treatmentRecommended = false;
  for (const c of consults) {
    const qd =
      c.quote_data && typeof c.quote_data === "object" && !Array.isArray(c.quote_data)
        ? (c.quote_data as Record<string, unknown>)
        : {};
    const mapped = quoteStatusFromConsultation({ status: c.status, quote_data: qd });
    quoteSent = quoteSent || mapped.quoteSent;
    quoteAccepted = quoteAccepted || mapped.quoteAccepted;
    treatmentRecommended =
      treatmentRecommended ||
      mapped.treatmentRecommended ||
      Boolean(c.recommendation_notes?.trim());
  }

  const depositPaid = (payments ?? []).some((p) => {
    const row = p as {
      status: string;
      amount_expected: number;
      amount_paid: number;
      due_date: string | null;
      payment_context: string;
    };
    if (!String(row.payment_context ?? "").toLowerCase().includes("surgery")) return false;
    return (
      !paymentRecordNeedsCollection(row as Pick<PaymentRecordRow, "status" | "amount_expected" | "amount_paid" | "due_date">, todayYmd) &&
      Number(row.amount_paid) > 0
    );
  });

  const surgeryBookings = bookings.filter((b) => {
    const type = String((b as { booking_type?: string }).booking_type ?? "").toLowerCase();
    return type.includes("surgery") || type.includes("procedure");
  });

  const activeSurgery = surgeryBookings.find((b) => {
    const st = String((b as { booking_status?: string }).booking_status ?? "").toLowerCase();
    return ["scheduled", "confirmed", "arrived"].includes(st);
  });

  const completedSurgery = surgeryBookings.find((b) => {
    const st = String((b as { booking_status?: string }).booking_status ?? "").toLowerCase();
    return st === "completed";
  });

  const surgeryDateYmd = activeSurgery
    ? calendarDateStringFromInstant(new Date(String((activeSurgery as { start_at: string }).start_at)), tz)
    : null;

  const procedureDayToday = Boolean(
    activeSurgery &&
      surgeryDateYmd === todayYmd &&
      ["scheduled", "confirmed", "arrived"].includes(
        String((activeSurgery as { booking_status?: string }).booking_status ?? "").toLowerCase()
      )
  );

  const procedureCompleted = Boolean(completedSurgery);

  const followUpBooked = bookings.some((b) => {
    const type = String((b as { booking_type?: string }).booking_type ?? "").toLowerCase();
    const st = String((b as { booking_status?: string }).booking_status ?? "").toLowerCase();
    return (type.includes("follow") || type.includes("review")) && ["scheduled", "confirmed"].includes(st);
  });

  let reviewFlags = {
    postOpFollowUpDue: false,
    threeMonthReviewDue: false,
    sixMonthReviewDue: false,
    twelveMonthAuditDue: false,
  };
  if (completedSurgery) {
    const procYmd = calendarDateStringFromInstant(
      new Date(String((completedSurgery as { start_at: string }).start_at)),
      tz
    );
    reviewFlags = reviewDueFromProcedureDate(procYmd, todayYmd);
  }

  const consentSigned = hasConsultationConsentSignal(
    consults.map((c) => ({
      status: c.status,
      quote_data:
        c.quote_data && typeof c.quote_data === "object" && !Array.isArray(c.quote_data)
          ? (c.quote_data as Record<string, unknown>)
          : {},
    }))
  );

  const imagingComplete = (imagesRes.data ?? []).length > 0;

  const hasRecentActivity =
    consultBooked ||
    consultCompleted ||
    Boolean(activeSurgery) ||
    procedureCompleted ||
    (bookingsRes.data ?? []).some((b) => {
      const st = String((b as { booking_status?: string }).booking_status ?? "").toLowerCase();
      return st !== "cancelled";
    });

  return {
    hasLead,
    leadLost,
    consultBooked,
    consultCompleted,
    treatmentRecommended,
    quoteSent,
    quoteAccepted,
    depositPaid,
    surgeryBooked: Boolean(activeSurgery),
    surgeryDateYmd,
    preOpChecklistComplete: quoteAccepted && depositPaid && consentSigned,
    surgeryReadinessReady:
      Boolean(activeSurgery) && depositPaid && consentSigned && imagingComplete,
    procedureDayToday,
    procedureCompleted,
    ...reviewFlags,
    hasRecentActivity,
    imagingComplete,
    consentSigned,
    followUpBooked,
  };
}

export async function loadPatientJourneySnapshot(
  tenantId: string,
  patientId: string,
  client?: SupabaseClient
): Promise<PatientJourneySnapshot> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const pid = assertNonEmptyUuid(patientId, "patientId").trim();
  const basePath = `/fi-admin/${tid}/patients/${pid}`;

  const [signals, persisted] = await Promise.all([
    loadPatientJourneySignals(tid, pid, client),
    loadPatientJourneyStateRow(tid, pid, client),
  ]);

  const derivedState = derivePatientJourneyStateFromSignals(signals);

  let state = derivedState;
  let manuallyOverridden = false;
  if (persisted) {
    const overrideActive =
      persisted.manuallyOverriddenBy &&
      (!persisted.overrideExpiresAt || Date.parse(persisted.overrideExpiresAt) > Date.now());
    if (overrideActive) {
      state = persisted.currentState;
      manuallyOverridden = true;
    } else {
      state = derivedState;
    }
  }

  const presentation = presentPatientJourneyState(state);
  const blockers = detectPatientJourneyBlockers({
    state,
    signals,
    hrefs: {
      missing_consent: `${basePath}/consultations`,
      unpaid_deposit: `/fi-admin/${tid}/financial/dashboard`,
      no_surgery_date: `/fi-admin/${tid}/surgery-booking`,
      missing_images: `${basePath}/imaging`,
      incomplete_pre_op_checklist: `/fi-admin/${tid}/surgery-readiness`,
      missing_follow_up_booking: `/fi-admin/${tid}/calendar`,
    },
  });
  const nextBestAction = derivePatientJourneyNextBestAction({
    state,
    blockers,
    basePath: `/fi-admin/${tid}`,
  });

  return {
    tenantId: tid,
    patientId: pid,
    state,
    presentation,
    derivedState,
    persisted,
    blockers,
    nextBestAction,
    manuallyOverridden,
  };
}

export async function syncPatientJourneyStateFromRecords(
  tenantId: string,
  patientId: string,
  reason = "automation_sync",
  client?: SupabaseClient
): Promise<{ changed: boolean; snapshot: PatientJourneySnapshot }> {
  const snapshot = await loadPatientJourneySnapshot(tenantId, patientId, client);
  const result = await applyPatientJourneyTransition({
    tenantId,
    patientId,
    toState: snapshot.derivedState,
    reason,
    source: "automatic",
    derivedState: snapshot.derivedState,
    client,
  });
  const refreshed = await loadPatientJourneySnapshot(tenantId, patientId, client);
  return { changed: result.changed, snapshot: refreshed };
}

export async function loadPatientJourneySnapshotsForPatients(
  tenantId: string,
  patientIds: string[],
  client?: SupabaseClient
): Promise<Map<string, PatientJourneySnapshot>> {
  const out = new Map<string, PatientJourneySnapshot>();
  const unique = [...new Set(patientIds.map((id) => id.trim()).filter(Boolean))];
  await Promise.all(
    unique.map(async (pid) => {
      try {
        const snap = await loadPatientJourneySnapshot(tenantId, pid, client);
        out.set(pid, snap);
      } catch {
        /* skip failed patient */
      }
    })
  );
  return out;
}

export async function advancePatientJourneyOnEvent(input: {
  tenantId: string;
  patientId: string;
  event: string;
  reason?: string;
  leadId?: string | null;
  caseId?: string | null;
  actorFiUserId?: string | null;
  client?: SupabaseClient;
}): Promise<{ applied: boolean; state: PatientJourneyState | null }> {
  const target = targetStateForAutomationEvent(input.event);
  if (!target) return { applied: false, state: null };

  const tid = input.tenantId.trim();
  const pid = input.patientId.trim();
  const snapshot = await loadPatientJourneySnapshot(tid, pid, input.client);

  if (!snapshot.manuallyOverridden) {
    const derived = derivePatientJourneyStateFromSignals(
      await loadPatientJourneySignals(tid, pid, input.client)
    );
    const toState = derived;
    if (toState === snapshot.state) return { applied: false, state: toState };
    await applyPatientJourneyTransition({
      tenantId: tid,
      patientId: pid,
      toState,
      reason: input.reason ?? input.event,
      source: "automatic",
      leadId: input.leadId,
      caseId: input.caseId,
      actorFiUserId: input.actorFiUserId,
      derivedState: derived,
      client: input.client,
    });
    return { applied: true, state: toState };
  }

  const from = snapshot.state;
  if (!isPatientJourneyTransitionAllowed(from, target, false)) {
    return { applied: false, state: from };
  }

  await applyPatientJourneyTransition({
    tenantId: tid,
    patientId: pid,
    toState: target,
    reason: input.reason ?? input.event,
    source: "automatic",
    leadId: input.leadId,
    caseId: input.caseId,
    actorFiUserId: input.actorFiUserId,
    client: input.client,
  });
  return { applied: true, state: target };
}