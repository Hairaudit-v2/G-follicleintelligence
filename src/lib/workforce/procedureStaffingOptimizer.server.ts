import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  DEFAULT_CLINICAL_STAFFING_TEMPLATES,
  normalizeRequiredRoles,
  type ClinicalStaffingRequiredRoles,
} from "@/src/lib/workforce-os/workforceClinicalStaffingTemplateDefaults";
import { resolveWorkforceEventTypeFromSurgery } from "@/src/lib/workforce-os/workforceClinicalEventMapping";
import { loadRosterAssignableStaff } from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import { countAssignedRoles, resolveClinicalStaffingTemplate } from "@/src/lib/workforce-os/workforceRosteringEngine";
import {
  listAwardLoadingPlaceholders,
  listWorkforceWageProfiles,
} from "@/src/lib/workforce/wageProfile.server";
import { resolveAwardLoadingsForProfile } from "@/src/lib/workforce/wageProfileCore";
import { shiftMinutesBetween } from "@/src/lib/workforce/shiftCostIntelligenceCore";

import {
  buildProcedureStaffingRecommendation,
  enrichCandidateWithCost,
  summarizeProcedureStaffingOptimizer,
  type OptimizerRankedCandidate,
  type ProcedureStaffingOptimizerSnapshot,
  type StaffWageCostHint,
} from "./procedureStaffingOptimizerCore";

function procedureLabel(metadata: Record<string, unknown> | null, surgeryId: string): string {
  const meta = metadata ?? {};
  const name =
    (typeof meta.procedure_name === "string" && meta.procedure_name) ||
    (typeof meta.procedure_type === "string" && meta.procedure_type);
  return name ? String(name) : `Surgery ${surgeryId.slice(0, 8)}`;
}

function surgeryWindow(surgery: {
  scheduled_date: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
}): { startsAt: string; endsAt: string; minutesWorked: number } {
  const date = String(surgery.scheduled_date).slice(0, 10);
  const startsAt = surgery.scheduled_start_at ?? `${date}T08:00:00.000Z`;
  const endsAt =
    surgery.scheduled_end_at ??
    new Date(new Date(startsAt).getTime() + 8 * 60 * 60_000).toISOString();
  const minutesWorked = shiftMinutesBetween(startsAt, endsAt) || 480;
  return { startsAt, endsAt, minutesWorked };
}

async function loadWageCostByFiStaff(
  tenantId: string,
  client: SupabaseClient
): Promise<Map<string, StaffWageCostHint>> {
  const [profiles, placeholders] = await Promise.all([
    listWorkforceWageProfiles(tenantId, client),
    listAwardLoadingPlaceholders(tenantId, client),
  ]);
  const map = new Map<string, StaffWageCostHint>();
  for (const profile of profiles) {
    if (!profile.fiStaffId) continue;
    map.set(profile.fiStaffId, {
      rateType: profile.rateType,
      baseRateCents: profile.baseRateCents,
      awardLoadings: resolveAwardLoadingsForProfile({
        awardCode: profile.awardCode,
        awardLoadingCodes: profile.awardLoadingCodes,
        placeholders,
      }),
    });
  }
  return map;
}

async function loadStaffingTemplates(tenantId: string, client: SupabaseClient) {
  const { data, error } = await client
    .from("fi_clinical_staffing_templates")
    .select("id, tenant_id, clinic_id, event_type, required_roles, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  if (error) {
    if (error.message?.includes("does not exist")) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    tenant_id: String((r as { tenant_id: string }).tenant_id),
    clinic_id:
      (r as { clinic_id: string | null }).clinic_id != null
        ? String((r as { clinic_id: string | null }).clinic_id)
        : null,
    event_type: String((r as { event_type: string }).event_type),
    required_roles: normalizeRequiredRoles(
      (r as { required_roles: Record<string, unknown> }).required_roles
    ),
    is_active: Boolean((r as { is_active: boolean }).is_active),
  }));
}

async function persistRecommendation(
  tenantId: string,
  recommendation: ReturnType<typeof buildProcedureStaffingRecommendation>,
  client: SupabaseClient
): Promise<void> {
  const payload = {
    tenant_id: tenantId,
    surgery_id: recommendation.surgeryId,
    work_date: recommendation.scheduledDate,
    recommended_team_json: recommendation.recommendedTeam.map((m) => ({
      staffId: m.staffId,
      name: m.name,
      assignedRole: m.assignedRole,
      optimizerScore: m.optimizerScore,
      grossCostCents: m.grossCostCents,
      section: m.section,
    })),
    blocked_staff_json: recommendation.blockedStaff.map((m) => ({
      staffId: m.staffId,
      name: m.name,
      assignedRole: m.assignedRole,
      reasons: m.reasons,
    })),
    total_team_cost_cents: recommendation.totalTeamCostCents,
    staffing_complete: recommendation.staffingComplete,
    generated_at: new Date().toISOString(),
    metadata: { eventType: recommendation.eventType },
  };

  const { error } = await client
    .from("fi_workforce_procedure_staffing_recommendations")
    .upsert(payload, { onConflict: "tenant_id,surgery_id" });
  if (error && !error.message?.includes("does not exist")) throw new Error(error.message);
}

export async function loadProcedureStaffingOptimizer(
  tenantId: string,
  workDate?: string | null,
  client?: SupabaseClient
): Promise<ProcedureStaffingOptimizerSnapshot> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const date = workDate?.trim() || new Date().toISOString().slice(0, 10);

  const [surgeriesRes, templates, wageByStaff] = await Promise.all([
    supabase
      .from("fi_surgeries")
      .select(
        "id, scheduled_date, scheduled_start_at, scheduled_end_at, status, clinic_id, metadata, procedure_phase"
      )
      .eq("tenant_id", tid)
      .eq("scheduled_date", date)
      .neq("status", "cancelled"),
    loadStaffingTemplates(tid, supabase),
    loadWageCostByFiStaff(tid, supabase),
  ]);

  if (surgeriesRes.error) {
    if (surgeriesRes.error.message?.includes("does not exist")) {
      return summarizeProcedureStaffingOptimizer({ workDate: date, recommendations: [] });
    }
    throw new Error(surgeriesRes.error.message);
  }

  const recommendations = [];

  for (const raw of surgeriesRes.data ?? []) {
    const surgery = raw as {
      id: string;
      scheduled_date: string;
      scheduled_start_at: string | null;
      scheduled_end_at: string | null;
      status: string;
      clinic_id: string | null;
      metadata: Record<string, unknown> | null;
      procedure_phase: string | null;
    };

    const eventType = resolveWorkforceEventTypeFromSurgery({
      procedure_phase: surgery.procedure_phase,
      metadata: surgery.metadata,
    });
    const template =
      resolveClinicalStaffingTemplate({
        eventType,
        clinicId: surgery.clinic_id,
        templates,
      }) ??
      DEFAULT_CLINICAL_STAFFING_TEMPLATES.find((t) => t.event_type === eventType) ??
      DEFAULT_CLINICAL_STAFFING_TEMPLATES.find((t) => t.event_type === "surgery");

    const requiredRoles: ClinicalStaffingRequiredRoles =
      template && "required_roles" in template
        ? normalizeRequiredRoles(template.required_roles)
        : { surgeon: 1, nurse: 2, technician: 2 };

    const { startsAt, endsAt, minutesWorked } = surgeryWindow(surgery);

    const { data: assignmentRows } = await supabase
      .from("fi_staff_event_assignments")
      .select("staff_id, assigned_role, assignment_status")
      .eq("tenant_id", tid)
      .eq("event_source", "surgery")
      .eq("event_id", surgery.id)
      .neq("assignment_status", "cancelled");

    const existingAssignmentsByRole = countAssignedRoles(
      (assignmentRows ?? []).map((r) => ({
        assignedRole: String((r as { assigned_role: string }).assigned_role),
      }))
    );

    const roleCandidates: Record<string, OptimizerRankedCandidate[]> = {};

    for (const [role, count] of Object.entries(requiredRoles)) {
      if ((count ?? 0) <= 0) continue;
      const ranked = await loadRosterAssignableStaff({
        tenantId: tid,
        clinicId: surgery.clinic_id,
        eventSource: "surgery",
        eventId: String(surgery.id),
        eventType,
        assignedRole: role,
        startsAt,
        endsAt,
      });

      roleCandidates[role] = ranked.map((candidate) =>
        enrichCandidateWithCost({
          candidate,
          assignedRole: role,
          wage: wageByStaff.get(candidate.staffId) ?? null,
          minutesWorked,
        })
      );
    }

    const recommendation = buildProcedureStaffingRecommendation({
      surgeryId: String(surgery.id),
      procedureLabel: procedureLabel(surgery.metadata, String(surgery.id)),
      scheduledDate: String(surgery.scheduled_date).slice(0, 10),
      startsAt,
      endsAt,
      clinicId: surgery.clinic_id != null ? String(surgery.clinic_id) : null,
      eventType,
      requiredRoles,
      minutesWorked,
      roleCandidates,
      existingAssignmentsByRole,
    });

    await persistRecommendation(tid, recommendation, supabase);
    recommendations.push(recommendation);
  }

  return summarizeProcedureStaffingOptimizer({ workDate: date, recommendations });
}

export async function applyRecommendedProcedureTeam(input: {
  tenantId: string;
  surgeryId: string;
  actingUserId?: string | null;
  client?: SupabaseClient;
}): Promise<{ assignedCount: number; skippedCount: number }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const sid = assertNonEmptyUuid(input.surgeryId, "surgeryId");
  const supabase = input.client ?? supabaseAdmin();

  const { data: surgeryRow, error: surgeryErr } = await supabase
    .from("fi_surgeries")
    .select("scheduled_date")
    .eq("tenant_id", tid)
    .eq("id", sid)
    .maybeSingle();
  if (surgeryErr) throw new Error(surgeryErr.message);
  if (!surgeryRow) throw new Error("Surgery not found.");

  const workDate = String((surgeryRow as { scheduled_date: string }).scheduled_date).slice(0, 10);
  const snapshot = await loadProcedureStaffingOptimizer(tid, workDate, supabase);
  const recommendation = snapshot.recommendations.find((r) => r.surgeryId === sid);
  if (!recommendation) throw new Error("No staffing recommendation for surgery.");

  const { assignStaffToClinicalEventAction } = await import(
    "@/src/lib/workforce-os/workforceRostering.server"
  );

  let assignedCount = 0;
  let skippedCount = 0;

  for (const member of recommendation.recommendedTeam) {
    if (member.autoBlocked) {
      skippedCount += 1;
      continue;
    }
    try {
      await assignStaffToClinicalEventAction({
        tenantId: tid,
        clinicId: recommendation.clinicId,
        eventSource: "surgery",
        eventId: recommendation.surgeryId,
        staffId: member.staffId,
        assignedRole: member.assignedRole,
        startsAt: recommendation.startsAt,
        endsAt: recommendation.endsAt,
        assignedBy: input.actingUserId ?? null,
        allowBlockedDraft: false,
        eventType: recommendation.eventType,
      });
      assignedCount += 1;
    } catch {
      skippedCount += 1;
    }
  }

  return { assignedCount, skippedCount };
}