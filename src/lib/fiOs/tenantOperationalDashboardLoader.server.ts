import "server-only";

import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  loadTenantCalendarSettingsCached,
  loadTenantConfigCached,
} from "@/src/lib/performance/referenceDataCache.server";
import { loadBookingsForTenantRange } from "@/src/lib/bookings/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { CRM_TASK_ACTIVE_STATUS_VALUES } from "@/src/lib/crm/crmTaskPolicy";
import { leadTitleFromRow, personMetadataDisplayLabel } from "@/src/lib/crm/crmLeadListDisplay";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadPipelineStages } from "@/src/lib/crm/pipeline";
import type { FiCrmPipelineStageRow } from "@/src/lib/crm/types";
import { DEFAULT_CRM_PIPELINE_KEY } from "@/src/lib/crm/types";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { resolveDevelopmentClinicAccessForTenant } from "@/src/lib/fiOs/developmentClinicAccess.server";
import { computeOperationalLocalDayUtcWindow } from "@/src/lib/fiOs/tenantOperationalLocalDay";
import { aggregateActiveLeadVolumeByPipelineStage } from "@/src/lib/fiOs/tenantOperationalDashboardCrmLeadVolume";
import { loadMedicationReorderPendingReviewCount } from "@/src/lib/medicationReorder/medicationReorderLoaders.server";
import { loadPaymentSummaryForOperations } from "@/src/lib/payments/paymentRecordLoaders.server";
import { readFiPaymentsEnabled } from "@/src/lib/payments/fiPaymentEnv.server";
import { loadRevenueCollectionsDashboardKpis } from "@/src/lib/revenueOs/revenueInvoiceLoaders.server";
import { loadSurgeryFinancialPaymentAttentionCount } from "@/src/lib/financialOs/financialSurgeryPipelineStatus.server";
import { loadPaymentPathwayAttentionCount } from "@/src/lib/financialOs/financialPaymentPathwayInbox.server";
import { loadFinanceApplicationAttentionCount } from "@/src/lib/financialOs/financialFinanceApplications.server";
import { loadSuperReleaseAttentionCount } from "@/src/lib/financialOs/financialSuperRelease.server";
import { loadInternationalTransferAttentionCount } from "@/src/lib/financialOs/financialInternationalTransfer.server";
import { loadFinancialClearanceAttentionCount } from "@/src/lib/financialOs/financialClearance.server";
import { loadOperationalDashboardReminderJobs } from "@/src/lib/reminders/reminderJobs.server";
import {
  bookingAgendaBucket,
  computeOperationalAgendaUtcRange,
  type AgendaBucket,
} from "@/src/lib/fiOs/tenantOperationalDashboardHelpers";
import { anchorLabelForBookingRow } from "@/src/lib/bookings/bookingDisplayContext";
import { loadBookingDisplayContextMaps } from "@/src/lib/bookings/bookingDisplayContext.server";
import {
  bookingStartFallsOnOperationalWindow,
  receptionBoardColumnForBooking,
  RECEPTION_BOARD_COLUMN_IDS,
} from "@/src/lib/fiOs/receptionBoardModel";
import { bookingAssignmentDisplay } from "@/src/lib/staff/staffAssigneeDisplay";
import { loadClinicalStaffPickerOptions } from "@/src/lib/staff/clinicalStaffPickerLoader.server";
import { loadCrmShellUserPickerOptions } from "@/src/lib/crm/crmShellLoaders";
import { bookingStatusLabel, bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";

export {
  bookingAgendaBucket,
  computeOperationalAgendaUtcRange,
} from "@/src/lib/fiOs/tenantOperationalDashboardHelpers";
export type { AgendaBucket } from "@/src/lib/fiOs/tenantOperationalDashboardHelpers";

/** Days in current pipeline stage before a lead appears on the dashboard stale list. */
export const DEFAULT_STALE_LEAD_STAGE_DAYS = 7;

const MS_DAY = 86_400_000;

const AGENDA_BOOKING_STATUSES = ["scheduled", "confirmed", "arrived"] as const;
const agendaBookingStatusSet = new Set<string>(AGENDA_BOOKING_STATUSES);

export const terminalLeadStatuses = new Set(["archived", "lost", "converted"]);

function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 3_600_000);
}

function mondayStartUtc(d: Date): Date {
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + mondayOffset, 0, 0, 0, 0)
  );
  return start;
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
  /** `fi_crm_leads.created_at` within tenant operational local day `[operationalDay.localStartIso, operationalDay.localEndIso)`. */
  newLeadsToday: z.number().int().nonnegative(),
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
  /** When true, FI Revenue / Payments module is enabled (env-driven; not a clinical guarantee). */
  revenueAvailable: z.boolean(),
});

const revenueCollectionsSchema = z.object({
  moduleEnabled: z.boolean(),
  unpaidIssuedInvoiceCount: z.number().int().nonnegative(),
  overdueInvoiceCount: z.number().int().nonnegative(),
});

const paymentCommercialKpisSchema = z.object({
  depositsDueCount: z.number().int().nonnegative(),
  depositsPaidTodayCount: z.number().int().nonnegative(),
  overduePaymentsCount: z.number().int().nonnegative(),
});

export type TenantLaunchControl = z.infer<typeof launchControlSchema>;

export type TenantRevenueCollections = z.infer<typeof revenueCollectionsSchema>;

export type TenantPaymentCommercialKpis = z.infer<typeof paymentCommercialKpisSchema>;

const clinicTodaySchema = z.object({
  /** Consultation bookings starting today (tenant IANA calendar day, active statuses). */
  consultations: z.number().int().nonnegative(),
  /** PRP bookings starting today. */
  prp: z.number().int().nonnegative(),
  /** Follow-up and review bookings starting today. */
  followUps: z.number().int().nonnegative(),
  /** Surgery bookings starting today. */
  surgeries: z.number().int().nonnegative(),
});

export type TenantClinicToday = z.infer<typeof clinicTodaySchema>;

const actionCentreSchema = z.object({
  /** Open CRM leads not yet contacted (status open). */
  leadsAwaitingContact: z.number().int().nonnegative(),
  /** Consultation workspaces still in draft, in progress, or quoted. */
  consultationsAwaitingCompletion: z.number().int().nonnegative(),
  /** Follow-up / review bookings due within 14 days (active statuses). */
  followUpsDue: z.number().int().nonnegative(),
  /** Upcoming surgery bookings missing a linked case (next 14 days — same horizon as Surgery readiness board). */
  surgeryReadinessAlerts: z.number().int().nonnegative(),
  /** Surgery bookings in the same 14-day window where FinancialOS / revenue signals need follow-up before procedure day. */
  surgeryFinancialPaymentAttention: z.number().int().nonnegative(),
  /** FinancialOS Phase 2C: open payment pathway inbox tasks requiring staff workflow. */
  financialPathwayTasksAttention: z.number().int().nonnegative(),
  /** FinancialOS Phase 3: finance applications breaching SLA attention rules. */
  financeApplicationsAttention: z.number().int().nonnegative(),
  /** FinancialOS Phase 3B: super release applications breaching SLA attention rules. */
  superReleaseApplicationsAttention: z.number().int().nonnegative(),
  /** FinancialOS Phase 3C: international transfer applications breaching SLA attention rules. */
  internationalTransferApplicationsAttention: z.number().int().nonnegative(),
  /** FinancialOS Phase 4: surgery bookings in the 14-day window requiring financial clearance attention. */
  financialClearanceAttention: z.number().int().nonnegative(),
});

export type TenantActionCentre = z.infer<typeof actionCentreSchema>;

const crmPipelineStageSnapshotSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  sort_order: z.number(),
  is_entry: z.boolean(),
  is_won: z.boolean(),
  is_lost: z.boolean(),
});

const crmPipelineLeadVolumeSchema = z.object({
  activeByStageId: z.record(z.string(), z.number().int().nonnegative()),
  activeUnassignedStage: z.number().int().nonnegative(),
  activeOtherPipelineStage: z.number().int().nonnegative(),
});

export type CrmPipelineLeadVolumePayload = z.infer<typeof crmPipelineLeadVolumeSchema>;

export type CrmPipelineStageSnapshot = z.infer<typeof crmPipelineStageSnapshotSchema>;

const operationalDaySchema = z.object({
  calendarTimezone: z.string(),
  todayYmd: z.string(),
  /** Inclusive UTC instant for tenant-local operational day start (same as booking “today” window). */
  localStartIso: z.string(),
  /** Exclusive UTC instant for tenant-local operational day end. */
  localEndIso: z.string(),
});

export type TenantOperationalDay = z.infer<typeof operationalDaySchema>;

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

const receptionBoardColumnSchema = z.enum(RECEPTION_BOARD_COLUMN_IDS);

const receptionBoardCardSchema = z.object({
  id: z.string().uuid(),
  startAt: z.string(),
  endAt: z.string(),
  title: z.string().nullable(),
  bookingType: z.string(),
  bookingStatus: z.string(),
  timezone: z.string().nullable(),
  /** Optional anchors for deep links (same tenant). */
  leadId: z.string().uuid().nullable(),
  patientId: z.string().uuid().nullable(),
  displayName: z.string(),
  statusLabel: z.string(),
  typeLabel: z.string(),
  providerLabel: z.string(),
  clinicLabel: z.string().nullable(),
  roomLabel: z.string().nullable(),
  receptionColumn: receptionBoardColumnSchema,
  /** Canonical metadata for client-side PATCH merges (includes optional reception phase). */
  metadata: z.record(z.string(), z.unknown()),
});

export type ReceptionBoardCard = z.infer<typeof receptionBoardCardSchema>;

const receptionBoardPayloadSchema = z.object({
  cards: z.array(receptionBoardCardSchema),
});

export type ReceptionBoardPayload = z.infer<typeof receptionBoardPayloadSchema>;

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
  clinicToday: clinicTodaySchema,
  actionCentre: actionCentreSchema,
  /** DoctorOS 1D: medication reorders awaiting clinic review (requested + doctor_review_required). */
  medicationReorderReviewsPending: z.number().int().nonnegative(),
  /** Tenant IANA calendar day for operational widgets (same source as booking day windows). */
  operationalDay: operationalDaySchema,
  /** Default CRM pipeline stages (single shared `loadPipelineStages` call per dashboard load). */
  crmPipelineStages: z.array(crmPipelineStageSnapshotSchema),
  /** Active (non-terminal) lead counts by default-pipeline stage id — from `fi_crm_leads`, not stale-lead hygiene. */
  crmPipelineLeadVolume: crmPipelineLeadVolumeSchema,
  /** Manual payment tracking KPIs (deposits / overdue — not integrated billing). */
  paymentCommercialKpis: paymentCommercialKpisSchema,
  /** Stage 7: issued invoice collection signals (separate from `fi_payment_records`). */
  revenueCollections: revenueCollectionsSchema,
  /** Reception board cards for `operationalDay` (tenant-local); empty when loader skips enrichment. */
  receptionBoard: receptionBoardPayloadSchema,
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

async function loadAgendaBookings(
  tenantId: string,
  now: Date
): Promise<{
  range: { startIso: string; endIso: string };
  byBucket: Record<AgendaBucket, DashboardBookingItem[]>;
}> {
  const { startIso: rangeStartIso, endIso: rangeEndIso } = computeOperationalAgendaUtcRange(now);

  const raw = await loadBookingsForTenantRange(tenantId, rangeStartIso, rangeEndIso);

  const filtered = raw.filter((b) => {
    if (
      b.booking_status === "cancelled" ||
      b.booking_status === "completed" ||
      b.booking_status === "no_show"
    ) {
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
  now: Date,
  stages: FiCrmPipelineStageRow[]
): Promise<StaleLeadItem[]> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();

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

  const activeLeads = leads.filter(
    (l) =>
      !terminalLeadStatuses.has(
        String(l.status ?? "")
          .trim()
          .toLowerCase()
      )
  );
  if (activeLeads.length === 0) return [];

  const personIds = Array.from(new Set(activeLeads.map((l) => l.person_id)));
  const { data: persons, error: pe } = await supabase
    .from("fi_persons")
    .select("id, metadata")
    .eq("tenant_id", tid)
    .in("id", personIds);
  if (pe) throw new Error(pe.message);
  const personMeta = new Map(
    (persons ?? []).map((p) => [
      String((p as { id: string }).id),
      (p as { metadata: unknown }).metadata,
    ])
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
    const enteredIso = sid ? (stageEnteredAt.get(lead.id) ?? lead.created_at) : lead.created_at;
    const enteredMs = Date.parse(enteredIso);
    if (!Number.isFinite(enteredMs)) continue;
    const daysInStage = Math.floor((nowMs - enteredMs) / MS_DAY);
    if (daysInStage < thresholdDays) continue;

    const meta = personMeta.get(lead.person_id);
    const metaObj =
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : null;
    const personLabel = personMetadataDisplayLabel(metaObj);
    const summaryTitle = leadTitleFromRow(lead.summary, lead.id);
    const title = personLabel !== "—" ? `${summaryTitle} · ${personLabel}` : summaryTitle;

    stale.push({
      leadId: lead.id,
      title,
      stageLabel: sid ? (stageLabel.get(sid) ?? "Stage") : "No stage",
      daysInStage,
      enteredStageAt: enteredIso,
    });
  }

  stale.sort((a, b) => b.daysInStage - a.daysInStage);
  return stale.slice(0, 25).map((s) => staleLeadItemSchema.parse(s));
}

async function loadTasksDue(
  tenantId: string,
  fiUserId: string | null,
  now: Date
): Promise<TaskDueItem[]> {
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

export async function resolveTenantLocalDayWindow(
  tenantId: string,
  now: Date,
  calendarTimezone?: string | null
): Promise<{ localStartIso: string; localEndIso: string }> {
  const tz =
    calendarTimezone?.trim() ||
    (await loadTenantCalendarSettingsCached(tenantId.trim())).calendarTimezone;
  const { localStartIso, localEndIso } = computeOperationalLocalDayUtcWindow(now, tz);
  return { localStartIso, localEndIso };
}

async function countActiveBookingsInRange(
  tenantId: string,
  startIso: string,
  endIso: string,
  bookingTypes: string | readonly string[]
): Promise<number> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const types = typeof bookingTypes === "string" ? [bookingTypes] : [...bookingTypes];

  let q = supabase
    .from("fi_bookings")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .in("booking_status", [...ACTIVE_AGENDA_BOOKING_STATUSES])
    .gte("start_at", startIso)
    .lt("start_at", endIso);

  if (types.length === 1) q = q.eq("booking_type", types[0]!);
  else q = q.in("booking_type", types);

  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function loadClinicTodayAndWeekCounts(
  tenantId: string,
  now: Date,
  calendarTimezone: string,
  operationalLocalDay?: { localStartIso: string; localEndIso: string }
): Promise<{ clinicToday: TenantClinicToday; surgeriesThisWeek: number }> {
  const { localStartIso, localEndIso } =
    operationalLocalDay ?? (await resolveTenantLocalDayWindow(tenantId, now, calendarTimezone));
  const weekStartIso = mondayStartUtc(now).toISOString();
  const weekEndIso = addHours(mondayStartUtc(now), 7 * 24).toISOString();

  const [consultations, prp, followUps, surgeries, surgeriesThisWeek] = await Promise.all([
    countActiveBookingsInRange(tenantId, localStartIso, localEndIso, "consultation"),
    countActiveBookingsInRange(tenantId, localStartIso, localEndIso, "prp"),
    countActiveBookingsInRange(tenantId, localStartIso, localEndIso, ["follow_up", "review"]),
    countActiveBookingsInRange(tenantId, localStartIso, localEndIso, "surgery"),
    countActiveBookingsInRange(tenantId, weekStartIso, weekEndIso, "surgery"),
  ]);

  return {
    clinicToday: clinicTodaySchema.parse({ consultations, prp, followUps, surgeries }),
    surgeriesThisWeek,
  };
}

async function loadActionCentreCounts(tenantId: string, now: Date): Promise<TenantActionCentre> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const horizonIso = addHours(now, 14 * 24).toISOString();
  const nowIso = now.toISOString();

  const [
    openLeadsRes,
    consultRes,
    followUpRes,
    surgeryReadyRes,
    surgeryFinancialPaymentAttention,
    financialPathwayTasksAttention,
    financeApplicationsAttention,
    superReleaseApplicationsAttention,
    internationalTransferApplicationsAttention,
    financialClearanceAttention,
  ] = await Promise.all([
    supabase
      .from("fi_crm_leads")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("status", "open"),
    supabase
      .from("fi_consultations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .in("status", ["draft", "in_progress", "quoted"]),
    supabase
      .from("fi_bookings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .in("booking_type", ["follow_up", "review"])
      .in("booking_status", [...ACTIVE_AGENDA_BOOKING_STATUSES])
      .gte("start_at", nowIso)
      .lt("start_at", horizonIso),
    supabase
      .from("fi_bookings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("booking_type", "surgery")
      .in("booking_status", [...ACTIVE_AGENDA_BOOKING_STATUSES])
      .gte("start_at", nowIso)
      .lt("start_at", horizonIso)
      .is("case_id", null),
    loadSurgeryFinancialPaymentAttentionCount(tid, now),
    loadPaymentPathwayAttentionCount(tid),
    loadFinanceApplicationAttentionCount(tid),
    loadSuperReleaseAttentionCount(tid),
    loadInternationalTransferAttentionCount(tid),
    loadFinancialClearanceAttentionCount(tid, now),
  ]);

  if (openLeadsRes.error) throw new Error(openLeadsRes.error.message);
  if (consultRes.error) throw new Error(consultRes.error.message);
  if (followUpRes.error) throw new Error(followUpRes.error.message);
  if (surgeryReadyRes.error) throw new Error(surgeryReadyRes.error.message);

  return actionCentreSchema.parse({
    leadsAwaitingContact: openLeadsRes.count ?? 0,
    consultationsAwaitingCompletion: consultRes.count ?? 0,
    followUpsDue: followUpRes.count ?? 0,
    surgeryReadinessAlerts: surgeryReadyRes.count ?? 0,
    surgeryFinancialPaymentAttention,
    financialPathwayTasksAttention,
    financeApplicationsAttention,
    superReleaseApplicationsAttention,
    internationalTransferApplicationsAttention,
    financialClearanceAttention,
  });
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

async function loadQuickStats(
  tenantId: string,
  now: Date,
  stages: FiCrmPipelineStageRow[],
  operationalLocalDay: { localStartIso: string; localEndIso: string }
): Promise<TenantQuickStats> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();

  const weekStart = mondayStartUtc(now).toISOString();
  const thirtyAgo = new Date(now.getTime() - 30 * MS_DAY).toISOString();

  const { localStartIso, localEndIso } = operationalLocalDay;

  const wonIds = new Set(stages.filter((s) => s.is_won).map((s) => s.id));
  const lostIds = new Set(stages.filter((s) => s.is_lost).map((s) => s.id));
  const terminalStageIds = Array.from(wonIds).concat(Array.from(lostIds));

  const [newLeadsRes, newLeadsTodayRes, terminalHistRes, consultRes, noShowRes, staffBookingsRes] =
    await Promise.all([
      supabase
        .from("fi_crm_leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .gte("created_at", weekStart),
      supabase
        .from("fi_crm_leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tid)
        .gte("created_at", localStartIso)
        .lt("created_at", localEndIso),
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
        .gte("start_at", localStartIso)
        .lt("start_at", localEndIso),
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
  if (newLeadsTodayRes.error) throw new Error(newLeadsTodayRes.error.message);
  if (consultRes.error) throw new Error(consultRes.error.message);
  if (noShowRes.error) throw new Error(noShowRes.error.message);
  if (terminalHistRes.error) throw new Error(terminalHistRes.error.message);
  if (staffBookingsRes.error) throw new Error(staffBookingsRes.error.message);

  const staffRows = (staffBookingsRes.data ?? []) as { assigned_staff_id: string | null }[];
  const staffOnDutyToday = new Set(
    staffRows.map((r) => r.assigned_staff_id?.trim()).filter((x): x is string => Boolean(x))
  ).size;

  const hist = (terminalHistRes.data ?? []) as {
    lead_id: string;
    to_stage_id: string;
    changed_at: string;
  }[];
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
    newLeadsToday: newLeadsTodayRes.count ?? 0,
    conversionRateLast30d,
    conversionWonLast30d: won,
    conversionClosedLast30d: closed,
    openConsultations: consultRes.count ?? 0,
    todaysNoShows: noShowRes.count ?? 0,
    staffOnDutyToday,
  });
}

async function loadCrmPipelineLeadVolume(
  tenantId: string,
  pipelineStages: FiCrmPipelineStageRow[]
): Promise<CrmPipelineLeadVolumePayload> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const { data, error } = await supabase
    .from("fi_crm_leads")
    .select("current_stage_id, status")
    .eq("tenant_id", tid);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { current_stage_id: string | null; status: string | null }[];
  const stageIds = new Set(pipelineStages.map((s) => s.id));
  const aggregated = aggregateActiveLeadVolumeByPipelineStage(rows, stageIds);
  return crmPipelineLeadVolumeSchema.parse(aggregated);
}

const UPCOMING_REMINDER_ROW_CAP = 10;
const UPCOMING_REMINDER_HORIZON_DAYS = 7;

async function loadUpcomingReminders(
  tenantId: string,
  now: Date
): Promise<DashboardReminderItem[]> {
  const raw = await loadOperationalDashboardReminderJobs(tenantId, now, {
    horizonDays: UPCOMING_REMINDER_HORIZON_DAYS,
    limit: UPCOMING_REMINDER_ROW_CAP,
  });
  return raw.map((r: unknown) => dashboardReminderItemSchema.parse(r));
}

export type LoadReceptionBoardCardsOptions = {
  /** shell = patient labels only; skips staff/user/clinic/room enrichment for first paint */
  enrichment?: "shell" | "full";
};

function providerLabelFromBookingMetadata(meta: Record<string, unknown>): string {
  const candidates = [
    meta.provider_label,
    meta.clinician_label,
    meta.staff_name,
    meta.assignee_name,
  ];
  for (const c of candidates) {
    const s = c != null ? String(c).trim() : "";
    if (s) return s;
  }
  return "Unassigned";
}

export async function loadReceptionBoardCards(
  tenantId: string,
  localStartIso: string,
  localEndIso: string,
  options: LoadReceptionBoardCardsOptions = {}
): Promise<ReceptionBoardCard[]> {
  const enrichment = options.enrichment ?? "full";
  const tid = tenantId.trim();
  const raw = await loadBookingsForTenantRange(tid, localStartIso, localEndIso);
  const todayBookings = raw.filter((b) =>
    bookingStartFallsOnOperationalWindow(b.start_at, localStartIso, localEndIso)
  );
  if (todayBookings.length === 0) return [];

  const maps = await loadBookingDisplayContextMaps(tid, todayBookings);

  let staffOpts: Awaited<ReturnType<typeof loadClinicalStaffPickerOptions>> = [];
  let userOpts: Awaited<ReturnType<typeof loadCrmShellUserPickerOptions>> = [];
  const clinicNameById = new Map<string, string>();
  const roomNameById = new Map<string, string>();

  if (enrichment === "full") {
    const { loadClinicalStaffPickerCached, loadCrmShellUsersCached } = await import(
      "@/src/lib/performance/referenceDataCache.server"
    );
    const [staff, users] = await Promise.all([
      loadClinicalStaffPickerCached(tid),
      loadCrmShellUsersCached(tid),
    ]);
    staffOpts = staff;
    userOpts = users;

    const clinicIds = Array.from(
      new Set(todayBookings.map((b) => b.clinic_id?.trim()).filter((x): x is string => Boolean(x)))
    );
    const roomIds = Array.from(
      new Set(todayBookings.map((b) => b.room_id?.trim()).filter((x): x is string => Boolean(x)))
    );

    const supabase = supabaseAdmin();
    const [clinicRes, roomRes] = await Promise.all([
      clinicIds.length
        ? supabase
            .from("fi_clinics")
            .select("id, display_name")
            .eq("tenant_id", tid)
            .in("id", clinicIds)
        : Promise.resolve({ data: [], error: null }),
      roomIds.length
        ? supabase
            .from("fi_clinic_rooms")
            .select("id, display_name")
            .eq("tenant_id", tid)
            .in("id", roomIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (clinicRes.error) throw new Error(clinicRes.error.message);
    if (roomRes.error) throw new Error(roomRes.error.message);

    for (const row of clinicRes.data ?? []) {
      const r = row as { id: string; display_name: string | null };
      clinicNameById.set(String(r.id), String(r.display_name ?? "").trim() || String(r.id));
    }
    for (const row of roomRes.data ?? []) {
      const r = row as { id: string; display_name: string | null };
      roomNameById.set(String(r.id), String(r.display_name ?? "").trim() || String(r.id));
    }
  }

  const cards: ReceptionBoardCard[] = [];
  for (const b of todayBookings) {
    const meta =
      b.metadata && typeof b.metadata === "object" && !Array.isArray(b.metadata)
        ? (b.metadata as Record<string, unknown>)
        : {};
    const displayName = anchorLabelForBookingRow(b, maps);
    const assign =
      enrichment === "full"
        ? bookingAssignmentDisplay(staffOpts, userOpts, b)
        : { providerLabel: providerLabelFromBookingMetadata(meta), ownerLabel: null, summaryLine: "" };
    const clinicLabel =
      enrichment === "full" && b.clinic_id?.trim()
        ? (clinicNameById.get(b.clinic_id.trim()) ?? null)
        : null;
    const roomLabel =
      enrichment === "full" && b.room_id?.trim()
        ? (roomNameById.get(b.room_id.trim()) ?? null)
        : null;
    cards.push(
      receptionBoardCardSchema.parse({
        id: b.id,
        startAt: b.start_at,
        endAt: b.end_at,
        title: b.title,
        bookingType: b.booking_type,
        bookingStatus: b.booking_status,
        timezone: b.timezone,
        leadId: b.lead_id?.trim() ? b.lead_id.trim() : null,
        patientId: b.patient_id?.trim() ? b.patient_id.trim() : null,
        displayName,
        statusLabel: bookingStatusLabel(b.booking_status),
        typeLabel: bookingTypeLabel(b.booking_type),
        providerLabel: assign.providerLabel,
        clinicLabel,
        roomLabel,
        receptionColumn: receptionBoardColumnForBooking({
          booking_status: b.booking_status,
          metadata: meta,
        }),
        metadata: meta,
      })
    );
  }

  cards.sort((a, b) => a.startAt.localeCompare(b.startAt));
  return cards;
}

export type LoadTenantOperationalDashboardOptions = {
  staleLeadStageDays?: number;
  /** When true, loads same-day reception cards (extra reads); default false for home/analytics callers. */
  includeReceptionBoard?: boolean;
};

/**
 * Tenant-scoped operational snapshot for the FI Admin home dashboard (service role).
 */
export async function loadTenantOperationalDashboard(
  tenantId: string,
  options?: LoadTenantOperationalDashboardOptions
): Promise<TenantOperationalDashboard> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const staleDays = options?.staleLeadStageDays ?? DEFAULT_STALE_LEAD_STAGE_DAYS;
  const now = new Date();
  const supabase = supabaseAdmin();

  const authUserId = await resolveAuthUserId(null);
  const clinicAccess = await resolveDevelopmentClinicAccessForTenant(tid, authUserId);
  const viewer = await loadFiUserDashboard(tid, authUserId);
  const viewerFiUserId = clinicAccess.fiUserId ?? viewer?.id ?? null;
  const canQuickCallIn = clinicAccess.allowed;

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

  const [tenantRow, calendarSettings, pipelineStages] = await Promise.all([
    loadTenantConfigCached(tid),
    loadTenantCalendarSettingsCached(tid),
    loadPipelineStages(
      {
        tenantId: tid,
        organisationId: null,
        clinicId: null,
        pipelineKey: DEFAULT_CRM_PIPELINE_KEY,
      },
      supabase
    ),
  ]);
  const tenantName = String(tenantRow.name ?? "").trim() || tid;
  const operationalCalendarTimezone = calendarSettings.calendarTimezone;
  const operationalLocalDayFull = computeOperationalLocalDayUtcWindow(
    now,
    operationalCalendarTimezone
  );
  const operationalLocalDay = {
    localStartIso: operationalLocalDayFull.localStartIso,
    localEndIso: operationalLocalDayFull.localEndIso,
  };
  const operationalTodayYmd = operationalLocalDayFull.todayYmd;
  const crmPipelineStages = pipelineStages.map((s) =>
    crmPipelineStageSnapshotSchema.parse({
      id: s.id,
      label: s.label,
      sort_order: s.sort_order,
      is_entry: s.is_entry,
      is_won: s.is_won,
      is_lost: s.is_lost,
    })
  );

  const includeReceptionBoard = Boolean(options?.includeReceptionBoard);

  const [
    agenda,
    staleLeads,
    tasksDue,
    quickStats,
    upcomingReminders,
    clinicCounts,
    actionCentre,
    openTasksCount,
    medicationReorderReviewsPending,
    crmPipelineLeadVolume,
    paymentCommercialKpis,
    receptionBoardCards,
    revenueCollections,
  ] = await Promise.all([
    loadAgendaBookings(tid, now),
    loadStaleLeads(tid, staleDays, now, pipelineStages),
    loadTasksDue(tid, viewerFiUserId, now),
    loadQuickStats(tid, now, pipelineStages, operationalLocalDay),
    loadUpcomingReminders(tid, now),
    loadClinicTodayAndWeekCounts(tid, now, operationalCalendarTimezone, operationalLocalDay),
    loadActionCentreCounts(tid, now),
    loadOpenCrmTasksCount(tid, viewerFiUserId),
    loadMedicationReorderPendingReviewCount(tid),
    loadCrmPipelineLeadVolume(tid, pipelineStages),
    loadPaymentSummaryForOperations(
      tid,
      operationalTodayYmd,
      operationalLocalDay.localStartIso,
      operationalLocalDay.localEndIso
    ),
    includeReceptionBoard
      ? loadReceptionBoardCards(
          tid,
          operationalLocalDay.localStartIso,
          operationalLocalDay.localEndIso
        )
      : Promise.resolve([]),
    loadRevenueCollectionsDashboardKpis(tid, operationalTodayYmd),
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
      consultationsToday: clinicCounts.clinicToday.consultations,
      surgeriesThisWeek: clinicCounts.surgeriesThisWeek,
      leadsNeedingFollowUp: staleLeads.length,
      openTasks: openTasksCount,
      revenueAvailable: readFiPaymentsEnabled(),
    },
    clinicToday: clinicCounts.clinicToday,
    actionCentre,
    medicationReorderReviewsPending,
    operationalDay: {
      calendarTimezone: operationalCalendarTimezone,
      todayYmd: operationalTodayYmd,
      localStartIso: operationalLocalDay.localStartIso,
      localEndIso: operationalLocalDay.localEndIso,
    },
    crmPipelineStages,
    crmPipelineLeadVolume,
    paymentCommercialKpis: paymentCommercialKpisSchema.parse(paymentCommercialKpis),
    revenueCollections: revenueCollectionsSchema.parse(revenueCollections),
    receptionBoard: receptionBoardPayloadSchema.parse({ cards: receptionBoardCards }),
  });
}
