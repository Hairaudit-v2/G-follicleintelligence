import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadCaseAdminDetail } from "@/src/lib/cases/caseLoaders";
import {
  loadConsultationForTenant,
  loadConsultationWorkspaceDisplay,
} from "@/src/lib/consultations/consultationLoaders.server";
import { CONSULTATION_TYPE_DEFINITIONS } from "@/src/lib/consultations/consultationTypeConfig";
import type { ConsultationStatus } from "@/src/lib/consultations/consultationTypes";
import { formatMoneyFromCents } from "@/src/lib/format/money";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";
import { mapPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import { loadStaffMemberForTenant } from "@/src/lib/staff/staff.server";
import { loadStaffTwinPage } from "@/src/lib/staff/staffTwinLoader.server";

export type PaymentWorkspacePayload = {
  paymentId: string;
  recordKind: "payment_request" | "payment_record";
  label: string;
  patientLabel: string | null;
  patientId: string | null;
  amountLabel: string;
  status: string;
  fullPageHref: string;
  invoiceId: string | null;
  checkoutUrl: string | null;
  canSendLink: boolean;
  canRecordPayment: boolean;
};

export type PathologyResultWorkspacePayload = {
  resultId: string;
  patientId: string;
  patientLabel: string;
  resultDate: string;
  status: string;
  reviewState: string;
  abnormalCount: number;
  fullPageHref: string;
};

export type SurgeryCaseWorkspacePayload = {
  caseId: string;
  title: string;
  patientLabel: string;
  patientId: string | null;
  status: string;
  treatmentType: string | null;
  blockerSummary: string;
  fullPageHref: string;
  surgeryDayHref: string | null;
};

export type ConsultationWorkspacePayload = {
  consultationId: string;
  title: string;
  status: string;
  typeLabel: string;
  patientLabel: string | null;
  patientId: string | null;
  appointmentLabel: string | null;
  primaryActionLabel: string | null;
  primaryActionHref: string | null;
  fullPageHref: string;
};

export type StaffWorkspacePayload = {
  staffId: string;
  displayName: string;
  role: string | null;
  employmentStatus: string | null;
  complianceSummary: string;
  fullPageHref: string;
  profileHref: string;
  accessHref: string | null;
};

function consultationPrimaryAction(
  base: string,
  consultationId: string,
  status: ConsultationStatus
): { label: string; href: string } | null {
  const href = `${base}/consultations/${consultationId}`;
  switch (status) {
    case "draft":
      return { label: "Start consultation", href };
    case "in_progress":
      return { label: "Continue consultation", href };
    case "quoted":
    case "completed":
      return { label: "Open consultation", href };
    default:
      return { label: "Open consultation", href };
  }
}

function consultationTypeLabel(id: string): string {
  return CONSULTATION_TYPE_DEFINITIONS.find((d) => d.id === id)?.label ?? id.replace(/_/g, " ");
}

async function resolvePatientLabel(tenantId: string, patientId: string): Promise<string> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patients")
    .select("metadata")
    .eq("tenant_id", tenantId)
    .eq("id", patientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return `Patient ${patientId.slice(0, 8)}…`;
  const meta = (data as { metadata: unknown }).metadata;
  const display =
    meta && typeof meta === "object" && !Array.isArray(meta)
      ? displayFromPersonMetadata(meta as Record<string, unknown>)
      : null;
  return display?.name ?? `Patient ${patientId.slice(0, 8)}…`;
}

export async function loadPaymentWorkspacePayload(
  tenantId: string,
  paymentId: string
): Promise<PaymentWorkspacePayload | null> {
  const tid = tenantId.trim();
  const pid = paymentId.trim();
  if (!tid || !pid) return null;

  const supabase = supabaseAdmin();
  const base = `/fi-admin/${tid}`;

  const { data: prRaw, error: pre } = await supabase
    .from("fi_payment_requests")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", pid)
    .maybeSingle();
  if (pre) throw new Error(pre.message);

  if (prRaw) {
    const pr = mapPaymentRequestRow(prRaw as Record<string, unknown>);
    let patientLabel: string | null = null;
    let patientId: string | null = null;
    if (pr.invoice_id) {
      const { data: inv } = await supabase
        .from("fi_invoices")
        .select("patient_id, title")
        .eq("tenant_id", tid)
        .eq("id", pr.invoice_id)
        .maybeSingle();
      if (inv) {
        patientId =
          (inv as { patient_id: string | null }).patient_id != null
            ? String((inv as { patient_id: string | null }).patient_id)
            : null;
        if (patientId) patientLabel = await resolvePatientLabel(tid, patientId);
      }
    }
    const amountCents = pr.amount_cents ?? pr.total_cents ?? 0;
    return {
      paymentId: pid,
      recordKind: "payment_request",
      label: patientLabel ? `Payment for ${patientLabel}` : "Payment request",
      patientLabel,
      patientId,
      amountLabel: formatMoneyFromCents(amountCents, pr.currency ?? "AUD"),
      status: pr.status,
      fullPageHref: `${base}/financial/payment-requests`,
      invoiceId: pr.invoice_id,
      checkoutUrl: pr.checkout_url?.trim() || null,
      canSendLink: pr.status === "draft" || pr.status === "sent",
      canRecordPayment: pr.status !== "paid" && pr.status !== "cancelled",
    };
  }

  const { data: payRaw, error: paye } = await supabase
    .from("fi_payments")
    .select("id, status, total_cents, currency, invoice_id")
    .eq("tenant_id", tid)
    .eq("id", pid)
    .maybeSingle();
  if (paye) throw new Error(paye.message);
  if (!payRaw) return null;

  const pay = payRaw as {
    id: string;
    status: string;
    total_cents: number;
    currency: string;
    invoice_id: string;
  };
  let patientLabel: string | null = null;
  let patientId: string | null = null;
  if (pay.invoice_id) {
    const { data: inv } = await supabase
      .from("fi_invoices")
      .select("patient_id")
      .eq("tenant_id", tid)
      .eq("id", pay.invoice_id)
      .maybeSingle();
    patientId =
      (inv as { patient_id: string | null } | null)?.patient_id != null
        ? String((inv as { patient_id: string | null }).patient_id)
        : null;
    if (patientId) patientLabel = await resolvePatientLabel(tid, patientId);
  }

  return {
    paymentId: pid,
    recordKind: "payment_record",
    label: patientLabel ? `Payment from ${patientLabel}` : "Payment record",
    patientLabel,
    patientId,
    amountLabel: formatMoneyFromCents(Number(pay.total_cents), pay.currency ?? "AUD"),
    status: pay.status,
    fullPageHref: `${base}/financial/payments`,
    invoiceId: pay.invoice_id,
    checkoutUrl: null,
    canSendLink: false,
    canRecordPayment: false,
  };
}

export async function loadPathologyResultWorkspacePayload(
  tenantId: string,
  resultId: string
): Promise<PathologyResultWorkspacePayload | null> {
  const tid = tenantId.trim();
  const rid = resultId.trim();
  if (!tid || !rid) return null;

  const supabase = supabaseAdmin();
  const { data: resRow, error: re } = await supabase
    .from("fi_pathology_results")
    .select("id, patient_id, result_date, status, reviewed_at")
    .eq("tenant_id", tid)
    .eq("id", rid)
    .maybeSingle();
  if (re) throw new Error(re.message);
  if (!resRow) return null;

  const patientId = String((resRow as { patient_id: string }).patient_id);
  const patientLabel = await resolvePatientLabel(tid, patientId);

  const { count, error: ce } = await supabase
    .from("fi_pathology_result_items")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .eq("result_id", rid)
    .in("flag", ["high", "low", "critical"]);
  if (ce) throw new Error(ce.message);

  const reviewedAt = (resRow as { reviewed_at: string | null }).reviewed_at;
  const status = String((resRow as { status: string }).status);
  const reviewState = reviewedAt ? "Reviewed" : status === "pending_review" ? "Awaiting review" : status;

  return {
    resultId: rid,
    patientId,
    patientLabel,
    resultDate: String((resRow as { result_date: string }).result_date ?? "").slice(0, 10),
    status,
    reviewState,
    abnormalCount: count ?? 0,
    fullPageHref: `/fi-admin/${tid}/patients/${patientId}/blood-results/${rid}`,
  };
}

export async function loadSurgeryCaseWorkspacePayload(
  tenantId: string,
  caseId: string
): Promise<SurgeryCaseWorkspacePayload | null> {
  const detail = await loadCaseAdminDetail(tenantId, caseId);
  if (!detail) return null;

  const base = `/fi-admin/${tenantId.trim()}`;
  const patientLabel = detail.patient?.person_label ?? "Case";
  const title =
    detail.treatment_type?.trim() ||
    detail.case_type?.trim() ||
    detail.external_id?.trim() ||
    `Case ${detail.id.slice(0, 8)}…`;

  const surgeryBooking = detail.bookings.find(
    (b) => b.booking_type.trim().toLowerCase() === "surgery"
  );

  let blockerSummary = `Status: ${detail.status.replace(/_/g, " ")}`;
  if (detail.status === "blocked" || detail.status === "on_hold") {
    blockerSummary = "Case has blockers — review preparation and clearance on the full case page.";
  } else if (surgeryBooking) {
    blockerSummary = `Surgery scheduled ${surgeryBooking.start_at.slice(0, 10)}`;
  }

  return {
    caseId: detail.id,
    title,
    patientLabel,
    patientId: detail.patient?.foundation_patient_id ?? detail.foundation_patient_id,
    status: detail.status,
    treatmentType: detail.treatment_type,
    blockerSummary,
    fullPageHref: `${base}/cases/${detail.id}`,
    surgeryDayHref: surgeryBooking ? `${base}/procedure-day` : null,
  };
}

export async function loadConsultationWorkspacePayload(
  tenantId: string,
  consultationId: string
): Promise<ConsultationWorkspacePayload | null> {
  const tid = tenantId.trim();
  const row = await loadConsultationForTenant(tid, consultationId);
  if (!row) return null;

  const display = await loadConsultationWorkspaceDisplay(tid, row);
  const base = `/fi-admin/${tid}`;
  const subject =
    display.patientName ??
    display.leadName ??
    `Consultation ${consultationId.slice(0, 8)}…`;
  const primary = consultationPrimaryAction(base, row.id, row.status);

  let appointmentLabel: string | null = null;
  if (row.consultation_date?.trim()) {
    appointmentLabel = row.consultation_date.slice(0, 10);
  } else if (row.booking_id?.trim()) {
    appointmentLabel = "Linked appointment";
  }

  return {
    consultationId: row.id,
    title: subject,
    status: row.status.replace(/_/g, " "),
    typeLabel: consultationTypeLabel(String(row.consultation_type)),
    patientLabel: display.patientName,
    patientId: row.patient_id,
    appointmentLabel,
    primaryActionLabel: primary?.label ?? null,
    primaryActionHref: primary?.href ?? null,
    fullPageHref: `${base}/consultations/${row.id}`,
  };
}

export async function loadStaffWorkspacePayload(
  tenantId: string,
  staffId: string
): Promise<StaffWorkspacePayload | null> {
  const tid = tenantId.trim();
  const sid = staffId.trim();
  const base = `/fi-admin/${tid}`;

  const twin = await loadStaffTwinPage(tid, sid);
  if (twin) {
    const compliance = twin.complianceSummary;
    const complianceSummary =
      compliance.overallStatus === "current"
        ? "Compliance up to date"
        : compliance.overallStatus === "due_soon"
          ? "Compliance due soon"
          : compliance.overallStatus === "expired"
            ? "Expired compliance items"
            : compliance.overallStatus === "missing"
              ? "Missing compliance records"
              : "Compliance status unknown";

    return {
      staffId: sid,
      displayName: twin.staff.full_name,
      role: twin.staff.staff_role,
      employmentStatus: twin.staff.is_active ? "active" : "inactive",
      complianceSummary,
      fullPageHref: `${base}/staff/${sid}/twin`,
      profileHref: `${base}/workforce-os/staff/${sid}`,
      accessHref: `${base}/settings/staff-access`,
    };
  }

  const staff = await loadStaffMemberForTenant(tid, sid);
  if (!staff) return null;

  return {
    staffId: sid,
    displayName: staff.full_name,
    role: staff.staff_role,
    employmentStatus: staff.is_active ? "active" : "inactive",
    complianceSummary: "Open full profile for readiness and compliance details.",
    fullPageHref: `${base}/workforce-os/staff/${sid}`,
    profileHref: `${base}/workforce-os/staff/${sid}`,
    accessHref: null,
  };
}
