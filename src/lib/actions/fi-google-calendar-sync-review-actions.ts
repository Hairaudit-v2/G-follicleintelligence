"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";

import {
  assertGoogleCalendarTenantAdminAccess,
  GoogleCalendarIntegrationAccessError,
} from "@/src/lib/googleCalendar/googleCalendarIntegrationAccess.server";
import type { GoogleCalendarSyncReviewClientItem } from "@/src/lib/googleCalendar/googleCalendarSyncReviewCore";
import {
  dismissGoogleCalendarSyncReviewItem,
  ignoreGoogleCalendarSyncReviewItem,
  importGoogleCalendarSyncReviewItem,
  linkGoogleCalendarSyncReviewItem,
} from "@/src/lib/googleCalendar/googleCalendarSyncReview.server";

const reviewItemBodySchema = z
  .object({
    reviewItemId: z.string().uuid(),
  })
  .strict();

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof GoogleCalendarIntegrationAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function revalidateReviewSurfaces(tenantId: string): void {
  const tid = tenantId.trim();
  revalidatePath(`/fi-admin/${tid}/settings/integrations`);
  revalidatePath(`/fi-admin/${tid}/calendar`);
}

export async function dismissGoogleCalendarSyncReviewItemAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; item: GoogleCalendarSyncReviewClientItem; message: string }
  | { ok: false; error: string }
> {
  try {
    const parsed = reviewItemBodySchema.parse(body);
    const { actorAuthUserId } = await assertGoogleCalendarTenantAdminAccess(tenantId);
    const result = await dismissGoogleCalendarSyncReviewItem(
      tenantId.trim(),
      parsed.reviewItemId,
      actorAuthUserId
    );
    if (!result.ok) return result;
    revalidateReviewSurfaces(tenantId);
    return { ok: true, item: result.item, message: "Review item dismissed." };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function ignoreGoogleCalendarSyncReviewItemAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; item: GoogleCalendarSyncReviewClientItem; message: string }
  | { ok: false; error: string }
> {
  try {
    const parsed = reviewItemBodySchema.parse(body);
    const { actorAuthUserId } = await assertGoogleCalendarTenantAdminAccess(tenantId);
    const result = await ignoreGoogleCalendarSyncReviewItem(
      tenantId.trim(),
      parsed.reviewItemId,
      actorAuthUserId
    );
    if (!result.ok) return result;
    revalidateReviewSurfaces(tenantId);
    return { ok: true, item: result.item, message: "Review item ignored." };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function linkGoogleCalendarSyncReviewItemAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; item: GoogleCalendarSyncReviewClientItem; message: string }
  | { ok: false; error: string }
> {
  try {
    const parsed = reviewItemBodySchema.parse(body);
    const { actorAuthUserId } = await assertGoogleCalendarTenantAdminAccess(tenantId);
    const result = await linkGoogleCalendarSyncReviewItem(
      tenantId.trim(),
      parsed.reviewItemId,
      actorAuthUserId
    );
    if (!result.ok) return result;
    revalidateReviewSurfaces(tenantId);
    return { ok: true, item: result.item, message: "Linked to existing FI appointment." };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function importGoogleCalendarSyncReviewItemAction(
  tenantId: string,
  body: unknown
): Promise<
  | { ok: true; item: GoogleCalendarSyncReviewClientItem; message: string }
  | { ok: false; error: string }
> {
  try {
    const parsed = reviewItemBodySchema.parse(body);
    const { actorAuthUserId } = await assertGoogleCalendarTenantAdminAccess(tenantId);
    const result = await importGoogleCalendarSyncReviewItem(
      tenantId.trim(),
      parsed.reviewItemId,
      actorAuthUserId
    );
    if (!result.ok) return result;
    revalidateReviewSurfaces(tenantId);
    return { ok: true, item: result.item, message: "Imported as new FI appointment." };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
