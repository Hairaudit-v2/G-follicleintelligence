"use server";

import { revalidatePath } from "next/cache";

import { CrmAccessError } from "@/src/lib/crm/crmGate";
import {
  advanceRecruitmentCandidate,
  createRecruitmentCandidate,
  updateRecruitmentCandidateOfferStatus,
  upsertWorkforceRoleRequirement,
} from "@/src/lib/workforce/recruitmentPipeline.server";
import {
  isRecruitmentOfferStatus,
  isRecruitmentPipelineStage,
  type RecruitmentCandidateSource,
} from "@/src/lib/workforce/recruitmentPipelineCore";
import { assertWorkforceHrManageAllowed } from "@/src/lib/workforce/workforceHrManageGate.server";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateRecruitment(tenantId: string): void {
  revalidatePath(`/fi-admin/${tenantId.trim()}/workforce-os/recruitment`);
  revalidatePath(`/fi-admin/${tenantId.trim()}/workforce-os`);
}

export async function createRecruitmentCandidateAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; candidateId: string } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    const b = body && typeof body === "object" && body !== null ? body : {};
    const fullName = String((b as { fullName?: string }).fullName ?? "").trim();
    if (!fullName) throw new Error("fullName is required.");

    const candidate = await createRecruitmentCandidate({
      tenantId,
      fullName,
      email: String((b as { email?: string }).email ?? "").trim() || null,
      phone: String((b as { phone?: string }).phone ?? "").trim() || null,
      source: String((b as { source?: string }).source ?? "direct").trim() as RecruitmentCandidateSource,
      roleRequirementId:
        String((b as { roleRequirementId?: string }).roleRequirementId ?? "").trim() || null,
      onboardingTemplateCode:
        String((b as { onboardingTemplateCode?: string }).onboardingTemplateCode ?? "").trim() ||
        null,
      notes: String((b as { notes?: string }).notes ?? "").trim() || null,
      actingUserId: fiUserId,
    });
    revalidateRecruitment(tenantId);
    return { ok: true, candidateId: candidate.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function advanceRecruitmentCandidateAction(
  tenantId: string,
  candidateId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    const b = body && typeof body === "object" && body !== null ? body : {};
    const toStage = String((b as { toStage?: string }).toStage ?? "").trim();
    if (!isRecruitmentPipelineStage(toStage)) throw new Error("Invalid pipeline stage.");

    const offerRaw = (b as { offerStatus?: string }).offerStatus;
    const offerStatus =
      offerRaw != null && isRecruitmentOfferStatus(String(offerRaw).trim())
        ? (String(offerRaw).trim() as import("@/src/lib/workforce/recruitmentPipelineCore").RecruitmentOfferStatus)
        : undefined;

    await advanceRecruitmentCandidate({
      tenantId,
      candidateId,
      toStage,
      offerStatus,
      notes: String((b as { notes?: string }).notes ?? "").trim() || null,
      actingUserId: fiUserId,
    });
    revalidateRecruitment(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateRecruitmentOfferStatusAction(
  tenantId: string,
  candidateId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { fiUserId } = await assertWorkforceHrManageAllowed(tenantId);
    const b = body && typeof body === "object" && body !== null ? body : {};
    const offerStatus = String((b as { offerStatus?: string }).offerStatus ?? "").trim();
    if (!isRecruitmentOfferStatus(offerStatus)) throw new Error("Invalid offer status.");

    await updateRecruitmentCandidateOfferStatus({
      tenantId,
      candidateId,
      offerStatus,
      notes: String((b as { notes?: string }).notes ?? "").trim() || null,
      actingUserId: fiUserId,
    });
    revalidateRecruitment(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function upsertWorkforceRoleRequirementAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; roleRequirementId: string } | { ok: false; error: string }> {
  try {
    await assertWorkforceHrManageAllowed(tenantId);
    const b = body && typeof body === "object" && body !== null ? body : {};
    const roleCode = String((b as { roleCode?: string }).roleCode ?? "").trim();
    const displayName = String((b as { displayName?: string }).displayName ?? "").trim();
    if (!roleCode || !displayName) throw new Error("roleCode and displayName are required.");

    const row = await upsertWorkforceRoleRequirement({
      tenantId,
      roleRequirementId:
        String((b as { roleRequirementId?: string }).roleRequirementId ?? "").trim() || null,
      roleCode,
      displayName,
      description: String((b as { description?: string }).description ?? "").trim() || null,
      onboardingTemplateCode:
        String((b as { onboardingTemplateCode?: string }).onboardingTemplateCode ?? "").trim() ||
        null,
    });
    revalidateRecruitment(tenantId);
    return { ok: true, roleRequirementId: row.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}