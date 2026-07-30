/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.1 — tenant-safe cohort query (server).
 * Read-only. Never infers membership from quotes/appointments/clinical rows.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import {
  EVOLVED_CONTROLLED_PILOT_PROGRAMME_KEY,
  type PilotEnrolmentStatus,
} from "./pilotControlContracts";
import {
  includeInActiveOperationalMetrics,
  includeInHistoricalPilotReporting,
  isPilotEnrolmentStatus,
} from "./pilotEnrolmentCore";

export type PilotProgrammeRecord = {
  id: string;
  tenantId: string;
  programmeKey: string;
  displayName: string;
  status: string;
  cohortKey: string;
  escalationThresholds: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type PilotEnrolmentRecord = {
  id: string;
  tenantId: string;
  programmeId: string;
  patientId: string;
  pilotProgrammeKey: string;
  pilotCohort: string;
  enrolmentStatus: PilotEnrolmentStatus;
  enrolledAt: string | null;
  invitedAt: string | null;
  activatedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  withdrawnAt: string | null;
  excludedAt: string | null;
  enrolledBy: string | null;
  approvedBy: string | null;
  operationalOwnerUserId: string | null;
  operationalOwnerRole: string | null;
  notes: string | null;
  exclusionReason: string | null;
  withdrawalReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PilotCohortQueryOptions = {
  supabase?: SupabaseClient;
  programmeKey?: string;
  /** When true, include completed for historical reporting. Default false = operational only. */
  includeHistorical?: boolean;
  statuses?: readonly PilotEnrolmentStatus[];
};

function mapProgramme(row: Record<string, unknown>): PilotProgrammeRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    programmeKey: String(row.programme_key),
    displayName: String(row.display_name),
    status: String(row.status),
    cohortKey: String(row.cohort_key),
    escalationThresholds:
      row.escalation_thresholds && typeof row.escalation_thresholds === "object"
        ? (row.escalation_thresholds as Record<string, unknown>)
        : {},
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
  };
}

function mapEnrolment(row: Record<string, unknown>): PilotEnrolmentRecord | null {
  const statusRaw = String(row.enrolment_status ?? "");
  if (!isPilotEnrolmentStatus(statusRaw)) return null;
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    programmeId: String(row.programme_id),
    patientId: String(row.patient_id),
    pilotProgrammeKey: String(row.pilot_programme_key),
    pilotCohort: String(row.pilot_cohort),
    enrolmentStatus: statusRaw,
    enrolledAt: row.enrolled_at != null ? String(row.enrolled_at) : null,
    invitedAt: row.invited_at != null ? String(row.invited_at) : null,
    activatedAt: row.activated_at != null ? String(row.activated_at) : null,
    pausedAt: row.paused_at != null ? String(row.paused_at) : null,
    completedAt: row.completed_at != null ? String(row.completed_at) : null,
    withdrawnAt: row.withdrawn_at != null ? String(row.withdrawn_at) : null,
    excludedAt: row.excluded_at != null ? String(row.excluded_at) : null,
    enrolledBy: row.enrolled_by != null ? String(row.enrolled_by) : null,
    approvedBy: row.approved_by != null ? String(row.approved_by) : null,
    operationalOwnerUserId:
      row.operational_owner_user_id != null ? String(row.operational_owner_user_id) : null,
    operationalOwnerRole:
      row.operational_owner_role != null ? String(row.operational_owner_role) : null,
    notes: row.notes != null ? String(row.notes) : null,
    exclusionReason: row.exclusion_reason != null ? String(row.exclusion_reason) : null,
    withdrawalReason: row.withdrawal_reason != null ? String(row.withdrawal_reason) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function loadPilotProgrammeForTenant(
  args: { tenantId: string; programmeKey?: string },
  options?: Pick<PilotCohortQueryOptions, "supabase">
): Promise<PilotProgrammeRecord | null> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const key = (args.programmeKey ?? EVOLVED_CONTROLLED_PILOT_PROGRAMME_KEY).trim();

  const { data, error } = await supabase
    .from("fi_pilot_programmes")
    .select(
      "id, tenant_id, programme_key, display_name, status, cohort_key, escalation_thresholds, metadata"
    )
    .eq("tenant_id", tid)
    .eq("programme_key", key)
    .maybeSingle();

  if (error) throw new Error(`loadPilotProgrammeForTenant: ${error.message}`);
  if (!data) return null;
  return mapProgramme(data as Record<string, unknown>);
}

/**
 * Resolve programme by UUID or programme_key within a tenant. Fail closed if not found.
 */
export async function loadPilotProgrammeByIdOrKey(
  args: { tenantId: string; programmeIdOrKey: string },
  options?: Pick<PilotCohortQueryOptions, "supabase">
): Promise<PilotProgrammeRecord | null> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const raw = args.programmeIdOrKey.trim();
  if (!raw) return null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);

  let query = supabase
    .from("fi_pilot_programmes")
    .select(
      "id, tenant_id, programme_key, display_name, status, cohort_key, escalation_thresholds, metadata"
    )
    .eq("tenant_id", tid);

  query = isUuid ? query.eq("id", raw) : query.eq("programme_key", raw);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`loadPilotProgrammeByIdOrKey: ${error.message}`);
  if (!data) return null;
  const mapped = mapProgramme(data as Record<string, unknown>);
  return mapped.tenantId === tid ? mapped : null;
}

/** List programmes for a tenant (never cross-tenant). */
export async function loadPilotProgrammesForTenant(
  args: { tenantId: string },
  options?: Pick<PilotCohortQueryOptions, "supabase">
): Promise<PilotProgrammeRecord[]> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");

  const { data, error } = await supabase
    .from("fi_pilot_programmes")
    .select(
      "id, tenant_id, programme_key, display_name, status, cohort_key, escalation_thresholds, metadata"
    )
    .eq("tenant_id", tid)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`loadPilotProgrammesForTenant: ${error.message}`);
  return (data ?? [])
    .map((row) => mapProgramme(row as Record<string, unknown>))
    .filter((p) => p.tenantId === tid);
}

/**
 * Load explicit pilot enrolments for a tenant.
 * Always filters by tenant_id. Does not join unrelated activity tables for membership.
 */
export async function loadPilotEnrolmentsForTenant(
  args: { tenantId: string; programmeId?: string },
  options?: PilotCohortQueryOptions
): Promise<PilotEnrolmentRecord[]> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");

  let query = supabase
    .from("fi_pilot_enrolments")
    .select(
      "id, tenant_id, programme_id, patient_id, pilot_programme_key, pilot_cohort, enrolment_status, enrolled_at, invited_at, activated_at, paused_at, completed_at, withdrawn_at, excluded_at, enrolled_by, approved_by, operational_owner_user_id, operational_owner_role, notes, exclusion_reason, withdrawal_reason, created_at, updated_at"
    )
    .eq("tenant_id", tid)
    .order("updated_at", { ascending: false });

  if (args.programmeId) {
    const pid = assertNonEmptyUuid(args.programmeId, "programmeId");
    query = query.eq("programme_id", pid);
  }

  if (options?.statuses && options.statuses.length > 0) {
    query = query.in("enrolment_status", [...options.statuses]);
  }

  const { data, error } = await query;
  if (error) throw new Error(`loadPilotEnrolmentsForTenant: ${error.message}`);

  const mapped = (data ?? [])
    .map((row) => mapEnrolment(row as Record<string, unknown>))
    .filter((r): r is PilotEnrolmentRecord => r != null)
    // Defence in depth: drop any row that somehow escaped tenant filter.
    .filter((r) => r.tenantId === tid);

  if (options?.statuses) return mapped;

  if (options?.includeHistorical) {
    return mapped.filter((r) => includeInHistoricalPilotReporting(r.enrolmentStatus));
  }

  return mapped.filter((r) => includeInActiveOperationalMetrics(r.enrolmentStatus));
}

/**
 * Resolve a single patient enrolment within a tenant — fail closed on 0 or >1 matches.
 */
export async function loadPilotEnrolmentForPatient(
  args: { tenantId: string; patientId: string; programmeId?: string },
  options?: Pick<PilotCohortQueryOptions, "supabase">
): Promise<
  | { ok: true; enrolment: PilotEnrolmentRecord }
  | { ok: false; code: "not_enrolled" | "ambiguous_enrolment" | "invalid_status" }
> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(args.tenantId, "tenantId");
  const patientId = assertNonEmptyUuid(args.patientId, "patientId");

  let query = supabase
    .from("fi_pilot_enrolments")
    .select(
      "id, tenant_id, programme_id, patient_id, pilot_programme_key, pilot_cohort, enrolment_status, enrolled_at, invited_at, activated_at, paused_at, completed_at, withdrawn_at, excluded_at, enrolled_by, approved_by, operational_owner_user_id, operational_owner_role, notes, exclusion_reason, withdrawal_reason, created_at, updated_at"
    )
    .eq("tenant_id", tid)
    .eq("patient_id", patientId);

  if (args.programmeId) {
    query = query.eq("programme_id", assertNonEmptyUuid(args.programmeId, "programmeId"));
  }

  const { data, error } = await query;
  if (error) throw new Error(`loadPilotEnrolmentForPatient: ${error.message}`);

  const mapped = (data ?? [])
    .map((row) => mapEnrolment(row as Record<string, unknown>))
    .filter((r): r is PilotEnrolmentRecord => r != null)
    .filter((r) => r.tenantId === tid && r.patientId === patientId);

  if (mapped.length === 0) return { ok: false, code: "not_enrolled" };
  if (mapped.length > 1) return { ok: false, code: "ambiguous_enrolment" };
  return { ok: true, enrolment: mapped[0]! };
}
