import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type {
  ReceptionCommunicationDeliveryRow,
  ReceptionCommunicationDeliveryStatus,
  ReceptionCommunicationDeliverySummary,
} from "@/src/lib/receptionOs/receptionCommunicationDelivery.types";
import type { ReceptionCommunicationSendResult } from "@/src/lib/receptionOs/receptionCommunicationProvider";

export { mapSendResultToDeliveryStatus } from "@/src/lib/receptionOs/receptionCommunicationDeliveryModel";

export type PersistReceptionCommunicationDeliveryParams = {
  tenantId: string;
  leadId?: string | null;
  patientId?: string | null;
  crmCommunicationId?: string | null;
  taskId?: string | null;
  channel: "sms" | "email";
  templateKey: string;
  toAddress: string | null;
  sendResult: ReceptionCommunicationSendResult;
  deliveryStatus: ReceptionCommunicationDeliveryStatus;
  errorMessage?: string | null;
  sentAt?: string | null;
  metadata?: Record<string, unknown>;
};

function mapDeliveryRow(raw: Record<string, unknown>): ReceptionCommunicationDeliveryRow {
  const meta = raw.metadata;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    lead_id: raw.lead_id != null ? String(raw.lead_id) : null,
    patient_id: raw.patient_id != null ? String(raw.patient_id) : null,
    crm_communication_id:
      raw.crm_communication_id != null ? String(raw.crm_communication_id) : null,
    task_id: raw.task_id != null ? String(raw.task_id) : null,
    channel: String(raw.channel) as "sms" | "email",
    provider: String(raw.provider) as "stub" | "resend" | "twilio",
    external_message_id: raw.external_message_id != null ? String(raw.external_message_id) : null,
    delivery_status: String(raw.delivery_status) as ReceptionCommunicationDeliveryStatus,
    error_message: raw.error_message != null ? String(raw.error_message) : null,
    sent_at: raw.sent_at != null ? String(raw.sent_at) : null,
    template_key: raw.template_key != null ? String(raw.template_key) : null,
    to_address: raw.to_address != null ? String(raw.to_address) : null,
    metadata:
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : {},
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

export async function persistReceptionCommunicationDelivery(
  params: PersistReceptionCommunicationDeliveryParams
): Promise<ReceptionCommunicationDeliveryRow> {
  const tid = assertNonEmptyUuid(params.tenantId, "tenantId").trim();
  const supabase = supabaseAdmin();

  const payload = {
    tenant_id: tid,
    lead_id: params.leadId?.trim() || null,
    patient_id: params.patientId?.trim() || null,
    crm_communication_id: params.crmCommunicationId?.trim() || null,
    task_id: params.taskId?.trim() || null,
    channel: params.channel,
    provider: params.sendResult.provider,
    external_message_id: params.sendResult.externalMessageId,
    delivery_status: params.deliveryStatus,
    error_message: params.errorMessage?.trim() || null,
    sent_at: params.sentAt ?? (params.deliveryStatus === "sent" ? new Date().toISOString() : null),
    template_key: params.templateKey,
    to_address: params.toAddress?.trim() || null,
    metadata: {
      detail: params.sendResult.detail,
      ...(params.metadata ?? {}),
    },
  };

  const { data, error } = await supabase
    .from("fi_reception_communication_deliveries")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    if (error.message.includes("does not exist")) {
      throw new Error(
        "Reception communication delivery tracking is not available (migration pending)."
      );
    }
    throw new Error(error.message);
  }

  return mapDeliveryRow(data as Record<string, unknown>);
}

export async function loadFailedReceptionCommunicationsForOperationalDay(
  tenantId: string,
  operationalDay: { localStartIso: string; localEndIso: string }
): Promise<ReceptionCommunicationDeliverySummary[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("fi_reception_communication_deliveries")
    .select(
      "id, channel, provider, delivery_status, error_message, sent_at, template_key, to_address, external_message_id, lead_id, patient_id, created_at"
    )
    .eq("tenant_id", tid)
    .eq("delivery_status", "failed")
    .gte("created_at", operationalDay.localStartIso)
    .lt("created_at", operationalDay.localEndIso)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id),
      channel: String(r.channel) as "sms" | "email",
      provider: String(r.provider),
      deliveryStatus: String(r.delivery_status) as ReceptionCommunicationDeliveryStatus,
      errorMessage: r.error_message != null ? String(r.error_message) : null,
      sentAt: r.sent_at != null ? String(r.sent_at) : null,
      templateKey: r.template_key != null ? String(r.template_key) : null,
      toAddress: r.to_address != null ? String(r.to_address) : null,
      externalMessageId: r.external_message_id != null ? String(r.external_message_id) : null,
      leadId: r.lead_id != null ? String(r.lead_id) : null,
      patientId: r.patient_id != null ? String(r.patient_id) : null,
      createdAt: String(r.created_at),
    };
  });
}
