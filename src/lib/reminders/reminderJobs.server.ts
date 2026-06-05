import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type { FiReminderJobRow, FiReminderJobWithTemplate } from "./reminderTypes";
import { REMINDER_JOB_STATUSES } from "./reminderConstants";
import type { ReminderJobStatus, ReminderTemplateType, ReminderTriggerEvent } from "./reminderConstants";
import { REMINDER_TEMPLATE_TYPES, REMINDER_TRIGGER_EVENTS } from "./reminderConstants";

function assertMetadataObject(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

function mapJobRow(row: Record<string, unknown>): FiReminderJobRow {
  const st = String(row.status);
  if (!REMINDER_JOB_STATUSES.includes(st as ReminderJobStatus)) {
    throw new Error(`Invalid reminder job status: ${st}`);
  }
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    template_id: String(row.template_id),
    booking_id: row.booking_id != null ? String(row.booking_id) : null,
    person_id: row.person_id != null ? String(row.person_id) : null,
    lead_id: row.lead_id != null ? String(row.lead_id) : null,
    scheduled_at: String(row.scheduled_at),
    status: st as ReminderJobStatus,
    attempt_count: Number(row.attempt_count ?? 0),
    last_attempt_at: row.last_attempt_at != null ? String(row.last_attempt_at) : null,
    delivered_at: row.delivered_at != null ? String(row.delivered_at) : null,
    error: row.error != null ? String(row.error) : null,
    metadata: assertMetadataObject(row.metadata),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function loadTemplatesByIds(
  supabase: SupabaseClient,
  tenantId: string,
  templateIds: string[]
): Promise<Map<string, { name: string; type: ReminderTemplateType; trigger_event: ReminderTriggerEvent }>> {
  const out = new Map<string, { name: string; type: ReminderTemplateType; trigger_event: ReminderTriggerEvent }>();
  if (!templateIds.length) return out;
  const { data, error } = await supabase
    .from("fi_reminder_templates")
    .select("id, name, type, trigger_event")
    .eq("tenant_id", tenantId.trim())
    .in("id", templateIds);
  if (error) throw new Error(error.message);
  for (const r of data ?? []) {
    const row = r as Record<string, unknown>;
    const id = String(row.id);
    const type = String(row.type);
    const trig = String(row.trigger_event);
    if (!REMINDER_TEMPLATE_TYPES.includes(type as ReminderTemplateType)) continue;
    if (!REMINDER_TRIGGER_EVENTS.includes(trig as ReminderTriggerEvent)) continue;
    out.set(id, {
      name: String(row.name),
      type: type as ReminderTemplateType,
      trigger_event: trig as ReminderTriggerEvent,
    });
  }
  return out;
}

export async function deletePendingReminderJobsForBooking(
  tenantId: string,
  bookingId: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const bid = assertNonEmptyUuid(bookingId, "bookingId");
  const { error } = await supabase.from("fi_reminder_jobs").delete().eq("tenant_id", tid).eq("booking_id", bid).eq("status", "pending");
  if (error) throw new Error(error.message);
}

export async function loadReminderJobsForBooking(
  tenantId: string,
  bookingId: string,
  client?: SupabaseClient
): Promise<FiReminderJobWithTemplate[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const bid = assertNonEmptyUuid(bookingId, "bookingId");

  const { data, error } = await supabase
    .from("fi_reminder_jobs")
    .select("*")
    .eq("tenant_id", tid)
    .eq("booking_id", bid)
    .order("scheduled_at", { ascending: true });

  if (error) throw new Error(error.message);
  const jobs = ((data ?? []) as Record<string, unknown>[]).map(mapJobRow);
  const tplIds = Array.from(new Set(jobs.map((j) => j.template_id)));
  const tplMap = await loadTemplatesByIds(supabase, tid, tplIds);

  return jobs.map((j) => {
    const t = tplMap.get(j.template_id);
    return {
      ...j,
      template_name: t?.name ?? "",
      template_type: t?.type ?? "email",
      template_trigger_event: t?.trigger_event ?? "booking_created",
    };
  });
}

export type UpcomingReminderDashboardItem = {
  jobId: string;
  scheduled_at: string;
  status: ReminderJobStatus;
  templateName: string;
  templateType: string;
  bookingId: string;
  bookingTitle: string | null;
  bookingStartAt: string;
};

/**
 * Pending (or processing) reminder jobs scheduled in [fromIso, toIso) for dashboard widgets.
 */
export async function loadUpcomingReminderJobsForTenantRange(
  tenantId: string,
  fromIso: string,
  toIso: string,
  limit: number,
  client?: SupabaseClient
): Promise<UpcomingReminderDashboardItem[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const cap = Math.min(Math.max(limit, 1), 100);

  const { data, error } = await supabase
    .from("fi_reminder_jobs")
    .select("id, scheduled_at, status, booking_id, template_id")
    .eq("tenant_id", tid)
    .in("status", ["pending", "processing"])
    .gte("scheduled_at", fromIso.trim())
    .lt("scheduled_at", toIso.trim())
    .order("scheduled_at", { ascending: true })
    .limit(cap);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const bookingIds = Array.from(
    new Set(rows.map((r) => (r.booking_id != null ? String(r.booking_id) : null)).filter((x): x is string => Boolean(x)))
  );
  const templateIds = Array.from(new Set(rows.map((r) => String(r.template_id))));

  const bookingMeta = new Map<string, { title: string | null; start_at: string }>();
  if (bookingIds.length) {
    const { data: bk, error: be } = await supabase
      .from("fi_bookings")
      .select("id, title, start_at")
      .eq("tenant_id", tid)
      .in("id", bookingIds);
    if (be) throw new Error(be.message);
    for (const b of bk ?? []) {
      const br = b as Record<string, unknown>;
      bookingMeta.set(String(br.id), {
        title: br.title != null ? String(br.title) : null,
        start_at: br.start_at != null ? String(br.start_at) : "",
      });
    }
  }

  const tplMap = await loadTemplatesByIds(supabase, tid, templateIds);

  return rows.map((row) => {
    const bid = row.booking_id != null ? String(row.booking_id) : "";
    const bk = bid ? bookingMeta.get(bid) : undefined;
    const tpl = tplMap.get(String(row.template_id));
    return {
      jobId: String(row.id),
      scheduled_at: String(row.scheduled_at),
      status: String(row.status) as ReminderJobStatus,
      templateName: tpl?.name ?? "Reminder",
      templateType: tpl?.type ?? "email",
      bookingId: bid,
      bookingTitle: bk?.title ?? null,
      bookingStartAt: bk?.start_at ?? "",
    };
  });
}

export async function loadReminderJobsForBookings(
  tenantId: string,
  bookingIds: string[],
  client?: SupabaseClient
): Promise<Map<string, FiReminderJobWithTemplate[]>> {
  const out = new Map<string, FiReminderJobWithTemplate[]>();
  if (!bookingIds.length) return out;
  const supabase = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const ids = bookingIds.map((id) => assertNonEmptyUuid(id, "bookingId"));

  const { data, error } = await supabase
    .from("fi_reminder_jobs")
    .select("*")
    .eq("tenant_id", tid)
    .in("booking_id", ids)
    .order("scheduled_at", { ascending: true });

  if (error) throw new Error(error.message);
  const jobs = ((data ?? []) as Record<string, unknown>[]).map(mapJobRow);
  const tplIds = Array.from(new Set(jobs.map((j) => j.template_id)));
  const tplMap = await loadTemplatesByIds(supabase, tid, tplIds);

  for (const j of jobs) {
    const bid = j.booking_id;
    if (!bid) continue;
    const t = tplMap.get(j.template_id);
    const item: FiReminderJobWithTemplate = {
      ...j,
      template_name: t?.name ?? "",
      template_type: t?.type ?? "email",
      template_trigger_event: t?.trigger_event ?? "booking_created",
    };
    const arr = out.get(bid) ?? [];
    arr.push(item);
    out.set(bid, arr);
  }
  return out;
}
