/**
 * ReceptionOS Phase 4 — suggested template selection + variable assembly (pure).
 */

import type { ReceptionOsActionAlert } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import type { ReceptionOsRevenueRiskAlertKind } from "@/src/lib/receptionOs/receptionOsRevenueModel";
import type { ReceptionTaskSourceType } from "@/src/lib/receptionOs/receptionTaskPolicy";
import {
  type ReceptionCommunicationTemplateKey,
  type ReceptionCommunicationTemplateVariables,
  isReceptionCommunicationTemplateKey,
} from "@/src/lib/receptionOs/receptionCommunicationTemplates";

export type ReceptionCommunicationSourceKind =
  | "task"
  | "action_alert"
  | "revenue_alert"
  | "deposit"
  | "surgery"
  | "pipeline"
  | "patient";

export type ReceptionCommunicationContextInput = {
  sourceKind: ReceptionCommunicationSourceKind;
  sourceId: string;
  label: string;
  alertKind?: string | null;
  taskSourceType?: ReceptionTaskSourceType | null;
  patientFirstName?: string | null;
  appointmentDate?: string | null;
  surgeryDate?: string | null;
  quoteAmount?: string | number | null;
  depositAmount?: string | number | null;
  currency?: string | null;
  paymentLink?: string | null;
  clinicName?: string | null;
  leadId?: string | null;
  taskId?: string | null;
};

export function extractLeadIdFromHref(href: string | null | undefined): string | null {
  if (!href?.trim()) return null;
  const m = href.match(/\/crm\/leads\/([0-9a-f-]{36})/i);
  return m?.[1] ?? null;
}

export function patientFirstNameFromLabel(label: string): string {
  const t = label.trim();
  if (!t) return "there";
  const first = t.split(/\s+/)[0] ?? t;
  return first.replace(/[^a-zA-Z'-]/g, "") || "there";
}

export function suggestReceptionCommunicationTemplateKey(
  input: Pick<ReceptionCommunicationContextInput, "sourceKind" | "alertKind" | "taskSourceType">
): ReceptionCommunicationTemplateKey {
  const kind = input.alertKind?.trim() ?? "";

  if (input.sourceKind === "deposit") return "deposit_reminder";
  if (input.sourceKind === "surgery") return "surgery_readiness";
  if (input.sourceKind === "patient") return "appointment_reminder";
  if (input.sourceKind === "pipeline") return "quote_follow_up";

  if (kind === "missing_deposit" || kind === "deposit_overdue") return "deposit_reminder";
  if (kind === "missing_finance_payment_link") return "payment_link_follow_up";
  if (kind === "surgery_risk" || kind === "surgery_booking_at_risk") return "surgery_readiness";
  if (kind === "patient_gone_cold") return "cold_lead_reactivation";
  if (
    kind === "no_follow_up_after_consultation" ||
    kind === "quote_followup_sla_breach" ||
    kind === "high_value_quote_no_followup" ||
    kind === "consultation_no_quote"
  ) {
    return "quote_follow_up";
  }
  if (kind === "missing_forms") return "consultation_no_show";

  if (input.taskSourceType === "payment") return "deposit_reminder";
  if (input.taskSourceType === "surgery") return "surgery_readiness";
  if (input.taskSourceType === "consultation") return "quote_follow_up";
  if (input.taskSourceType === "booking") return "appointment_reminder";
  if (input.taskSourceType === "lead") return "cold_lead_reactivation";

  return "quote_follow_up";
}

export function suggestTemplateFromActionAlert(
  alert: ReceptionOsActionAlert
): ReceptionCommunicationTemplateKey {
  return suggestReceptionCommunicationTemplateKey({
    sourceKind: "action_alert",
    alertKind: alert.kind,
  });
}

export function suggestTemplateFromRevenueAlertKind(
  kind: ReceptionOsRevenueRiskAlertKind
): ReceptionCommunicationTemplateKey {
  return suggestReceptionCommunicationTemplateKey({
    sourceKind: "revenue_alert",
    alertKind: kind,
  });
}

export function buildReceptionCommunicationVariables(
  input: ReceptionCommunicationContextInput
): ReceptionCommunicationTemplateVariables {
  const currency = input.currency?.trim() || "AUD";
  const depositAmt =
    input.depositAmount != null
      ? typeof input.depositAmount === "number"
        ? `${currency} ${input.depositAmount}`
        : String(input.depositAmount)
      : undefined;
  const quoteAmt =
    input.quoteAmount != null
      ? typeof input.quoteAmount === "number"
        ? `${currency} ${input.quoteAmount}`
        : String(input.quoteAmount)
      : undefined;

  return {
    patient_first_name: input.patientFirstName?.trim() || patientFirstNameFromLabel(input.label),
    appointment_date: input.appointmentDate?.trim() || "",
    surgery_date: input.surgeryDate?.trim() || "",
    quote_amount: quoteAmt ?? "",
    deposit_amount: depositAmt ?? "",
    payment_link: input.paymentLink?.trim() || "",
    clinic_name: input.clinicName?.trim() || "the clinic",
  };
}

export function parseSuggestedTemplateKey(
  raw: string | null | undefined
): ReceptionCommunicationTemplateKey | null {
  const t = raw?.trim() ?? "";
  return isReceptionCommunicationTemplateKey(t) ? t : null;
}
