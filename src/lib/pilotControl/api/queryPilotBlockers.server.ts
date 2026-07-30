/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 — persisted blocker register queries (server).
 * Prefer reading fi_pilot_blockers over cohort re-evaluation on every refresh.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import type {
  PilotBlockerCategory,
  PilotBlockerDimension,
  PilotBlockerOwner,
  PilotBlockerResolutionState,
  PilotBlockerSeverity,
  PilotEscalationLevel,
  PilotSourceModule,
} from "../pilotControlContracts";
import type { PilotBlockerRecord } from "../blockers/blockerTypes";
import { PILOT_BLOCKER_ACTIVE_STATES } from "../pilotControlContracts";

function adminClient(supabase?: SupabaseClient): SupabaseClient {
  return supabase ?? supabaseAdmin();
}

export type PilotBlockerQueryFilters = {
  patientId?: string;
  state?: string | string[];
  category?: string;
  dimension?: string;
  severity?: string;
  ownerType?: string;
  ownerUserId?: string;
  escalated?: boolean;
  requiresPilotPause?: boolean;
  ageFrom?: number;
  ageTo?: number;
};

function mapBlockerRow(row: Record<string, unknown>): PilotBlockerRecord {
  const ownership =
    row.ownership && typeof row.ownership === "object"
      ? (row.ownership as Record<string, unknown>)
      : {};
  const escalation =
    row.escalation && typeof row.escalation === "object"
      ? (row.escalation as Record<string, unknown>)
      : {};

  return {
    blockerKey: String(row.blocker_key ?? row.fingerprint ?? ""),
    fingerprint: String(row.fingerprint),
    programmeId: String(row.programme_id),
    enrolmentId: String(row.enrolment_id),
    tenantId: String(row.tenant_id),
    patientId: String(row.patient_id),
    category: String(row.category) as PilotBlockerCategory,
    subcategory: row.subcategory != null ? String(row.subcategory) : undefined,
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    patientSafeSummary:
      row.patient_safe_summary != null ? String(row.patient_safe_summary) : undefined,
    recommendedNextAction: String(row.recommended_next_action ?? ""),
    sourceModule: String(row.source_module) as PilotSourceModule,
    sourceRecordId: row.source_record_id != null ? String(row.source_record_id) : undefined,
    sourceSignalKey: row.source_signal_key != null ? String(row.source_signal_key) : undefined,
    dimension: String(row.dimension) as PilotBlockerDimension,
    severity: String(row.severity) as PilotBlockerSeverity,
    state: String(row.state) as PilotBlockerResolutionState,
    ownership: {
      ownerType: String(ownership.ownerType ?? row.owner_type ?? "unassigned") as PilotBlockerOwner,
      ownerUserId:
        ownership.ownerUserId != null
          ? String(ownership.ownerUserId)
          : row.owner_user_id != null
            ? String(row.owner_user_id)
            : undefined,
      ownerRole:
        ownership.ownerRole != null
          ? String(ownership.ownerRole)
          : row.owner_role != null
            ? String(row.owner_role)
            : undefined,
      assignmentSource: String(
        ownership.assignmentSource ?? row.assignment_source ?? "module_default"
      ) as PilotBlockerRecord["ownership"]["assignmentSource"],
      ownershipReason: String(ownership.ownershipReason ?? ""),
    },
    firstDetectedAt: String(row.first_detected_at),
    lastConfirmedAt: String(row.last_confirmed_at ?? row.first_detected_at),
    ageSeconds: Number(row.age_seconds ?? 0),
    escalation: {
      level: String(escalation.level ?? row.escalation_level ?? "none") as PilotEscalationLevel,
      escalated: Boolean(escalation.escalated ?? false),
      requiresPilotPause: Boolean(
        escalation.requiresPilotPause ?? row.requires_pilot_pause ?? false
      ),
      requiresImmediateReview: Boolean(escalation.requiresImmediateReview ?? false),
    },
    provenance: Array.isArray(row.provenance) ? (row.provenance as PilotBlockerRecord["provenance"]) : [],
    correlationIds: Array.isArray(row.correlation_ids)
      ? (row.correlation_ids as string[])
      : [],
    detectedByVersion: String(row.detected_by_version ?? ""),
    evaluatedAt: String(row.updated_at ?? row.last_confirmed_at ?? new Date().toISOString()),
    criticalIntegrity: Boolean(row.critical_integrity),
  };
}

/**
 * Query persisted blockers for a programme. Default = active states only.
 * Does not scan JSON provenance for ordinary filters.
 */
export async function queryPilotBlockersForProgramme(args: {
  tenantId: string;
  programmeId: string;
  filters?: PilotBlockerQueryFilters;
  page?: number;
  pageSize?: number;
  supabase?: SupabaseClient;
}): Promise<{ items: PilotBlockerRecord[]; total: number }> {
  const db = adminClient(args.supabase);
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const pid = assertNonEmptyUuid(args.programmeId, "programmeId");
  const page = args.page ?? 1;
  const pageSize = args.pageSize ?? 25;
  const filters = args.filters ?? {};

  const states =
    filters.state == null
      ? [...PILOT_BLOCKER_ACTIVE_STATES]
      : Array.isArray(filters.state)
        ? filters.state
        : [filters.state];

  let query = db
    .from("fi_pilot_blockers")
    .select("*", { count: "exact" })
    .eq("tenant_id", tid)
    .eq("programme_id", pid)
    .in("state", states);

  if (filters.patientId) query = query.eq("patient_id", filters.patientId);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.dimension) query = query.eq("dimension", filters.dimension);
  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.ownerType) query = query.eq("owner_type", filters.ownerType);
  if (filters.ownerUserId) query = query.eq("owner_user_id", filters.ownerUserId);
  if (filters.requiresPilotPause === true) query = query.eq("requires_pilot_pause", true);
  if (filters.ageFrom != null) query = query.gte("age_seconds", filters.ageFrom);
  if (filters.ageTo != null) query = query.lte("age_seconds", filters.ageTo);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.order("severity", { ascending: true }).range(from, to);

  const { data, error, count } = await query;
  if (error) {
    if (String(error.message).includes("fi_pilot_blockers") || error.code === "42P01") {
      return { items: [], total: 0 };
    }
    throw error;
  }

  let items = (data ?? [])
    .map((r) => mapBlockerRow(r as Record<string, unknown>))
    .filter((b) => b.tenantId === tid && b.programmeId === pid);

  if (filters.escalated === true) {
    items = items.filter((b) => b.escalation.escalated);
  }

  return { items, total: count ?? items.length };
}

/** Load all active blockers for overview health (bounded). */
export async function loadActiveProgrammeBlockers(args: {
  tenantId: string;
  programmeId: string;
  limit?: number;
  supabase?: SupabaseClient;
}): Promise<PilotBlockerRecord[]> {
  const result = await queryPilotBlockersForProgramme({
    tenantId: args.tenantId,
    programmeId: args.programmeId,
    page: 1,
    pageSize: args.limit ?? 200,
    supabase: args.supabase,
  });
  return result.items;
}
