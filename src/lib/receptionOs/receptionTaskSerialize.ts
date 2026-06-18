import type { ReceptionOsTaskItem } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import type { ReceptionTaskRow } from "@/src/lib/receptionOs/receptionTasks.types";

export function serializeReceptionTaskRow(row: ReceptionTaskRow): ReceptionOsTaskItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    sourceType: row.source_type,
    severity: row.severity,
    status: row.status,
    ownerFiUserId: row.owner_fi_user_id,
    dueAt: row.due_at,
    patientId: row.patient_id,
    caseId: row.case_id,
    leadId: row.lead_id,
    bookingId: row.booking_id,
    paymentId: row.payment_id,
    consultationId: row.consultation_id,
    sourceAlertKind: row.source_alert_kind,
    sourceRefId: row.source_ref_id,
    resolutionNotes: row.resolution_notes,
    internalNotes: row.internal_notes,
    snoozedUntil: row.snoozed_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeReceptionTaskRows(rows: readonly ReceptionTaskRow[]): ReceptionOsTaskItem[] {
  return rows.map(serializeReceptionTaskRow);
}
