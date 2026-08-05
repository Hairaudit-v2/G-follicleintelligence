/**
 * Batch planning staff context (FI-TEAM-COHESION-B1.8B).
 *
 * Query budget:
 * 1. one schedulable staff population (or injected staffIds)
 * 2. one resolveStaffIdentities({ by: "staffId" }) batch
 * 3. in-memory projection — no per-person identity loop
 *
 * Candidates and vacancies stay separate non-staff entities.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { resolveStaffIdentities } from "@/src/lib/team/identity/server";
import type { StaffIdentity } from "@/src/lib/team/identity/types";
import { projectPlanningStaffEntry } from "@/src/lib/team/planning/projectPlanningStaffEntry";
import type {
  PlanningRecruitmentCandidateRef,
  PlanningStaffEntry,
  PlanningVacancyRef,
} from "@/src/lib/team/planning/types";
import { loadAllStaffForTenant } from "@/src/lib/staff/staff.server";
import {
  listRecruitmentCandidates,
  listWorkforceRoleRequirements,
} from "@/src/lib/workforce/recruitmentPipeline.server";

export type PlanningStaffContextModel = {
  tenantId: string;
  staff: PlanningStaffEntry[];
  identitiesByStaffId: Map<string, StaffIdentity>;
  candidates: PlanningRecruitmentCandidateRef[];
  vacancies: PlanningVacancyRef[];
  schedulableCount: number;
};

export type LoadPlanningStaffContextOptions = {
  client?: SupabaseClient;
  staffIds?: string[];
  /** Optional injected readiness maps — defaults assume clinical/roster ready when linked. */
  rosterReadyByStaffId?: ReadonlyMap<string, boolean>;
  clinicalReadyByStaffId?: ReadonlyMap<string, boolean>;
  clinicalBlockersByStaffId?: ReadonlyMap<string, string[]>;
};

export async function loadPlanningStaffContext(
  tenantId: string,
  options?: LoadPlanningStaffContextOptions
): Promise<PlanningStaffContextModel> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const client = options?.client ?? supabaseAdmin();

  const schedulingRows =
    options?.staffIds && options.staffIds.length > 0
      ? options.staffIds.map((id) => ({ id }))
      : await loadAllStaffForTenant(tid, client);

  const staffIds = schedulingRows.map((r) => String(r.id));

  const [identityBatch, candidates, roleRequirements] = await Promise.all([
    staffIds.length
      ? resolveStaffIdentities(
          { tenantId: tid, by: "staffId", staffIds },
          { client }
        )
      : Promise.resolve({ byKey: new Map<string, StaffIdentity | null>() }),
    listRecruitmentCandidates(tid).catch(() => []),
    listWorkforceRoleRequirements(tid).catch(() => []),
  ]);

  const identitiesByStaffId = new Map<string, StaffIdentity>();
  const staff: PlanningStaffEntry[] = [];

  for (const staffId of staffIds) {
    const identity = identityBatch.byKey.get(staffId) ?? null;
    if (!identity) continue;
    // Hard skip cross-tenant from normal planning population.
    if (identity.integrity.linkStatus === "cross_tenant_mismatch") continue;
    identitiesByStaffId.set(staffId, identity);

    const rosterReady = options?.rosterReadyByStaffId?.get(staffId) ?? true;
    const clinicalReady = options?.clinicalReadyByStaffId?.get(staffId) ?? true;
    const domainSchedulable =
      Boolean(identity.staffId) &&
      identity.employmentStatus !== "terminated" &&
      identity.employmentStatus !== "resigned" &&
      !identity.archivedAt;

    staff.push(
      projectPlanningStaffEntry(identity, {
        rosterReady,
        clinicalReady,
        clinicalBlockers: options?.clinicalBlockersByStaffId?.get(staffId) ?? [],
        domainSchedulable,
        eligibleRoleIds: identity.roles,
        procedureCapabilities: identity.capabilities,
      })
    );
  }

  const candidateRefs: PlanningRecruitmentCandidateRef[] = candidates
    .filter((c) => !c.archivedAt)
    .map((c) => ({
      candidateId: c.id,
      displayName: c.fullName || c.email || "Candidate",
      pipelineStage: c.pipelineStage,
      roleRequirementId: c.roleRequirementId ?? null,
    }));

  const vacancies: PlanningVacancyRef[] = roleRequirements
    .filter((r) => r.isActive)
    .map((r) => ({
      roleRequirementId: r.id,
      roleLabel: r.displayName || r.roleCode || "Open role",
      openCount: 1,
    }));

  return {
    tenantId: tid,
    staff,
    identitiesByStaffId,
    candidates: candidateRefs,
    vacancies,
    schedulableCount: staff.filter((s) => s.availability.schedulable).length,
  };
}
