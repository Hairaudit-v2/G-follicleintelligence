import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { loadCaseAppointmentBookingsForShell } from "@/src/lib/cases/caseAppointmentShellLoader.server";
import { loadBookingsForOperatorView } from "@/src/lib/bookings/bookings";
import {
  buildFinancialClearanceFromPipelineStatus,
  aggregateFinancialClearanceDashboardMetrics,
  type FinancialClearanceDashboardMetrics,
  type FinancialClearanceResult,
} from "@/src/lib/financialOs/financialClearanceCore";
import {
  loadFinancialSurgeryPipelineStatusByBookings,
  loadCaseFinancialOsSurgeryPipelineSummary,
} from "@/src/lib/financialOs/financialSurgeryPipelineStatus.server";
import type { FinancialSurgeryPipelineStatus } from "@/src/lib/financialOs/financialSurgeryPipelineStatusCore";
import { loadCasePaymentReadiness } from "@/src/lib/revenueOs/revenueInvoiceLoaders.server";
import {
  computeSurgeryReadinessBoardWindow,
  isActiveSurgeryBookingStatus,
  isInstantInTenantInclusiveDayWindow,
} from "@/src/lib/surgery/surgeryReadinessBoardModel";

export type { FinancialClearanceResult, FinancialClearanceDashboardMetrics } from "@/src/lib/financialOs/financialClearanceCore";

const BOARD_LIMIT = 240;

type BookingClearanceContext = {
  id: string;
  case_id: string | null;
  patient_id: string | null;
  booking_status: string;
  financial_os_status?: string | null;
  start_at?: string | null;
};

function unavailableClearance(): FinancialClearanceResult {
  return buildFinancialClearanceFromPipelineStatus({
    todayYmd: "1970-01-01",
    calendarTimezone: "UTC",
    booking_status: null,
    surgeryDateYmd: null,
    dataLoadFailed: true,
    pipeline: {
      financialDataAvailable: false,
      financial_os_status: null,
      depositInvoiceState: "not_applicable",
      balanceInvoiceState: "not_applicable",
      amount_paid_cents: 0,
      balance_due_cents: 0,
      balance_overdue: false,
      balance_due_within_14_days: false,
      deposit_pending_for_confirmed_surgery: false,
      failed_payment_in_last_60_days: false,
      installment_overdue: false,
      paymentPathway: {
        hasActivePathway: false,
        pathway_id: null,
        pathway_type: null,
        pathway_status: null,
        provider: null,
        expected_settlement_date: null,
        pathway_attention_required: false,
        pathway_attention_reason: null,
      },
      pathwayTaskAttention: {
        task_attention_required: false,
        task_attention_reason: null,
        unresolved_open_task_count: 0,
      },
      financeApplicationAttention: {
        finance_attention_required: false,
        finance_attention_reason: null,
        finance_attention_labels: [],
      },
      superReleaseApplicationAttention: {
        super_release_attention_required: false,
        super_release_summary_label: null,
        super_release_attention_labels: [],
        days_in_status: 0,
        sla_breach: false,
      },
      internationalTransferApplicationAttention: {
        international_transfer_attention_required: false,
        international_transfer_summary_label: null,
        international_transfer_attention_labels: [],
        days_in_status: 0,
        sla_breach: false,
        settlement_variance_label: null,
        financial_clearance_state: "blocked",
      },
    },
  });
}

function resolveFromPipelineAndContext(args: {
  todayYmd: string;
  calendarTimezone: string;
  booking: BookingClearanceContext;
  pipeline: FinancialSurgeryPipelineStatus;
  dataLoadFailed?: boolean;
}): FinancialClearanceResult {
  return buildFinancialClearanceFromPipelineStatus({
    todayYmd: args.todayYmd,
    calendarTimezone: args.calendarTimezone,
    booking_status: args.booking.booking_status,
    surgeryDateYmd: args.booking.start_at ? String(args.booking.start_at).slice(0, 10) : null,
    dataLoadFailed: args.dataLoadFailed,
    pipeline: args.pipeline,
  });
}

export function buildFinancialClearanceMapFromPipeline(
  bookings: BookingClearanceContext[],
  pipelineMap: Map<string, FinancialSurgeryPipelineStatus>,
  ctx: { todayYmd: string; calendarTimezone: string }
): Map<string, FinancialClearanceResult> {
  const out = new Map<string, FinancialClearanceResult>();
  for (const b of bookings) {
    const pipeline = pipelineMap.get(b.id);
    if (!pipeline) {
      out.set(b.id, unavailableClearance());
      continue;
    }
    out.set(
      b.id,
      resolveFromPipelineAndContext({
        todayYmd: ctx.todayYmd,
        calendarTimezone: ctx.calendarTimezone,
        booking: b,
        pipeline,
        dataLoadFailed: !pipeline.financialDataAvailable,
      })
    );
  }
  return out;
}

export async function resolveFinancialClearanceForBooking(
  tenantId: string,
  input: {
    todayYmd: string;
    calendarTimezone: string;
    booking: BookingClearanceContext;
  }
): Promise<FinancialClearanceResult> {
  const map = await resolveFinancialClearanceForBookings(tenantId, {
    todayYmd: input.todayYmd,
    calendarTimezone: input.calendarTimezone,
    bookings: [input.booking],
  });
  return map.get(input.booking.id) ?? unavailableClearance();
}

export async function resolveFinancialClearanceForBookings(
  tenantId: string,
  input: {
    todayYmd: string;
    calendarTimezone: string;
    bookings: BookingClearanceContext[];
  }
): Promise<Map<string, FinancialClearanceResult>> {
  const out = new Map<string, FinancialClearanceResult>();
  for (const b of input.bookings) {
    out.set(b.id, unavailableClearance());
  }
  if (!input.bookings.length) return out;

  const pipelineMap = await loadFinancialSurgeryPipelineStatusByBookings(tenantId, input);
  for (const b of input.bookings) {
    const pipeline = pipelineMap.get(b.id);
    if (!pipeline) continue;
    out.set(
      b.id,
      resolveFromPipelineAndContext({
        todayYmd: input.todayYmd,
        calendarTimezone: input.calendarTimezone,
        booking: b,
        pipeline,
        dataLoadFailed: !pipeline.financialDataAvailable,
      })
    );
  }
  return out;
}

export async function resolveFinancialClearanceForCase(
  tenantId: string,
  input: {
    caseId: string;
    patientId: string | null;
    todayYmd?: string;
    calendarTimezone?: string;
  }
): Promise<FinancialClearanceResult> {
  const tid = tenantId.trim();
  let todayYmd = input.todayYmd?.trim();
  let calendarTimezone = input.calendarTimezone?.trim();
  if (!todayYmd || !calendarTimezone) {
    const settings = await loadTenantOperationalCalendarSettings(tid);
    calendarTimezone = calendarTimezone || settings.calendarTimezone;
    todayYmd = todayYmd || new Date().toISOString().slice(0, 10);
  }

  try {
    const [readiness, caseAppointmentBookings] = await Promise.all([
      loadCasePaymentReadiness(tid, input.caseId),
      loadCaseAppointmentBookingsForShell(tid, input.caseId, input.patientId),
    ]);
    const pipeline = await loadCaseFinancialOsSurgeryPipelineSummary(tid, {
      caseId: input.caseId,
      todayYmd,
      calendarTimezone,
      readiness,
      caseAppointmentBookings,
    });
    return buildFinancialClearanceFromPipelineStatus({
      todayYmd,
      calendarTimezone,
      booking_status: null,
      surgeryDateYmd: null,
      dataLoadFailed: !pipeline.financialDataAvailable,
      pipeline,
    });
  } catch {
    return unavailableClearance();
  }
}

async function loadUpcomingSurgeryBookingsForClearance(
  tenantId: string,
  args: { todayYmd: string; calendarTimezone: string; horizonDays: number; limit: number }
): Promise<BookingClearanceContext[]> {
  const window = computeSurgeryReadinessBoardWindow(new Date(`${args.todayYmd}T12:00:00.000Z`), args.calendarTimezone);
  const rawBookings = await loadBookingsForOperatorView({
    tenantId: tenantId.trim(),
    rangeStartIso: window.rangeStartIso,
    rangeEndIso: window.rangeEndIso,
    bookingType: "surgery",
    includeCancelled: false,
    limit: Math.min(args.limit, BOARD_LIMIT),
  });

  return rawBookings
    .filter(
      (b) =>
        b.booking_type.trim().toLowerCase() === "surgery" &&
        isActiveSurgeryBookingStatus(b.booking_status) &&
        isInstantInTenantInclusiveDayWindow(
          Date.parse(b.start_at),
          window.calendarTimezone,
          window.todayYmd,
          window.windowEndYmd
        )
    )
    .map((b) => ({
      id: b.id,
      case_id: b.case_id,
      patient_id: b.patient_id,
      booking_status: b.booking_status,
      financial_os_status: b.financial_os_status ?? null,
      start_at: b.start_at,
    }));
}

export async function loadFinancialClearanceAttentionCount(tenantId: string, now: Date = new Date()): Promise<number> {
  try {
    const { calendarTimezone } = await loadTenantOperationalCalendarSettings(tenantId.trim());
    const window = computeSurgeryReadinessBoardWindow(now, calendarTimezone);
    const bookings = await loadUpcomingSurgeryBookingsForClearance(tenantId, {
      todayYmd: window.todayYmd,
      calendarTimezone: window.calendarTimezone,
      horizonDays: 14,
      limit: BOARD_LIMIT,
    });
    if (!bookings.length) return 0;
    const map = await resolveFinancialClearanceForBookings(tenantId, {
      todayYmd: window.todayYmd,
      calendarTimezone: window.calendarTimezone,
      bookings,
    });
    let n = 0;
    for (const b of bookings) {
      const c = map.get(b.id);
      if (c?.requires_staff_attention || c?.clearance_state === "attention_required") n += 1;
    }
    return n;
  } catch {
    return 0;
  }
}

export async function loadFinancialClearanceDashboardMetrics(
  tenantId: string,
  now: Date = new Date()
): Promise<FinancialClearanceDashboardMetrics> {
  const { calendarTimezone } = await loadTenantOperationalCalendarSettings(tenantId.trim());
  const window = computeSurgeryReadinessBoardWindow(now, calendarTimezone);
  const bookings = await loadUpcomingSurgeryBookingsForClearance(tenantId, {
    todayYmd: window.todayYmd,
    calendarTimezone: window.calendarTimezone,
    horizonDays: 14,
    limit: BOARD_LIMIT,
  });
  if (!bookings.length) {
    return aggregateFinancialClearanceDashboardMetrics([]);
  }
  const map = await resolveFinancialClearanceForBookings(tenantId, {
    todayYmd: window.todayYmd,
    calendarTimezone: window.calendarTimezone,
    bookings,
  });
  const results = bookings.map((b) => map.get(b.id) ?? unavailableClearance());
  return aggregateFinancialClearanceDashboardMetrics(results);
}

export type FinancialClearanceSnapshotRow = {
  tenant_id: string;
  booking_id: string | null;
  case_id: string | null;
  patient_id: string | null;
  clearance_state: string;
  clearance_label: string | null;
  financially_safe_to_proceed: boolean;
  paid_in_full: boolean;
  requires_staff_attention: boolean;
  amount_paid_cents: number | null;
  balance_due_cents: number | null;
  blocking_factors: string[];
  warning_factors: string[];
  source_breakdown: Record<string, unknown>;
};

function snapshotFromClearance(args: {
  tenantId: string;
  booking: BookingClearanceContext;
  clearance: FinancialClearanceResult;
}): FinancialClearanceSnapshotRow {
  return {
    tenant_id: args.tenantId.trim(),
    booking_id: args.booking.id,
    case_id: args.booking.case_id?.trim() || null,
    patient_id: args.booking.patient_id?.trim() || null,
    clearance_state: args.clearance.clearance_state,
    clearance_label: args.clearance.clearance_label,
    financially_safe_to_proceed: args.clearance.financially_safe_to_proceed,
    paid_in_full: args.clearance.paid_in_full,
    requires_staff_attention: args.clearance.requires_staff_attention,
    amount_paid_cents: args.clearance.amount_paid_cents,
    balance_due_cents: args.clearance.balance_due_cents,
    blocking_factors: args.clearance.blocking_factors,
    warning_factors: args.clearance.warning_factors,
    source_breakdown: args.clearance.source_breakdown as Record<string, unknown>,
  };
}

export async function runFinancialClearanceSnapshotCron(args: {
  tenantId?: string | null;
  runDateYmd: string;
  horizonDays?: number;
  limit?: number;
  dryRun?: boolean;
}): Promise<{
  processed: number;
  inserted: number;
  dryRun: boolean;
  byState: Record<string, number>;
}> {
  const supabase = supabaseAdmin();
  const limit = Math.min(500, Math.max(1, args.limit ?? 200));
  const horizonDays = args.horizonDays ?? 14;

  let tenantIds: string[] = [];
  if (args.tenantId?.trim()) {
    tenantIds = [args.tenantId.trim()];
  } else {
    const { data, error } = await supabase.from("fi_tenants").select("id").limit(500);
    if (error) throw new Error(error.message);
    tenantIds = (data ?? []).map((r) => String((r as { id: string }).id));
  }

  let processed = 0;
  let inserted = 0;
  const byState: Record<string, number> = {};
  const now = new Date(`${args.runDateYmd}T12:00:00.000Z`);

  for (const tid of tenantIds) {
    const { calendarTimezone } = await loadTenantOperationalCalendarSettings(tid);
    const window = computeSurgeryReadinessBoardWindow(now, calendarTimezone);
    const bookings = await loadUpcomingSurgeryBookingsForClearance(tid, {
      todayYmd: window.todayYmd,
      calendarTimezone: window.calendarTimezone,
      horizonDays,
      limit,
    });
    if (!bookings.length) continue;

    const clearanceMap = await resolveFinancialClearanceForBookings(tid, {
      todayYmd: window.todayYmd,
      calendarTimezone: window.calendarTimezone,
      bookings,
    });

    const rows: FinancialClearanceSnapshotRow[] = [];
    for (const b of bookings) {
      const clearance = clearanceMap.get(b.id) ?? unavailableClearance();
      processed += 1;
      byState[clearance.clearance_state] = (byState[clearance.clearance_state] ?? 0) + 1;
      rows.push(snapshotFromClearance({ tenantId: tid, booking: b, clearance }));
    }

    if (!args.dryRun && rows.length) {
      const { error: insertError } = await supabase.from("fi_financial_clearance_snapshots").insert(rows);
      if (insertError) throw new Error(insertError.message);
      inserted += rows.length;
    }
  }

  return { processed, inserted: args.dryRun ? 0 : inserted, dryRun: Boolean(args.dryRun), byState };
}

export async function insertFinancialClearanceSnapshots(
  supabase: SupabaseClient,
  rows: FinancialClearanceSnapshotRow[]
): Promise<void> {
  if (!rows.length) return;
  const { error } = await supabase.from("fi_financial_clearance_snapshots").insert(rows);
  if (error) throw new Error(error.message);
}
