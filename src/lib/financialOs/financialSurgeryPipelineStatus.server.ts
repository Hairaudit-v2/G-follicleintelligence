import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { loadBookingsForOperatorView } from "@/src/lib/bookings/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { mapInvoiceRow, mapPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import type { CasePaymentReadiness } from "@/src/lib/revenueOs/revenueInvoiceLoaders.server";
import type { FiInvoiceRow, FiPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import {
  computeSurgeryReadinessBoardWindow,
  isActiveSurgeryBookingStatus,
  isInstantInTenantInclusiveDayWindow,
} from "@/src/lib/surgery/surgeryReadinessBoardModel";
import {
  buildFinancialSurgeryPipelineStatus,
  type FinancialSurgeryPipelineStatus,
} from "@/src/lib/financialOs/financialSurgeryPipelineStatusCore";
import type { FiPaymentPathwayRow } from "@/src/lib/financialOs/financialPaymentPathwayCore";
import { resolveActivePaymentPathway } from "@/src/lib/financialOs/financialPaymentPathwayCore";
import { loadUnresolvedPathwayTasksForBookings } from "@/src/lib/financialOs/financialPaymentPathwayInbox.server";
import {
  loadUnresolvedFinanceApplicationsForBookings,
  loadUnresolvedFinanceApplicationsForPathways,
  type FinanceApplicationRecord,
} from "@/src/lib/financialOs/financialFinanceApplications.server";
import type { FiFinanceApplicationRow } from "@/src/lib/financialOs/financialFinanceApplicationsCore";
import {
  loadUnresolvedSuperReleaseApplicationsForBookings,
  loadUnresolvedSuperReleaseApplicationsForPathways,
  type SuperReleaseApplicationRecord,
} from "@/src/lib/financialOs/financialSuperRelease.server";
import type { FiSuperReleaseApplicationRow } from "@/src/lib/financialOs/financialSuperReleaseCore";
import {
  loadUnresolvedInternationalTransferApplicationsForBookings,
  loadUnresolvedInternationalTransferApplicationsForPathways,
  type InternationalTransferApplicationRecord,
} from "@/src/lib/financialOs/financialInternationalTransfer.server";
import type { FiInternationalTransferApplicationRow } from "@/src/lib/financialOs/financialInternationalTransferCore";

export type { FinancialSurgeryPipelineStatus } from "@/src/lib/financialOs/financialSurgeryPipelineStatusCore";

const BOARD_LIMIT = 240;

function uniqueStrings(ids: (string | null | undefined)[]): string[] {
  const s = new Set<string>();
  for (const id of ids) {
    if (id?.trim()) s.add(id.trim());
  }
  return Array.from(s);
}

function emptyUnavailable(): FinancialSurgeryPipelineStatus {
  return buildFinancialSurgeryPipelineStatus({
    todayYmd: "1970-01-01",
    calendarTimezone: "UTC",
    booking_status: null,
    financial_os_status: null,
    case_id: null,
    patient_id: null,
    invoices: [],
    paymentRequests: [],
    payments: [],
    installmentPlans: [],
  });
}

async function loadInstallmentRowsForInvoices(
  supabase: SupabaseClient,
  tenantId: string,
  invoiceIds: string[]
): Promise<
  Array<{
    invoice_id: string;
    status: string;
    next_payment_date: string | null;
    remaining_balance: number;
  }>
> {
  const ids = uniqueStrings(invoiceIds);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("fi_installment_plans")
    .select("invoice_id, status, next_payment_date, remaining_balance")
    .eq("tenant_id", tenantId.trim())
    .in("invoice_id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []).map((raw) => {
    const r = raw as {
      invoice_id: string;
      status: string;
      next_payment_date: string | null;
      remaining_balance: number;
    };
    return {
      invoice_id: String(r.invoice_id),
      status: String(r.status ?? ""),
      next_payment_date:
        r.next_payment_date != null ? String(r.next_payment_date).slice(0, 10) : null,
      remaining_balance: Number(r.remaining_balance ?? 0),
    };
  });
}

async function loadPaymentPathwayRowsForContext(
  supabase: SupabaseClient,
  tenantId: string,
  args: { caseIds: string[]; invoiceIds: string[]; bookingIds: string[] }
): Promise<{
  byCaseId: Map<string, FiPaymentPathwayRow[]>;
  byInvoiceId: Map<string, FiPaymentPathwayRow[]>;
  byBookingId: Map<string, FiPaymentPathwayRow[]>;
}> {
  const byCaseId = new Map<string, FiPaymentPathwayRow[]>();
  const byInvoiceId = new Map<string, FiPaymentPathwayRow[]>();
  const byBookingId = new Map<string, FiPaymentPathwayRow[]>();

  const caseIds = uniqueStrings(args.caseIds);
  const invoiceIds = uniqueStrings(args.invoiceIds);
  const bookingIds = uniqueStrings(args.bookingIds);
  if (!caseIds.length && !invoiceIds.length && !bookingIds.length) {
    return { byCaseId, byInvoiceId, byBookingId };
  }

  const orClauses: string[] = [];
  if (caseIds.length) orClauses.push(`case_id.in.(${caseIds.join(",")})`);
  if (invoiceIds.length) orClauses.push(`invoice_id.in.(${invoiceIds.join(",")})`);
  if (bookingIds.length) orClauses.push(`booking_id.in.(${bookingIds.join(",")})`);

  const { data, error } = await supabase
    .from("fi_payment_pathways")
    .select(
      "id, pathway_type, status, provider, provider_reference, expected_settlement_date, actual_settlement_date, expected_amount_cents, settled_amount_cents, currency_code, case_id, invoice_id, booking_id, created_at, updated_at"
    )
    .eq("tenant_id", tenantId.trim())
    .or(orClauses.join(","))
    .neq("status", "cancelled");
  if (error) throw new Error(error.message);

  for (const raw of (data ?? []) as Array<Record<string, unknown>>) {
    const row: FiPaymentPathwayRow = {
      id: String(raw.id),
      pathway_type: raw.pathway_type as FiPaymentPathwayRow["pathway_type"],
      status: raw.status as FiPaymentPathwayRow["status"],
      provider: raw.provider ? String(raw.provider) : null,
      provider_reference: raw.provider_reference ? String(raw.provider_reference) : null,
      expected_settlement_date: raw.expected_settlement_date
        ? String(raw.expected_settlement_date).slice(0, 10)
        : null,
      actual_settlement_date: raw.actual_settlement_date
        ? String(raw.actual_settlement_date).slice(0, 10)
        : null,
      expected_amount_cents:
        raw.expected_amount_cents != null ? Number(raw.expected_amount_cents) : null,
      settled_amount_cents:
        raw.settled_amount_cents != null ? Number(raw.settled_amount_cents) : null,
      currency_code: raw.currency_code ? String(raw.currency_code) : "AUD",
      created_at: String(raw.created_at ?? ""),
      updated_at: String(raw.updated_at ?? ""),
    };
    const cid = raw.case_id ? String(raw.case_id) : null;
    const iid = raw.invoice_id ? String(raw.invoice_id) : null;
    const bid = raw.booking_id ? String(raw.booking_id) : null;
    if (cid) byCaseId.set(cid, [...(byCaseId.get(cid) ?? []), row]);
    if (iid) byInvoiceId.set(iid, [...(byInvoiceId.get(iid) ?? []), row]);
    if (bid) byBookingId.set(bid, [...(byBookingId.get(bid) ?? []), row]);
  }

  return { byCaseId, byInvoiceId, byBookingId };
}

function toFinanceApplicationRow(app: FinanceApplicationRecord): FiFinanceApplicationRow {
  return {
    id: app.id,
    application_status: app.application_status,
    submitted_at: app.submitted_at,
    approved_at: app.approved_at,
    settled_at: app.settled_at,
    expected_settlement_date: app.expected_settlement_date,
    created_at: app.created_at,
    updated_at: app.updated_at,
    finance_provider_id: app.finance_provider_id,
    payment_pathway_id: app.payment_pathway_id,
    booking_id: app.booking_id,
  };
}

function toSuperReleaseApplicationRow(
  app: SuperReleaseApplicationRecord
): FiSuperReleaseApplicationRow {
  return {
    id: app.id,
    application_status: app.application_status,
    submitted_at: app.submitted_at,
    approved_at: app.approved_at,
    funds_released_at: app.funds_released_at,
    expected_release_date: app.expected_release_date,
    created_at: app.created_at,
    updated_at: app.updated_at,
    payment_pathway_id: app.payment_pathway_id,
    booking_id: app.booking_id,
    provider_name: app.provider_name,
  };
}

function toInternationalTransferApplicationRow(
  app: InternationalTransferApplicationRecord
): FiInternationalTransferApplicationRow {
  return {
    id: app.id,
    transfer_status: app.transfer_status,
    transfer_method: app.transfer_method,
    source_country_code: app.source_country_code,
    source_currency_code: app.source_currency_code,
    settlement_currency_code: app.settlement_currency_code,
    expected_amount_cents: app.expected_amount_cents,
    expected_settlement_amount_cents: app.expected_settlement_amount_cents,
    received_amount_cents: app.received_amount_cents,
    expected_exchange_rate: app.expected_exchange_rate,
    actual_exchange_rate: app.actual_exchange_rate,
    fx_fee_cents: app.fx_fee_cents,
    settlement_variance_cents: app.settlement_variance_cents,
    expected_settlement_date: app.expected_settlement_date,
    actual_settlement_date: app.actual_settlement_date,
    payment_reference: app.payment_reference,
    created_at: app.created_at,
    updated_at: app.updated_at,
    payment_pathway_id: app.payment_pathway_id,
    booking_id: app.booking_id,
  };
}

function pickFinanceApplicationForContext(args: {
  bookingId: string;
  activePathwayId: string | null;
  byBooking: Map<string, FinanceApplicationRecord[]>;
  byPathway: Map<string, FinanceApplicationRecord>;
}): FiFinanceApplicationRow | null {
  const bookingApps = args.byBooking.get(args.bookingId) ?? [];
  if (bookingApps.length) return toFinanceApplicationRow(bookingApps[0]!);
  if (args.activePathwayId) {
    const pathwayApp = args.byPathway.get(args.activePathwayId);
    if (pathwayApp) return toFinanceApplicationRow(pathwayApp);
  }
  return null;
}

function pickSuperReleaseApplicationForContext(args: {
  bookingId: string;
  activePathwayId: string | null;
  byBooking: Map<string, SuperReleaseApplicationRecord[]>;
  byPathway: Map<string, SuperReleaseApplicationRecord>;
}): FiSuperReleaseApplicationRow | null {
  const bookingApps = args.byBooking.get(args.bookingId) ?? [];
  if (bookingApps.length) return toSuperReleaseApplicationRow(bookingApps[0]!);
  if (args.activePathwayId) {
    const pathwayApp = args.byPathway.get(args.activePathwayId);
    if (pathwayApp) return toSuperReleaseApplicationRow(pathwayApp);
  }
  return null;
}

function pickInternationalTransferApplicationForContext(args: {
  bookingId: string;
  activePathwayId: string | null;
  byBooking: Map<string, InternationalTransferApplicationRecord[]>;
  byPathway: Map<string, InternationalTransferApplicationRecord>;
}): FiInternationalTransferApplicationRow | null {
  const bookingApps = args.byBooking.get(args.bookingId) ?? [];
  if (bookingApps.length) return toInternationalTransferApplicationRow(bookingApps[0]!);
  if (args.activePathwayId) {
    const pathwayApp = args.byPathway.get(args.activePathwayId);
    if (pathwayApp) return toInternationalTransferApplicationRow(pathwayApp);
  }
  return null;
}

async function loadFailedPaymentsForInvoices(
  supabase: SupabaseClient,
  tenantId: string,
  invoiceIds: string[],
  sinceIso: string
): Promise<Array<{ invoice_id: string; status: string; created_at: string }>> {
  const ids = uniqueStrings(invoiceIds);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("fi_payments")
    .select("invoice_id, status, created_at")
    .eq("tenant_id", tenantId.trim())
    .eq("status", "failed")
    .gte("created_at", sinceIso)
    .in("invoice_id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []).map((raw) => {
    const r = raw as { invoice_id: string; status: string; created_at: string };
    return {
      invoice_id: String(r.invoice_id),
      status: String(r.status),
      created_at: String(r.created_at),
    };
  });
}

/**
 * Batch-loads FinancialOS + revenue rows for surgery bookings and returns per-booking pipeline status.
 * On any failure, returns “unavailable” for every booking id (does not throw to callers).
 */
export async function loadFinancialSurgeryPipelineStatusByBookings(
  tenantId: string,
  input: {
    todayYmd: string;
    calendarTimezone: string;
    bookings: Array<{
      id: string;
      case_id: string | null;
      patient_id: string | null;
      booking_status: string;
      financial_os_status?: string | null;
      start_at?: string | null;
    }>;
  }
): Promise<Map<string, FinancialSurgeryPipelineStatus>> {
  const out = new Map<string, FinancialSurgeryPipelineStatus>();
  const tid = tenantId.trim();
  const { todayYmd, calendarTimezone, bookings } = input;
  for (const b of bookings) {
    out.set(b.id, emptyUnavailable());
  }
  if (!bookings.length) return out;

  try {
    const supabase = supabaseAdmin();
    const caseIds = uniqueStrings(bookings.map((b) => b.case_id));
    const patientIds = uniqueStrings(bookings.map((b) => b.patient_id));

    const invoiceById = new Map<string, FiInvoiceRow>();
    if (caseIds.length) {
      const { data, error } = await supabase
        .from("fi_invoices")
        .select("*")
        .eq("tenant_id", tid)
        .in("case_id", caseIds)
        .in("invoice_kind", ["surgery_deposit", "surgery_balance"]);
      if (error) throw new Error(error.message);
      for (const raw of data ?? []) {
        const inv = mapInvoiceRow(raw as Record<string, unknown>);
        invoiceById.set(inv.id, inv);
      }
    }
    if (patientIds.length) {
      const { data, error } = await supabase
        .from("fi_invoices")
        .select("*")
        .eq("tenant_id", tid)
        .in("patient_id", patientIds)
        .is("case_id", null)
        .in("invoice_kind", ["surgery_deposit", "surgery_balance"]);
      if (error) throw new Error(error.message);
      for (const raw of data ?? []) {
        const inv = mapInvoiceRow(raw as Record<string, unknown>);
        invoiceById.set(inv.id, inv);
      }
    }
    const allInvoices = Array.from(invoiceById.values());
    const invoiceIds = allInvoices.map((i) => i.id);

    let paymentRequests: FiPaymentRequestRow[] = [];
    if (invoiceIds.length) {
      const { data: prs, error: pre } = await supabase
        .from("fi_payment_requests")
        .select("*")
        .eq("tenant_id", tid)
        .in("invoice_id", invoiceIds)
        .order("created_at", { ascending: false })
        .limit(800);
      if (pre) throw new Error(pre.message);
      paymentRequests = (prs ?? []).map((x) => mapPaymentRequestRow(x as Record<string, unknown>));
    }

    const failedSince = new Date();
    failedSince.setUTCDate(failedSince.getUTCDate() - 60);
    const [
      installmentPlans,
      failedPayments,
      pathwaysByContext,
      tasksByBooking,
      financeAppsByBooking,
      superReleaseAppsByBooking,
      internationalTransferAppsByBooking,
    ] = await Promise.all([
      loadInstallmentRowsForInvoices(supabase, tid, invoiceIds),
      loadFailedPaymentsForInvoices(supabase, tid, invoiceIds, failedSince.toISOString()),
      loadPaymentPathwayRowsForContext(supabase, tid, {
        caseIds,
        invoiceIds,
        bookingIds: bookings.map((b) => b.id),
      }),
      loadUnresolvedPathwayTasksForBookings(
        tid,
        bookings.map((b) => b.id)
      ),
      loadUnresolvedFinanceApplicationsForBookings(
        tid,
        bookings.map((b) => b.id)
      ),
      loadUnresolvedSuperReleaseApplicationsForBookings(
        tid,
        bookings.map((b) => b.id)
      ),
      loadUnresolvedInternationalTransferApplicationsForBookings(
        tid,
        bookings.map((b) => b.id)
      ),
    ]);

    const pathwayIdSet = new Set<string>();
    for (const rows of [
      ...pathwaysByContext.byCaseId.values(),
      ...pathwaysByContext.byBookingId.values(),
      ...pathwaysByContext.byInvoiceId.values(),
    ]) {
      for (const row of rows) pathwayIdSet.add(row.id);
    }
    const financeAppsByPathway = await loadUnresolvedFinanceApplicationsForPathways(
      tid,
      Array.from(pathwayIdSet)
    );
    const superReleaseAppsByPathway = await loadUnresolvedSuperReleaseApplicationsForPathways(
      tid,
      Array.from(pathwayIdSet)
    );
    const internationalTransferAppsByPathway =
      await loadUnresolvedInternationalTransferApplicationsForPathways(
        tid,
        Array.from(pathwayIdSet)
      );

    for (const b of bookings) {
      const cid = b.case_id?.trim() || null;
      const ctxInvoiceIds = allInvoices
        .filter((i) =>
          cid
            ? i.case_id?.trim() === cid
            : i.patient_id?.trim() === b.patient_id?.trim() && !i.case_id
        )
        .map((i) => i.id);
      const pathwayRows = [
        ...(cid ? (pathwaysByContext.byCaseId.get(cid) ?? []) : []),
        ...(pathwaysByContext.byBookingId.get(b.id) ?? []),
        ...ctxInvoiceIds.flatMap((iid) => pathwaysByContext.byInvoiceId.get(iid) ?? []),
      ];
      const dedupedPathwayRows = Array.from(new Map(pathwayRows.map((r) => [r.id, r])).values());
      const activePathway = resolveActivePaymentPathway(dedupedPathwayRows);
      const financeApplication = pickFinanceApplicationForContext({
        bookingId: b.id,
        activePathwayId: activePathway?.id ?? null,
        byBooking: financeAppsByBooking,
        byPathway: financeAppsByPathway,
      });
      const superReleaseApplication = pickSuperReleaseApplicationForContext({
        bookingId: b.id,
        activePathwayId: activePathway?.id ?? null,
        byBooking: superReleaseAppsByBooking,
        byPathway: superReleaseAppsByPathway,
      });
      const internationalTransferApplication = pickInternationalTransferApplicationForContext({
        bookingId: b.id,
        activePathwayId: activePathway?.id ?? null,
        byBooking: internationalTransferAppsByBooking,
        byPathway: internationalTransferAppsByPathway,
      });

      const st = buildFinancialSurgeryPipelineStatus({
        todayYmd,
        calendarTimezone,
        booking_status: b.booking_status,
        financial_os_status: b.financial_os_status ?? null,
        case_id: cid,
        patient_id: b.patient_id?.trim() || null,
        invoices: allInvoices,
        paymentRequests,
        payments: failedPayments,
        installmentPlans,
        paymentPathways: dedupedPathwayRows,
        pathwayTasks: tasksByBooking.get(b.id) ?? [],
        financeApplication,
        superReleaseApplication,
        internationalTransferApplication,
        surgeryDateYmd: b.start_at ? String(b.start_at).slice(0, 10) : null,
      });
      out.set(b.id, st);
    }
  } catch {
    for (const b of bookings) {
      out.set(b.id, emptyUnavailable());
    }
  }

  return out;
}

/**
 * Case detail: combines existing case invoice/readiness payload with installment + failed payment reads.
 */
export async function loadCaseFinancialOsSurgeryPipelineSummary(
  tenantId: string,
  input: {
    todayYmd: string;
    calendarTimezone: string;
    caseId: string;
    readiness: CasePaymentReadiness;
    caseAppointmentBookings: FiBookingRow[];
  }
): Promise<FinancialSurgeryPipelineStatus> {
  const tid = tenantId.trim();
  const { todayYmd, calendarTimezone, caseId, readiness, caseAppointmentBookings } = input;
  const cid = caseId.trim();

  const surgeryBookings = caseAppointmentBookings.filter(
    (b) =>
      b.booking_type.trim().toLowerCase() === "surgery" &&
      b.booking_status.trim().toLowerCase() !== "cancelled"
  );
  surgeryBookings.sort((a, b) => a.start_at.localeCompare(b.start_at));
  const primary = surgeryBookings[0] ?? null;

  try {
    const supabase = supabaseAdmin();
    const invoiceIds = readiness.invoices.map((i) => i.id);
    const failedSince = new Date();
    failedSince.setUTCDate(failedSince.getUTCDate() - 60);
    const [
      installmentPlans,
      failedPayments,
      pathwaysByContext,
      tasksByBooking,
      financeAppsByBooking,
      superReleaseAppsByBooking,
      internationalTransferAppsByBooking,
    ] = await Promise.all([
      loadInstallmentRowsForInvoices(supabase, tid, invoiceIds),
      loadFailedPaymentsForInvoices(supabase, tid, invoiceIds, failedSince.toISOString()),
      loadPaymentPathwayRowsForContext(supabase, tid, {
        caseIds: [cid],
        invoiceIds,
        bookingIds: surgeryBookings.map((b) => b.id),
      }),
      loadUnresolvedPathwayTasksForBookings(
        tid,
        surgeryBookings.map((b) => b.id)
      ),
      loadUnresolvedFinanceApplicationsForBookings(
        tid,
        surgeryBookings.map((b) => b.id)
      ),
      loadUnresolvedSuperReleaseApplicationsForBookings(
        tid,
        surgeryBookings.map((b) => b.id)
      ),
      loadUnresolvedInternationalTransferApplicationsForBookings(
        tid,
        surgeryBookings.map((b) => b.id)
      ),
    ]);

    const pathwayRows = [
      ...(pathwaysByContext.byCaseId.get(cid) ?? []),
      ...invoiceIds.flatMap((iid) => pathwaysByContext.byInvoiceId.get(iid) ?? []),
      ...surgeryBookings.flatMap((b) => pathwaysByContext.byBookingId.get(b.id) ?? []),
    ];
    const dedupedPathwayRows = Array.from(new Map(pathwayRows.map((r) => [r.id, r])).values());
    const financeAppsByPathway = await loadUnresolvedFinanceApplicationsForPathways(
      tid,
      dedupedPathwayRows.map((r) => r.id)
    );
    const superReleaseAppsByPathway = await loadUnresolvedSuperReleaseApplicationsForPathways(
      tid,
      dedupedPathwayRows.map((r) => r.id)
    );
    const internationalTransferAppsByPathway =
      await loadUnresolvedInternationalTransferApplicationsForPathways(
        tid,
        dedupedPathwayRows.map((r) => r.id)
      );
    const activePathway = resolveActivePaymentPathway(dedupedPathwayRows);
    const financeApplication = primary
      ? pickFinanceApplicationForContext({
          bookingId: primary.id,
          activePathwayId: activePathway?.id ?? null,
          byBooking: financeAppsByBooking,
          byPathway: financeAppsByPathway,
        })
      : activePathway && financeAppsByPathway.get(activePathway.id)
        ? toFinanceApplicationRow(financeAppsByPathway.get(activePathway.id)!)
        : null;
    const superReleaseApplication = primary
      ? pickSuperReleaseApplicationForContext({
          bookingId: primary.id,
          activePathwayId: activePathway?.id ?? null,
          byBooking: superReleaseAppsByBooking,
          byPathway: superReleaseAppsByPathway,
        })
      : activePathway && superReleaseAppsByPathway.get(activePathway.id)
        ? toSuperReleaseApplicationRow(superReleaseAppsByPathway.get(activePathway.id)!)
        : null;
    const internationalTransferApplication = primary
      ? pickInternationalTransferApplicationForContext({
          bookingId: primary.id,
          activePathwayId: activePathway?.id ?? null,
          byBooking: internationalTransferAppsByBooking,
          byPathway: internationalTransferAppsByPathway,
        })
      : activePathway && internationalTransferAppsByPathway.get(activePathway.id)
        ? toInternationalTransferApplicationRow(
            internationalTransferAppsByPathway.get(activePathway.id)!
          )
        : null;

    return buildFinancialSurgeryPipelineStatus({
      todayYmd,
      calendarTimezone,
      booking_status: primary?.booking_status ?? null,
      financial_os_status: primary?.financial_os_status ?? null,
      case_id: cid,
      patient_id: primary?.patient_id?.trim() || null,
      invoices: readiness.invoices,
      paymentRequests: readiness.paymentRequests,
      payments: failedPayments,
      installmentPlans,
      paymentPathways: dedupedPathwayRows,
      pathwayTasks: primary ? (tasksByBooking.get(primary.id) ?? []) : [],
      financeApplication,
      superReleaseApplication,
      internationalTransferApplication,
      surgeryDateYmd: primary?.start_at ? String(primary.start_at).slice(0, 10) : null,
    });
  } catch {
    return emptyUnavailable();
  }
}

/**
 * Counts active surgery bookings in the Surgery readiness 14-day window that require payment attention (FinancialOS + revenue).
 */
export async function loadSurgeryFinancialPaymentAttentionCount(
  tenantId: string,
  now: Date = new Date()
): Promise<number> {
  const tid = tenantId.trim();
  try {
    const { calendarTimezone } = await loadTenantOperationalCalendarSettings(tid);
    const window = computeSurgeryReadinessBoardWindow(now, calendarTimezone);
    const rawBookings = await loadBookingsForOperatorView({
      tenantId: tid,
      rangeStartIso: window.rangeStartIso,
      rangeEndIso: window.rangeEndIso,
      bookingType: "surgery",
      includeCancelled: false,
      limit: BOARD_LIMIT,
    });
    const surgeryBookings = rawBookings.filter(
      (b) =>
        b.booking_type.trim().toLowerCase() === "surgery" &&
        isActiveSurgeryBookingStatus(b.booking_status) &&
        isInstantInTenantInclusiveDayWindow(
          Date.parse(b.start_at),
          window.calendarTimezone,
          window.todayYmd,
          window.windowEndYmd
        )
    );
    if (!surgeryBookings.length) return 0;
    const map = await loadFinancialSurgeryPipelineStatusByBookings(tid, {
      todayYmd: window.todayYmd,
      calendarTimezone: window.calendarTimezone,
      bookings: surgeryBookings.map((b) => ({
        id: b.id,
        case_id: b.case_id,
        patient_id: b.patient_id,
        booking_status: b.booking_status,
        financial_os_status: b.financial_os_status ?? null,
      })),
    });
    let n = 0;
    for (const b of surgeryBookings) {
      if (map.get(b.id)?.payment_attention_required) n += 1;
    }
    return n;
  } catch {
    return 0;
  }
}
