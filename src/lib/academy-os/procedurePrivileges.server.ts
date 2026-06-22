import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import { publishAcademyProcedurePrivilegeEvent } from "./academyAnalyticsPublisher.server";
import {
  buildProcedurePrivilegeEligibilitySnapshot,
  evaluateRoleProcedureRequirements,
  resolvePrivilegeStatus,
} from "./procedurePrivilegeEngine";
import {
  DEFAULT_PROCEDURE_PRIVILEGE_REQUIREMENTS,
  type ProcedurePrivilegeRequirementSeedResult,
} from "./procedurePrivilegeRequirementDefaults";
import type {
  FiProcedurePrivilegeRequirementRow,
  FiStaffProcedurePrivilegeRow,
  PrivilegeLevel,
  PrivilegeStatus,
  ProcedurePrivilegeEligibilityResult,
} from "./procedurePrivilegeTypes";
import { isPrivilegeLevel } from "./procedurePrivilegeTypes";

function mapPrivilegeRow(raw: Record<string, unknown>): FiStaffProcedurePrivilegeRow {
  return {
    id: String(raw.id),
    tenantId: String(raw.tenant_id),
    clinicId: raw.clinic_id != null ? String(raw.clinic_id) : null,
    staffId: String(raw.staff_id),
    procedureKey: String(raw.procedure_key),
    privilegeLevel: String(raw.privilege_level) as PrivilegeLevel,
    privilegeStatus: String(raw.privilege_status) as PrivilegeStatus,
    sourceSystem: String(raw.source_system),
    sourceCompetencyKey: raw.source_competency_key != null ? String(raw.source_competency_key) : null,
    sourceProjectionId: raw.source_projection_id != null ? String(raw.source_projection_id) : null,
    grantedBy: raw.granted_by != null ? String(raw.granted_by) : null,
    grantedAt: String(raw.granted_at),
    expiresAt: raw.expires_at != null ? String(raw.expires_at) : null,
    reviewedAt: raw.reviewed_at != null ? String(raw.reviewed_at) : null,
    reviewDueAt: raw.review_due_at != null ? String(raw.review_due_at) : null,
    restrictionReason: raw.restriction_reason != null ? String(raw.restriction_reason) : null,
    notes: raw.notes != null ? String(raw.notes) : null,
    metadata:
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : {},
    createdAt: String(raw.created_at),
    updatedAt: String(raw.updated_at),
  };
}

function mapRequirementRow(raw: Record<string, unknown>): FiProcedurePrivilegeRequirementRow {
  return {
    id: String(raw.id),
    tenantId: String(raw.tenant_id),
    clinicId: raw.clinic_id != null ? String(raw.clinic_id) : null,
    eventType: String(raw.event_type),
    assignedRole: String(raw.assigned_role),
    requiredProcedureKey: String(raw.required_procedure_key),
    minimumPrivilegeLevel: String(raw.minimum_privilege_level) as PrivilegeLevel,
    isActive: Boolean(raw.is_active),
    createdAt: String(raw.created_at),
    updatedAt: String(raw.updated_at),
  };
}

function normalizeRole(value: string): string {
  return value.trim().toLowerCase();
}

function resolveRequirementsForContext(input: {
  requirements: FiProcedurePrivilegeRequirementRow[];
  eventType: string;
  assignedRole: string;
  clinicId?: string | null;
}): FiProcedurePrivilegeRequirementRow[] {
  const eventType = input.eventType.trim().toLowerCase();
  const role = normalizeRole(input.assignedRole);
  const clinicId = input.clinicId?.trim() || null;

  const matching = input.requirements.filter(
    (r) => r.isActive && r.eventType.trim().toLowerCase() === eventType && normalizeRole(r.assignedRole) === role
  );

  if (clinicId) {
    const clinicSpecific = matching.filter((r) => r.clinicId?.trim() === clinicId);
    if (clinicSpecific.length > 0) return clinicSpecific;
  }

  return matching.filter((r) => !r.clinicId?.trim());
}

export async function loadStaffProcedurePrivileges(
  tenantId: string,
  staffId: string,
  client?: SupabaseClient
): Promise<FiStaffProcedurePrivilegeRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const sid = assertNonEmptyUuid(staffId, "staffId");
  const supabase = client ?? supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_staff_procedure_privileges")
    .select("*")
    .eq("tenant_id", tid)
    .eq("staff_id", sid)
    .order("procedure_key", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapPrivilegeRow(row as Record<string, unknown>));
}

export async function loadProcedurePrivilegeRequirements(
  tenantId: string,
  clinicId?: string | null,
  eventType?: string | null,
  assignedRole?: string | null,
  client?: SupabaseClient
): Promise<FiProcedurePrivilegeRequirementRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();

  let query = supabase.from("fi_procedure_privilege_requirements").select("*").eq("tenant_id", tid).eq("is_active", true);

  if (eventType?.trim()) {
    query = query.eq("event_type", eventType.trim().toLowerCase());
  }
  if (assignedRole?.trim()) {
    query = query.eq("assigned_role", normalizeRole(assignedRole));
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = (data ?? []).map((row) => mapRequirementRow(row as Record<string, unknown>));

  if (clinicId?.trim()) {
    const cid = clinicId.trim();
    const clinicRows = rows.filter((r) => r.clinicId?.trim() === cid);
    if (clinicRows.length > 0) {
      rows = clinicRows;
    } else {
      rows = rows.filter((r) => !r.clinicId?.trim());
    }
  }

  return rows;
}

export async function loadAllProcedurePrivilegeRequirementsForTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<FiProcedurePrivilegeRequirementRow[]> {
  return loadProcedurePrivilegeRequirements(tenantId, null, null, null, client);
}

export type GrantStaffProcedurePrivilegeInput = {
  tenantId: string;
  staffId: string;
  procedureKey: string;
  privilegeLevel: PrivilegeLevel;
  clinicId?: string | null;
  sourceSystem?: string;
  sourceCompetencyKey?: string | null;
  sourceProjectionId?: string | null;
  grantedBy?: string | null;
  expiresAt?: string | null;
  reviewDueAt?: string | null;
  notes?: string | null;
  privilegeStatus?: PrivilegeStatus;
};

export async function grantStaffProcedurePrivilege(
  input: GrantStaffProcedurePrivilegeInput,
  client?: SupabaseClient
): Promise<FiStaffProcedurePrivilegeRow> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sid = assertNonEmptyUuid(input.staffId, "staffId");
  if (!isPrivilegeLevel(input.privilegeLevel)) {
    throw new Error("Invalid privilege level");
  }

  const supabase = client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("fi_staff_procedure_privileges")
    .insert({
      tenant_id: tid,
      staff_id: sid,
      clinic_id: input.clinicId?.trim() || null,
      procedure_key: input.procedureKey.trim().toLowerCase(),
      privilege_level: input.privilegeLevel,
      privilege_status: input.privilegeStatus ?? "active",
      source_system: input.sourceSystem?.trim() || "fi_os",
      source_competency_key: input.sourceCompetencyKey?.trim() || null,
      source_projection_id: input.sourceProjectionId?.trim() || null,
      granted_by: input.grantedBy?.trim() || null,
      granted_at: now,
      expires_at: input.expiresAt ?? null,
      review_due_at: input.reviewDueAt ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not grant procedure privilege.");
  const row = mapPrivilegeRow(data as Record<string, unknown>);

  void publishAcademyProcedurePrivilegeEvent({
    eventType: "procedure_privilege_granted",
    tenantId: tid,
    staffId: sid,
    privilege: row,
  });

  return row;
}

export type MutateStaffProcedurePrivilegeInput = {
  tenantId: string;
  privilegeId: string;
  staffId: string;
  reason?: string | null;
  mutatedBy?: string | null;
};

export async function suspendStaffProcedurePrivilege(
  input: MutateStaffProcedurePrivilegeInput,
  client?: SupabaseClient
): Promise<FiStaffProcedurePrivilegeRow> {
  return updatePrivilegeStatus({ ...input, privilegeStatus: "suspended" }, client);
}

export async function revokeStaffProcedurePrivilege(
  input: MutateStaffProcedurePrivilegeInput,
  client?: SupabaseClient
): Promise<FiStaffProcedurePrivilegeRow> {
  return updatePrivilegeStatus({ ...input, privilegeStatus: "revoked" }, client);
}

async function updatePrivilegeStatus(
  input: MutateStaffProcedurePrivilegeInput & { privilegeStatus: PrivilegeStatus },
  client?: SupabaseClient
): Promise<FiStaffProcedurePrivilegeRow> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const pid = assertNonEmptyUuid(input.privilegeId, "privilegeId");
  const supabase = client ?? supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_staff_procedure_privileges")
    .update({
      privilege_status: input.privilegeStatus,
      restriction_reason: input.reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tid)
    .eq("id", pid)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Could not update procedure privilege.");
  const row = mapPrivilegeRow(data as Record<string, unknown>);

  void publishAcademyProcedurePrivilegeEvent({
    eventType:
      input.privilegeStatus === "suspended" ? "procedure_privilege_suspended" : "procedure_privilege_revoked",
    tenantId: tid,
    staffId: input.staffId,
    privilege: row,
    reason: input.reason,
  });

  return row;
}

export async function expireStaffProcedurePrivilegesJob(input: {
  tenantId: string;
  at?: Date;
  client?: SupabaseClient;
}): Promise<{ expired: number }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const at = input.at ?? new Date();
  const supabase = input.client ?? supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_staff_procedure_privileges")
    .select("*")
    .eq("tenant_id", tid)
    .in("privilege_status", ["active", "pending_review"])
    .not("expires_at", "is", null)
    .lte("expires_at", at.toISOString());

  if (error) throw new Error(error.message);

  let expired = 0;
  for (const raw of data ?? []) {
    const row = mapPrivilegeRow(raw as Record<string, unknown>);
    const effective = resolvePrivilegeStatus({
      privilegeStatus: row.privilegeStatus,
      expiresAt: row.expiresAt,
      at,
    });
    if (effective !== "expired") continue;

    const { error: updErr } = await supabase
      .from("fi_staff_procedure_privileges")
      .update({ privilege_status: "expired", updated_at: at.toISOString() })
      .eq("id", row.id)
      .eq("tenant_id", tid);

    if (updErr) throw new Error(updErr.message);
    expired += 1;

    void publishAcademyProcedurePrivilegeEvent({
      eventType: "procedure_privilege_expired",
      tenantId: tid,
      staffId: row.staffId,
      privilege: { ...row, privilegeStatus: "expired" },
    });
  }

  return { expired };
}

export async function evaluateStaffProcedurePrivilegeForEvent(input: {
  tenantId: string;
  staffId: string;
  clinicId?: string | null;
  eventType: string;
  assignedRole: string;
  blockPendingReview?: boolean;
  at?: Date;
  privileges?: FiStaffProcedurePrivilegeRow[];
  requirements?: FiProcedurePrivilegeRequirementRow[];
}): Promise<ProcedurePrivilegeEligibilityResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sid = assertNonEmptyUuid(input.staffId, "staffId");

  const [privileges, allRequirements] = await Promise.all([
    input.privileges ?? loadStaffProcedurePrivileges(tid, sid),
    input.requirements ?? loadAllProcedurePrivilegeRequirementsForTenant(tid),
  ]);

  const scopedRequirements = resolveRequirementsForContext({
    requirements: allRequirements,
    eventType: input.eventType,
    assignedRole: input.assignedRole,
    clinicId: input.clinicId,
  });

  return evaluateRoleProcedureRequirements({
    privileges,
    requirements: scopedRequirements,
    assignedRole: input.assignedRole,
    clinicId: input.clinicId,
    blockPendingReview: input.blockPendingReview,
    at: input.at,
  });
}

export async function evaluateStaffProcedurePrivilegesForAssignments(input: {
  tenantId: string;
  clinicId?: string | null;
  eventType: string;
  assignments: Array<{ staffId: string; assignedRole: string }>;
  blockPendingReview?: boolean;
  at?: Date;
}): Promise<
  Map<
    string,
    ProcedurePrivilegeEligibilityResult & { eligibilitySnapshot: Record<string, unknown> }
  >
> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const allRequirements = await loadAllProcedurePrivilegeRequirementsForTenant(tid);
  const results = new Map<
    string,
    ProcedurePrivilegeEligibilityResult & { eligibilitySnapshot: Record<string, unknown> }
  >();

  for (const assignment of input.assignments) {
    const privileges = await loadStaffProcedurePrivileges(tid, assignment.staffId);
    const scopedRequirements = resolveRequirementsForContext({
      requirements: allRequirements,
      eventType: input.eventType,
      assignedRole: assignment.assignedRole,
      clinicId: input.clinicId,
    });

    const eligibility = evaluateRoleProcedureRequirements({
      privileges,
      requirements: scopedRequirements,
      assignedRole: assignment.assignedRole,
      clinicId: input.clinicId,
      blockPendingReview: input.blockPendingReview,
      at: input.at,
    });

    const key = `${assignment.staffId}::${normalizeRole(assignment.assignedRole)}`;
    results.set(key, {
      ...eligibility,
      eligibilitySnapshot: buildProcedurePrivilegeEligibilitySnapshot({
        eligibility,
        assignedRole: assignment.assignedRole,
        eventType: input.eventType,
      }),
    });

    if (!eligibility.eligible && scopedRequirements.length > 0) {
      void publishAcademyProcedurePrivilegeEvent({
        eventType: "privilege_requirement_missing",
        tenantId: tid,
        staffId: assignment.staffId,
        privilege: null,
        eventMetadata: {
          event_type: input.eventType,
          assigned_role: assignment.assignedRole,
          missing_requirements: eligibility.missingRequirements,
          privilege_status: eligibility.status,
        },
      });
    }
  }

  return results;
}

export async function seedDefaultProcedurePrivilegeRequirementsForTenant(
  tenantId: string,
  clinicId?: string | null,
  client?: SupabaseClient
): Promise<ProcedurePrivilegeRequirementSeedResult> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  let created = 0;
  let skipped = 0;

  for (const req of DEFAULT_PROCEDURE_PRIVILEGE_REQUIREMENTS) {
    let query = supabase
      .from("fi_procedure_privilege_requirements")
      .select("id")
      .eq("tenant_id", tid)
      .eq("event_type", req.event_type)
      .eq("assigned_role", req.assigned_role)
      .eq("required_procedure_key", req.required_procedure_key)
      .eq("is_active", true);

    if (clinicId?.trim()) {
      query = query.eq("clinic_id", clinicId.trim());
    } else {
      query = query.is("clinic_id", null);
    }

    const { data: existing, error: findErr } = await query.maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (existing) {
      skipped += 1;
      continue;
    }

    const { error: insErr } = await supabase.from("fi_procedure_privilege_requirements").insert({
      tenant_id: tid,
      clinic_id: clinicId?.trim() || null,
      event_type: req.event_type,
      assigned_role: req.assigned_role,
      required_procedure_key: req.required_procedure_key,
      minimum_privilege_level: req.minimum_privilege_level,
      is_active: true,
    });
    if (insErr) throw new Error(insErr.message);
    created += 1;
  }

  return { created, skipped };
}
