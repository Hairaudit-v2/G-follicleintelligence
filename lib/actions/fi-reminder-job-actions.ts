"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  parseAdminKeyFromUnknown,
} from "@/src/lib/crm/crmGate";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";

const baseJobSchema = z.object({
  tenantId: z.string().uuid(),
  jobId: z.string().uuid(),
  adminKey: z.string().optional(),
});

function errMsg(e: unknown): string {
  if (e instanceof z.ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

export async function markReminderJobSentAction(
  tenantId: string,
  jobId: string,
  body?: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = baseJobSchema.parse({
      tenantId: tenantId.trim(),
      jobId: jobId.trim(),
      adminKey: parseAdminKeyFromUnknown(body),
    });
    await assertCrmTenantWriteAllowed({
      tenantId: parsed.tenantId,
      adminKey: parsed.adminKey,
      request: undefined,
    });
    const tid = assertNonEmptyUuid(parsed.tenantId, "tenantId");
    const jid = assertNonEmptyUuid(parsed.jobId, "jobId");
    const nowIso = new Date().toISOString();
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("fi_reminder_jobs")
      .update({
        status: "sent",
        delivered_at: nowIso,
        error_log: null,
        updated_at: nowIso,
      })
      .eq("tenant_id", tid)
      .eq("id", jid)
      .in("status", ["pending", "processing"])
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Job not found or not in a markable state.");
    revalidatePath(`/fi-admin/${tid}`);
    revalidatePath(`/fi-admin/${tid}/bookings`);
    revalidatePath(`/fi-admin/${tid}/calendar`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function cancelReminderJobAction(
  tenantId: string,
  jobId: string,
  body?: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const parsed = baseJobSchema
      .extend({
        reason: z.string().max(500).optional(),
      })
      .parse({
        tenantId: tenantId.trim(),
        jobId: jobId.trim(),
        adminKey: parseAdminKeyFromUnknown(body),
        reason: typeof raw.reason === "string" ? raw.reason : undefined,
      });
    await assertCrmTenantWriteAllowed({
      tenantId: parsed.tenantId,
      adminKey: parsed.adminKey,
      request: undefined,
    });
    const tid = assertNonEmptyUuid(parsed.tenantId, "tenantId");
    const jid = assertNonEmptyUuid(parsed.jobId, "jobId");
    const nowIso = new Date().toISOString();
    const reason = (parsed.reason ?? "cancelled_by_operator").trim().slice(0, 500);
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("fi_reminder_jobs")
      .update({
        status: "cancelled",
        error_log: reason,
        updated_at: nowIso,
      })
      .eq("tenant_id", tid)
      .eq("id", jid)
      .in("status", ["pending", "processing"])
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Job not found or not cancellable.");
    revalidatePath(`/fi-admin/${tid}`);
    revalidatePath(`/fi-admin/${tid}/bookings`);
    revalidatePath(`/fi-admin/${tid}/calendar`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function rescheduleReminderJobAction(
  tenantId: string,
  jobId: string,
  body: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const parsed = baseJobSchema
      .extend({ scheduledAtIso: z.coerce.string().min(16, "scheduledAtIso is required.") })
      .parse({
        tenantId: tenantId.trim(),
        jobId: jobId.trim(),
        adminKey: parseAdminKeyFromUnknown(body),
        scheduledAtIso: raw.scheduledAtIso,
      });
    await assertCrmTenantWriteAllowed({
      tenantId: parsed.tenantId,
      adminKey: parsed.adminKey,
      request: undefined,
    });
    const tid = assertNonEmptyUuid(parsed.tenantId, "tenantId");
    const jid = assertNonEmptyUuid(parsed.jobId, "jobId");
    const t = Date.parse(parsed.scheduledAtIso);
    if (!Number.isFinite(t)) throw new Error("Invalid scheduled time.");
    const scheduledAt = new Date(t).toISOString();
    const nowIso = new Date().toISOString();
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("fi_reminder_jobs")
      .update({
        scheduled_at: scheduledAt,
        updated_at: nowIso,
      })
      .eq("tenant_id", tid)
      .eq("id", jid)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data)
      throw new Error("Job not found or not pending (cannot reschedule while processing).");
    revalidatePath(`/fi-admin/${tid}`);
    revalidatePath(`/fi-admin/${tid}/bookings`);
    revalidatePath(`/fi-admin/${tid}/calendar`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
