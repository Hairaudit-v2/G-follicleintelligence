"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";

import { assertPaymentRecordWriteAllowed } from "@/src/lib/payments/paymentRecordAccess.server";
import { FI_REVENUE_ATTRIBUTION_SOURCES } from "@/src/lib/financialOs/financialRevenueAttributionCore";
import {
  triggerManualRevenueAttributionRecalculation,
  upsertRevenueAttributionOverride,
} from "@/src/lib/financialOs/financialRevenueAttribution.server";
import { resolveActorFiUserIdForTenantAdminActions } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

const optionalAdminKey = z.object({ adminKey: z.string().optional() });

const overrideSchema = optionalAdminKey.extend({
  case_id: z.string().uuid(),
  attribution_source: z.enum(FI_REVENUE_ATTRIBUTION_SOURCES).nullable().optional(),
  campaign_name: z.string().max(200).nullable().optional(),
  campaign_id: z.string().max(200).nullable().optional(),
  consultant_fi_user_id: z.string().uuid().nullable().optional(),
});

const recalcSchema = optionalAdminKey.extend({ case_id: z.string().uuid() });

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateAttributionPaths(tenantId: string, caseId?: string) {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/financial-os`);
  if (caseId?.trim()) revalidatePath(`/fi-admin/${tid}/cases/${caseId.trim()}`);
}

export async function saveRevenueAttributionOverrideAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = overrideSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const actorFiUserId = await resolveActorFiUserIdForTenantAdminActions(tenantId.trim());
    await upsertRevenueAttributionOverride({
      tenantId: tenantId.trim(),
      caseId: parsed.case_id,
      attributionSource: parsed.attribution_source ?? null,
      campaignName: parsed.campaign_name ?? null,
      campaignId: parsed.campaign_id ?? null,
      consultantFiUserId: parsed.consultant_fi_user_id ?? null,
      updatedByFiUserId: actorFiUserId,
    });
    revalidateAttributionPaths(tenantId, parsed.case_id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function recalculateRevenueAttributionAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; event_id?: string } | { ok: false; error: string }> {
  try {
    const parsed = recalcSchema.parse(body);
    await assertPaymentRecordWriteAllowed(tenantId, parsed.adminKey);
    const actorFiUserId = await resolveActorFiUserIdForTenantAdminActions(tenantId.trim());
    const event = await triggerManualRevenueAttributionRecalculation({
      tenantId: tenantId.trim(),
      caseId: parsed.case_id,
      actorFiUserId,
    });
    revalidateAttributionPaths(tenantId, parsed.case_id);
    return { ok: true, event_id: event?.id };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
