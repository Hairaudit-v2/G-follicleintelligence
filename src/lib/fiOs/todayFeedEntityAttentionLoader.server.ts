import "server-only";

import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import { loadBookingsForOperatorView } from "@/src/lib/bookings/bookings";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";
import {
  resolveFinancialClearanceForBookings,
} from "@/src/lib/financialOs/financialClearance.server";
import { loadFinancialSurgeryPipelineStatusByBookings } from "@/src/lib/financialOs/financialSurgeryPipelineStatus.server";
import { mapPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import {
  computeEffectivePaymentStatus,
  type PaymentRecordRow,
} from "@/src/lib/payments/paymentRecordModel";
import { loadPatientLabelsForBookings } from "@/src/lib/surgery/surgeryReadinessBoardLoader.server";
import {
  computeSurgeryReadinessBoardWindow,
  isActiveSurgeryBookingStatus,
  isInstantInTenantInclusiveDayWindow,
} from "@/src/lib/surgery/surgeryReadinessBoardModel";
import type { TodayEntityAttentionSignal } from "@/src/lib/fiOs/todayFeedEntityAttention";
import {
  consultationEntityHref,
  pathologyResultEntityHref,
  paymentEntityHref,
  resolveFinancialAttentionHref,
  staffEntityHref,
  surgeryCaseEntityHref,
} from "@/src/lib/fiOs/todayFeedEntityLinks";

const ENTITY_LIMIT_PER_CATEGORY = 12;
const ENTITY_SIGNAL_LIMIT = 48;

export const todayEntityAttentionSignalSchema = z.object({
  id: z.string(),
  category: z.enum(["financial", "surgery", "pathology", "consultation", "staff"]),
  aggregateKey: z.string(),
  personLabel: z.string(),
  actionLabel: z.string(),
  detailLine: z.string().optional(),
  actionHint: z.string().optional(),
  href: z.string(),
  severity: z.enum(["critical", "warning", "normal"]),
  bucket: z.enum(["right_now", "up_next", "coming_up"]),
  priorityScore: z.number(),
  groupKey: z.string().optional(),
});

export type TodayEntityAttentionPayload = {
  signals: TodayEntityAttentionSignal[];
};

function firstName(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "Patient";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

async function loadPatientLabelsById(
  tenantId: string,
  patientIds: string[]
): Promise<Map<string, string>> {
  const ids = [...new Set(patientIds.filter(Boolean))];
  const out = new Map<string, string>();
  if (!ids.length) return out;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, metadata")
    .eq("tenant_id", tenantId)
    .in("id", ids);
  if (error) throw new Error(error.message);

  for (const raw of data ?? []) {
    const id = String((raw as { id: string }).id);
    const meta = (raw as { metadata: unknown }).metadata;
    const display =
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? displayFromPersonMetadata(meta as Record<string, unknown>)
        : null;
    out.set(id, display?.name?.trim() || `Patient ${id.slice(0, 8)}…`);
  }
  return out;
}

async function loadConsultationSubjectLabels(
  tenantId: string,
  rows: Array<{ patient_id: string | null; lead_id: string | null; person_id: string | null }>
): Promise<Map<string, string>> {
  const patientIds = rows.map((r) => r.patient_id).filter((x): x is string => Boolean(x?.trim()));
  const leadIds = rows.map((r) => r.lead_id).filter((x): x is string => Boolean(x?.trim()));
  const personIds = rows.map((r) => r.person_id).filter((x): x is string => Boolean(x?.trim()));

  const labels = new Map<string, string>();
  const patientLabels = await loadPatientLabelsById(tenantId, patientIds);
  for (const [id, name] of patientLabels) labels.set(`patient:${id}`, name);

  const supabase = supabaseAdmin();
  if (leadIds.length) {
    const { data, error } = await supabase
      .from("fi_crm_leads")
      .select("id, summary, person_id")
      .eq("tenant_id", tenantId)
      .in("id", leadIds);
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const id = String((raw as { id: string }).id);
      const summary = String((raw as { summary: string | null }).summary ?? "").trim();
      labels.set(`lead:${id}`, summary || `Lead ${id.slice(0, 8)}…`);
    }
  }

  if (personIds.length) {
    const { data, error } = await supabase
      .from("fi_persons")
      .select("id, metadata")
      .eq("tenant_id", tenantId)
      .in("id", personIds);
    if (error) throw new Error(error.message);
    for (const raw of data ?? []) {
      const id = String((raw as { id: string }).id);
      const meta = (raw as { metadata: unknown }).metadata;
      const display =
        meta && typeof meta === "object" && !Array.isArray(meta)
          ? displayFromPersonMetadata(meta as Record<string, unknown>)
          : null;
      labels.set(`person:${id}`, display?.name?.trim() || `Person ${id.slice(0, 8)}…`);
    }
  }

  return labels;
}

function consultationPersonLabel(
  row: { patient_id: string | null; lead_id: string | null; person_id: string | null },
  labels: Map<string, string>
): string {
  if (row.patient_id?.trim()) return labels.get(`patient:${row.patient_id.trim()}`) ?? "Patient";
  if (row.lead_id?.trim()) return labels.get(`lead:${row.lead_id.trim()}`) ?? "Lead";
  if (row.person_id?.trim()) return labels.get(`person:${row.person_id.trim()}`) ?? "Person";
  return "Consultation";
}

async function loadFinancialEntitySignals(
  tenantId: string,
  base: string,
  now: Date
): Promise<TodayEntityAttentionSignal[]> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const out: TodayEntityAttentionSignal[] = [];

  const { calendarTimezone } = await loadTenantOperationalCalendarSettings(tid);
  const window = computeSurgeryReadinessBoardWindow(now, calendarTimezone);
  const todayYmd = window.todayYmd;

  const rawBookings = await loadBookingsForOperatorView({
    tenantId: tid,
    rangeStartIso: window.rangeStartIso,
    rangeEndIso: window.rangeEndIso,
    bookingType: "surgery",
    includeCancelled: false,
    limit: 120,
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

  const patientLabels = await loadPatientLabelsForBookings(supabase, tid, surgeryBookings);

  if (surgeryBookings.length) {
    const bookingCtx = surgeryBookings.map((b) => ({
      id: b.id,
      case_id: b.case_id,
      patient_id: b.patient_id,
      booking_status: b.booking_status,
      financial_os_status: b.financial_os_status ?? null,
    }));

    const [pipelineMap, clearanceMap] = await Promise.all([
      loadFinancialSurgeryPipelineStatusByBookings(tid, {
        todayYmd: window.todayYmd,
        calendarTimezone: window.calendarTimezone,
        bookings: bookingCtx,
      }),
      resolveFinancialClearanceForBookings(tid, {
        todayYmd: window.todayYmd,
        calendarTimezone: window.calendarTimezone,
        bookings: bookingCtx.map((b) => ({
          id: b.id,
          case_id: b.case_id,
          patient_id: b.patient_id,
          booking_status: b.booking_status,
          financial_os_status: b.financial_os_status ?? null,
          start_at: surgeryBookings.find((x) => x.id === b.id)?.start_at ?? null,
        })),
      }),
    ]);

    const caseIds = surgeryBookings.map((b) => b.case_id).filter((x): x is string => Boolean(x?.trim()));
    const patientIds = surgeryBookings
      .map((b) => b.patient_id)
      .filter((x): x is string => Boolean(x?.trim()));
    const invoiceByCase = new Map<string, string[]>();
    const invoiceByPatient = new Map<string, string[]>();

    if (caseIds.length || patientIds.length) {
      let invoiceQuery = supabase.from("fi_invoices").select("id, case_id, patient_id").eq("tenant_id", tid);
      if (caseIds.length && patientIds.length) {
        invoiceQuery = invoiceQuery.or(
          `case_id.in.(${caseIds.join(",")}),and(patient_id.in.(${patientIds.join(",")}),case_id.is.null)`
        );
      } else if (caseIds.length) {
        invoiceQuery = invoiceQuery.in("case_id", caseIds);
      } else {
        invoiceQuery = invoiceQuery.in("patient_id", patientIds).is("case_id", null);
      }
      const { data: invoiceRows, error: invoiceErr } = await invoiceQuery.limit(400);
      if (invoiceErr) throw new Error(invoiceErr.message);
      for (const raw of invoiceRows ?? []) {
        const row = raw as { id: string; case_id: string | null; patient_id: string | null };
        const iid = String(row.id);
        if (row.case_id?.trim()) {
          const key = row.case_id.trim();
          invoiceByCase.set(key, [...(invoiceByCase.get(key) ?? []), iid]);
        } else if (row.patient_id?.trim()) {
          const key = row.patient_id.trim();
          invoiceByPatient.set(key, [...(invoiceByPatient.get(key) ?? []), iid]);
        }
      }
    }

    const allInvoiceIds = [
      ...new Set([...invoiceByCase.values(), ...invoiceByPatient.values()].flat()),
    ];
    const paymentRequestByInvoice = new Map<string, string>();
    if (allInvoiceIds.length) {
      const { data, error } = await supabase
        .from("fi_payment_requests")
        .select("*")
        .eq("tenant_id", tid)
        .in("invoice_id", allInvoiceIds)
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw new Error(error.message);
      for (const raw of data ?? []) {
        const pr = mapPaymentRequestRow(raw as Record<string, unknown>);
        const iid = pr.invoice_id?.trim();
        if (iid && !paymentRequestByInvoice.has(iid)) {
          paymentRequestByInvoice.set(iid, pr.id);
        }
      }
    }

    function resolvePaymentRequestId(booking: (typeof surgeryBookings)[number]): string | null {
      const invoiceIds = booking.case_id?.trim()
        ? (invoiceByCase.get(booking.case_id.trim()) ?? [])
        : booking.patient_id?.trim()
          ? (invoiceByPatient.get(booking.patient_id.trim()) ?? [])
          : [];
      for (const iid of invoiceIds) {
        const prId = paymentRequestByInvoice.get(iid);
        if (prId) return prId;
      }
      return null;
    }

    for (const b of surgeryBookings) {
      if (out.filter((s) => s.category === "financial").length >= ENTITY_LIMIT_PER_CATEGORY) break;

      const label =
        (b.patient_id ? patientLabels.get(b.patient_id) : null) ??
        (b.person_id ? patientLabels.get(`person:${b.person_id}`) : null) ??
        "Patient";
      const pipeline = pipelineMap.get(b.id);
      const clearance = clearanceMap.get(b.id);
      const paymentRequestId = resolvePaymentRequestId(b);

      const href = resolveFinancialAttentionHref({
        base,
        paymentRequestId,
        caseId: b.case_id,
        patientId: b.patient_id,
        aggregateFallbackHref: `${base}/financial/dashboard`,
      });

      if (
        clearance &&
        (clearance.requires_staff_attention || clearance.clearance_state === "attention_required")
      ) {
        out.push({
          id: `entity-financial-clearance-${b.id}`,
          category: "financial",
          aggregateKey: "financial_clearance",
          personLabel: label,
          actionLabel: `${firstName(label)} needs financial clearance`,
          detailLine: clearance.clearance_label?.trim() || "Confirm clearance before procedure day",
          actionHint: "Review clearance",
          href,
          severity: "critical",
          bucket: "right_now",
          priorityScore: 102,
          groupKey: "entity:financial_clearance",
        });
        continue;
      }

      if (pipeline?.payment_attention_required) {
        out.push({
          id: `entity-surgery-payment-${b.id}`,
          category: "financial",
          aggregateKey: "surgery_payment",
          personLabel: label,
          actionLabel: `${firstName(label)} needs payment attention`,
          detailLine: pipeline.summary_label?.trim() || "Deposit or balance requires confirmation",
          actionHint: "Take payment",
          href,
          severity: "warning",
          bucket: "up_next",
          priorityScore: 92,
          groupKey: "entity:surgery_payment",
        });
      }
    }
  }

  const { data: paymentRows, error: payErr } = await supabase
    .from("fi_payment_records")
    .select(
      "id, patient_id, status, due_date, amount_expected, amount_paid, updated_at, payment_context"
    )
    .eq("tenant_id", tid)
    .limit(500);
  if (payErr) throw new Error(payErr.message);

  const overdueRows = ((paymentRows ?? []) as PaymentRecordRow[]).filter((r) => {
    const eff = computeEffectivePaymentStatus(r, todayYmd);
    return eff === "overdue" || eff === "overdue_derived";
  });

  const overduePatientLabels = await loadPatientLabelsById(
    tid,
    overdueRows.map((r) => r.patient_id).filter((x): x is string => Boolean(x?.trim()))
  );

  for (const row of overdueRows) {
    if (out.filter((s) => s.id.startsWith("entity-payment-overdue-")).length >= ENTITY_LIMIT_PER_CATEGORY) {
      break;
    }
    const label =
      (row.patient_id ? overduePatientLabels.get(row.patient_id) : null) ?? "Patient";
    out.push({
      id: `entity-payment-overdue-${row.id}`,
      category: "financial",
      aggregateKey: "surgery_payment",
      personLabel: label,
      actionLabel: `${firstName(label)} payment overdue`,
      detailLine: "Outstanding balance requires collection",
      actionHint: "Take payment",
      href: paymentEntityHref(base, row.id, "payment_record"),
      severity: "warning",
      bucket: "right_now",
      priorityScore: 88,
      groupKey: "entity:payment_overdue",
    });
  }

  return out;
}

async function loadSurgeryEntitySignals(
  tenantId: string,
  base: string,
  now: Date
): Promise<TodayEntityAttentionSignal[]> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { calendarTimezone } = await loadTenantOperationalCalendarSettings(tid);
  const window = computeSurgeryReadinessBoardWindow(now, calendarTimezone);
  const horizonIso = window.rangeEndIso;

  const rawBookings = await loadBookingsForOperatorView({
    tenantId: tid,
    rangeStartIso: window.rangeStartIso,
    rangeEndIso: horizonIso,
    bookingType: "surgery",
    includeCancelled: false,
    limit: 120,
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

  const patientLabels = await loadPatientLabelsForBookings(supabase, tid, surgeryBookings);
  const out: TodayEntityAttentionSignal[] = [];

  for (const b of surgeryBookings) {
    if (out.length >= ENTITY_LIMIT_PER_CATEGORY) break;

    const label =
      (b.patient_id ? patientLabels.get(b.patient_id) : null) ??
      (b.person_id ? patientLabels.get(`person:${b.person_id}`) : null) ??
      "Patient";

    const daysUntil = Math.max(
      0,
      Math.round(
        (Date.parse(b.start_at) - now.getTime()) / 86_400_000
      )
    );
    const dayLabel =
      daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`;

    if (!b.case_id?.trim()) {
      out.push({
        id: `entity-surgery-readiness-${b.id}`,
        category: "surgery",
        aggregateKey: "surgery_readiness",
        personLabel: label,
        actionLabel: `${firstName(label)} surgery preparation incomplete`,
        detailLine: `Procedure ${dayLabel} — case not linked yet`,
        actionHint: "Review case",
        href: b.patient_id ? `${base}/patients/${b.patient_id}` : `${base}/cases`,
        severity: "critical",
        bucket: "right_now",
        priorityScore: 96,
        groupKey: "entity:surgery_readiness",
      });
      continue;
    }

    if (daysUntil > 1) continue;

    out.push({
      id: `entity-surgery-scheduled-${b.id}`,
      category: "surgery",
      aggregateKey: "surgery_readiness",
      personLabel: label,
      actionLabel: `${firstName(label)} surgery scheduled ${dayLabel}`,
      detailLine: "Open case workspace to confirm readiness",
      actionHint: "Open case",
      href: surgeryCaseEntityHref(base, b.case_id),
      severity: daysUntil <= 1 ? "warning" : "normal",
      bucket: daysUntil <= 1 ? "right_now" : "up_next",
      priorityScore: daysUntil <= 1 ? 75 : 45,
      groupKey: "entity:surgery_scheduled",
    });
  }

  return out;
}

async function loadPathologyEntitySignals(
  tenantId: string,
  base: string
): Promise<TodayEntityAttentionSignal[]> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_pathology_results")
    .select("id, patient_id, status, reviewed_at, result_date")
    .eq("tenant_id", tid)
    .is("reviewed_at", null)
    .in("status", ["draft", "pending_review", "received"])
    .order("result_date", { ascending: false })
    .limit(ENTITY_LIMIT_PER_CATEGORY);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    id: string;
    patient_id: string;
    status: string;
    reviewed_at: string | null;
    result_date: string | null;
  }[];

  const patientLabels = await loadPatientLabelsById(
    tid,
    rows.map((r) => r.patient_id)
  );
  const out: TodayEntityAttentionSignal[] = [];

  for (const row of rows) {
    const label = patientLabels.get(row.patient_id) ?? "Patient";
    out.push({
      id: `entity-pathology-${row.id}`,
      category: "pathology",
      aggregateKey: "pathology_review",
      personLabel: label,
      actionLabel: `Review ${firstName(label)} pathology result`,
      detailLine: "Blood result awaiting clinical review",
      actionHint: "Review",
      href: pathologyResultEntityHref(base, row.patient_id, row.id),
      severity: "warning",
      bucket: "up_next",
      priorityScore: 72,
      groupKey: "entity:pathology_review",
    });
  }

  return out;
}

async function loadConsultationEntitySignals(
  tenantId: string,
  base: string,
  now: Date
): Promise<TodayEntityAttentionSignal[]> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_consultations")
    .select("id, status, patient_id, lead_id, person_id, consultation_date")
    .eq("tenant_id", tid)
    .in("status", ["draft", "in_progress", "quoted"])
    .order("updated_at", { ascending: false })
    .limit(ENTITY_LIMIT_PER_CATEGORY);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    id: string;
    status: string;
    patient_id: string | null;
    lead_id: string | null;
    person_id: string | null;
    consultation_date: string | null;
  }[];

  const labels = await loadConsultationSubjectLabels(tid, rows);
  const out: TodayEntityAttentionSignal[] = [];

  for (const row of rows) {
    const label = consultationPersonLabel(row, labels);
    const status = row.status.replace(/_/g, " ");
    const consultDate = row.consultation_date?.trim()?.slice(0, 10);
    const scheduledSoon =
      consultDate &&
      Date.parse(`${consultDate}T23:59:59.000Z`) - now.getTime() <= 2 * 86_400_000;

    out.push({
      id: `entity-consultation-${row.id}`,
      category: "consultation",
      aggregateKey: "consultations",
      personLabel: label,
      actionLabel:
        row.status === "draft"
          ? `${firstName(label)} consultation ready to start`
          : row.status === "in_progress"
            ? `${firstName(label)} consultation in progress`
            : `${firstName(label)} consultation awaiting closure`,
      detailLine: scheduledSoon
        ? `Scheduled ${consultDate} — ${status}`
        : `Status: ${status}`,
      actionHint: row.status === "quoted" ? "Complete" : "Open",
      href: consultationEntityHref(base, row.id),
      severity: row.status === "in_progress" ? "warning" : "normal",
      bucket: scheduledSoon || row.status === "in_progress" ? "right_now" : "up_next",
      priorityScore: scheduledSoon ? 78 : 68,
      groupKey: "entity:consultation",
    });
  }

  return out;
}

async function loadStaffEntitySignals(tenantId: string, base: string): Promise<TodayEntityAttentionSignal[]> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();

  const { data: alertRows, error } = await supabase
    .from("fi_staff_compliance_alerts")
    .select("id, staff_member_id, alert_type, severity, message")
    .eq("tenant_id", tid)
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(ENTITY_LIMIT_PER_CATEGORY);
  if (error) throw new Error(error.message);

  const memberIds = [
    ...new Set(
      ((alertRows ?? []) as { staff_member_id: string }[]).map((r) => String(r.staff_member_id))
    ),
  ];
  const nameById = new Map<string, string>();
  if (memberIds.length) {
    const { data: members, error: memberErr } = await supabase
      .from("fi_staff_members")
      .select("id, full_name")
      .eq("tenant_id", tid)
      .in("id", memberIds);
    if (memberErr) throw new Error(memberErr.message);
    for (const m of members ?? []) {
      nameById.set(String((m as { id: string }).id), String((m as { full_name: string }).full_name));
    }
  }

  const out: TodayEntityAttentionSignal[] = [];
  for (const raw of alertRows ?? []) {
    const row = raw as {
      id: string;
      staff_member_id: string;
      alert_type: string;
      severity: string;
      message: string | null;
    };
    const staffId = String(row.staff_member_id);
    const name = nameById.get(staffId) ?? "Staff member";
    const alertType = row.alert_type.replace(/_/g, " ");
    const sev = String(row.severity ?? "").toLowerCase();
    const severity =
      sev === "critical" || sev === "high" ? "critical" : sev === "medium" ? "warning" : "normal";

    out.push({
      id: `entity-staff-${row.id}`,
      category: "staff",
      aggregateKey: "staff_compliance",
      personLabel: name,
      actionLabel: `${firstName(name)} — ${alertType}`,
      detailLine: row.message?.trim() || "Compliance item needs attention",
      actionHint: "Review",
      href: staffEntityHref(base, staffId),
      severity,
      bucket: severity === "critical" ? "right_now" : "up_next",
      priorityScore: severity === "critical" ? 84 : 58,
      groupKey: "entity:staff_compliance",
    });
  }

  return out;
}

export async function loadTodayEntityAttentionSignals(
  tenantId: string,
  now: Date = new Date()
): Promise<TodayEntityAttentionSignal[]> {
  const base = `/fi-admin/${tenantId.trim()}`;

  const [financial, surgery, pathology, consultation, staff] = await Promise.all([
    loadFinancialEntitySignals(tenantId, base, now),
    loadSurgeryEntitySignals(tenantId, base, now),
    loadPathologyEntitySignals(tenantId, base),
    loadConsultationEntitySignals(tenantId, base, now),
    loadStaffEntitySignals(tenantId, base),
  ]);

  return [...financial, ...surgery, ...pathology, ...consultation, ...staff].slice(
    0,
    ENTITY_SIGNAL_LIMIT
  );
}

export async function loadTodayEntityAttentionPayload(
  tenantId: string,
  now: Date = new Date()
): Promise<TodayEntityAttentionPayload> {
  const signals = await loadTodayEntityAttentionSignals(tenantId, now);
  return {
    signals: signals.map((s) => todayEntityAttentionSignalSchema.parse(s)),
  };
}
