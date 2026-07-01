import "server-only";

import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { HR_OS_ROUTE_REQUIRED_ROLES } from "@/src/lib/platform/entitlements/hrOsRouteGateCore.server";
import {
  listOnboardingTemplateOptions,
  listRecruitmentCandidates,
  listWorkforceRoleRequirements,
} from "@/src/lib/workforce/recruitmentPipeline.server";
import { countCandidatesByStage } from "@/src/lib/workforce/recruitmentPipelineCore";

export async function loadWorkforceOsRecruitmentPage(tenantId: string) {
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) return null;

  const tid = tenantId.trim();
  const [candidates, roleRequirements, onboardingTemplates] = await Promise.all([
    listRecruitmentCandidates(tid),
    listWorkforceRoleRequirements(tid),
    listOnboardingTemplateOptions(),
  ]);

  const role = access.userRole.trim().toLowerCase();
  const canManage =
    access.platformAdminPreview ||
    (HR_OS_ROUTE_REQUIRED_ROLES as readonly string[]).includes(role);

  return {
    candidates,
    roleRequirements,
    onboardingTemplates,
    stageCounts: countCandidatesByStage(candidates),
    canManage,
  };
}