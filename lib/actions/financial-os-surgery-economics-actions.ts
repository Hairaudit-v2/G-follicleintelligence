"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";

import { assertPaymentRecordWriteAllowed } from "@/src/lib/payments/paymentRecordAccess.server";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import { SURGEON_COST_TYPES } from "@/src/lib/financialOs/financialSurgeryEconomicsCore";
import {
  activateSurgeryCostModel,
  archiveSurgeryCostModel,
  createSurgeryCostModel,
  updateActiveSurgeryCostModel,
} from "@/src/lib/financialOs/financialSurgeryCostModel.server";
import {
  loadProfitabilitySnapshotHistoryForCase,
  triggerSurgeryProfitabilitySnapshotForCase,
} from "@/src/lib/financialOs/financialSurgeryEconomicsSnapshotOrchestrator.server";
import { resolveActorFiUserIdForTenantAdminActions } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

const optionalAdminKey = z.object({ adminKey: z.string().optional() });

const costModelFieldsSchema = z.object({
  procedure_type: z.string().min(1).max(120),
  surgeon_cost_type: z.enum(SURGEON_COST_TYPES),
  surgeon_cost_value_cents: z.number().int().min(0),
  rn_hourly_rate_cents: z.number().int().min(0),
  technician_hourly_rate_cents: z.number().int().min(0),
  assistant_hourly_rate_cents: z.number().int().min(0),
  room_hourly_cost_cents: z.number().int().min(0),
  consumables_base_cost_cents: z.number().int().min(0),
  graft_consumable_cost_cents: z.number().int().min(0),
  prp_cost_cents: z.number().int().min(0),
  exosome_cost_cents: z.number().int().min(0),
  medication_cost_cents: z.number().int().min(0),
  default_duration_minutes: z.number().int().min(1).max(1440),
  activate: z.boolean().optional(),
});

const createCostModelSchema = optionalAdminKey.merge(costModelFieldsSchema);
const updateCostModelSchema = optionalAdminKey
  .extend({ model_id: z.string().uuid() })
  .merge(costModelFieldsSchema.partial());
const modelIdSchema = optionalAdminKey.extend({ model_id: z.string().uuid() });
const caseSnapshotSchema = optionalAdminKey.extend({ case_id: z.string().uuid() });

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof StaffPinMutationBlockedError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateSurgeryEconomicsPaths(tenantId: string, caseId?: string) {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/financial-os`);
  revalidatePath(`/fi-admin/${tid}/financial-os/cost-models`);
  if (caseId?.trim()) revalidatePath(`/fi-admin/${tid}/cases/${caseId.trim()}`);
}

export async function createSurgeryCostModelAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; model_id: string } | { ok: false; error: string }> {
  try {
    const parsed = createCostModelSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const actorFiUserId = await resolveActorFiUserIdForTenantAdminActions(tenantId.trim());
    const model = await createSurgeryCostModel({
      tenantId: tenantId.trim(),
      input: parsed,
      createdByFiUserId: actorFiUserId,
    });
    revalidateSurgeryEconomicsPaths(tenantId);
    return { ok: true, model_id: model.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function updateSurgeryCostModelAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = updateCostModelSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const { model_id, adminKey: _ak, ...patch } = parsed;
    void _ak;
    await updateActiveSurgeryCostModel({
      tenantId: tenantId.trim(),
      modelId: model_id,
      patch,
    });
    revalidateSurgeryEconomicsPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function archiveSurgeryCostModelAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = modelIdSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await archiveSurgeryCostModel({ tenantId: tenantId.trim(), modelId: parsed.model_id });
    revalidateSurgeryEconomicsPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function activateSurgeryCostModelAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = modelIdSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    await activateSurgeryCostModel({ tenantId: tenantId.trim(), modelId: parsed.model_id });
    revalidateSurgeryEconomicsPaths(tenantId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function createSurgeryProfitabilitySnapshotAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; snapshot_id: string } | { ok: false; error: string; reasons?: string[] }> {
  try {
    const parsed = caseSnapshotSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const actorFiUserId = await resolveActorFiUserIdForTenantAdminActions(tenantId.trim());
    const result = await triggerSurgeryProfitabilitySnapshotForCase({
      tenantId: tenantId.trim(),
      caseId: parsed.case_id,
      trigger: { source: "manual_create", actorFiUserId },
      allowNotReady: false,
    });
    if (!result.ok) return { ok: false, error: result.error };
    if (!result.triggered) {
      return {
        ok: false,
        error: "Snapshot could not be created — configuration incomplete.",
        reasons: result.readiness.reasons,
      };
    }
    revalidateSurgeryEconomicsPaths(tenantId, parsed.case_id);
    return { ok: true, snapshot_id: result.snapshot.id ?? "" };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function recalculateSurgeryProfitabilitySnapshotAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; snapshot_id: string } | { ok: false; error: string; reasons?: string[] }> {
  try {
    const parsed = caseSnapshotSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const actorFiUserId = await resolveActorFiUserIdForTenantAdminActions(tenantId.trim());
    const result = await triggerSurgeryProfitabilitySnapshotForCase({
      tenantId: tenantId.trim(),
      caseId: parsed.case_id,
      trigger: { source: "manual_recalculate", actorFiUserId },
      allowNotReady: false,
    });
    if (!result.ok) return { ok: false, error: result.error };
    if (!result.triggered) {
      return {
        ok: false,
        error: "Snapshot could not be recalculated — configuration incomplete.",
        reasons: result.readiness.reasons,
      };
    }
    revalidateSurgeryEconomicsPaths(tenantId, parsed.case_id);
    return { ok: true, snapshot_id: result.snapshot.id ?? "" };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadSurgeryProfitabilitySnapshotHistoryAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; snapshots: Awaited<ReturnType<typeof loadProfitabilitySnapshotHistoryForCase>> }
  | { ok: false; error: string }
> {
  try {
    const parsed = caseSnapshotSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const snapshots = await loadProfitabilitySnapshotHistoryForCase(
      tenantId.trim(),
      parsed.case_id
    );
    return { ok: true, snapshots };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
