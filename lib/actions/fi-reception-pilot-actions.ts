"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";

import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { getFiTenantMemberSessionIfAllowed } from "@/src/lib/crm/crmShellAccess";
import { insertReceptionPilotFeedback } from "@/src/lib/receptionOs/receptionPilotFeedback.server";
import {
  RECEPTION_PILOT_FEEDBACK_KINDS,
  sanitizeReceptionPilotFeedbackContext,
} from "@/src/lib/receptionOs/receptionPilotFeedbackModel";
import { resolveReceptionOsViewerContext } from "@/src/lib/receptionOs/receptionOsAccess.server";
import {
  isReceptionUsageEventKind,
  sanitizeReceptionUsageEventContext,
} from "@/src/lib/receptionOs/receptionUsageEventModel";
import { trackReceptionUsageEventSafe } from "@/src/lib/receptionOs/receptionUsageEvents.server";
import { RECEPTION_OS_OPERATING_MODES } from "@/src/lib/receptionOs/receptionOperatingMode";

const optionalAdminKey = z.object({ adminKey: z.string().optional() });

const usageContextSchema = z.object({
  operatingMode: z.enum(RECEPTION_OS_OPERATING_MODES).nullable().optional(),
  widgetKey: z.string().max(64).nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  alertKind: z.string().max(64).nullable().optional(),
  sourceRefId: z.string().max(128).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const trackUsageSchema = optionalAdminKey.extend({
  eventKind: z.string().min(1),
  context: usageContextSchema.optional(),
});

const feedbackSchema = optionalAdminKey.extend({
  feedbackKind: z.enum(RECEPTION_PILOT_FEEDBACK_KINDS),
  context: usageContextSchema
    .extend({
      note: z.string().max(500).nullable().optional(),
    })
    .optional(),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

async function assertPilotFeedbackAccess(tenantId: string, adminKey?: string) {
  const tid = tenantId.trim();
  await assertCrmTenantReadAllowed({ tenantId: tid, adminKey, request: undefined });
  const viewer = await resolveReceptionOsViewerContext(tid);
  if (!viewer.canAccessReceptionOs) {
    throw new Error(
      "ReceptionOS access requires an active staff or CRM shell role for this tenant."
    );
  }
  const member = await getFiTenantMemberSessionIfAllowed(tid);
  return { actorFiUserId: member?.fiUserId ?? null };
}

export async function trackReceptionUsageEventAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = trackUsageSchema.parse(body);
    if (!isReceptionUsageEventKind(parsed.eventKind)) {
      return { ok: false, error: "Invalid usage event kind." };
    }
    const { actorFiUserId } = await assertPilotFeedbackAccess(tenantId, parsed.adminKey);
    const ctx = sanitizeReceptionUsageEventContext(parsed.context ?? undefined);
    trackReceptionUsageEventSafe({
      tenantId: tenantId.trim(),
      profileId: actorFiUserId,
      eventKind: parsed.eventKind,
      context: ctx,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function submitReceptionPilotFeedbackAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; feedbackId: string } | { ok: false; error: string }> {
  try {
    const parsed = feedbackSchema.parse(body);
    const { actorFiUserId } = await assertPilotFeedbackAccess(tenantId, parsed.adminKey);
    const ctx = sanitizeReceptionPilotFeedbackContext(parsed.context ?? undefined);
    const { feedbackId } = await insertReceptionPilotFeedback({
      tenantId: tenantId.trim(),
      profileId: actorFiUserId,
      feedbackKind: parsed.feedbackKind,
      context: ctx,
    });
    revalidatePath(`/fi-admin/${tenantId.trim()}/reception-os`);
    return { ok: true, feedbackId };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
