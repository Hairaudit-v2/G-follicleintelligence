import type { PatientTimelineItemType, PatientTimelineSourceType } from "./patientTimelineTypes";

const CRM_ACTIVITY_LABELS: Record<string, string> = {
  "lead.created": "Lead created",
  "lead.updated": "Lead updated",
  "lead.converted_to_person": "Lead converted",
  "lead.case_seeded": "Case linked from lead",
  "stage.changed": "Pipeline stage changed",
  "task.created": "Task created",
  "task.updated": "Task updated",
  "task.completed": "Task completed",
  "task.reopened": "Task reopened",
  "note.created": "Note added",
  "lead_note.created": "Lead note added",
  "lead_note.updated": "Lead note updated",
  "lead_note.archived": "Lead note archived",
  "lead_communication.created": "Contact log entry",
  "lead_communication.updated": "Contact log updated",
  "lead_communication.archived": "Contact log archived",
  "message.logged": "Message preview logged",
  "booking.updated": "Booking updated",
  "booking.created": "Booking activity",
  "booking.completed": "Booking activity",
  "booking.cancelled": "Booking activity",
};

export function crmActivityTimelineTitle(activityKind: string): string {
  const k = activityKind.trim();
  return CRM_ACTIVITY_LABELS[k] ?? "CRM activity";
}

export function patientTimelineSourceLabel(source: PatientTimelineSourceType): string {
  switch (source) {
    case "patient":
      return "Patient";
    case "lead":
      return "Lead";
    case "crm_activity":
      return "CRM";
    case "booking":
      return "Booking";
    case "case":
      return "Case";
    case "clinical":
      return "Clinical";
    case "image":
      return "Image";
    case "system":
      return "System";
    default:
      return "Other";
  }
}

export function patientTimelineItemTypeLabel(itemType: PatientTimelineItemType): string {
  switch (itemType) {
    case "lead_created":
      return "Lead";
    case "lead_converted":
      return "Conversion";
    case "crm_activity":
      return "Activity";
    case "booking_scheduled":
      return "Scheduled";
    case "booking_completed":
      return "Completed";
    case "booking_cancelled":
      return "Cancelled";
    case "case_created":
      return "Case";
    case "clinical_details_updated":
      return "Clinical";
    case "image_uploaded":
      return "Image";
    case "image_archived":
      return "Image";
    case "patient_admin_updated":
      return "Admin";
    case "other":
      return "Other";
    default:
      return itemType;
  }
}
