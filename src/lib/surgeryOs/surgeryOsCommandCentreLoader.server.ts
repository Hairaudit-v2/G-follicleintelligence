import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { computeProcedureDayBoardWindow } from "@/src/lib/surgery/procedureDayBoardModel";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";
import { resolveSurgeryOsViewerContext } from "@/src/lib/surgeryOs/surgeryOsAccess.server";
import {
  assertSurgeryOsTenantRowScope,
  compareSurgeryOsSeverity,
  computeReadinessPercent,
  computeReadinessRiskLevel,
  deriveSurgeryAlerts,
  SURGERY_OS_ASSIGNMENT_STATUS_LABELS,
  SURGERY_OS_LIVE_STATUS_LABELS,
  SURGERY_OS_NOTE_KIND_LABELS,
  SURGERY_OS_PROCEDURE_EVENT_LABELS,
  SURGERY_OS_PROCEDURE_PHASE_LABELS,
  SURGERY_OS_READINESS_CHECKLIST_KEYS,
  SURGERY_OS_READINESS_CHECKLIST_LABELS,
  SURGERY_OS_READINESS_RISK_LABELS,
  SURGERY_OS_TEAM_ROLE_LABELS,
  type SurgeryOsAssignmentStatus,
  type SurgeryOsLiveStatus,
  type SurgeryOsNoteKind,
  type SurgeryOsProcedureEventKind,
  type SurgeryOsProcedurePhase,
  type SurgeryOsReadinessChecklist,
  type SurgeryOsTeamRole,
} from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import type {
  SurgeryOsAlert,
  SurgeryOsCommandCentrePayload,
  SurgeryOsGraftCountEvent,
  SurgeryOsGraftSummary,
  SurgeryOsLiveSurgery,
  SurgeryOsOperationalNote,
  SurgeryOsProcedureTimelineEvent,
  SurgeryOsReadinessSnapshot,
  SurgeryOsTeamMember,
} from "@/src/lib/surgeryOs/surgeryOsBoardModel.types";
import {
  computeGraftProgressPercent,
  computeConfirmedTrayTotals,
  countTrayReviewBuckets,
  deriveGraftAlerts,
  deriveTrayReviewStatuses,
  isSurgeryStatusEligibleForGraftCounting,
  parseTrayNumberFromNote,
  resolveGraftCountSessionLock,
  SURGERY_OS_GRAFT_COUNT_EVENT_TYPE_LABELS,
  SURGERY_OS_GRAFT_RECONCILIATION_STATUS_LABELS,
  SURGERY_OS_GRAFT_SESSION_PHASE_LABELS,
  type SurgeryOsGraftReconciliationStatus,
  type SurgeryOsGraftSessionPhase,
} from "@/src/lib/surgeryOs/surgeryOsGraftModel";
import { graftSessionToTotals, loadGraftCountEventsForSurgeries, loadGraftSessionsForSurgeries } from "@/src/lib/surgeryOs/surgeryGraftMutations.server";
import { surgeryOsCommandCentrePayloadSchema } from "@/src/lib/surgeryOs/surgeryOsBoardPayloadSchema";
import { loadSurgeryOsVieCaptureSummaries } from "@/src/lib/surgeryOs/surgeryOsVieCapture.server";
import {
  emptySurgeryOsIntelligence,
  isMissingDatabaseRelationError,
  normalizeLoaderErrorMessage,
} from "@/src/lib/surgeryOs/surgeryOsLoaderResilience";

type SurgeryRow = {
  id: string;
  tenant_id: string;
  patient_id: string | null;
  case_id: string | null;
  booking_id: string | null;
  surgeon_fi_user_id: string | null;
  status: string;
  live_status: string;
  procedure_phase: string;
  target_grafts: number | null;
  scheduled_date: string;
  scheduled_start_at: string | null;
  readiness_percent: number;
  readiness_risk_level: string;
  readiness_checklist: unknown;
};

type ProcedureEventRow = {
  id: string;
  tenant_id: string;
  surgery_id: string;
  event_kind: string;
  occurred_at: string;
  recorded_by_fi_user_id: string | null;
};

type TeamAssignmentRow = {
  id: string;
  tenant_id: string;
  surgery_id: string;
  fi_user_id: string;
  role: string;
  assignment_status: string;
};

type OperationalNoteRow = {
  id: string;
  tenant_id: string;
  surgery_id: string;
  note_kind: string;
  severity: string;
  body: string;
  recorded_at: string;
  recorded_by_fi_user_id: string | null;
};

const ACTIVE_SURGERY_STATUSES = ["scheduled", "pre_op", "in_progress", "paused"] as const;

function uniqueStrings(ids: (string | null | undefined)[]): string[] {
  const s = new Set<string>();
  for (const id of ids) {
    if (id?.trim()) s.add(id.trim());
  }
  return Array.from(s);
}

function parseChecklist(raw: unknown): SurgeryOsReadinessChecklist {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: SurgeryOsReadinessChecklist = {};
  for (const key of SURGERY_OS_READINESS_CHECKLIST_KEYS) {
    if (typeof src[key] === "boolean") out[key] = src[key];
  }
  return out;
}

async function loadPatientLabels(
  supabase: SupabaseClient,
  tenantId: string,
  patientIds: string[],
): Promise<Map<string, string>> {
  const tid = tenantId.trim();
  const ids = uniqueStrings(patientIds);
  const out = new Map<string, string>();
  if (!ids.length) return out;

  const { data: patients, error: pErr } = await supabase
    .from("fi_patients")
    .select("id, person_id")
    .eq("tenant_id", tid)
    .in("id", ids);
  if (pErr) throw new Error(pErr.message);

  const personIds = uniqueStrings((patients ?? []).map((p) => (p as { person_id: string | null }).person_id));
  const personMeta = new Map<string, Record<string, unknown>>();
  if (personIds.length) {
    const { data: persons, error: peErr } = await supabase
      .from("fi_persons")
      .select("id, metadata")
      .eq("tenant_id", tid)
      .in("id", personIds);
    if (peErr) throw new Error(peErr.message);
    for (const raw of persons ?? []) {
      const row = raw as { id: string; metadata: unknown };
      personMeta.set(
        String(row.id),
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {},
      );
    }
  }

  for (const raw of patients ?? []) {
    const p = raw as { id: string; person_id: string | null };
    const meta = p.person_id ? personMeta.get(String(p.person_id)) ?? {} : {};
    const label = displayFromPersonMetadata(meta).name.trim() || "Patient";
    out.set(String(p.id), label);
  }
  return out;
}

async function loadFiUserLabelsById(
  supabase: SupabaseClient,
  tenantId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  const tid = tenantId.trim();
  const ids = uniqueStrings(userIds);
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data, error } = await supabase.from("fi_users").select("id, email").eq("tenant_id", tid).in("id", ids);
  if (error) throw new Error(error.message);
  for (const raw of data ?? []) {
    const r = raw as { id: string; email: string | null };
    out.set(String(r.id), String(r.email ?? "").trim() || "User");
  }
  return out;
}

function buildHrefs(tenantId: string, row: Pick<SurgeryRow, "id" | "patient_id" | "case_id" | "booking_id">) {
  const base = `/fi-admin/${tenantId.trim()}`;
  return {
    patient: row.patient_id ? `${base}/patients/${row.patient_id}` : null,
    case: row.case_id ? `${base}/cases/${row.case_id}` : null,
    surgery: `${base}/surgery-os?surgery=${row.id}`,
    calendar: row.booking_id ? `${base}/calendar?booking=${row.booking_id}` : `${base}/calendar`,
  };
}

export async function loadSurgeryOsCommandCentrePayload(
  tenantId: string,
  now: Date = new Date(),
): Promise<SurgeryOsCommandCentrePayload> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const supabase = supabaseAdmin();
  // SA-2 field-level redaction (follow-up): redact surgery.graft_count / hair_count / punch_size /
  // transection_rate / complications / surgical_notes / medications for the current viewer via
  // `redactSurgeryCaseForStaffAccess(tenantId, case)` from
  // `@/src/lib/staffAccess/staffFieldAccess.server` before rendering case detail/readiness cards.
  // Apply per-case at the render boundary so masked/summary placeholders don't reach numeric
  // metric consumers. Field access is clamped to SurgeryOS module access by the engine.

  const [{ calendarTimezone }, viewer, tenantRes] = await Promise.all([
    loadTenantOperationalCalendarSettings(tid),
    resolveSurgeryOsViewerContext(tid),
    supabase.from("fi_tenants").select("name").eq("id", tid).maybeSingle(),
  ]);

  if (tenantRes.error) throw new Error(tenantRes.error.message);
  if (!tenantRes.data) throw new Error("Tenant not found");

  const tenantName = String((tenantRes.data as { name?: string }).name ?? "").trim() || tid;
  const window = computeProcedureDayBoardWindow(now, calendarTimezone);

  let surgeries: SurgeryRow[] = [];
  try {
    const { data, error } = await supabase
      .from("fi_surgeries")
      .select(
        "id, tenant_id, patient_id, case_id, booking_id, surgeon_fi_user_id, status, live_status, procedure_phase, target_grafts, scheduled_date, scheduled_start_at, readiness_percent, readiness_risk_level, readiness_checklist",
      )
      .eq("tenant_id", tid)
      .eq("scheduled_date", window.todayYmd)
      .in("status", [...ACTIVE_SURGERY_STATUSES])
      .order("scheduled_start_at", { ascending: true, nullsFirst: false });

    if (error) {
      if (isMissingDatabaseRelationError(error)) {
        surgeries = [];
      } else {
        throw new Error(error.message);
      }
    } else {
      surgeries = (data ?? []) as SurgeryRow[];
    }
  } catch (e) {
    if (isMissingDatabaseRelationError(e)) {
      surgeries = [];
    } else {
      throw e;
    }
  }

  for (const row of surgeries) {
    assertSurgeryOsTenantRowScope(tid, row.tenant_id, "fi_surgeries");
  }

  const surgeryIds = surgeries.map((s) => s.id);
  let events: ProcedureEventRow[] = [];
  let teamRows: TeamAssignmentRow[] = [];
  let noteRows: OperationalNoteRow[] = [];

  if (surgeryIds.length) {
    const [eventsRes, teamRes, notesRes] = await Promise.all([
      supabase
        .from("fi_surgery_procedure_events")
        .select("id, tenant_id, surgery_id, event_kind, occurred_at, recorded_by_fi_user_id")
        .eq("tenant_id", tid)
        .in("surgery_id", surgeryIds)
        .order("occurred_at", { ascending: true }),
      supabase
        .from("fi_surgery_team_assignments")
        .select("id, tenant_id, surgery_id, fi_user_id, role, assignment_status")
        .eq("tenant_id", tid)
        .in("surgery_id", surgeryIds),
      supabase
        .from("fi_surgery_operational_notes")
        .select("id, tenant_id, surgery_id, note_kind, severity, body, recorded_at, recorded_by_fi_user_id")
        .eq("tenant_id", tid)
        .in("surgery_id", surgeryIds)
        .order("recorded_at", { ascending: false })
        .limit(100),
    ]);

    for (const res of [eventsRes, teamRes, notesRes]) {
      if (res.error && !isMissingDatabaseRelationError(res.error)) {
        throw new Error(res.error.message);
      }
    }

    events = (eventsRes.data ?? []) as ProcedureEventRow[];
    teamRows = (teamRes.data ?? []) as TeamAssignmentRow[];
    noteRows = (notesRes.data ?? []) as OperationalNoteRow[];
  }

  const patientIds = surgeries.map((s) => s.patient_id);
  const userIds = uniqueStrings([
    ...surgeries.map((s) => s.surgeon_fi_user_id),
    ...teamRows.map((t) => t.fi_user_id),
    ...events.map((e) => e.recorded_by_fi_user_id),
    ...noteRows.map((n) => n.recorded_by_fi_user_id),
  ]);

  const [patientLabels, userLabels, graftSessionsBySurgery, graftEventsBySurgery] = await Promise.all([
    loadPatientLabels(supabase, tid, patientIds.filter(Boolean) as string[]),
    loadFiUserLabelsById(supabase, tid, userIds),
    loadGraftSessionsForSurgeries(tid, surgeryIds),
    loadGraftCountEventsForSurgeries(tid, surgeryIds),
  ]);

  const teamBySurgery = new Map<string, TeamAssignmentRow[]>();
  for (const t of teamRows) {
    const list = teamBySurgery.get(t.surgery_id) ?? [];
    list.push(t);
    teamBySurgery.set(t.surgery_id, list);
  }

  const graftEventUserIds = uniqueStrings(
    [...graftEventsBySurgery.values()].flatMap((events) =>
      events.map((e) => e.created_by_fi_user_id).filter(Boolean),
    ) as string[],
  );
  const missingUserIds = graftEventUserIds.filter((id) => !userLabels.has(id));
  if (missingUserIds.length) {
    const extraLabels = await loadFiUserLabelsById(supabase, tid, missingUserIds);
    for (const [id, label] of extraLabels) userLabels.set(id, label);
  }

  const liveSurgeries: SurgeryOsLiveSurgery[] = [];
  const readinessSnapshots: SurgeryOsReadinessSnapshot[] = [];
  const graftSummary: SurgeryOsGraftSummary[] = [];
  const allAlerts: SurgeryOsAlert[] = [];

  for (const row of surgeries) {
    const patientLabel = row.patient_id ? patientLabels.get(row.patient_id) ?? "Patient" : "Patient";
    const hrefs = buildHrefs(tid, row);
    const team = teamBySurgery.get(row.id) ?? [];
    const surgeonFromTeam = team.find((t) => t.role === "surgeon");
    const surgeonLabel =
      (row.surgeon_fi_user_id ? userLabels.get(row.surgeon_fi_user_id) ?? null : null) ??
      (surgeonFromTeam ? userLabels.get(surgeonFromTeam.fi_user_id) ?? null : null) ??
      null;

    const teamNames = team
      .map((t) => userLabels.get(t.fi_user_id) ?? null)
      .filter(Boolean)
      .slice(0, 4);
    const assignedTeamSummary = teamNames.length ? teamNames.join(", ") : null;

    const phase = row.procedure_phase as SurgeryOsProcedurePhase;
    const liveStatus = row.live_status as SurgeryOsLiveStatus;

    liveSurgeries.push({
      id: row.id,
      patientId: row.patient_id,
      patientLabel,
      caseId: row.case_id,
      bookingId: row.booking_id,
      surgeonLabel,
      assignedTeamSummary,
      targetGrafts: row.target_grafts,
      status: row.status,
      graftCountingEligible: isSurgeryStatusEligibleForGraftCounting(row.status),
      procedurePhase: phase,
      procedurePhaseLabel: SURGERY_OS_PROCEDURE_PHASE_LABELS[phase] ?? phase,
      liveStatus,
      liveStatusLabel: SURGERY_OS_LIVE_STATUS_LABELS[liveStatus] ?? liveStatus,
      scheduledStartAt: row.scheduled_start_at,
      hrefs,
    });

    const checklist = parseChecklist(row.readiness_checklist);
    const percent = row.readiness_percent ?? computeReadinessPercent(checklist);
    const riskLevel = computeReadinessRiskLevel(checklist, percent);

    readinessSnapshots.push({
      surgeryId: row.id,
      patientLabel,
      readinessPercent: percent,
      readinessRiskLevel: riskLevel,
      readinessRiskLabel: SURGERY_OS_READINESS_RISK_LABELS[riskLevel],
      checklist: SURGERY_OS_READINESS_CHECKLIST_KEYS.map((key) => ({
        key,
        label: SURGERY_OS_READINESS_CHECKLIST_LABELS[key],
        complete: checklist[key] === true,
      })),
      hrefs: {
        patient: hrefs.patient,
        case: hrefs.case,
        surgery: hrefs.surgery,
      },
    });

    const unavailableCount = team.filter((t) => t.assignment_status === "unavailable").length;
    const surgeryAlerts = deriveSurgeryAlerts({
      surgeryId: row.id,
      patientLabel,
      checklist,
      readinessRiskLevel: riskLevel,
      liveStatus,
      scheduledStartAt: row.scheduled_start_at,
      nowMs: now.getTime(),
      teamUnavailableCount: unavailableCount,
      hrefs: {
        patient: hrefs.patient,
        case: hrefs.case,
        surgery: hrefs.surgery,
      },
    });
    allAlerts.push(...surgeryAlerts);

    const graftSession = graftSessionsBySurgery.get(row.id);
    const rawGraftEvents = graftEventsBySurgery.get(row.id) ?? [];
    const reviewStatuses = deriveTrayReviewStatuses(
      rawGraftEvents.map((e) => ({
        id: e.id,
        eventType: e.event_type,
        note: e.note,
        createdAt: e.created_at,
      })),
    );
    const trayBuckets = countTrayReviewBuckets(
      rawGraftEvents.map((e) => ({
        eventType: e.event_type,
        reviewStatus: e.event_type === "tray_count" ? reviewStatuses.get(e.id) ?? "pending" : null,
      })),
    );
    const confirmedTrayTotals = computeConfirmedTrayTotals(
      rawGraftEvents.map((e) => ({
        eventType: e.event_type,
        reviewStatus: e.event_type === "tray_count" ? reviewStatuses.get(e.id) ?? "pending" : null,
        singles: e.singles,
        doubles: e.doubles,
        triples: e.triples,
        multiples: e.multiples,
        totalHairs: e.total_hairs,
        deltaDiscarded: e.delta_discarded,
      })),
    );
    const recentCorrection = rawGraftEvents.find((e) => e.event_type === "correction");
    const recentCorrectionMagnitude = recentCorrection
      ? Math.max(
          Math.abs(recentCorrection.delta_extracted),
          Math.abs(recentCorrection.delta_implanted),
          Math.abs(recentCorrection.delta_discarded),
        )
      : null;

    const graftPhase = (graftSession?.phase ?? "extraction") as SurgeryOsGraftSessionPhase;
    const reconciliationStatus = (graftSession?.reconciliation_status ?? "pending") as SurgeryOsGraftReconciliationStatus;
    const totals = graftSession
      ? graftSessionToTotals(graftSession)
      : graftSessionToTotals({
          id: "",
          tenant_id: tid,
          surgery_id: row.id,
          phase: "extraction",
          target_grafts: row.target_grafts,
          extracted_grafts: 0,
          implanted_grafts: 0,
          discarded_grafts: 0,
          remaining_grafts: 0,
          singles: 0,
          doubles: 0,
          triples: 0,
          multiples: 0,
          total_hairs: 0,
          average_hairs_per_graft: null,
          reconciliation_status: "pending",
          created_by_fi_user_id: null,
          extraction_lock_device_id: null,
          extraction_lock_held_at: null,
          extraction_lock_held_by_fi_user_id: null,
          implantation_lock_device_id: null,
          implantation_lock_held_at: null,
          implantation_lock_held_by_fi_user_id: null,
          reconciled_by_fi_user_id: null,
          reconciled_at: null,
        });

    graftSummary.push({
      surgeryId: row.id,
      patientLabel,
      sessionId: graftSession?.id ?? null,
      phase: graftPhase,
      phaseLabel: SURGERY_OS_GRAFT_SESSION_PHASE_LABELS[graftPhase],
      targetGrafts: totals.targetGrafts,
      extractedGrafts: totals.extractedGrafts,
      implantedGrafts: totals.implantedGrafts,
      discardedGrafts: totals.discardedGrafts,
      remainingGrafts: totals.remainingGrafts,
      singles: totals.composition.singles,
      doubles: totals.composition.doubles,
      triples: totals.composition.triples,
      multiples: totals.composition.multiples,
      totalHairs: totals.totalHairs,
      averageHairsPerGraft: totals.averageHairsPerGraft,
      progressPercent: computeGraftProgressPercent(totals.extractedGrafts, totals.targetGrafts),
      reconciliationStatus,
      reconciliationStatusLabel: SURGERY_OS_GRAFT_RECONCILIATION_STATUS_LABELS[reconciliationStatus],
      pendingTrayCount: trayBuckets.pending,
      confirmedTrayGrafts: confirmedTrayTotals.singles + confirmedTrayTotals.doubles + confirmedTrayTotals.triples + confirmedTrayTotals.multiples,
      reconciledAt: graftSession?.reconciled_at ?? null,
      reconciledByLabel: graftSession?.reconciled_by_fi_user_id
        ? userLabels.get(graftSession.reconciled_by_fi_user_id) ?? null
        : null,
      sessionLocks: {
        extraction: resolveGraftCountSessionLock({
          kind: "extraction",
          deviceId: graftSession?.extraction_lock_device_id ?? null,
          heldAt: graftSession?.extraction_lock_held_at ?? null,
          heldByFiUserId: graftSession?.extraction_lock_held_by_fi_user_id ?? null,
          heldByLabel: graftSession?.extraction_lock_held_by_fi_user_id
            ? userLabels.get(graftSession.extraction_lock_held_by_fi_user_id) ?? null
            : null,
          requestingDeviceId: null,
          nowMs: now.getTime(),
        }),
        implantation: resolveGraftCountSessionLock({
          kind: "implantation",
          deviceId: graftSession?.implantation_lock_device_id ?? null,
          heldAt: graftSession?.implantation_lock_held_at ?? null,
          heldByFiUserId: graftSession?.implantation_lock_held_by_fi_user_id ?? null,
          heldByLabel: graftSession?.implantation_lock_held_by_fi_user_id
            ? userLabels.get(graftSession.implantation_lock_held_by_fi_user_id) ?? null
            : null,
          requestingDeviceId: null,
          nowMs: now.getTime(),
        }),
      },
      totals,
      hrefs: {
        patient: hrefs.patient,
        case: hrefs.case,
        surgery: hrefs.surgery,
      },
    });

    const graftAlerts = deriveGraftAlerts({
      surgeryId: row.id,
      patientLabel,
      procedurePhase: phase,
      totals,
      reconciliationStatus,
      href: hrefs.surgery,
      pendingTrayCount: trayBuckets.pending,
      recentCorrectionMagnitude,
    });
    allAlerts.push(
      ...graftAlerts.map((a) => ({
        id: a.id,
        kind: a.kind,
        title: a.title,
        detail: a.detail,
        severity: a.severity,
        surgeryId: a.surgeryId,
        href: a.href,
      })),
    );
  }

  allAlerts.sort((a, b) => compareSurgeryOsSeverity(a.severity, b.severity));

  const surgeryPatientMap = new Map(surgeries.map((s) => [s.id, s.patient_id ? patientLabels.get(s.patient_id) ?? "Patient" : "Patient"]));

  const procedureTimeline: SurgeryOsProcedureTimelineEvent[] = events.map((e) => {
    const kind = e.event_kind as SurgeryOsProcedureEventKind;
    return {
      id: e.id,
      surgeryId: e.surgery_id,
      patientLabel: surgeryPatientMap.get(e.surgery_id) ?? "Patient",
      eventKind: kind,
      eventLabel: SURGERY_OS_PROCEDURE_EVENT_LABELS[kind] ?? kind,
      occurredAt: e.occurred_at,
      recordedByLabel: e.recorded_by_fi_user_id ? userLabels.get(e.recorded_by_fi_user_id) ?? null : null,
    };
  });

  const teamAssignments: SurgeryOsTeamMember[] = teamRows.map((t) => {
    const role = t.role as SurgeryOsTeamRole;
    const status = t.assignment_status as SurgeryOsAssignmentStatus;
    return {
      id: t.id,
      surgeryId: t.surgery_id,
      fiUserId: t.fi_user_id,
      patientLabel: surgeryPatientMap.get(t.surgery_id) ?? "Patient",
      staffLabel: userLabels.get(t.fi_user_id) ?? "Staff",
      role,
      roleLabel: SURGERY_OS_TEAM_ROLE_LABELS[role] ?? role,
      assignmentStatus: status,
      assignmentStatusLabel: SURGERY_OS_ASSIGNMENT_STATUS_LABELS[status] ?? status,
    };
  });

  const operationalNotes: SurgeryOsOperationalNote[] = noteRows.map((n) => {
    const kind = n.note_kind as SurgeryOsNoteKind;
    return {
      id: n.id,
      surgeryId: n.surgery_id,
      patientLabel: surgeryPatientMap.get(n.surgery_id) ?? "Patient",
      noteKind: kind,
      noteKindLabel: SURGERY_OS_NOTE_KIND_LABELS[kind] ?? kind,
      severity: (n.severity as SurgeryOsOperationalNote["severity"]) ?? "info",
      body: n.body,
      recordedAt: n.recorded_at,
      recordedByLabel: n.recorded_by_fi_user_id ? userLabels.get(n.recorded_by_fi_user_id) ?? null : null,
    };
  });

  const graftEvents: SurgeryOsGraftCountEvent[] = [];
  for (const surgeryId of surgeryIds) {
    const rawEvents = graftEventsBySurgery.get(surgeryId) ?? [];
    const reviewStatuses = deriveTrayReviewStatuses(
      rawEvents.map((e) => ({
        id: e.id,
        eventType: e.event_type,
        note: e.note,
        createdAt: e.created_at,
      })),
    );
    for (const e of rawEvents) {
      graftEvents.push({
        id: e.id,
        surgeryId: e.surgery_id,
        sessionId: e.session_id,
        eventType: e.event_type,
        eventTypeLabel: SURGERY_OS_GRAFT_COUNT_EVENT_TYPE_LABELS[e.event_type] ?? e.event_type,
        deltaExtracted: e.delta_extracted,
        deltaImplanted: e.delta_implanted,
        deltaDiscarded: e.delta_discarded,
        singles: e.singles,
        doubles: e.doubles,
        triples: e.triples,
        multiples: e.multiples,
        totalHairs: e.total_hairs,
        note: e.note,
        createdAt: e.created_at,
        createdByLabel: e.created_by_fi_user_id ? userLabels.get(e.created_by_fi_user_id) ?? null : null,
        reviewStatus: e.event_type === "tray_count" ? reviewStatuses.get(e.id) ?? "pending" : null,
        trayNumber: parseTrayNumberFromNote(e.note),
      });
    }
  }

  const vieCaptureInputs = surgeries
    .filter((row) => row.patient_id?.trim())
    .map((row) => ({
      surgeryId: row.id,
      patientId: row.patient_id!.trim(),
      patientLabel: row.patient_id ? patientLabels.get(row.patient_id) ?? "Patient" : "Patient",
      caseId: row.case_id,
      bookingId: row.booking_id,
    }));

  let vieCapture: Awaited<ReturnType<typeof loadSurgeryOsVieCaptureSummaries>> = [];
  try {
    vieCapture = await loadSurgeryOsVieCaptureSummaries(tid, vieCaptureInputs, supabase);
  } catch (e) {
    if (!isMissingDatabaseRelationError(e)) throw e;
  }

  const payload: SurgeryOsCommandCentrePayload = {
    tenantId: tid,
    tenantName,
    loadedAt: now.toISOString(),
    operationalDay: {
      calendarTimezone,
      todayYmd: window.todayYmd,
      localStartIso: window.rangeStartIso,
      localEndIso: window.rangeEndIso,
    },
    viewer: {
      role: viewer.surgeryOsRole,
      staffRole: viewer.staffRole,
      visibleWidgets: viewer.visibleWidgets,
    },
    liveSurgeries,
    readinessSnapshots,
    procedureTimeline,
    teamAssignments,
    alerts: allAlerts,
    operationalNotes,
    graftSummary,
    graftEvents,
    vieCapture,
    intelligence: emptySurgeryOsIntelligence(),
  };

  try {
    return surgeryOsCommandCentrePayloadSchema.parse(payload);
  } catch (e) {
    console.error("[loadSurgeryOsCommandCentrePayload] schema validation failed", normalizeLoaderErrorMessage(e));
    throw e;
  }
}
