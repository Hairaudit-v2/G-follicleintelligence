import "server-only";

import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { computeTomorrowOperationalWindow } from "@/src/lib/clinicOs/tomorrowBoardModel";
import {
  loadReceptionBoardCards,
  loadTenantOperationalDashboard,
} from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { computeOperationalLocalDayUtcWindow } from "@/src/lib/fiOs/tenantOperationalLocalDay";
import {
  beginFiPerfCollection,
  finishFiPerfCollection,
  recordFiPerfPayloadBytes,
  withFiPerfSpan,
} from "@/src/lib/performance/fiPerfCollector.server";
import { loadReceptionShellBootstrapCached } from "@/src/lib/performance/referenceDataCache.server";
import { loadReceptionOsBoardPayload } from "@/src/lib/receptionOs/receptionOsBoardLoader.server";
import { loadSurgeryReadinessBoardPayload } from "@/src/lib/surgery/surgeryReadinessBoardLoader.server";
import type { SurgeryReadinessBoardCard } from "@/src/lib/surgery/surgeryReadinessBoardLoader.server";
import { loadPatientJourneySnapshotsForPatients } from "@/src/lib/patientJourney/patientJourneyState.server";
import { PATIENT_JOURNEY_STATE_LABELS } from "@/src/lib/patientJourney/patientJourneyStateCore";
import {
  buildAppointmentCard,
  buildCalendarSchedulingConflictAlerts,
  buildExtendedAlertsFromSurgeryCards,
  buildIntelligenceMetrics,
  buildLiveActivityFeed,
  buildQueueBoard,
  buildQuickActions,
  mapOsAlertToBoardAlert,
  mapTomorrowSurgeryCard,
  sortActionAlerts,
  sortAppointmentsChronologically,
} from "./receptionBoardCore";
import { readFiProcedureDayEnabled } from "@/src/lib/procedureDay/procedureDayEnv.server";
import { appendProcedureDayQuickActionIfEnabled } from "@/src/lib/procedureDay/procedureDayReceptionCore";

import type { ReceptionBoardCommandCenterPayload } from "./receptionBoardTypes";

async function loadBookingCaseIds(
  tenantId: string,
  bookingIds: string[]
): Promise<Map<string, string>> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const out = new Map<string, string>();
  if (!bookingIds.length) return out;

  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_bookings")
    .select("id, tenant_id, case_id")
    .eq("tenant_id", tid)
    .in("id", bookingIds);
  if (error) throw new Error(error.message);

  for (const raw of data ?? []) {
    const r = raw as { id: string; tenant_id: string; case_id: string | null };
    const rowTenant = String(r.tenant_id ?? "").trim();
    if (rowTenant && rowTenant !== tid) {
      throw new Error("Cross-tenant booking row detected.");
    }
    const caseId = r.case_id?.trim();
    if (caseId) out.set(String(r.id), caseId);
  }
  return out;
}

function collectSurgeryCards(
  payload: Awaited<ReturnType<typeof loadSurgeryReadinessBoardPayload>>
): SurgeryReadinessBoardCard[] {
  return [
    ...payload.columns.ready,
    ...payload.columns.needs_attention,
    ...payload.columns.high_risk,
    ...payload.columns.missing_pathology,
    ...payload.columns.missing_consent,
    ...payload.columns.on_hold_not_linked,
  ];
}

export type LoadReceptionBoardCommandCenterOptions = {
  /** When set, enforces CRM tenant read gate (API routes). Page loader uses portal gate separately. */
  enforceCrmReadGate?: boolean;
  adminKey?: string;
  request?: Request;
  /** shell = first paint (~today's schedule only); full = enrichment for alerts, journey, surgery prep */
  tier?: "shell" | "full";
};

function emptyIntelligenceMetrics(): ReceptionBoardCommandCenterPayload["intelligence"] {
  return {
    todayConsultations: 0,
    todaySurgeries: 0,
    revenueBookedToday: 0,
    outstandingPayments: 0,
    conversionRateToday: null,
    doctorUtilizationPercent: null,
    staffUtilizationPercent: null,
    averageConsultationCloseRate: null,
    upcomingFollowUps: 0,
    unreadPatientTasks: 0,
  };
}

/**
 * Fast path for first usable paint — today's schedule + queue only (~10–15 queries).
 * Client hydrates full payload via `/api/tenants/.../reception-board`.
 */
export async function loadReceptionBoardShellPayload(
  tenantId: string,
  now: Date = new Date()
): Promise<ReceptionBoardCommandCenterPayload> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const base = `/fi-admin/${tid}`;
  beginFiPerfCollection("reception_board_shell", tid);

  try {
    const bootstrap = await withFiPerfSpan("tenant.bootstrap", () =>
      loadReceptionShellBootstrapCached(tid)
    );
    const calendarTimezone = bootstrap.calendarTimezone;
    const operationalDay = computeOperationalLocalDayUtcWindow(now, calendarTimezone);

    const cards = await withFiPerfSpan("reception.cards", () =>
      loadReceptionBoardCards(
        tid,
        operationalDay.localStartIso,
        operationalDay.localEndIso,
        { enrichment: "shell" }
      )
    );

    // Case ids hydrate on full tier — avoids an extra round-trip on cold shell paint.
    const caseByBooking = new Map<string, string>();

    const appointments = sortAppointmentsChronologically(
      cards.map((card) =>
        buildAppointmentCard(card, {
          base,
          tz: calendarTimezone,
          caseId: caseByBooking.get(card.id) ?? null,
          paymentStatus: "unknown",
        })
      )
    );

    const queue = buildQueueBoard(cards, {
      base,
      tz: calendarTimezone,
      caseByBooking,
    });

    const actionAlerts = sortActionAlerts(
      buildCalendarSchedulingConflictAlerts(cards, base)
    ).slice(0, 40);

    const payload: ReceptionBoardCommandCenterPayload = {
      tenantId: tid,
      tenantName: bootstrap.tenantName,
      loadedAt: now.toISOString(),
      operationalDay: {
        calendarTimezone,
        todayYmd: operationalDay.todayYmd,
        localStartIso: operationalDay.localStartIso,
        localEndIso: operationalDay.localEndIso,
      },
      appointments,
      queue,
      actionAlerts,
      quickActions: appendProcedureDayQuickActionIfEnabled(
        buildQuickActions(base),
        base,
        readFiProcedureDayEnabled()
      ),
      tomorrowSurgeries: [],
      intelligence: emptyIntelligenceMetrics(),
      liveEvents: [],
      receptionCards: cards,
      loadTier: "shell",
    };

    recordFiPerfPayloadBytes(JSON.stringify(payload).length);
    return payload;
  } finally {
    finishFiPerfCollection();
  }
}

/**
 * Reception Board Command Center orchestrator — composes CalendarOS, SurgeryOS, ReceptionOS,
 * and tenant operational dashboard without duplicating domain logic.
 */
export async function loadReceptionBoardCommandCenterPayload(
  tenantId: string,
  now: Date = new Date(),
  options: LoadReceptionBoardCommandCenterOptions = {}
): Promise<ReceptionBoardCommandCenterPayload> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const tier = options.tier ?? "full";

  if (tier === "shell") {
    return loadReceptionBoardShellPayload(tid, now);
  }

  if (options.enforceCrmReadGate) {
    await assertCrmTenantReadAllowed({
      tenantId: tid,
      adminKey: options.adminKey,
      request: options.request,
    });
  }

  beginFiPerfCollection("reception_board_full", tid);

  const base = `/fi-admin/${tid}`;

  try {

  const [operational, surgeryPayload] = await Promise.all([
    loadTenantOperationalDashboard(tid, { includeReceptionBoard: true }),
    loadSurgeryReadinessBoardPayload(tid, now),
  ]);

  const tz = operational.operationalDay.calendarTimezone;
  const tomorrowWindow = computeTomorrowOperationalWindow(now, tz);
  const cards = operational.receptionBoard.cards;
  const bookingIds = cards.map((c) => c.id);
  const patientIds = cards.map((c) => c.patientId).filter((id): id is string => Boolean(id?.trim()));

  const caseByBookingPromise = loadBookingCaseIds(tid, bookingIds);

  const [caseByBooking, journeyByPatient, receptionOsBoard] = await Promise.all([
    caseByBookingPromise,
    loadPatientJourneySnapshotsForPatients(tid, patientIds),
    caseByBookingPromise.then((caseMap) =>
      loadReceptionOsBoardPayload(tid, now, {
        operational,
        surgeryPayload,
        caseByBooking: caseMap,
      })
    ),
  ]);

  const outstandingPaymentIds = new Set(
    receptionOsBoard.outstandingDeposits.map((d) => d.id)
  );
  const overdueIds = new Set(
    receptionOsBoard.outstandingDeposits.filter((d) => d.isOverdue).map((d) => d.id)
  );

  const appointments = sortAppointmentsChronologically(
    cards.map((card) => {
      let paymentStatus: ReturnType<typeof buildAppointmentCard>["paymentStatus"] = "unknown";
      const bookingPayments = receptionOsBoard.outstandingDeposits.filter(
        (d) => d.hrefs.patient === (card.patientId ? `${base}/patients/${card.patientId}` : null)
      );
      if (bookingPayments.some((d) => overdueIds.has(d.id))) paymentStatus = "overdue";
      else if (bookingPayments.some((d) => outstandingPaymentIds.has(d.id))) paymentStatus = "due";
      else if (card.bookingType.toLowerCase().includes("surgery")) paymentStatus = "not_required";

      const journey = card.patientId ? journeyByPatient.get(card.patientId) : undefined;

      return buildAppointmentCard(card, {
        base,
        tz,
        caseId: caseByBooking.get(card.id) ?? null,
        paymentStatus,
        journeyState: journey?.state ?? null,
        journeyStateLabel: journey
          ? PATIENT_JOURNEY_STATE_LABELS[journey.state]
          : null,
      });
    })
  );

  const blockerKindMap: Record<string, import("./receptionBoardTypes").ReceptionBoardExtendedAlertKind> = {
    missing_consent: "missing_consent",
    unpaid_deposit: "missing_deposit",
    no_surgery_date: "unconfirmed_surgery",
    missing_images: "missing_imaging",
    incomplete_pre_op_checklist: "missing_pre_op_checklist",
    missing_follow_up_booking: "no_follow_up_after_consultation",
    missing_medical_clearance: "missing_medical_clearance",
  };
  const journeyBlockerAlerts = [...journeyByPatient.values()].flatMap((snap) =>
    snap.blockers.map((b) => ({
      id: `journey-${snap.patientId}-${b.kind}`,
      kind: blockerKindMap[b.kind] ?? "surgery_readiness_incomplete",
      title: b.label,
      detail: `${snap.presentation.label} · patient blocker`,
      severity: b.severity === "critical" ? ("critical" as const) : ("warning" as const),
      href: b.href,
      priorityScore: b.severity === "critical" ? 96 : 78,
    }))
  );

  const queue = buildQueueBoard(cards, { base, tz, caseByBooking });
  const surgeryCards = collectSurgeryCards(surgeryPayload);

  const osAlerts = receptionOsBoard.actionAlerts.map(mapOsAlertToBoardAlert);
  const surgeryAlerts = buildExtendedAlertsFromSurgeryCards(
    surgeryCards,
    base,
    tomorrowWindow.tomorrowYmd
  );
  const calendarConflictAlerts = buildCalendarSchedulingConflictAlerts(cards, base);
  const actionAlerts = sortActionAlerts([
    ...osAlerts,
    ...surgeryAlerts,
    ...journeyBlockerAlerts,
    ...calendarConflictAlerts,
  ]).slice(0, 40);

  const tomorrowSurgeries = surgeryCards
    .map((c) => mapTomorrowSurgeryCard(c, tomorrowWindow.tomorrowYmd))
    .filter((c): c is NonNullable<typeof c> => c != null)
    .sort((a, b) => a.surgeryTime.localeCompare(b.surgeryTime));

  const intelligence = buildIntelligenceMetrics({
    cards,
    revenueBookedToday: receptionOsBoard.outstandingDeposits.reduce(
      (sum, d) => sum + d.amountPaid,
      0
    ),
    outstandingPayments: receptionOsBoard.outstandingDeposits.length,
    conversionRateToday: null,
    upcomingFollowUps: receptionOsBoard.actionAlerts.filter(
      (a) => a.kind === "no_follow_up_after_consultation"
    ).length,
    unreadPatientTasks: 0,
  });

  const liveEvents = buildLiveActivityFeed({
    cards,
    communicationEvents: receptionOsBoard.communicationTimeline,
    base,
    loadedAt: now.toISOString(),
  });

  const payload: ReceptionBoardCommandCenterPayload = {
    tenantId: tid,
    tenantName: operational.tenantName,
    loadedAt: now.toISOString(),
    operationalDay: operational.operationalDay,
    appointments,
    queue,
    actionAlerts,
    quickActions: appendProcedureDayQuickActionIfEnabled(
      buildQuickActions(base),
      base,
      readFiProcedureDayEnabled()
    ),
    tomorrowSurgeries,
    intelligence,
    liveEvents,
    receptionCards: cards,
    loadTier: "full",
  };
  recordFiPerfPayloadBytes(JSON.stringify(payload).length);
  return payload;
  } finally {
    finishFiPerfCollection();
  }
}