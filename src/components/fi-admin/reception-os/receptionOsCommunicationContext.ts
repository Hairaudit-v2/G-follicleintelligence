"use client";

import type { ReceptionCommunicationContextInput } from "@/src/lib/receptionOs/receptionCommunicationComposer";
import type { ReceptionOsActionAlert } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import type { ReceptionOsDepositItem } from "@/src/lib/receptionOs/receptionOsBoardPayloadSchema";
import type { ReceptionOsRevenueRiskAlert } from "@/src/lib/receptionOs/receptionOsRevenueModel";
import type { ReceptionOsSurgeryItem } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import type { ReceptionOsTaskItem } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import { extractLeadIdFromHref } from "@/src/lib/receptionOs/receptionCommunicationComposer";

export type ReceptionComposerChannel = "sms" | "email" | "phone" | "note";

export function buildContextFromTask(
  task: ReceptionOsTaskItem,
  clinicName: string,
): ReceptionCommunicationContextInput {
  return {
    sourceKind: "task",
    sourceId: task.id,
    label: task.title,
    alertKind: task.sourceAlertKind,
    taskSourceType: task.sourceType,
    taskId: task.id,
    leadId: task.leadId,
    clinicName,
  };
}

export function buildContextFromActionAlert(
  alert: ReceptionOsActionAlert,
  task: ReceptionOsTaskItem | null,
  clinicName: string,
): ReceptionCommunicationContextInput {
  return {
    sourceKind: "action_alert",
    sourceId: alert.id,
    label: alert.title,
    alertKind: alert.kind,
    taskId: task?.id ?? null,
    leadId: extractLeadIdFromHref(alert.hrefs?.lead ?? null) ?? task?.leadId ?? null,
    clinicName,
  };
}

export function buildContextFromRevenueAlert(
  alert: ReceptionOsRevenueRiskAlert,
  task: ReceptionOsTaskItem | null,
  clinicName: string,
): ReceptionCommunicationContextInput {
  return {
    sourceKind: "revenue_alert",
    sourceId: alert.id,
    label: alert.title,
    alertKind: alert.kind,
    taskId: task?.id ?? null,
    leadId: extractLeadIdFromHref(alert.hrefs.lead) ?? task?.leadId ?? null,
    clinicName,
  };
}

export function buildContextFromDeposit(deposit: ReceptionOsDepositItem, clinicName: string): ReceptionCommunicationContextInput {
  return {
    sourceKind: "deposit",
    sourceId: deposit.id,
    label: deposit.patientLabel,
    depositAmount: deposit.amountExpected - deposit.amountPaid,
    currency: deposit.currency,
    paymentLink: deposit.paymentLink ?? null,
    leadId: extractLeadIdFromHref(deposit.hrefs.lead),
    clinicName,
  };
}

export function buildContextFromSurgery(item: ReceptionOsSurgeryItem, clinicName: string): ReceptionCommunicationContextInput {
  return {
    sourceKind: "surgery",
    sourceId: item.bookingId,
    label: item.patientLabel,
    surgeryDate: `${item.surgeryDate} ${item.surgeryTime}`.trim(),
    leadId: extractLeadIdFromHref(item.hrefs.patient),
    clinicName,
  };
}
