"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";

import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { getFiTenantMemberSessionIfAllowed } from "@/src/lib/crm/crmShellAccess";
import {
  createReceptionDailyCloseout,
  loadReceptionCloseoutSnapshotForCommandCentre,
} from "@/src/lib/receptionOs/receptionDailyCloseout.server";
import { resolveReceptionOsViewerContext } from "@/src/lib/receptionOs/receptionOsAccess.server";
import { loadReceptionOsCommandCentrePayload } from "@/src/lib/receptionOs/receptionOsCommandCentreLoader.server";
import { receptionCloseoutCloseDayAllowed } from "@/src/lib/receptionOs/receptionCloseoutPolicy";
import { trackReceptionUsageEventSafe } from "@/src/lib/receptionOs/receptionUsageEvents.server";

const optionalAdminKey = z.object({ adminKey: z.string().optional() });

const closeDaySchema = optionalAdminKey.extend({
  notes: z.string().max(8000).nullable().optional(),
  usageContext: z
    .object({
      operatingMode: z.enum(["morning_prep", "live_clinic", "end_of_day"]).nullable().optional(),
    })
    .optional(),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateReceptionOsPaths(tenantId: string) {
  revalidatePath(`/fi-admin/${tenantId.trim()}/reception-os`);
}

async function assertCloseoutAccess(tenantId: string, adminKey?: string) {
  const tid = tenantId.trim();
  await assertCrmTenantReadAllowed({ tenantId: tid, adminKey, request: undefined });
  const viewer = await resolveReceptionOsViewerContext(tid);
  if (!viewer.canAccessReceptionOs) {
    throw new Error(
      "ReceptionOS access requires an active staff or CRM shell role for this tenant."
    );
  }
  const member = await getFiTenantMemberSessionIfAllowed(tid);
  return { role: viewer.receptionOsRole, actorFiUserId: member?.fiUserId ?? null };
}

export async function closeReceptionOperatingDayAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; closeoutId: string } | { ok: false; error: string }> {
  try {
    const parsed = closeDaySchema.parse(body);
    const { role, actorFiUserId } = await assertCloseoutAccess(tenantId, parsed.adminKey);
    if (!receptionCloseoutCloseDayAllowed(role)) {
      throw new Error("Only clinic managers and admins may close the operating day.");
    }

    const payload = await loadReceptionOsCommandCentrePayload(tenantId.trim());
    const snapshot = await loadReceptionCloseoutSnapshotForCommandCentre(payload);
    if (snapshot.existingCloseoutId) {
      throw new Error("This operating day has already been closed.");
    }

    const { closeoutId } = await createReceptionDailyCloseout({
      tenantId: tenantId.trim(),
      operatingDate: payload.operationalDay.todayYmd,
      closedByFiUserId: actorFiUserId,
      notes: parsed.notes ?? null,
      snapshot,
    });

    trackReceptionUsageEventSafe({
      tenantId: tenantId.trim(),
      profileId: actorFiUserId,
      eventKind: "day_closed",
      context: {
        operatingMode: parsed.usageContext?.operatingMode ?? "end_of_day",
        sourceRefId: closeoutId,
        metadata: { operatingDate: payload.operationalDay.todayYmd },
      },
    });

    revalidateReceptionOsPaths(tenantId);
    return { ok: true, closeoutId };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function loadReceptionCloseoutPreviewAction(
  tenantId: string,
  body: unknown
): Promise<
  | {
      ok: true;
      snapshot: Awaited<ReturnType<typeof loadReceptionCloseoutSnapshotForCommandCentre>>;
    }
  | { ok: false; error: string }
> {
  try {
    optionalAdminKey.parse(body);
    const { actorFiUserId } = await assertCloseoutAccess(tenantId);
    const payload = await loadReceptionOsCommandCentrePayload(tenantId.trim());
    const snapshot = await loadReceptionCloseoutSnapshotForCommandCentre(payload);
    trackReceptionUsageEventSafe({
      tenantId: tenantId.trim(),
      profileId: actorFiUserId,
      eventKind: "closeout_previewed",
      context: {
        operatingMode: "end_of_day",
        metadata: { operatingDate: payload.operationalDay.todayYmd },
      },
    });
    return { ok: true, snapshot };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
