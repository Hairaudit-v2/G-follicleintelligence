import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

import {
  assertRecruitmentStageTransition,
  defaultOfferStatusForStage,
  isRecruitmentCandidateSource,
  normalizeRecruitmentOfferStatus,
  normalizeRecruitmentPipelineStage,
  type OnboardingTemplateOption,
  type RecruitmentCandidate,
  type RecruitmentCandidateSource,
  type RecruitmentOfferStatus,
  type RecruitmentPipelineStage,
  type RecruitmentStageEvent,
  type WorkforceRoleRequirement,
} from "./recruitmentPipelineCore";

function mapRoleRequirement(row: Record<string, unknown>): WorkforceRoleRequirement {
  const req = row.requirements_json;
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    roleCode: String(row.role_code),
    displayName: String(row.display_name),
    description: row.description != null ? String(row.description) : null,
    requirementsJson:
      req && typeof req === "object" && !Array.isArray(req)
        ? (req as Record<string, unknown>)
        : {},
    onboardingTemplateCode:
      row.onboarding_template_code != null ? String(row.onboarding_template_code) : null,
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapCandidate(
  row: Record<string, unknown>,
  role?: WorkforceRoleRequirement | null
): RecruitmentCandidate {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    roleRequirementId: row.role_requirement_id != null ? String(row.role_requirement_id) : null,
    roleCode: role?.roleCode ?? null,
    roleDisplayName: role?.displayName ?? null,
    fullName: String(row.full_name),
    email: row.email != null ? String(row.email) : null,
    phone: row.phone != null ? String(row.phone) : null,
    source: (() => {
      const src = String(row.source ?? "direct").trim().toLowerCase();
      return isRecruitmentCandidateSource(src) ? src : "direct";
    })(),
    pipelineStage: normalizeRecruitmentPipelineStage(String(row.pipeline_stage)),
    offerStatus: normalizeRecruitmentOfferStatus(String(row.offer_status)),
    onboardingTemplateCode:
      row.onboarding_template_code != null ? String(row.onboarding_template_code) : null,
    notes: row.notes != null ? String(row.notes) : null,
    assignedToUserId:
      row.assigned_to_user_id != null ? String(row.assigned_to_user_id) : null,
    hiredStaffMemberId:
      row.hired_staff_member_id != null ? String(row.hired_staff_member_id) : null,
    archivedAt: row.archived_at != null ? String(row.archived_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapStageEvent(row: Record<string, unknown>): RecruitmentStageEvent {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    candidateId: String(row.candidate_id),
    fromStage:
      row.from_stage != null
        ? normalizeRecruitmentPipelineStage(String(row.from_stage))
        : null,
    toStage: normalizeRecruitmentPipelineStage(String(row.to_stage)),
    offerStatus:
      row.offer_status != null
        ? normalizeRecruitmentOfferStatus(String(row.offer_status))
        : null,
    notes: row.notes != null ? String(row.notes) : null,
    recordedByUserId:
      row.recorded_by_user_id != null ? String(row.recorded_by_user_id) : null,
    recordedAt: String(row.recorded_at),
  };
}

export async function listOnboardingTemplateOptions(
  client?: SupabaseClient
): Promise<OnboardingTemplateOption[]> {
  const supabase = client ?? supabaseAdmin();
  // tenant-guard-allow: fi_tenant_provisioning_templates is a platform-global reference catalogue (no tenant_id column); read-only lookup of active templates.
  const { data, error } = await supabase
    .from("fi_tenant_provisioning_templates")
    .select("code, display_name, description")
    .eq("is_active", true)
    .order("display_name", { ascending: true });
  if (error) {
    if (error.message?.includes("does not exist")) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => ({
    code: String((r as { code: string }).code),
    displayName: String((r as { display_name: string }).display_name),
    description:
      (r as { description: string | null }).description != null
        ? String((r as { description: string | null }).description)
        : null,
  }));
}

export async function listWorkforceRoleRequirements(
  tenantId: string,
  client?: SupabaseClient
): Promise<WorkforceRoleRequirement[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_workforce_role_requirements")
    .select("*")
    .eq("tenant_id", tid)
    .order("display_name", { ascending: true });
  if (error) {
    if (error.message?.includes("does not exist")) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => mapRoleRequirement(r as Record<string, unknown>));
}

export async function listRecruitmentCandidates(
  tenantId: string,
  client?: SupabaseClient
): Promise<RecruitmentCandidate[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const [roles, candRes] = await Promise.all([
    listWorkforceRoleRequirements(tid, supabase),
    supabase
      .from("fi_workforce_recruitment_candidates")
      .select("*")
      .eq("tenant_id", tid)
      .is("archived_at", null)
      .order("updated_at", { ascending: false }),
  ]);
  if (candRes.error) {
    if (candRes.error.message?.includes("does not exist")) return [];
    throw new Error(candRes.error.message);
  }
  const roleById = new Map(roles.map((r) => [r.id, r]));
  return (candRes.data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const roleId = row.role_requirement_id != null ? String(row.role_requirement_id) : null;
    return mapCandidate(row, roleId ? roleById.get(roleId) : null);
  });
}

export async function upsertWorkforceRoleRequirement(input: {
  tenantId: string;
  roleRequirementId?: string | null;
  roleCode: string;
  displayName: string;
  description?: string | null;
  onboardingTemplateCode?: string | null;
  actingUserId?: string | null;
  client?: SupabaseClient;
}): Promise<WorkforceRoleRequirement> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();
  const roleCode = input.roleCode.trim();
  const displayName = input.displayName.trim();
  if (!roleCode || !displayName) throw new Error("roleCode and displayName are required.");

  const payload = {
    tenant_id: tid,
    role_code: roleCode,
    display_name: displayName,
    description: input.description?.trim() || null,
    onboarding_template_code: input.onboardingTemplateCode?.trim() || null,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const rid = input.roleRequirementId?.trim();
  if (rid) {
    const { data, error } = await supabase
      .from("fi_workforce_role_requirements")
      .update(payload)
      .eq("tenant_id", tid)
      .eq("id", rid)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapRoleRequirement(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("fi_workforce_role_requirements")
    .insert({
      ...payload,
      requirements_json: {},
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRoleRequirement(data as Record<string, unknown>);
}

export async function createRecruitmentCandidate(input: {
  tenantId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  source?: RecruitmentCandidateSource;
  roleRequirementId?: string | null;
  onboardingTemplateCode?: string | null;
  notes?: string | null;
  actingUserId?: string | null;
  client?: SupabaseClient;
}): Promise<RecruitmentCandidate> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("fullName is required.");

  let onboardingTemplateCode = input.onboardingTemplateCode?.trim() || null;
  let role: WorkforceRoleRequirement | null = null;
  if (input.roleRequirementId?.trim()) {
    const { data: roleRow } = await supabase
      .from("fi_workforce_role_requirements")
      .select("*")
      .eq("tenant_id", tid)
      .eq("id", input.roleRequirementId.trim())
      .maybeSingle();
    if (roleRow) {
      role = mapRoleRequirement(roleRow as Record<string, unknown>);
      if (!onboardingTemplateCode && role.onboardingTemplateCode) {
        onboardingTemplateCode = role.onboardingTemplateCode;
      }
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_workforce_recruitment_candidates")
    .insert({
      tenant_id: tid,
      role_requirement_id: input.roleRequirementId?.trim() || null,
      full_name: fullName,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      source: input.source ?? "direct",
      pipeline_stage: "applied",
      offer_status: "none",
      onboarding_template_code: onboardingTemplateCode,
      notes: input.notes?.trim() || null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const candidate = mapCandidate(data as Record<string, unknown>, role);
  await recordRecruitmentStageEvent({
    tenantId: tid,
    candidateId: candidate.id,
    fromStage: null,
    toStage: "applied",
    offerStatus: "none",
    notes: "Candidate created",
    recordedByUserId: input.actingUserId ?? null,
    client: supabase,
  });
  return candidate;
}

async function recordRecruitmentStageEvent(input: {
  tenantId: string;
  candidateId: string;
  fromStage: RecruitmentPipelineStage | null;
  toStage: RecruitmentPipelineStage;
  offerStatus?: RecruitmentOfferStatus | null;
  notes?: string | null;
  recordedByUserId?: string | null;
  client: SupabaseClient;
}): Promise<void> {
  const { error } = await input.client.from("fi_workforce_recruitment_stage_events").insert({
    tenant_id: input.tenantId,
    candidate_id: input.candidateId,
    from_stage: input.fromStage,
    to_stage: input.toStage,
    offer_status: input.offerStatus ?? null,
    notes: input.notes?.trim() || null,
    recorded_by_user_id: input.recordedByUserId?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function advanceRecruitmentCandidate(input: {
  tenantId: string;
  candidateId: string;
  toStage: RecruitmentPipelineStage;
  offerStatus?: RecruitmentOfferStatus | null;
  notes?: string | null;
  actingUserId?: string | null;
  client?: SupabaseClient;
}): Promise<RecruitmentCandidate> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(input.candidateId, "candidateId");
  const supabase = input.client ?? supabaseAdmin();

  const { data: existing, error: loadErr } = await supabase
    .from("fi_workforce_recruitment_candidates")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", cid)
    .is("archived_at", null)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!existing) throw new Error("Recruitment candidate not found.");

  const fromStage = normalizeRecruitmentPipelineStage(
    String((existing as { pipeline_stage: string }).pipeline_stage)
  );
  const toStage = input.toStage;
  assertRecruitmentStageTransition(fromStage, toStage);

  const currentOffer = normalizeRecruitmentOfferStatus(
    String((existing as { offer_status: string }).offer_status)
  );
  const nextOffer =
    input.offerStatus != null
      ? input.offerStatus
      : defaultOfferStatusForStage(toStage, currentOffer);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_workforce_recruitment_candidates")
    .update({
      pipeline_stage: toStage,
      offer_status: nextOffer,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", cid)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await recordRecruitmentStageEvent({
    tenantId: tid,
    candidateId: cid,
    fromStage,
    toStage,
    offerStatus: nextOffer,
    notes: input.notes,
    recordedByUserId: input.actingUserId ?? null,
    client: supabase,
  });

  let role: WorkforceRoleRequirement | null = null;
  const roleId = (existing as { role_requirement_id: string | null }).role_requirement_id;
  if (roleId) {
    const roles = await listWorkforceRoleRequirements(tid, supabase);
    role = roles.find((r) => r.id === roleId) ?? null;
  }
  return mapCandidate(data as Record<string, unknown>, role);
}

export async function updateRecruitmentCandidateOfferStatus(input: {
  tenantId: string;
  candidateId: string;
  offerStatus: RecruitmentOfferStatus;
  notes?: string | null;
  actingUserId?: string | null;
  client?: SupabaseClient;
}): Promise<RecruitmentCandidate> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const cid = assertNonEmptyUuid(input.candidateId, "candidateId");
  const supabase = input.client ?? supabaseAdmin();

  const { data: existing, error: loadErr } = await supabase
    .from("fi_workforce_recruitment_candidates")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", cid)
    .is("archived_at", null)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!existing) throw new Error("Recruitment candidate not found.");

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_workforce_recruitment_candidates")
    .update({
      offer_status: input.offerStatus,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", cid)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const fromStage = normalizeRecruitmentPipelineStage(
    String((existing as { pipeline_stage: string }).pipeline_stage)
  );
  await recordRecruitmentStageEvent({
    tenantId: tid,
    candidateId: cid,
    fromStage,
    toStage: fromStage,
    offerStatus: input.offerStatus,
    notes: input.notes ?? `Offer status → ${input.offerStatus}`,
    recordedByUserId: input.actingUserId ?? null,
    client: supabase,
  });

  return mapCandidate(data as Record<string, unknown>);
}

export async function listRecruitmentStageEvents(
  tenantId: string,
  candidateId: string,
  client?: SupabaseClient
): Promise<RecruitmentStageEvent[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const cid = assertNonEmptyUuid(candidateId, "candidateId");
  const supabase = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_workforce_recruitment_stage_events")
    .select("*")
    .eq("tenant_id", tid)
    .eq("candidate_id", cid)
    .order("recorded_at", { ascending: false });
  if (error) {
    if (error.message?.includes("does not exist")) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => mapStageEvent(r as Record<string, unknown>));
}