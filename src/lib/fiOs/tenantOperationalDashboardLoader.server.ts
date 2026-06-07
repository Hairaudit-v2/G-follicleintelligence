import "server-only";

import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calendarDateStringFromInstant, zonedMidnightUtcMs, zonedNextDayUtcMs } from "@/src/lib/calendar/calendarTimezone";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { loadBookingsForTenantRange } from "@/src/lib/bookings/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { CRM_TASK_ACTIVE_STATUS_VALUES } from "@/src/lib/crm/crmTaskPolicy";
import { leadTitleFromRow, personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadPipelineStages } from "@/src/lib/crm/pipeline";
import { DEFAULT_CRM_PIPELINE_KEY } from "@/src/lib/crm/types";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { isCrmMutationRole } from "@/src/lib/crm/crmGatePolicy";
import { loadOperationalDashboardReminderJobs } from "@/src/lib/reminders/reminderJobs.server";

/** Days in current pipeline stage before a lead appears on the dashboard stale list. */
export const DEFAULT_STALE_LEAD_STAGE_DAYS = 7;

const MS_DAY = 86_400_000;

const AGENDA_BOOKING_STATUSES = ["scheduled", "confirmed", "arrived"] as const;
const agendaBookingStatusSet = new Set<string>(AGENDA_BOOKING_STATUSES);

const terminalLeadStatuses = new Set(["archived", "lost", "converted"]);

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 3_600_000);
}

/** Same UTC window as the home dashboard agenda (midnight UTC today → +72h). */
export function computeOperationalAgendaUtcRange(now: Date): { startIso: string; endIso: string } {
  const dayStart = utcDayStart(now);
  const rangeEnd = addHours(dayStart, 72);
  return { startIso: dayStart.toISOString(), endIso: rangeEnd.toISOString() };
}

function mondayStartUtc(d: Date): Date {
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + mondayOffset, 0, 0, 0, 0));
  return start;
}

export type AgendaBucket = "consult" | "surgery" | "follow_up" | "other";

export function bookingAgendaBucket(bookingType: string): AgendaBucket {
  const t = bookingType.trim();
  if (t === "consultation") return "consult";
  if (t === "surgery") return "surgery";
  if (t === "follow_up" || t === "review") return "follow_up";
  return "other";
}

const dashboardBookingItemSchema = z.object({
  id: z.string().uuid(),
  start_at: z.string(),
  end_at: z.string(),
  title: z.string().nullable(),
  booking_type: z.string(),
  booking_status: z.string(),
  timezone: z.string().nullable(),
  lead_id: z.string().uuid().nullable(),
  patient_id: z.string().uuid().nullable(),
  case_id: z.string().uuid().nullable(),
});

export type DashboardBookingItem = z.infer<typeof dashboardBookingItemSchema>;

const staleLeadItemSchema = z.object({
  leadId: z.string().uuid(),
  title: z.string(),
  stageLabel: z.string(),
  daysInStage: z.number().int().nonnegative(),
  enteredStageAt: z.string(),
});

export type StaleLeadItem = z.infer<typeof staleLeadItemSchema>;

const taskDueItemSchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
  title: z.string(),
  status: z.string(),
  taskType: z.string(),
  dueAt: z.string().nullable(),
  assigneeUserId: z.string().uuid().nullable(),
  isUnassigned: z.boolean(),
});

export type TaskDueItem = z.infer<typeof taskDueItemSchema>;

const quickStatsSchema = z.object({
  newLeadsThisWeek: z.number().int().nonnegative(),
  conversionRateLast30d: z.number().min(0).max(1).nullable(),
  conversionWonLast30d: z.number().int().nonnegative(),
  conversionClosedLast30d: z.number().int().nonnegative(),
  openConsultations: z.number().int().nonnegative(),
  todaysNoShows: z.number().int().nonnegative(),
  staffOnDutyToday: z.number().int().nonnegative(),
});

export type TenantQuickStats = z.infer<typeof quickStatsSchema>;

const launchControlSchema = z.object({
  /** Consultation bookings starting today (tenant IANA calendar day, active statuses). */
  consultationsToday: z.number().int().nonnegative(),
  /** Surgery bookings scheduled Mon–Sun UTC week (active statuses). */
  surgeriesThisWeek: z.number().int().nonnegative(),
  /** Stale leads past threshold (same list as dashboard CRM hygiene). */
  leadsNeedingFollowUp: z.number().int().nonnegative(),
  /** Active CRM tasks (same visibility filter as tasks-due list; count not capped). */
  openTasks: z.number().int().nonnegative(),
  /** Reserved for billing integration — UI shows placeholder when false. */
  revenueAvailable: z.boolean(),
});

export type TenantLaunchControl = z.infer<typeof launchControlSchema>;

const dashboardReminderItemSchema = z.object({
  jobId: z.string().uuid(),
  scheduled_at: z.string(),
  status: z.string(),
  templateName: z.string(),
  templateType: z.string(),
  bookingId: z.string().uuid().nullable(),
  bookingTitle: z.string().nullable(),
  bookingStartAt: z.string().nullable(),
  bookingTimezone: z.string().nullable(),
  leadId: z.string().uuid().nullable(),
  patientId: z.string().uuid().nullable(),
  recipientLabel: z.string(),
  clinicalSummaryLine: z.string().nullable(),
  bookingAssigneeFiUserId: z.string().uuid().nullable(),
  leadPrimaryOwnerFiUserId: z.string().uuid().nullable(),
  detailHref: z.string(),
});

export type DashboardReminderItem = z.infer<typeof dashboardReminderItemSchema>;

export const tenantOperationalDashboardSchema = z.object({
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  agendaRange: z.object({ startIso: z.string(), endIso: z.string() }),
  agendaByBucket: z.object({
    consult: z.array(dashboardBookingItemSchema),
    surgery: z.array(dashboardBookingItemSchema),
    follow_up: z.array(dashboardBookingItemSchema),
    other: z.array(dashboardBookingItemSchema),
  }),
  upcomingReminders: z.array(dashboardReminderItemSchema),
  staleLeads: z.array(staleLeadItemSchema),
  staleLeadThresholdDays: z.number().int().positive(),
  tasksDue: z.array(taskDueItemSchema),
  quickStats: quickStatsSchema,
  viewerFiUserId: z.string().uuid().nullable(),
  /** `fi_staff.id` for the signed-in tenant user when `fi_staff.fi_user_id` matches their `fi_users.id`. */
  viewerStaffId: z.string().uuid().nullable(),
  canQuickCallIn: z.boolean(),
  launchControl: launchControlSchema,
});

export type TenantOperationalDashboard = z.infer<typeof tenantOperationalDashboardSchema>;

function mapBookingToDashboardItem(row: FiBookingRow): DashboardBookingItem {
  return dashboardBookingItemSchema.parse({
    id: row.id,
    start_at: row.start_at,
    end_at: row.end_at,
    title: row.title,
    booking_type: row.booking_type,
    booking_status: row.booking_status,
    timezone: row.timezone,
    lead_id: row.lead_id,
    patient_id: row.patient_id,
    case_id: row.case_id,
  });
}

async function loadFiUserDashboard(
  tenantId: string,
  authUserId: string | null
): Promise<{ id: string; role: string } | null> {
  if (!authUserId?.trim()) return null;
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, role")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: String((data as { id: string }).id),
    role: String((data as { role: string | null }).role ?? "member"),
  };
}

async function loadAgendaBookings(tenantId: string, now: Date): Promise<{
  range: { startIso: string; endIso: string };
  byBucket: Record<AgendaBucket, DashboardBookingItem[]>;
}> {
  const { startIso: rangeStartIso, endIso: rangeEndIso } = computeOperationalAgendaUtcRange(now);

  const raw = await loadBookingsForTenantRange(tenantId, rangeStartIso, rangeEndIso);

  const filtered = raw.filter((b) => {
    if (b.booking_status === "cancelled" || b.booking_status === "completed" || b.booking_status === "no_show") {
      return false;
    }
    return agendaBookingStatusSet.has(b.booking_status);
  });

  const byBucket: Record<AgendaBucket, DashboardBookingItem[]> = {
    consult: [],
    surgery: [],
    follow_up: [],
    other: [],
  };

  for (const row of filtered) {
    const item = mapBookingToDashboardItem(row);
    byBucket[bookingAgendaBucket(item.booking_type)].push(item);
  }

  for (const k of Object.keys(byBucket) as AgendaBucket[]) {
    byBucket[k].sort((a, b) => a.start_at.localeCompare(b.start_at));
  }

  return {
    range: { startIso: rangeStartIso, endIso: rangeEndIso },
    byBucket,
  };
}

async function loadStaleLeads(
  tenantId: string,
  thresholdDays: number,
  now: Date
): Promise<StaleLeadItem[]> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();

  const stages = await loadPipelineStages(
    { tenantId: tid, organisationId: null, clinicId: null, pipelineKey: DEFAULT_CRM_PIPELINE_KEY },
    supabase
  );
  const stageLabel = new Map(stages.map((s) => [s.id, s.label]));

  const { data: leadRows, error: le } = await supabase
    .from("fi_crm_leads")
    .select("id, summary, current_stage_id, created_at, status, person_id")
    .eq("tenant_id", tid)
    .limit(400);

  if (le) throw new Error(le.message);
  const leads = (leadRows ?? []) as {
    id: string;
    summary: string | null;
    current_stage_id: string | null;
    created_at: string;
    status: string;
    person_id: string;
  }[];

  const activeLeads = leads.filter((l) => !terminalLeadStatuses.has(String(l.status ?? "").trim().toLowerCase()));
  if (activeLeads.length === 0) return [];

  const personIds = Array.from(new Set(activeLeads.map((l) => l.person_id)));
  const { data: persons, error: pe } = await supabase.from("fi_persons").select("id, metadata").in("id", personIds);
  if (pe) throw new Error(pe.message);
  const personMeta = new Map(
    (persons ?? []).map((p) => [String((p as { id: string }).id), (p as { metadata: unknown }).metadata])
  );

  const leadIds = activeLeads.map((l) => l.id);
  const { data: histRows, error: he } = await supabase
    .from("fi_crm_lead_stage_history")
    .select("lead_id, to_stage_id, changed_at")
    .eq("tenant_id", tid)
    .in("lead_id", leadIds)
    .order("changed_at", { ascending: false });

  if (he) throw new Error(he.message);

  type Hist = { lead_id: string; to_stage_id: string; changed_at: string };
  const history = (histRows ?? []) as Hist[];
  const leadById = new Map(activeLeads.map((l) => [l.id, l]));

  const stageEnteredAt = new Map<string, string>();
  for (const row of history) {
    const lead = leadById.get(row.lead_id);
    if (!lead?.current_stage_id) continue;
    if (row.to_stage_id !== lead.current_stage_id) continue;
    if (!stageEnteredAt.has(row.lead_id)) {
      stageEnteredAt.set(row.lead_id, row.changed_at);
    }
  }

  const stale: StaleLeadItem[] = [];
  const nowMs = now.getTime();

  for (const lead of activeLeads) {
    const sid = lead.current_stage_id;
    const enteredIso = sid ? stageEnteredAt.get(lead.id) ?? lead.created_at : lead.created_at;
    const enteredMs = Date.parse(enteredIso);
    if (!Number.isFinite(enteredMs)) continue;
    const daysInStage = Math.floor((nowMs - enteredMs) / MS_DAY);
    if (daysInStage < thresholdDays) continue;

    const meta = personMeta.get(lead.person_id);
    const metaObj =
      meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : null;
    const personLabel = personMetadataDisplayLabel(metaObj);
    const summaryTitle = leadTitleFromRow(lead.summary, lead.id);
    const title = personLabel !== "—" ? `${summaryTitle} · ${personLabel}` : summaryTitle;

    stale.push({
      leadId: lead.id,
      title,
      stageLabel: sid ? stageLabel.get(sid) ?? "Stage" : "No stage",
      daysInStage,
      enteredStageAt: enteredIso,
    });
  }

  stale.sort((a, b) => b.daysInStage - a.daysInStage);
  return stale.slice(0, 25).map((s) => staleLeadItemSchema.parse(s));
}

async function loadTasksDue(tenantId: string, fiUserId: string | null, now: Date): Promise<TaskDueItem[]> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const horizon = addHours(now, 14 * 24).toISOString();

  let q = supabase
    .from("fi_crm_tasks")
    .select("id, lead_id, title, status, task_type, due_at, assignee_user_id")
    .eq("tenant_id", tid)
    .in("status", [...CRM_TASK_ACTIVE_STATUS_VALUES]);

  if (fiUserId) {
    q = q.or(`assignee_user_id.eq.${fiUserId},assignee_user_id.is.null`);
  } else {
    q = q.is("assignee_user_id", null);
  }

  const { data, error } = await q.order("due_at", { ascending: true, nullsFirst: false }).limit(40);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    id: string;
    lead_id: string;
    title: string;
    status: string;
    task_type: string;
    due_at: string | null;
    assignee_user_id: string | null;
  }[];

  const filtered = rows.filter((r) => {
    if (!r.due_at) return true;
    return r.due_at <= horizon;
  });

  return filtered.slice(0, 20).map((r) =>
    taskDueItemSchema.parse({
      id: r.id,
      leadId: r.lead_id,
      title: r.title,
      status: r.status,
      taskType: r.task_type,
      dueAt: r.due_at,
      assigneeUserId: r.assignee_user_id,
      isUnassigned: r.assignee_user_id == null,
    })
  );
}

const ACTIVE_AGENDA_BOOKING_STATUSES = ["scheduled", "confirmed", "arrived"] as const;

async function loadLaunchBookingCounts(
  tenantId: string,
  now: Date
): Promise<{ consultationsToday: number; surgeriesThisWeek: number }> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();

  const { calendarTimezone } = await loadTenantOperationalCalendarSettings(tid);
  const todayYmd = calendarDateStringFromInstant(now, calendarTimezone);
  const localDayStartMs = zonedMidnightUtcMs(todayYmd, calendarTimezone);
  const localDayEndMs = zonedNextDayUtcMs(todayYmd, calendarTimezone);
  const dayStart = utcDayStart(now).toISOString();
  const dayEnd = addHours(utcDayStart(now), 24).toISOString();
  const localStartIso = localDayStartMs != null ? new Date(localDayStartMs).toISOString() : dayStart;
  const localEndIso = localDayEndMs != null ? new Date(localDayEndMs).toISOString() : dayEnd;

  const weekStartIso = mondayStartUtc(now).toISOString();
  const weekEndIso = addHours(mondayStartUtc(now), 7 * 24).toISOString();

  const [cRes, sRes] = await Promise.all([
    supabase
      .from("fi_bookings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("booking_type", "consultation")
      .in("booking_status", [...ACTIVE_AGENDA_BOOKING_STATUSES])
      .gte("start_at", localStartIso)
      .lt("start_at", localEndIso),
    supabase
      .from("fi_bookings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("booking_type", "surgery")
      .in("booking_status", [...ACTIVE_AGENDA_BOOKING_STATUSES])
      .gte("start_at", weekStartIso)
      .lt("start_at", weekEndIso),
  ]);

  if (cRes.error) throw new Error(cRes.error.message);
  if (sRes.error) throw new Error(sRes.error.message);

  return {
    consultationsToday: cRes.count ?? 0,
    surgeriesThisWeek: sRes.count ?? 0,
  };
}

async function loadOpenCrmTasksCount(tenantId: string, fiUserId: string | null): Promise<number> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();

  let q = supabase
    .from("fi_crm_tasks")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .in("status", [...CRM_TASK_ACTIVE_STATUS_VALUES]);

  if (fiUserId) {
    q = q.or(`assignee_user_id.eq.${fiUserId},assignee_user_id.is.null`);
  } else {
    q = q.is("assignee_user_id", null);
  }

  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function loadQuickStats(tenantId: string, now: Date): Promise<TenantQuickStats> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();

  const weekStart = mondayStartUtc(now).toISOString();
  const thirtyAgo = new Date(now.getTime() - 30 * MS_DAY).toISOString();
  const dayStart = utcDayStart(now).toISOString();
  const dayEnd = addHours(utcDayStart(now), 24).toISOString();

  const { calendarTimezone } = await loadTenantOperationalCalendarSettings(tid);
  const todayYmd = calendarDateStringFromInstant(now, calendarTimezone);
  const localDayStartMs = zonedMidnightUtcMs(todayYmd, calendarTimezone);
  const localDayEndMs = zonedNextDayUtcMs(todayYmd, calendarTimezone);
  const localStartIso =
    localDayStartMs != null ? new Date(localDayStartMs).toISOString() : dayStart;
  const localEndIso = localDayEndMs != null ? new Date(localDayEndMs).toISOString() : dayEnd;

  const stages = await loadPipelineStages(
    { tenantId: tid, organisationId: null, clinicId: null, pipelineKey: DEFAULT_CRM_PIPELINE_KEY },
    supabase
  );
  const wonIds = new Set(stages.filter((s) => s.is_won).map((s) => s.id));
  const lostIds = new Set(stages.filter((s) => s.is_lost).map((s) => s.id));
  const terminalStageIds = Array.from(wonIds).concat(Array.from(lostIds));

  const [
    newLeadsRes,
    terminalHistRes,
    consultRes,
    noShowRes,
    staffBookingsRes,
  ] = await Promise.all([
    supabase
      .from("fi_crm_leads")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .gte("created_at", weekStart),
    terminalStageIds.length
      ? supabase
          .from("fi_crm_lead_stage_history")
          .select("lead_id, to_stage_id, changed_at")
          .eq("tenant_id", tid)
          .gte("changed_at", thirtyAgo)
          .in("to_stage_id", terminalStageIds)
          .order("changed_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("fi_consultations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .in("status", ["draft", "in_progress", "quoted"]),
    supabase
      .from("fi_bookings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("booking_status", "no_show")
      .gte("start_at", dayStart)
      .lt("start_at", dayEnd),
    supabase
      .from("fi_bookings")
      .select("assigned_staff_id")
      .eq("tenant_id", tid)
      .in("booking_status", ["scheduled", "confirmed", "arrived"])
      .gte("start_at", localStartIso)
      .lt("start_at", localEndIso)
      .not("assigned_staff_id", "is", null),
  ]);

  if (newLeadsRes.error) throw new Error(newLeadsRes.error.message);
  if (consultRes.error) throw new Error(consultRes.error.message);
  if (noShowRes.error) throw new Error(noShowRes.error.message);
  if (terminalHistRes.error) throw new Error(terminalHistRes.error.message);
  if (staffBookingsRes.error) throw new Error(staffBookingsRes.error.message);

  const staffRows = (staffBookingsRes.data ?? []) as { assigned_staff_id: string | null }[];
  const staffOnDutyToday = new Set(
    staffRows.map((r) => r.assigned_staff_id?.trim()).filter((x): x is string => Boolean(x))
  ).size;

  const hist = (terminalHistRes.data ?? []) as { lead_id: string; to_stage_id: string; changed_at: string }[];
  const lastOutcome = new Map<string, { to: string; at: string }>();
  for (const row of hist) {
    if (!lastOutcome.has(row.lead_id)) {
      lastOutcome.set(row.lead_id, { to: row.to_stage_id, at: row.changed_at });
    }
  }

  let won = 0;
  let lost = 0;
  for (const { to } of Array.from(lastOutcome.values())) {
    if (wonIds.has(to)) won += 1;
    else if (lostIds.has(to)) lost += 1;
  }

  const closed = won + lost;
  const conversionRateLast30d = closed > 0 ? won / closed : null;

  return quickStatsSchema.parse({
    newLeadsThisWeek: newLeadsRes.count ?? 0,
    conversionRateLast30d,
    conversionWonLast30d: won,
    conversionClosedLast30d: closed,
    openConsultations: consultRes.count ?? 0,
    todaysNoShows: noShowRes.count ?? 0,
    staffOnDutyToday,
  });
}

const UPCOMING_REMINDER_ROW_CAP = 10;
const UPCOMING_REMINDER_HORIZON_DAYS = 7;

async function loadUpcomingReminders(tenantId: string, now: Date): Promise<DashboardReminderItem[]> {
  const raw = await loadOperationalDashboardReminderJobs(tenantId, now, {
    horizonDays: UPCOMING_REMINDER_HORIZON_DAYS,
    limit: UPCOMING_REMINDER_ROW_CAP,
  });
  return raw.map((r) => dashboardReminderItemSchema.parse(r));
}

/**
 * Tenant-scoped operational snapshot for the FI Admin home dashboard (service role).
 */
export async function loadTenantOperationalDashboard(
  tenantId: string,
  options?: { staleLeadStageDays?: number }
): Promise<TenantOperationalDashboard> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const staleDays = options?.staleLeadStageDays ?? DEFAULT_STALE_LEAD_STAGE_DAYS;
  const now = new Date();
  const supabase = supabaseAdmin();

  const authUserId = await resolveAuthUserId(null);
  const viewer = await loadFiUserDashboard(tid, authUserId);
  const viewerFiUserId = viewer?.id ?? null;
  const canQuickCallIn = isCrmMutationRole(viewer?.role);

  let viewerStaffId: string | null = null;
  if (viewerFiUserId) {
    const { data: staffRow, error: staffRowErr } = await supabase
      .from("fi_staff")
      .select("id")
      .eq("tenant_id", tid)
      .eq("fi_user_id", viewerFiUserId)
      .maybeSingle();
    if (staffRowErr) throw new Error(staffRowErr.message);
    if (staffRow) viewerStaffId = String((staffRow as { id: string }).id);
  }

  const tenantRes = await supabase.from("fi_tenants").select("name").eq("id", tid).maybeSingle();
  if (tenantRes.error) throw new Error(tenantRes.error.message);
  if (!tenantRes.data) throw new Error("Tenant not found");
  const tenantName = String((tenantRes.data as { name?: string }).name ?? "").trim() || tid;

  const [agenda, staleLeads, tasksDue, quickStats, upcomingReminders, launchBookings, openTasksCount] =
    await Promise.all([
      loadAgendaBookings(tid, now),
      loadStaleLeads(tid, staleDays, now),
      loadTasksDue(tid, viewerFiUserId, now),
      loadQuickStats(tid, now),
      loadUpcomingReminders(tid, now),
      loadLaunchBookingCounts(tid, now),
      loadOpenCrmTasksCount(tid, viewerFiUserId),
    ]);

  return tenantOperationalDashboardSchema.parse({
    tenantId: tid,
    tenantName,
    agendaRange: agenda.range,
    agendaByBucket: agenda.byBucket,
    upcomingReminders,
    staleLeads,
    staleLeadThresholdDays: staleDays,
    tasksDue,
    quickStats,
    viewerFiUserId,
    viewerStaffId,
    canQuickCallIn,
    launchControl: {
      consultationsToday: launchBookings.consultationsToday,
      surgeriesThisWeek: launchBookings.surgeriesThisWeek,
      leadsNeedingFollowUp: staleLeads.length,
      openTasks: openTasksCount,
      revenueAvailable: false,
    },
  });
}
