import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { CREDENTIAL_DUE_SOON_DAYS } from "@/src/lib/workforce/credentialExpiryCore";
import { loadProcedureStaffingOptimizer } from "@/src/lib/workforce/procedureStaffingOptimizer.server";
import {
  listRecruitmentCandidates,
  listWorkforceRoleRequirements,
} from "@/src/lib/workforce/recruitmentPipeline.server";
import { loadShiftCostIntelligence } from "@/src/lib/workforce/shiftCostIntelligence.server";
import { listActiveStaffForWageProfiles } from "@/src/lib/workforce/wageProfile.server";
import {
  buildWorkforcePlanningSnapshot,
  classifyCredentialRiskSeverity,
  forecastProcedureCapacity,
  forecastRecruitmentNeed,
  PLANNING_HORIZON_DAYS,
  planningHorizonFromDate,
  predictStaffingShortages,
  type CredentialExpiryRisk,
  type WorkforcePlanningSnapshot,
} from "@/src/lib/workforce/workforcePlanningEngineCore";
import { addDaysIso } from "@/src/lib/workforce/shiftCostIntelligenceCore";

async function loadCredentialExpiryRisks(
  tenantId: string,
  client: SupabaseClient
): Promise<CredentialExpiryRisk[]> {
  const now = new Date();
  const soonCutoff = new Date(
    now.getTime() + CREDENTIAL_DUE_SOON_DAYS * 86_400_000
  ).toISOString();

  const [credRes, certRes, membersRes] = await Promise.all([
    client
      .from("fi_staff_credentials")
      .select("staff_member_id, display_name, expires_at, blocks_clinical_work, status")
      .eq("tenant_id", tenantId)
      .is("archived_at", null)
      .not("expires_at", "is", null)
      .lte("expires_at", soonCutoff),
    client
      .from("fi_staff_certifications")
      .select("staff_member_id, display_name, expires_at, status")
      .eq("tenant_id", tenantId)
      .is("archived_at", null)
      .not("expires_at", "is", null)
      .lte("expires_at", soonCutoff),
    client
      .from("fi_staff_members")
      .select("id, full_name")
      .eq("tenant_id", tenantId)
      .is("archived_at", null),
  ]);

  if (credRes.error && !credRes.error.message?.includes("does not exist")) {
    throw new Error(credRes.error.message);
  }
  if (certRes.error && !certRes.error.message?.includes("does not exist")) {
    throw new Error(certRes.error.message);
  }
  if (membersRes.error) throw new Error(membersRes.error.message);

  const nameByMember = new Map(
    (membersRes.data ?? []).map((m) => [
      String((m as { id: string }).id),
      String((m as { full_name: string }).full_name),
    ])
  );

  const risks: CredentialExpiryRisk[] = [];

  for (const raw of credRes.data ?? []) {
    const row = raw as {
      staff_member_id: string;
      display_name: string;
      expires_at: string;
      blocks_clinical_work: boolean;
      status: string;
    };
    const expiresAt = String(row.expires_at);
    const days = Math.ceil(
      (new Date(expiresAt).getTime() - now.getTime()) / 86_400_000
    );
    const blocks = Boolean(row.blocks_clinical_work);
    risks.push({
      staffMemberId: String(row.staff_member_id),
      staffName: nameByMember.get(String(row.staff_member_id)) ?? "Staff",
      itemType: "credential",
      displayName: String(row.display_name),
      expiresAt: expiresAt.slice(0, 10),
      daysUntilExpiry: days,
      blocksClinicalWork: blocks,
      severity: classifyCredentialRiskSeverity(days, blocks),
    });
  }

  for (const raw of certRes.data ?? []) {
    const row = raw as {
      staff_member_id: string;
      display_name: string;
      expires_at: string;
      status: string;
    };
    const expiresAt = String(row.expires_at);
    const days = Math.ceil(
      (new Date(expiresAt).getTime() - now.getTime()) / 86_400_000
    );
    const blocks = row.status === "expired";
    risks.push({
      staffMemberId: String(row.staff_member_id),
      staffName: nameByMember.get(String(row.staff_member_id)) ?? "Staff",
      itemType: "certification",
      displayName: String(row.display_name),
      expiresAt: expiresAt.slice(0, 10),
      daysUntilExpiry: days,
      blocksClinicalWork: blocks,
      severity: classifyCredentialRiskSeverity(days, blocks),
    });
  }

  return risks.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

async function loadProcedureSignalsForHorizon(
  tenantId: string,
  horizonStart: string,
  horizonEnd: string,
  client: SupabaseClient
): Promise<{
  scheduledProcedures: number;
  fullyStaffedProcedures: number;
  understaffedByDate: Array<{ workDate: string; missingRoles: Array<{ role: string; gap: number }> }>;
}> {
  const { data: surgeries, error } = await client
    .from("fi_surgeries")
    .select("id, scheduled_date")
    .eq("tenant_id", tenantId)
    .gte("scheduled_date", horizonStart)
    .lte("scheduled_date", horizonEnd)
    .neq("status", "cancelled");
  if (error) {
    if (error.message?.includes("does not exist")) {
      return { scheduledProcedures: 0, fullyStaffedProcedures: 0, understaffedByDate: [] };
    }
    throw new Error(error.message);
  }

  const scheduledProcedures = (surgeries ?? []).length;
  const uniqueDates = Array.from(
    new Set(
      (surgeries ?? []).map((s) =>
        String((s as { scheduled_date: string }).scheduled_date).slice(0, 10)
      )
    )
  );

  let fullyStaffedProcedures = 0;
  const understaffedByDate: Array<{
    workDate: string;
    missingRoles: Array<{ role: string; gap: number }>;
  }> = [];

  for (const workDate of uniqueDates) {
    const optimizer = await loadProcedureStaffingOptimizer(tenantId, workDate, client);
    for (const rec of optimizer.recommendations) {
      if (rec.staffingComplete) {
        fullyStaffedProcedures += 1;
      } else if (rec.missingRoles.length > 0) {
        understaffedByDate.push({
          workDate,
          missingRoles: rec.missingRoles.map((m) => ({
            role: m.role,
            gap: Math.max(0, m.required - m.assigned),
          })),
        });
      }
    }
  }

  return { scheduledProcedures, fullyStaffedProcedures, understaffedByDate };
}

async function persistPlanningSnapshot(
  tenantId: string,
  snapshot: WorkforcePlanningSnapshot,
  client: SupabaseClient
): Promise<void> {
  const topAction = snapshot.nextBestActions[0] ?? null;
  const { error } = await client.from("fi_workforce_planning_snapshots").upsert(
    {
      tenant_id: tenantId,
      horizon_start: snapshot.horizonStart,
      horizon_end: snapshot.horizonEnd,
      snapshot_json: snapshot,
      next_best_action_json: topAction,
      generated_at: snapshot.generatedAt,
    },
    { onConflict: "tenant_id,horizon_start,horizon_end" }
  );
  if (error && !error.message?.includes("does not exist")) throw new Error(error.message);
}

export async function loadWorkforcePlanningEngine(
  tenantId: string,
  anchorDate?: string | null,
  client?: SupabaseClient
): Promise<WorkforcePlanningSnapshot> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const { horizonStart, horizonEnd } = planningHorizonFromDate(anchorDate);

  const [
    credentialRisks,
    procedureSignals,
    roleRequirements,
    candidates,
    staffOptions,
    shiftIntel,
    activeStaffRes,
  ] = await Promise.all([
    loadCredentialExpiryRisks(tid, supabase),
    loadProcedureSignalsForHorizon(tid, horizonStart, horizonEnd, supabase),
    listWorkforceRoleRequirements(tid, supabase),
    listRecruitmentCandidates(tid, supabase),
    listActiveStaffForWageProfiles(tid, supabase),
    loadShiftCostIntelligence(tid, horizonStart, supabase),
    supabase
      .from("fi_staff_members")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("employment_status", "active")
      .is("archived_at", null),
  ]);

  if (activeStaffRes.error) throw new Error(activeStaffRes.error.message);

  const staffingShortages = predictStaffingShortages({
    understaffedByDate: procedureSignals.understaffedByDate,
  });

  const activePipeline = candidates.filter(
    (c) => c.pipelineStage !== "hired" && c.pipelineStage !== "withdrawn"
  );
  const lateStage = activePipeline.filter((c) =>
    ["offer", "reference_check", "clinical_assessment"].includes(c.pipelineStage)
  );
  const staffingShortageTotal = staffingShortages.reduce((sum, s) => sum + s.shortageCount, 0);

  const recruitmentForecast = forecastRecruitmentNeed({
    roleRequirementsCount: roleRequirements.filter((r) => r.isActive).length,
    activePipelineCount: activePipeline.length,
    lateStageCount: lateStage.length,
    staffingShortageTotal,
  });

  const procedureCapacity = forecastProcedureCapacity({
    horizonDays: PLANNING_HORIZON_DAYS,
    scheduledProcedures: procedureSignals.scheduledProcedures,
    fullyStaffedProcedures: procedureSignals.fullyStaffedProcedures,
    activeClinicalStaffCount: activeStaffRes.count ?? staffOptions.length,
    avgTeamSizePerProcedure: 5,
  });

  const missingWageProfileCount = staffOptions.filter((s) => !s.hasWageProfile).length;

  const snapshot = buildWorkforcePlanningSnapshot({
    tenantId: tid,
    horizonStart,
    horizonEnd,
    staffingShortages,
    credentialRisks,
    recruitmentForecast,
    procedureCapacity,
    weeklyWageExposureCents: shiftIntel.weeklyForecast.totalForecastGrossCostCents,
    missingWageProfileCount,
  });

  await persistPlanningSnapshot(tid, snapshot, supabase);
  return snapshot;
}

export async function refreshWorkforcePlanningForWeek(
  tenantId: string,
  client?: SupabaseClient
): Promise<WorkforcePlanningSnapshot> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const start = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < 7; i++) {
    const d = addDaysIso(start, i);
    await loadProcedureStaffingOptimizer(tid, d, supabase);
  }

  return loadWorkforcePlanningEngine(tid, start, supabase);
}