import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  FI_CASE_PROCEDURE_SELECT_COLUMNS,
  mapCaseProcedureRowFromRecord,
} from "@/src/lib/cases/procedureDayLoaders";
import { upsertProcedureDayForCase } from "@/src/lib/cases/procedureDayUpdate";
import { buildProcedureEventAuditMetadata } from "@/src/lib/surgeryOs/surgeryOsPolicy";
import { loadGraftSessionsForSurgeries } from "@/src/lib/surgeryOs/surgeryGraftMutations.server";
import type { SurgeryMutationRow } from "@/src/lib/surgeryOs/surgeryMutations.server";
import {
  buildLiveTheatreCaseProcedurePatch,
  isLiveTheatreCaseSyncNoOp,
  type LiveTheatreCaseSyncTrigger,
  type LiveTheatreGraftSessionSnapshot,
  type LiveTheatreSurgerySnapshot,
} from "@/src/lib/surgeryOs/liveTheatreCaseSyncCore";
import type { GraftSessionRow } from "@/src/lib/surgeryOs/surgeryGraftMutations.server";

export type SyncLiveTheatreToCaseProcedureInput = {
  tenantId: string;
  surgeryId: string;
  trigger: LiveTheatreCaseSyncTrigger;
  actorFiUserId?: string | null;
};

export type SyncLiveTheatreToCaseProcedureResult = {
  synced: boolean;
  skipped: boolean;
  caseId: string | null;
  reason?: string;
};

function toSurgerySnapshot(surgery: SurgeryMutationRow): LiveTheatreSurgerySnapshot {
  return {
    id: surgery.id,
    case_id: surgery.case_id,
    status: surgery.status,
    scheduled_date: surgery.scheduled_date,
    actual_start_at: surgery.actual_start_at,
    actual_end_at: surgery.actual_end_at,
    surgeon_fi_user_id: surgery.surgeon_fi_user_id,
  };
}

function toGraftSnapshot(session: GraftSessionRow): LiveTheatreGraftSessionSnapshot {
  return {
    extracted_grafts: session.extracted_grafts,
    implanted_grafts: session.implanted_grafts,
    total_hairs: session.total_hairs,
    reconciliation_status: session.reconciliation_status,
    reconciled_at: session.reconciled_at,
  };
}

async function loadSurgeryForSync(
  tenantId: string,
  surgeryId: string,
  client: SupabaseClient
): Promise<SurgeryMutationRow | null> {
  const { data, error } = await client
    .from("fi_surgeries")
    .select(
      "id, tenant_id, patient_id, case_id, booking_id, clinic_id, surgeon_fi_user_id, status, live_status, procedure_phase, target_grafts, scheduled_date, scheduled_start_at, scheduled_end_at, actual_start_at, actual_end_at"
    )
    .eq("tenant_id", tenantId)
    .eq("id", surgeryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
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

async function loadExistingCaseProcedure(
  tenantId: string,
  caseId: string,
  client: SupabaseClient
) {
  const { data, error } = await client
    .from("fi_case_procedures")
    .select(FI_CASE_PROCEDURE_SELECT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("case_id", caseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapCaseProcedureRowFromRecord(data as Record<string, unknown>);
}

async function insertCaseSyncAuditEvent(input: {
  tenantId: string;
  surgeryId: string;
  caseId: string;
  trigger: LiveTheatreCaseSyncTrigger;
  actorFiUserId: string | null;
  patchKeys: string[];
}): Promise<void> {
  const supabase = supabaseAdmin();
  await supabase.from("fi_surgery_procedure_events").insert({
    tenant_id: input.tenantId.trim(),
    surgery_id: input.surgeryId.trim(),
    event_kind: "custom",
    recorded_by_fi_user_id: input.actorFiUserId,
    metadata: buildProcedureEventAuditMetadata({
      sourceAction: "live_theatre_case_sync",
      previousStatus: "",
      newStatus: input.trigger,
      previousPhase: "",
      newPhase: "",
      previousLiveStatus: "",
      newLiveStatus: "",
      extra: {
        case_id: input.caseId,
        sync_trigger: input.trigger,
        synced_fields: input.patchKeys,
        custom_label: "Live theatre synced to case procedure",
      },
    }),
  });
}

/**
 * Syncs live theatre surgery state into `fi_case_procedures` for the linked case.
 * Idempotent and preserves existing case procedure fields unless live data fills gaps.
 */
export async function syncLiveTheatreToCaseProcedure(
  input: SyncLiveTheatreToCaseProcedureInput,
  client?: SupabaseClient
): Promise<SyncLiveTheatreToCaseProcedureResult> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sid = assertNonEmptyUuid(input.surgeryId, "surgeryId");

  try {
    const surgery = await loadSurgeryForSync(tid, sid, supabase);
    if (!surgery) return { synced: false, skipped: true, caseId: null, reason: "surgery_not_found" };

    const caseId = surgery.case_id?.trim() || null;
    if (!caseId) {
      return { synced: false, skipped: true, caseId: null, reason: "no_linked_case" };
    }

    const graftSessions = await loadGraftSessionsForSurgeries(tid, [sid]);
    const graftSessionRow = graftSessions.get(sid) ?? null;
    const graftSession = graftSessionRow ? toGraftSnapshot(graftSessionRow) : null;

    const existing = await loadExistingCaseProcedure(tid, caseId, supabase);
    if (
      isLiveTheatreCaseSyncNoOp({
        existing,
        surgeryId: sid,
        trigger: input.trigger,
        graftSession,
      })
    ) {
      return { synced: false, skipped: true, caseId, reason: "already_synced" };
    }

    const syncedAt = new Date().toISOString();
    const patch = buildLiveTheatreCaseProcedurePatch({
      surgery: toSurgerySnapshot(surgery),
      graftSession,
      existing,
      trigger: input.trigger,
      syncedAt,
    });
    if (!patch) {
      return { synced: false, skipped: true, caseId, reason: "no_patch" };
    }

    await upsertProcedureDayForCase({ tenantId: tid, caseId, patch }, supabase);

    try {
      await insertCaseSyncAuditEvent({
        tenantId: tid,
        surgeryId: sid,
        caseId,
        trigger: input.trigger,
        actorFiUserId: input.actorFiUserId ?? null,
        patchKeys: Object.keys(patch),
      });
    } catch {
      /* audit is best-effort */
    }

    return { synced: true, skipped: false, caseId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync_failed";
    return { synced: false, skipped: false, caseId: null, reason: message };
  }
}
