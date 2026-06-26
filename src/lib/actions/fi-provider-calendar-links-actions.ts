"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import {
  assertGoogleCalendarTenantAdminAccess,
  GoogleCalendarIntegrationAccessError,
} from "@/src/lib/googleCalendar/googleCalendarIntegrationAccess.server";
import {
  createStaffCalendarLink,
  deactivateStaffCalendarLink,
} from "@/src/lib/googleCalendar/googleCalendarProviderLinks.server";
import type { StaffCalendarLinkClientRow } from "@/src/lib/googleCalendar/googleCalendarProviderLinksCore";

const createLinkBodySchema = z
  .object({
    staffMemberId: z.string().uuid(),
    calendarId: z.string().min(1).max(512),
    calendarLabel: z.string().max(256).optional(),
    googleAccountEmail: z.string().email().optional().or(z.literal("")),
    provider: z.enum(["google", "timely"]).optional(),
    timelyIcsUrl: z.string().url().optional().or(z.literal("")),
  })
  .strict();

const deactivateLinkBodySchema = z
  .object({
    linkId: z.string().uuid(),
  })
  .strict();

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof GoogleCalendarIntegrationAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

export async function createStaffCalendarLinkAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; link: StaffCalendarLinkClientRow } | { ok: false; error: string }> {
  try {
    const parsed = createLinkBodySchema.parse(body);
    await assertGoogleCalendarTenantAdminAccess(tenantId);
    const link = await createStaffCalendarLink({
      tenantId: tenantId.trim(),
      staffMemberId: parsed.staffMemberId,
      calendarId: parsed.calendarId.trim(),
      calendarLabel: parsed.calendarLabel?.trim() || null,
      googleAccountEmail: parsed.googleAccountEmail?.trim() || null,
      provider: parsed.provider ?? "google",
      timelyIcsUrl: parsed.timelyIcsUrl?.trim() || null,
    });
    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/settings/integrations`);
    revalidatePath(`/fi-admin/${tid}/calendar`);
    return { ok: true, link };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function deactivateStaffCalendarLinkAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; link: StaffCalendarLinkClientRow } | { ok: false; error: string }> {
  try {
    const parsed = deactivateLinkBodySchema.parse(body);
    await assertGoogleCalendarTenantAdminAccess(tenantId);
    const link = await deactivateStaffCalendarLink(tenantId.trim(), parsed.linkId);
    const tid = tenantId.trim();
    revalidatePath(`/fi-admin/${tid}/settings/integrations`);
    revalidatePath(`/fi-admin/${tid}/calendar`);
    return { ok: true, link };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
