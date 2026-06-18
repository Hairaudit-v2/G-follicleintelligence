import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  assertSurgeryOsTenantRowScope,
  type SurgeryOsProcedureEventKind,
} from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import {
  assertGraftCountSessionLock,
  assertGraftReconciliationGate,
  buildGraftTotalsFromSession,
  computeAverageHairsPerGraft,
  computeGraftCompositionTotal,
  computeGraftCorrectionMagnitude,
  computeRemainingGrafts,
  computeTrayHairTotal,
  countTrayReviewBuckets,
  deriveReconciliationStatus,
  deriveTrayReviewStatusForEvent,
  formatTrayCountNote,
  graftEventTypeToTimelineKind,
  graftTimelineLabel,
  isSurgeryStatusEligibleForGraftCounting,
  requiresLargeCorrectionNote,
  SURGERY_OS_GRAFT_TYPE_HAIR_WEIGHTS,
  validateGraftCorrection,
  validateGraftCountUpdate,
  type SurgeryOsGraftCountEventType,
  type SurgeryOsGraftCountSessionLockKind,
  type SurgeryOsGraftSessionPhase,
  type SurgeryOsGraftType,
  shouldBlockSurgeryPhaseForGraftReconciliation,
  type SurgeryOsGraftReconciliationStatus,
} from "@/src/lib/surgeryOs/surgeryOsGraftModel";
import { isMissingDatabaseRelationError } from "@/src/lib/surgeryOs/surgeryOsLoaderResilience";
import type { SurgeryOsAction } from "@/src/lib/surgeryOs/surgeryOsPolicy";
import type { ProcedureEventRow, SurgeryMutationRow } from "@/src/lib/surgeryOs/surgeryMutations.server";

export type GraftSessionRow = {
  id: string;
  tenant_id: string;
  surgery_id: string;
  phase: SurgeryOsGraftSessionPhase;
  target_grafts: number | null;
  extracted_grafts: number;
  implanted_grafts: number;
  discarded_grafts: number;
  remaining_grafts: number;
  singles: number;
  doubles: number;
  triples: number;
  multiples: number;
  total_hairs: number;
  average_hairs_per_graft: number | null;
  reconciliation_status: string;
  created_by_fi_user_id: string | null;
  extraction_lock_device_id: string | null;
  extraction_lock_held_at: string | null;
  extraction_lock_held_by_fi_user_id: string | null;
  implantation_lock_device_id: string | null;
  implantation_lock_held_at: string | null;
  implantation_lock_held_by_fi_user_id: string | null;
  reconciled_by_fi_user_id: string | null;
  reconciled_at: string | null;
};

export type GraftCountEventRow = {
  id: string;
  tenant_id: string;
  surgery_id: string;
  session_id: string;
  event_type: SurgeryOsGraftCountEventType;
  delta_extracted: number;
  delta_implanted: number;
  delta_discarded: number;
  singles: number | null;
  doubles: number | null;
  triples: number | null;
  multiples: number | null;
  total_hairs: number | null;
  note: string | null;
  created_by_fi_user_id: string | null;
  created_at: string;
  client_submission_id: string | null;
};

function mapGraftSessionRow(raw: Record<string, unknown>): GraftSessionRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    surgery_id: String(raw.surgery_id),
    phase: raw.phase as SurgeryOsGraftSessionPhase,
    target_grafts: raw.target_grafts != null ? Number(raw.target_grafts) : null,
    extracted_grafts: Number(raw.extracted_grafts ?? 0),
    implanted_grafts: Number(raw.implanted_grafts ?? 0),
    discarded_grafts: Number(raw.discarded_grafts ?? 0),
    remaining_grafts: Number(raw.remaining_grafts ?? 0),
    singles: Number(raw.singles ?? 0),
    doubles: Number(raw.doubles ?? 0),
    triples: Number(raw.triples ?? 0),
    multiples: Number(raw.multiples ?? 0),
    total_hairs: Number(raw.total_hairs ?? 0),
    average_hairs_per_graft:
      raw.average_hairs_per_graft != null ? Number(raw.average_hairs_per_graft) : null,
    reconciliation_status: String(raw.reconciliation_status ?? "pending"),
    created_by_fi_user_id: raw.created_by_fi_user_id != null ? String(raw.created_by_fi_user_id) : null,
    extraction_lock_device_id:
      raw.extraction_lock_device_id != null ? String(raw.extraction_lock_device_id) : null,
    extraction_lock_held_at:
      raw.extraction_lock_held_at != null ? String(raw.extraction_lock_held_at) : null,
    extraction_lock_held_by_fi_user_id:
      raw.extraction_lock_held_by_fi_user_id != null ? String(raw.extraction_lock_held_by_fi_user_id) : null,
    implantation_lock_device_id:
      raw.implantation_lock_device_id != null ? String(raw.implantation_lock_device_id) : null,
    implantation_lock_held_at:
      raw.implantation_lock_held_at != null ? String(raw.implantation_lock_held_at) : null,
    implantation_lock_held_by_fi_user_id:
      raw.implantation_lock_held_by_fi_user_id != null ? String(raw.implantation_lock_held_by_fi_user_id) : null,
    reconciled_by_fi_user_id:
      raw.reconciled_by_fi_user_id != null ? String(raw.reconciled_by_fi_user_id) : null,
    reconciled_at: raw.reconciled_at != null ? String(raw.reconciled_at) : null,
  };
}

async function loadSurgeryForGraftMutation(tenantId: string, surgeryId: string): Promise<SurgeryMutationRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const sid = assertNonEmptyUuid(surgeryId, "surgeryId").trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_surgeries").select("*").eq("tenant_id", tid).eq("id", sid).maybeSingle();
  if (error) {
    if (isMissingDatabaseRelationError(error)) throw new Error("SurgeryOS tables are not available.");
    throw new Error(error.message);
  }
  if (!data) throw new Error("Surgery not found.");
  const row = data as Record<string, unknown>;
  assertSurgeryOsTenantRowScope(tid, String(row.tenant_id), "fi_surgeries");
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    patient_id: row.patient_id != null ? String(row.patient_id) : null,
    case_id: row.case_id != null ? String(row.case_id) : null,
    booking_id: row.booking_id != null ? String(row.booking_id) : null,
    clinic_id: row.clinic_id != null ? String(row.clinic_id) : null,
    surgeon_fi_user_id: row.surgeon_fi_user_id != null ? String(row.surgeon_fi_user_id) : null,
    status: String(row.status),
    live_status: String(row.live_status),
    procedure_phase: String(row.procedure_phase),
    target_grafts: row.target_grafts != null ? Number(row.target_grafts) : null,
    scheduled_date: String(row.scheduled_date),
    scheduled_start_at: row.scheduled_start_at != null ? String(row.scheduled_start_at) : null,
    scheduled_end_at: row.scheduled_end_at != null ? String(row.scheduled_end_at) : null,
    actual_start_at: row.actual_start_at != null ? String(row.actual_start_at) : null,
    actual_end_at: row.actual_end_at != null ? String(row.actual_end_at) : null,
  };
}

function assertSurgeryGraftCountingAllowed(surgery: SurgeryMutationRow, allowAdminOverride?: boolean): void {
  if (!isSurgeryStatusEligibleForGraftCounting(surgery.status, { allowAdminOverride })) {
    throw new Error(
      "Graft counting is only allowed for active surgeries today. Completed or cancelled surgeries require admin override.",
    );
  }
}

function sessionLockKindForAction(action: SurgeryOsAction): SurgeryOsGraftCountSessionLockKind | null {
  switch (action) {
    case "add_extraction_count":
    case "enter_tray_count":
      return "extraction";
    case "add_implantation_count":
      return "implantation";
    default:
      return null;
  }
}

function buildSessionLockPatch(input: {
  session: GraftSessionRow;
  lockKind: SurgeryOsGraftCountSessionLockKind;
  deviceId: string;
  actorFiUserId: string | null;
  nowIso: string;
}): Record<string, unknown> {
  if (input.lockKind === "extraction") {
    return {
      extraction_lock_device_id: input.deviceId,
      extraction_lock_held_at: input.nowIso,
      extraction_lock_held_by_fi_user_id: input.actorFiUserId,
    };
  }
  return {
    implantation_lock_device_id: input.deviceId,
    implantation_lock_held_at: input.nowIso,
    implantation_lock_held_by_fi_user_id: input.actorFiUserId,
  };
}

async function findExistingGraftSubmission(input: {
  tenantId: string;
  sessionId: string;
  clientSubmissionId: string;
}): Promise<GraftCountEventRow | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_surgery_graft_count_events")
    .select("*")
    .eq("tenant_id", input.tenantId.trim())
    .eq("session_id", input.sessionId.trim())
    .eq("client_submission_id", input.clientSubmissionId.trim())
    .maybeSingle();

  if (error) {
    if (isMissingDatabaseRelationError(error)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    surgery_id: String(row.surgery_id),
    session_id: String(row.session_id),
    event_type: String(row.event_type) as SurgeryOsGraftCountEventType,
    delta_extracted: Number(row.delta_extracted ?? 0),
    delta_implanted: Number(row.delta_implanted ?? 0),
    delta_discarded: Number(row.delta_discarded ?? 0),
    singles: row.singles != null ? Number(row.singles) : null,
    doubles: row.doubles != null ? Number(row.doubles) : null,
    triples: row.triples != null ? Number(row.triples) : null,
    multiples: row.multiples != null ? Number(row.multiples) : null,
    total_hairs: row.total_hairs != null ? Number(row.total_hairs) : null,
    note: row.note != null ? String(row.note) : null,
    created_by_fi_user_id:
      row.created_by_fi_user_id != null ? String(row.created_by_fi_user_id) : null,
    created_at: String(row.created_at),
    client_submission_id:
      row.client_submission_id != null ? String(row.client_submission_id) : null,
  };
}

async function loadGraftCountEventsForSession(
  tenantId: string,
  sessionId: string,
): Promise<GraftCountEventRow[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_surgery_graft_count_events")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("session_id", sessionId.trim())
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingDatabaseRelationError(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      surgery_id: String(row.surgery_id),
      session_id: String(row.session_id),
      event_type: String(row.event_type) as SurgeryOsGraftCountEventType,
      delta_extracted: Number(row.delta_extracted ?? 0),
      delta_implanted: Number(row.delta_implanted ?? 0),
      delta_discarded: Number(row.delta_discarded ?? 0),
      singles: row.singles != null ? Number(row.singles) : null,
      doubles: row.doubles != null ? Number(row.doubles) : null,
      triples: row.triples != null ? Number(row.triples) : null,
      multiples: row.multiples != null ? Number(row.multiples) : null,
      total_hairs: row.total_hairs != null ? Number(row.total_hairs) : null,
      note: row.note != null ? String(row.note) : null,
      created_by_fi_user_id:
        row.created_by_fi_user_id != null ? String(row.created_by_fi_user_id) : null,
      created_at: String(row.created_at),
      client_submission_id:
        row.client_submission_id != null ? String(row.client_submission_id) : null,
    };
  });
}

async function getOrCreateGraftSession(
  tenantId: string,
  surgery: SurgeryMutationRow,
  actorFiUserId: string | null,
  phase: SurgeryOsGraftSessionPhase,
): Promise<GraftSessionRow> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();

  const { data: existing, error: loadErr } = await supabase
    .from("fi_surgery_graft_sessions")
    .select("*")
    .eq("tenant_id", tid)
    .eq("surgery_id", surgery.id)
    .maybeSingle();

  if (loadErr && !isMissingDatabaseRelationError(loadErr)) throw new Error(loadErr.message);
  if (existing) {
    const row = mapGraftSessionRow(existing as Record<string, unknown>);
    assertSurgeryOsTenantRowScope(tid, row.tenant_id, "fi_surgery_graft_sessions");
    return row;
  }

  const insertRow = {
    tenant_id: tid,
    surgery_id: surgery.id,
    phase,
    target_grafts: surgery.target_grafts,
    created_by_fi_user_id: actorFiUserId,
  };

  const { data: created, error: insertErr } = await supabase
    .from("fi_surgery_graft_sessions")
    .insert(insertRow)
    .select("*")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      const { data: raced } = await supabase
        .from("fi_surgery_graft_sessions")
        .select("*")
        .eq("tenant_id", tid)
        .eq("surgery_id", surgery.id)
        .maybeSingle();
      if (raced) return mapGraftSessionRow(raced as Record<string, unknown>);
    }
    throw new Error(insertErr.message);
  }

  return mapGraftSessionRow(created as Record<string, unknown>);
}

async function insertGraftTimelineEvent(input: {
  tenantId: string;
  surgeryId: string;
  eventKind: SurgeryOsProcedureEventKind;
  actorFiUserId: string | null;
  metadata: Record<string, unknown>;
}): Promise<ProcedureEventRow> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_surgery_procedure_events")
    .insert({
      tenant_id: input.tenantId.trim(),
      surgery_id: input.surgeryId.trim(),
      event_kind: input.eventKind,
      recorded_by_fi_user_id: input.actorFiUserId,
      metadata: input.metadata,
    })
    .select("id, tenant_id, surgery_id, event_kind, occurred_at, recorded_by_fi_user_id, metadata")
    .single();
  if (error) throw new Error(error.message);
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    surgery_id: String(row.surgery_id),
    event_kind: String(row.event_kind),
    occurred_at: String(row.occurred_at),
    recorded_by_fi_user_id: row.recorded_by_fi_user_id != null ? String(row.recorded_by_fi_user_id) : null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
  };
}

type GraftMutationPatch = {
  phase?: SurgeryOsGraftSessionPhase;
  deltaExtracted?: number;
  deltaImplanted?: number;
  deltaDiscarded?: number;
  setExtracted?: number;
  setImplanted?: number;
  setDiscarded?: number;
  singles?: number;
  doubles?: number;
  triples?: number;
  multiples?: number;
  deltaSingles?: number;
  deltaDoubles?: number;
  deltaTriples?: number;
  deltaMultiples?: number;
  totalHairs?: number;
  deltaTotalHairs?: number;
  accumulateComposition?: boolean;
  reconciliationCompleted?: boolean;
  eventType: SurgeryOsGraftCountEventType;
  sourceAction: SurgeryOsAction;
  note?: string | null;
  eventSingles?: number | null;
  eventDoubles?: number | null;
  eventTriples?: number | null;
  eventMultiples?: number | null;
  eventTotalHairs?: number | null;
  clientSubmissionId?: string | null;
};

async function applyGraftMutation(input: {
  tenantId: string;
  surgeryId: string;
  actorFiUserId: string | null;
  deviceId?: string | null;
  allowAdminOverride?: boolean;
  patch: GraftMutationPatch;
}): Promise<{ session: GraftSessionRow; event: GraftCountEventRow; timelineEvent: ProcedureEventRow }> {
  const surgery = await loadSurgeryForGraftMutation(input.tenantId, input.surgeryId);
  assertSurgeryGraftCountingAllowed(surgery, input.allowAdminOverride);

  const session = await getOrCreateGraftSession(
    input.tenantId,
    surgery,
    input.actorFiUserId,
    input.patch.phase ?? sessionPhaseFromAction(input.patch.sourceAction),
  );

  if (input.patch.clientSubmissionId?.trim()) {
    const existing = await findExistingGraftSubmission({
      tenantId: input.tenantId,
      sessionId: session.id,
      clientSubmissionId: input.patch.clientSubmissionId,
    });
    if (existing) {
      return {
        session,
        event: existing,
        timelineEvent: {
          id: existing.id,
          tenant_id: existing.tenant_id,
          surgery_id: existing.surgery_id,
          event_kind: graftEventTypeToTimelineKind(existing.event_type),
          occurred_at: existing.created_at,
          recorded_by_fi_user_id: existing.created_by_fi_user_id,
          metadata: { duplicate_submission: true },
        },
      };
    }
  }

  const lockKind = sessionLockKindForAction(input.patch.sourceAction);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  if (lockKind) {
    assertGraftCountSessionLock({
      kind: lockKind,
      lockDeviceId:
        lockKind === "extraction"
          ? session.extraction_lock_device_id
          : session.implantation_lock_device_id,
      lockHeldAt:
        lockKind === "extraction" ? session.extraction_lock_held_at : session.implantation_lock_held_at,
      requestingDeviceId: input.deviceId ?? null,
      nowMs,
    });
  }

  const deltaExtracted = input.patch.deltaExtracted ?? 0;
  const deltaImplanted = input.patch.deltaImplanted ?? 0;
  const deltaDiscarded = input.patch.deltaDiscarded ?? 0;

  let nextExtracted = session.extracted_grafts;
  let nextImplanted = session.implanted_grafts;
  let nextDiscarded = session.discarded_grafts;

  if (input.patch.eventType === "correction") {
    const validation = validateGraftCorrection({
      extracted: input.patch.setExtracted ?? session.extracted_grafts,
      implanted: input.patch.setImplanted ?? session.implanted_grafts,
      discarded: input.patch.setDiscarded ?? session.discarded_grafts,
    });
    if (!validation.ok) throw new Error(validation.reason);
    nextExtracted = input.patch.setExtracted ?? session.extracted_grafts;
    nextImplanted = input.patch.setImplanted ?? session.implanted_grafts;
    nextDiscarded = input.patch.setDiscarded ?? session.discarded_grafts;
  } else if (input.patch.eventType === "tray_count") {
    // Tray totals are applied only after nurse confirmation — audit event only here.
  } else if (input.patch.eventType === "graft_reconciliation") {
    // Reconciliation status update — graft totals unchanged.
  } else if (
    input.patch.eventType === "tray_confirmed" ||
    input.patch.eventType === "tray_rejected"
  ) {
    if (input.patch.eventType === "tray_confirmed") {
      const validation = validateGraftCountUpdate({
        currentExtracted: session.extracted_grafts,
        currentImplanted: session.implanted_grafts,
        currentDiscarded: session.discarded_grafts,
        deltaExtracted: 0,
        deltaImplanted: 0,
        deltaDiscarded,
      });
      if (!validation.ok) throw new Error(validation.reason);
      nextDiscarded += deltaDiscarded;
    }
  } else {
    const validation = validateGraftCountUpdate({
      currentExtracted: session.extracted_grafts,
      currentImplanted: session.implanted_grafts,
      currentDiscarded: session.discarded_grafts,
      deltaExtracted,
      deltaImplanted,
      deltaDiscarded,
    });
    if (!validation.ok) throw new Error(validation.reason);
    nextExtracted += deltaExtracted;
    nextImplanted += deltaImplanted;
    nextDiscarded += deltaDiscarded;
  }

  const nextSingles =
    input.patch.singles ??
    (input.patch.deltaSingles != null
      ? session.singles + input.patch.deltaSingles
      : session.singles);
  const nextDoubles =
    input.patch.doubles ??
    (input.patch.deltaDoubles != null
      ? session.doubles + input.patch.deltaDoubles
      : session.doubles);
  const nextTriples =
    input.patch.triples ??
    (input.patch.deltaTriples != null
      ? session.triples + input.patch.deltaTriples
      : session.triples);
  const nextMultiples =
    input.patch.multiples ??
    (input.patch.deltaMultiples != null
      ? session.multiples + input.patch.deltaMultiples
      : session.multiples);
  const nextTotalHairs =
    input.patch.totalHairs ??
    (input.patch.deltaTotalHairs != null
      ? session.total_hairs + input.patch.deltaTotalHairs
      : session.total_hairs);
  const nextRemaining = computeRemainingGrafts(nextExtracted, nextImplanted, nextDiscarded);
  const compositionTotal = computeGraftCompositionTotal({
    singles: nextSingles,
    doubles: nextDoubles,
    triples: nextTriples,
    multiples: nextMultiples,
  });
  const graftBasis = compositionTotal > 0 ? compositionTotal : nextExtracted;
  const nextAverage = computeAverageHairsPerGraft(nextTotalHairs, graftBasis);

  const nextPhase = input.patch.phase ?? session.phase;
  const reconciliationStatus = deriveReconciliationStatus(
    nextExtracted,
    nextImplanted,
    nextDiscarded,
    nextRemaining,
    input.patch.reconciliationCompleted === true,
  );

  const supabase = supabaseAdmin();
  const sessionUpdate: Record<string, unknown> = {
    phase: nextPhase,
    target_grafts: session.target_grafts ?? surgery.target_grafts,
    extracted_grafts: nextExtracted,
    implanted_grafts: nextImplanted,
    discarded_grafts: nextDiscarded,
    remaining_grafts: nextRemaining,
    singles: nextSingles,
    doubles: nextDoubles,
    triples: nextTriples,
    multiples: nextMultiples,
    total_hairs: nextTotalHairs,
    average_hairs_per_graft: nextAverage,
    reconciliation_status: reconciliationStatus,
  };

  if (lockKind && input.deviceId?.trim()) {
    Object.assign(
      sessionUpdate,
      buildSessionLockPatch({
        session,
        lockKind,
        deviceId: input.deviceId.trim(),
        actorFiUserId: input.actorFiUserId,
        nowIso,
      }),
    );
  }

  if (input.patch.reconciliationCompleted === true) {
    sessionUpdate.reconciled_by_fi_user_id = input.actorFiUserId;
    sessionUpdate.reconciled_at = nowIso;
  }

  const { data: updatedSession, error: updateErr } = await supabase
    .from("fi_surgery_graft_sessions")
    .update(sessionUpdate)
    .eq("tenant_id", input.tenantId.trim())
    .eq("id", session.id)
    .select("*")
    .single();
  if (updateErr) throw new Error(updateErr.message);

  const { data: countEvent, error: eventErr } = await supabase
    .from("fi_surgery_graft_count_events")
    .insert({
      tenant_id: input.tenantId.trim(),
      surgery_id: surgery.id,
      session_id: session.id,
      event_type: input.patch.eventType,
      delta_extracted: input.patch.eventType === "correction" ? nextExtracted - session.extracted_grafts : deltaExtracted,
      delta_implanted: input.patch.eventType === "correction" ? nextImplanted - session.implanted_grafts : deltaImplanted,
      delta_discarded: input.patch.eventType === "correction" ? nextDiscarded - session.discarded_grafts : deltaDiscarded,
      singles: input.patch.eventSingles ?? input.patch.singles ?? input.patch.deltaSingles ?? null,
      doubles: input.patch.eventDoubles ?? input.patch.doubles ?? input.patch.deltaDoubles ?? null,
      triples: input.patch.eventTriples ?? input.patch.triples ?? input.patch.deltaTriples ?? null,
      multiples: input.patch.eventMultiples ?? input.patch.multiples ?? input.patch.deltaMultiples ?? null,
      total_hairs: input.patch.eventTotalHairs ?? input.patch.totalHairs ?? input.patch.deltaTotalHairs ?? null,
      note: input.patch.note?.trim() || null,
      created_by_fi_user_id: input.actorFiUserId,
      client_submission_id: input.patch.clientSubmissionId?.trim() || null,
    })
    .select("*")
    .single();
  if (eventErr) throw new Error(eventErr.message);

  const timelineKind = graftEventTypeToTimelineKind(input.patch.eventType);
  const timelineEvent = await insertGraftTimelineEvent({
    tenantId: input.tenantId,
    surgeryId: surgery.id,
    eventKind: timelineKind,
    actorFiUserId: input.actorFiUserId,
    metadata: {
      source_action: input.patch.sourceAction,
      graft_event_type: input.patch.eventType,
      session_id: session.id,
      delta_extracted: deltaExtracted,
      delta_implanted: deltaImplanted,
      delta_discarded: deltaDiscarded,
      extracted_grafts: nextExtracted,
      implanted_grafts: nextImplanted,
      discarded_grafts: nextDiscarded,
      remaining_grafts: nextRemaining,
      reconciliation_status: reconciliationStatus,
      custom_label: graftTimelineLabel(input.patch.eventType, {
        extracted: deltaExtracted,
        implanted: deltaImplanted,
        discarded: deltaDiscarded,
      }),
      ...(input.patch.note ? { note: input.patch.note } : {}),
    },
  });

  const eventRow = countEvent as Record<string, unknown>;
  return {
    session: mapGraftSessionRow(updatedSession as Record<string, unknown>),
    event: {
      id: String(eventRow.id),
      tenant_id: String(eventRow.tenant_id),
      surgery_id: String(eventRow.surgery_id),
      session_id: String(eventRow.session_id),
      event_type: String(eventRow.event_type) as SurgeryOsGraftCountEventType,
      delta_extracted: Number(eventRow.delta_extracted ?? 0),
      delta_implanted: Number(eventRow.delta_implanted ?? 0),
      delta_discarded: Number(eventRow.delta_discarded ?? 0),
      singles: eventRow.singles != null ? Number(eventRow.singles) : null,
      doubles: eventRow.doubles != null ? Number(eventRow.doubles) : null,
      triples: eventRow.triples != null ? Number(eventRow.triples) : null,
      multiples: eventRow.multiples != null ? Number(eventRow.multiples) : null,
      total_hairs: eventRow.total_hairs != null ? Number(eventRow.total_hairs) : null,
      note: eventRow.note != null ? String(eventRow.note) : null,
      created_by_fi_user_id:
        eventRow.created_by_fi_user_id != null ? String(eventRow.created_by_fi_user_id) : null,
      created_at: String(eventRow.created_at),
      client_submission_id:
        eventRow.client_submission_id != null ? String(eventRow.client_submission_id) : null,
    },
    timelineEvent,
  };
}

function sessionPhaseFromAction(action: SurgeryOsAction): SurgeryOsGraftSessionPhase {
  switch (action) {
    case "add_implantation_count":
      return "implantation";
    case "enter_tray_count":
      return "tray_count";
    case "reconcile_grafts":
      return "reconciliation";
    default:
      return "extraction";
  }
}

export async function addExtractionGraftCount(input: {
  tenantId: string;
  surgeryId: string;
  count: number;
  graftType?: SurgeryOsGraftType | null;
  note?: string | null;
  actorFiUserId: string | null;
  deviceId?: string | null;
  clientSubmissionId?: string | null;
  allowAdminOverride?: boolean;
}) {
  if (input.count <= 0) throw new Error("Extraction count must be positive.");

  const patch: GraftMutationPatch = {
    phase: "extraction",
    deltaExtracted: input.count,
    eventType: "count_update",
    sourceAction: "add_extraction_count",
    note: input.note,
  };

  if (input.graftType) {
    const hairDelta = input.count * SURGERY_OS_GRAFT_TYPE_HAIR_WEIGHTS[input.graftType];
    switch (input.graftType) {
      case "single":
        patch.deltaSingles = input.count;
        break;
      case "double":
        patch.deltaDoubles = input.count;
        break;
      case "triple":
        patch.deltaTriples = input.count;
        break;
      case "multiple":
        patch.deltaMultiples = input.count;
        break;
    }
    patch.deltaTotalHairs = hairDelta;
    patch.eventSingles = input.graftType === "single" ? input.count : null;
    patch.eventDoubles = input.graftType === "double" ? input.count : null;
    patch.eventTriples = input.graftType === "triple" ? input.count : null;
    patch.eventMultiples = input.graftType === "multiple" ? input.count : null;
    patch.eventTotalHairs = hairDelta;
  }

  return applyGraftMutation({
    tenantId: input.tenantId,
    surgeryId: input.surgeryId,
    actorFiUserId: input.actorFiUserId,
    deviceId: input.deviceId,
    allowAdminOverride: input.allowAdminOverride,
    patch: {
      ...patch,
      clientSubmissionId: input.clientSubmissionId,
    },
  });
}

export async function addImplantationGraftCount(input: {
  tenantId: string;
  surgeryId: string;
  count: number;
  graftType?: SurgeryOsGraftType | null;
  note?: string | null;
  actorFiUserId: string | null;
  deviceId?: string | null;
  clientSubmissionId?: string | null;
  allowAdminOverride?: boolean;
}) {
  if (input.count <= 0) throw new Error("Implantation count must be positive.");

  const patch: GraftMutationPatch = {
    phase: "implantation",
    deltaImplanted: input.count,
    eventType: "count_update",
    sourceAction: "add_implantation_count",
    note: input.note,
  };

  if (input.graftType) {
    const hairDelta = input.count * SURGERY_OS_GRAFT_TYPE_HAIR_WEIGHTS[input.graftType];
    switch (input.graftType) {
      case "single":
        patch.deltaSingles = input.count;
        break;
      case "double":
        patch.deltaDoubles = input.count;
        break;
      case "triple":
        patch.deltaTriples = input.count;
        break;
      case "multiple":
        patch.deltaMultiples = input.count;
        break;
    }
    patch.deltaTotalHairs = hairDelta;
    patch.eventSingles = input.graftType === "single" ? input.count : null;
    patch.eventDoubles = input.graftType === "double" ? input.count : null;
    patch.eventTriples = input.graftType === "triple" ? input.count : null;
    patch.eventMultiples = input.graftType === "multiple" ? input.count : null;
    patch.eventTotalHairs = hairDelta;
  }

  return applyGraftMutation({
    tenantId: input.tenantId,
    surgeryId: input.surgeryId,
    actorFiUserId: input.actorFiUserId,
    deviceId: input.deviceId,
    allowAdminOverride: input.allowAdminOverride,
    patch: {
      ...patch,
      clientSubmissionId: input.clientSubmissionId,
    },
  });
}

export async function enterTrayGraftCount(input: {
  tenantId: string;
  surgeryId: string;
  trayNumber?: number | null;
  singles: number;
  doubles: number;
  triples: number;
  multiples: number;
  damaged?: number;
  totalHairs?: number | null;
  note?: string | null;
  actorFiUserId: string | null;
  deviceId?: string | null;
  clientSubmissionId?: string | null;
  allowAdminOverride?: boolean;
}) {
  if (
    input.singles < 0 ||
    input.doubles < 0 ||
    input.triples < 0 ||
    input.multiples < 0
  ) {
    throw new Error("Tray composition counts cannot be negative.");
  }
  const trayTotal = input.singles + input.doubles + input.triples + input.multiples;
  const damaged = input.damaged ?? 0;
  if (trayTotal <= 0 && damaged <= 0) throw new Error("Tray count requires at least one graft or damaged unit.");

  const trayComposition = {
    singles: input.singles,
    doubles: input.doubles,
    triples: input.triples,
    multiples: input.multiples,
  };
  const computedHairs = input.totalHairs ?? computeTrayHairTotal(trayComposition);
  const trayNote = input.trayNumber
    ? formatTrayCountNote(input.trayNumber, input.note)
    : input.note?.trim() || null;

  const result = await applyGraftMutation({
    tenantId: input.tenantId,
    surgeryId: input.surgeryId,
    actorFiUserId: input.actorFiUserId,
    deviceId: input.deviceId,
    allowAdminOverride: input.allowAdminOverride,
    patch: {
      phase: "tray_count",
      deltaExtracted: 0,
      deltaImplanted: 0,
      deltaDiscarded: damaged > 0 ? damaged : 0,
      eventType: "tray_count",
      sourceAction: "enter_tray_count",
      note: trayNote,
      eventSingles: input.singles,
      eventDoubles: input.doubles,
      eventTriples: input.triples,
      eventMultiples: input.multiples,
      eventTotalHairs: computedHairs,
      clientSubmissionId: input.clientSubmissionId,
    },
  });

  return result;
}

export async function logDiscardedGrafts(input: {
  tenantId: string;
  surgeryId: string;
  count: number;
  note?: string | null;
  actorFiUserId: string | null;
}) {
  if (input.count <= 0) throw new Error("Discarded count must be positive.");
  return applyGraftMutation({
    tenantId: input.tenantId,
    surgeryId: input.surgeryId,
    actorFiUserId: input.actorFiUserId,
    patch: {
      deltaDiscarded: input.count,
      eventType: "discard_logged",
      sourceAction: "log_discarded_grafts",
      note: input.note,
    },
  });
}

export async function correctGraftCount(input: {
  tenantId: string;
  surgeryId: string;
  extracted: number;
  implanted: number;
  discarded: number;
  singles?: number;
  doubles?: number;
  triples?: number;
  multiples?: number;
  totalHairs?: number;
  note?: string | null;
  actorFiUserId: string | null;
}) {
  const surgery = await loadSurgeryForGraftMutation(input.tenantId, input.surgeryId);
  const session = await getOrCreateGraftSession(input.tenantId, surgery, input.actorFiUserId, "extraction");
  const magnitude = computeGraftCorrectionMagnitude({
    previous: {
      extracted: session.extracted_grafts,
      implanted: session.implanted_grafts,
      discarded: session.discarded_grafts,
    },
    next: {
      extracted: input.extracted,
      implanted: input.implanted,
      discarded: input.discarded,
    },
  });
  if (requiresLargeCorrectionNote(magnitude) && !input.note?.trim()) {
    throw new Error(
      `Correction of ${magnitude} or more grafts requires a note explaining the change.`,
    );
  }

  return applyGraftMutation({
    tenantId: input.tenantId,
    surgeryId: input.surgeryId,
    actorFiUserId: input.actorFiUserId,
    patch: {
      setExtracted: input.extracted,
      setImplanted: input.implanted,
      setDiscarded: input.discarded,
      singles: input.singles,
      doubles: input.doubles,
      triples: input.triples,
      multiples: input.multiples,
      totalHairs: input.totalHairs,
      eventType: "correction",
      sourceAction: "correct_graft_count",
      note: input.note,
    },
  });
}

export async function confirmTrayGraftCount(input: {
  tenantId: string;
  surgeryId: string;
  trayEventId: string;
  approved: boolean;
  note?: string | null;
  actorFiUserId: string | null;
  deviceId?: string | null;
  clientSubmissionId?: string | null;
  allowAdminOverride?: boolean;
}) {
  const tid = input.tenantId.trim();
  const supabase = supabaseAdmin();
  const { data: trayEvent, error } = await supabase
    .from("fi_surgery_graft_count_events")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", input.trayEventId.trim())
    .eq("surgery_id", input.surgeryId.trim())
    .maybeSingle();

  if (error) {
    if (isMissingDatabaseRelationError(error)) throw new Error("SurgeryOS graft tables are not available.");
    throw new Error(error.message);
  }
  if (!trayEvent) throw new Error("Tray count event not found.");
  const row = trayEvent as Record<string, unknown>;
  if (String(row.event_type) !== "tray_count") {
    throw new Error("Only tray count events can be reviewed.");
  }

  const sessionId = String(row.session_id);
  const sessionEvents = await loadGraftCountEventsForSession(tid, sessionId);
  const reviewStatus = deriveTrayReviewStatusForEvent(
    input.trayEventId.trim(),
    sessionEvents.map((e) => ({
      id: e.id,
      eventType: e.event_type,
      note: e.note,
      createdAt: e.created_at,
    })),
  );
  if (reviewStatus !== "pending") {
    throw new Error(`Tray has already been ${reviewStatus}.`);
  }

  const trayLabel = row.note != null ? String(row.note) : "Tray count";
  const reviewNote = input.note?.trim()
    ? `${input.approved ? "Confirmed" : "Rejected"}: ${trayLabel} — ${input.note.trim()}`
    : `${input.approved ? "Confirmed" : "Rejected"}: ${trayLabel}`;

  const singles = row.singles != null ? Number(row.singles) : 0;
  const doubles = row.doubles != null ? Number(row.doubles) : 0;
  const triples = row.triples != null ? Number(row.triples) : 0;
  const multiples = row.multiples != null ? Number(row.multiples) : 0;
  const totalHairs = row.total_hairs != null ? Number(row.total_hairs) : 0;
  const damaged = Number(row.delta_discarded ?? 0);

  return applyGraftMutation({
    tenantId: input.tenantId,
    surgeryId: input.surgeryId,
    actorFiUserId: input.actorFiUserId,
    deviceId: input.deviceId,
    allowAdminOverride: input.allowAdminOverride,
    patch: {
      eventType: input.approved ? "tray_confirmed" : "tray_rejected",
      sourceAction: "confirm_tray_count",
      note: reviewNote,
      deltaExtracted: 0,
      deltaImplanted: 0,
      deltaDiscarded: input.approved ? damaged : 0,
      deltaSingles: input.approved ? singles : undefined,
      deltaDoubles: input.approved ? doubles : undefined,
      deltaTriples: input.approved ? triples : undefined,
      deltaMultiples: input.approved ? multiples : undefined,
      deltaTotalHairs: input.approved ? totalHairs : undefined,
      clientSubmissionId: input.clientSubmissionId,
    },
  });
}

export async function reconcileGrafts(input: {
  tenantId: string;
  surgeryId: string;
  note?: string | null;
  actorFiUserId: string | null;
  allowAdminOverride?: boolean;
}) {
  const surgery = await loadSurgeryForGraftMutation(input.tenantId, input.surgeryId);
  assertSurgeryGraftCountingAllowed(surgery, input.allowAdminOverride);
  const session = await getOrCreateGraftSession(input.tenantId, surgery, input.actorFiUserId, "reconciliation");
  const remaining = computeRemainingGrafts(
    session.extracted_grafts,
    session.implanted_grafts,
    session.discarded_grafts,
  );

  const sessionEvents = await loadGraftCountEventsForSession(input.tenantId, session.id);
  const reviewStatuses = new Map(
    sessionEvents
      .filter((e) => e.event_type === "tray_count")
      .map((e) => [
        e.id,
        deriveTrayReviewStatusForEvent(
          e.id,
          sessionEvents.map((ev) => ({
            id: ev.id,
            eventType: ev.event_type,
            note: ev.note,
            createdAt: ev.created_at,
          })),
        ),
      ]),
  );
  const pendingTrayCount = countTrayReviewBuckets(
    sessionEvents.map((e) => ({
      eventType: e.event_type,
      reviewStatus: e.event_type === "tray_count" ? reviewStatuses.get(e.id) ?? "pending" : null,
    })),
  ).pending;

  assertGraftReconciliationGate({
    extractedGrafts: session.extracted_grafts,
    implantedGrafts: session.implanted_grafts,
    discardedGrafts: session.discarded_grafts,
    remainingGrafts: remaining,
    reconciliationStatus: session.reconciliation_status as SurgeryOsGraftReconciliationStatus,
    pendingTrayCount,
    requireCompleted: false,
  });

  if (remaining !== 0) {
    throw new Error(
      `Graft reconciliation mismatch: ${remaining} graft(s) unaccounted. Extracted − implanted − discarded must equal zero.`,
    );
  }

  return applyGraftMutation({
    tenantId: input.tenantId,
    surgeryId: input.surgeryId,
    actorFiUserId: input.actorFiUserId,
    allowAdminOverride: input.allowAdminOverride,
    patch: {
      phase: "reconciliation",
      reconciliationCompleted: true,
      eventType: "graft_reconciliation",
      sourceAction: "reconcile_grafts",
      note: input.note,
    },
  });
}

export function graftSessionToTotals(session: GraftSessionRow): ReturnType<typeof buildGraftTotalsFromSession> {
  return buildGraftTotalsFromSession({
    targetGrafts: session.target_grafts,
    extractedGrafts: session.extracted_grafts,
    implantedGrafts: session.implanted_grafts,
    discardedGrafts: session.discarded_grafts,
    singles: session.singles,
    doubles: session.doubles,
    triples: session.triples,
    multiples: session.multiples,
    totalHairs: session.total_hairs,
  });
}

export async function loadGraftSessionsForSurgeries(
  tenantId: string,
  surgeryIds: string[],
): Promise<Map<string, GraftSessionRow>> {
  const tid = tenantId.trim();
  const ids = surgeryIds.filter(Boolean);
  const out = new Map<string, GraftSessionRow>();
  if (!ids.length) return out;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_surgery_graft_sessions")
    .select("*")
    .eq("tenant_id", tid)
    .in("surgery_id", ids);

  if (error) {
    if (isMissingDatabaseRelationError(error)) return out;
    throw new Error(error.message);
  }

  for (const raw of data ?? []) {
    const row = mapGraftSessionRow(raw as Record<string, unknown>);
    assertSurgeryOsTenantRowScope(tid, row.tenant_id, "fi_surgery_graft_sessions");
    out.set(row.surgery_id, row);
  }
  return out;
}

export async function loadGraftCountEventsForSurgeries(
  tenantId: string,
  surgeryIds: string[],
): Promise<Map<string, GraftCountEventRow[]>> {
  const tid = tenantId.trim();
  const ids = surgeryIds.filter(Boolean);
  const out = new Map<string, GraftCountEventRow[]>();
  if (!ids.length) return out;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_surgery_graft_count_events")
    .select("*")
    .eq("tenant_id", tid)
    .in("surgery_id", ids)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingDatabaseRelationError(error)) return out;
    throw new Error(error.message);
  }

  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    const surgeryId = String(row.surgery_id);
    assertSurgeryOsTenantRowScope(tid, String(row.tenant_id), "fi_surgery_graft_count_events");
    const event: GraftCountEventRow = {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      surgery_id: surgeryId,
      session_id: String(row.session_id),
      event_type: String(row.event_type) as SurgeryOsGraftCountEventType,
      delta_extracted: Number(row.delta_extracted ?? 0),
      delta_implanted: Number(row.delta_implanted ?? 0),
      delta_discarded: Number(row.delta_discarded ?? 0),
      singles: row.singles != null ? Number(row.singles) : null,
      doubles: row.doubles != null ? Number(row.doubles) : null,
      triples: row.triples != null ? Number(row.triples) : null,
      multiples: row.multiples != null ? Number(row.multiples) : null,
      total_hairs: row.total_hairs != null ? Number(row.total_hairs) : null,
      note: row.note != null ? String(row.note) : null,
      created_by_fi_user_id:
        row.created_by_fi_user_id != null ? String(row.created_by_fi_user_id) : null,
      created_at: String(row.created_at),
      client_submission_id:
        row.client_submission_id != null ? String(row.client_submission_id) : null,
    };
    const list = out.get(surgeryId) ?? [];
    list.push(event);
    out.set(surgeryId, list);
  }
  return out;
}

export async function assertGraftReconciliationForPhaseTransition(input: {
  tenantId: string;
  surgeryId: string;
  toPhase: string;
}): Promise<void> {
  if (!shouldBlockSurgeryPhaseForGraftReconciliation(input.toPhase)) return;

  const surgery = await loadSurgeryForGraftMutation(input.tenantId, input.surgeryId);
  const sessions = await loadGraftSessionsForSurgeries(input.tenantId, [surgery.id]);
  const graftSession = sessions.get(surgery.id);
  if (!graftSession) {
    throw new Error("Graft reconciliation must be completed before moving to recovery or complete.");
  }

  const sessionEvents = await loadGraftCountEventsForSession(input.tenantId, graftSession.id);
  const reviewStatuses = new Map(
    sessionEvents
      .filter((e) => e.event_type === "tray_count")
      .map((e) => [
        e.id,
        deriveTrayReviewStatusForEvent(
          e.id,
          sessionEvents.map((ev) => ({
            id: ev.id,
            eventType: ev.event_type,
            note: ev.note,
            createdAt: ev.created_at,
          })),
        ),
      ]),
  );
  const pendingTrayCount = countTrayReviewBuckets(
    sessionEvents.map((e) => ({
      eventType: e.event_type,
      reviewStatus: e.event_type === "tray_count" ? reviewStatuses.get(e.id) ?? "pending" : null,
    })),
  ).pending;

  assertGraftReconciliationGate({
    extractedGrafts: graftSession.extracted_grafts,
    implantedGrafts: graftSession.implanted_grafts,
    discardedGrafts: graftSession.discarded_grafts,
    remainingGrafts: graftSession.remaining_grafts,
    reconciliationStatus: graftSession.reconciliation_status as SurgeryOsGraftReconciliationStatus,
    pendingTrayCount,
    requireCompleted: true,
  });
}
