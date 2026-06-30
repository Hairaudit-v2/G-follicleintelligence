"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { rejectStaffPinSessionForRestrictedMutation } from "@/src/lib/staffPin/staffPinMutationGuard.server";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import { getCalendarSettingsAccess } from "@/src/lib/calendar/calendarSettingsAccess.server";
import { validateCalendarSettingsInput } from "@/src/lib/calendar/calendarSettingsCore";
import { upsertCalendarSettings } from "@/src/lib/calendar/calendarSettings.server";

function errMsg(e: unknown): string {
  if (e instanceof StaffPinMutationBlockedError) return e.message;
  return e instanceof Error ? e.message : String(e);
}

const saveSchema = z.object({
  tenantId: z.string().uuid(),
  clinicId: z.string().uuid().nullable().optional(),
  settings: z.unknown(),
});

export type CalendarSettingsSaveResult = { ok: true } | { ok: false; error: string };

export async function saveCalendarSettingsAction(
  body: unknown
): Promise<CalendarSettingsSaveResult> {
  try {
    const parsed = saveSchema.parse(body);
    const tid = parsed.tenantId.trim();
    const cid = parsed.clinicId?.trim() || null;

    await rejectStaffPinSessionForRestrictedMutation(tid);

    const access = await getCalendarSettingsAccess(tid);
    if (!access.canView) {
      return { ok: false, error: "Not allowed to view calendar settings for this tenant." };
    }
    if (!access.canEdit) {
      return { ok: false, error: "You do not have permission to edit calendar settings." };
    }

    const validated = validateCalendarSettingsInput(parsed.settings);
    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }

    await upsertCalendarSettings({ tenantId: tid, clinicId: cid, document: validated.document });

    revalidatePath(`/fi-admin/${tid}/settings/calendar`);
    revalidatePath(`/fi-admin/${tid}/configuration`);
    revalidatePath(`/fi-admin/${tid}/calendar`);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError)
      return { ok: false, error: e.errors.map((x) => x.message).join("; ") };
    return { ok: false, error: errMsg(e) };
  }
}
