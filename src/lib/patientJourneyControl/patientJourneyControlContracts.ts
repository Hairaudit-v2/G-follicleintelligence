/**
 * FI-PATIENT-APP-P1 — Journey Control pure contracts (patient-safe enums + helpers).
 * No server imports. FiOS is SoR; patient app mirrors these DTOs only.
 */

export const PATIENT_JOURNEY_MILESTONE_KEYS = [
  "consultation_completed",
  "treatment_plan_prepared",
  "quote_sent",
  "quote_accepted",
  "deposit_paid",
  "blood_request_issued",
  "results_received",
  "clinical_review_completed",
  "surgery_booked",
  "pre_surgery_documents_completed",
  "patient_cleared_for_surgery",
] as const;

export type PatientJourneyMilestoneKey = (typeof PATIENT_JOURNEY_MILESTONE_KEYS)[number];

export const PATIENT_JOURNEY_MILESTONE_STATUSES = [
  "not_started",
  "action_required",
  "in_progress",
  "waiting_on_patient",
  "waiting_on_clinic",
  "completed",
  "blocked",
] as const;

export type PatientJourneyMilestoneStatus = (typeof PATIENT_JOURNEY_MILESTONE_STATUSES)[number];

export const PATIENT_JOURNEY_RESPONSIBLE_ROLES = [
  "patient",
  "clinic",
  "clinician",
  "system",
] as const;

export type PatientJourneyResponsibleRole = (typeof PATIENT_JOURNEY_RESPONSIBLE_ROLES)[number];

export const PATIENT_JOURNEY_MILESTONE_LABELS: Record<PatientJourneyMilestoneKey, string> = {
  consultation_completed: "Consultation completed",
  treatment_plan_prepared: "Treatment plan prepared",
  quote_sent: "Quote delivered",
  quote_accepted: "Quote accepted",
  deposit_paid: "Deposit paid",
  blood_request_issued: "Blood tests requested",
  results_received: "Results received",
  clinical_review_completed: "Clinical review completed",
  surgery_booked: "Surgery booked",
  pre_surgery_documents_completed: "Pre-surgery documents completed",
  patient_cleared_for_surgery: "Cleared for surgery",
};

export const PATIENT_ACTION_KINDS = [
  "review_quote",
  "accept_quote",
  "pay_deposit",
  "complete_blood_tests",
  "sign_document",
  "upload_medications",
  "upload_preop_photos",
  "confirm_contacts",
  "await_treatment_plan",
  "await_pathology_review",
  "await_surgery_confirmation",
  "await_medical_clearance",
  "attend_appointment",
  "upload_images",
  "request_review",
  "none",
] as const;

export type PatientActionKind = (typeof PATIENT_ACTION_KINDS)[number];

export const PATIENT_ACTION_STATUSES = [
  "open",
  "in_progress",
  "waiting_on_clinic",
  "completed",
  "cancelled",
  "blocked",
] as const;

export type PatientActionStatus = (typeof PATIENT_ACTION_STATUSES)[number];

export const PATIENT_ACTION_BUCKETS = [
  "action_required",
  "waiting_on_clinic",
  "upcoming",
  "recently_completed",
] as const;

export type PatientActionBucket = (typeof PATIENT_ACTION_BUCKETS)[number];

export const PATIENT_JOURNEY_DOMAIN_EVENTS = [
  "quote_delivered",
  "quote_accepted",
  "quote_declined",
  "deposit_received",
  "blood_request_issued",
  "pathology_results_received",
  "pathology_cleared",
  "document_packet_released",
  "document_packet_completed",
  "document_rejected",
  "surgery_booked",
  "surgery_readiness_ready",
] as const;

export type PatientJourneyDomainEvent = (typeof PATIENT_JOURNEY_DOMAIN_EVENTS)[number];

export const PATIENT_JOURNEY_NOTIFICATION_EVENTS = [
  "quote_delivered",
  "quote_reminder",
  "deposit_due",
  "blood_request_issued",
  "pathology_received_awaiting_review",
  "pathology_cleared",
  "document_required",
  "document_rejected",
  "action_overdue",
] as const;

export type PatientJourneyNotificationEvent = (typeof PATIENT_JOURNEY_NOTIFICATION_EVENTS)[number];

export const PATIENT_QUOTE_CLINIC_STATUSES = [
  "prepared",
  "sent",
  "delivered",
  "first_viewed",
  "last_viewed",
  "accepted",
  "declined",
  "expired",
  "deposit_outstanding",
  "deposit_received",
] as const;

export type PatientQuoteClinicStatus = (typeof PATIENT_QUOTE_CLINIC_STATUSES)[number];

export const PATIENT_DOCUMENT_SECTION_KEYS = [
  "contacts",
  "medical_history",
  "medications",
  "allergies",
  "procedures",
  "smoking_alcohol",
  "treatment_consent",
  "photography",
  "privacy",
  "observer",
  "instructions",
  "transport",
  "finance",
] as const;

export type PatientDocumentSectionKey = (typeof PATIENT_DOCUMENT_SECTION_KEYS)[number];

export const PATIENT_DOCUMENT_SECTION_LABELS: Record<PatientDocumentSectionKey, string> = {
  contacts: "Emergency contacts",
  medical_history: "Medical history",
  medications: "Medications",
  allergies: "Allergies",
  procedures: "Previous procedures",
  smoking_alcohol: "Smoking and alcohol",
  treatment_consent: "Treatment consent",
  photography: "Photography consent",
  privacy: "Privacy acknowledgement",
  observer: "Observer consent",
  instructions: "Pre-surgery instructions",
  transport: "Transport arrangements",
  finance: "Financial acknowledgement",
};

export const PATIENT_DOCUMENT_PACKET_STATUSES = [
  "draft",
  "released",
  "in_progress",
  "pending_review",
  "accepted",
  "rejected_needs_correction",
  "signed",
  "completed",
] as const;

export type PatientDocumentPacketStatus = (typeof PATIENT_DOCUMENT_PACKET_STATUSES)[number];

export const PATIENT_DOCUMENT_SECTION_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "rejected",
] as const;

export type PatientDocumentSectionStatus = (typeof PATIENT_DOCUMENT_SECTION_STATUSES)[number];

export const PATIENT_PATHOLOGY_STATUSES = [
  "not_requested",
  "prepared",
  "issued",
  "awaiting_results",
  "results_received",
  "awaiting_clinical_review",
  "cleared",
  "follow_up_required",
] as const;

export type PatientPathologyStatus = (typeof PATIENT_PATHOLOGY_STATUSES)[number];

export const PATIENT_ACTION_DEEP_LINK_KEYS = [
  "quote",
  "deposit",
  "documents",
  "pathology",
  "appointments",
  "progress",
  "messages",
  "account",
  "actions",
] as const;

export type PatientActionDeepLinkKey = (typeof PATIENT_ACTION_DEEP_LINK_KEYS)[number];

export const PATIENT_ACTION_DEFAULT_TITLES: Record<PatientActionKind, string> = {
  review_quote: "Review your treatment quote",
  accept_quote: "Accept your quote",
  pay_deposit: "Pay your deposit",
  complete_blood_tests: "Complete your blood tests",
  sign_document: "Complete pre-surgery documents",
  upload_medications: "Upload your medication list",
  upload_preop_photos: "Upload pre-surgery photos",
  confirm_contacts: "Confirm your emergency contacts",
  await_treatment_plan: "Waiting on your treatment plan",
  await_pathology_review: "Waiting on clinical review of results",
  await_surgery_confirmation: "Waiting on surgery confirmation",
  await_medical_clearance: "Waiting on medical clearance",
  attend_appointment: "Attend your appointment",
  upload_images: "Upload progress photos",
  request_review: "Request a clinical review",
  none: "No action required",
};

export const QUOTE_ACCEPTED_FOLLOW_ON_ACTIONS = ["pay_deposit", "complete_blood_tests"] as const;

export const PATHOLOGY_NOTIFICATION_COPY = {
  blood_request_issued: {
    title: "Blood tests requested",
    body: "Your clinic has requested blood tests. Open the app for instructions.",
  },
  pathology_received_awaiting_review: {
    title: "Pathology results received",
    body: "Your pathology results have been received and are awaiting clinical review.",
  },
  pathology_cleared: {
    title: "Blood assessment complete",
    body: "Your pre-surgery blood assessment has been completed. No further action is currently required.",
  },
} as const;

/** Patient-facing incompleteness copy naming exact missing sections. */
export function formatMissingDocumentSections(
  missingKeys: readonly string[],
  labels: Record<string, string> = PATIENT_DOCUMENT_SECTION_LABELS
): string {
  const names = missingKeys
    .map((k) => labels[k] ?? k.replace(/_/g, " "))
    .filter((n) => n.trim().length > 0);
  if (names.length === 0) return "All required sections are complete.";
  if (names.length === 1) return `Please complete: ${names[0]}.`;
  if (names.length === 2) return `Please complete: ${names[0]} and ${names[1]}.`;
  const head = names.slice(0, -1).join(", ");
  const last = names[names.length - 1];
  return `Please complete: ${head}, and ${last}.`;
}

/** Bucket an action for Action Centre projections. */
export function bucketForPatientAction(input: {
  status: string;
  dueAt?: string | null;
  completedAt?: string | null;
  nowIso?: string;
}): PatientActionBucket {
  const status = String(input.status ?? "").trim();
  if (status === "completed" || status === "cancelled") return "recently_completed";
  if (status === "waiting_on_clinic" || status === "blocked") return "waiting_on_clinic";
  if (status === "open" || status === "in_progress") {
    const dueAt = input.dueAt?.trim() || null;
    if (dueAt) {
      const now = Date.parse(input.nowIso ?? new Date().toISOString());
      const due = Date.parse(dueAt);
      if (Number.isFinite(due) && Number.isFinite(now) && due > now + 48 * 60 * 60 * 1000) {
        return "upcoming";
      }
    }
    return "action_required";
  }
  return "action_required";
}

export function isPatientActionKind(value: unknown): value is PatientActionKind {
  return typeof value === "string" && (PATIENT_ACTION_KINDS as readonly string[]).includes(value);
}

export function isPatientJourneyMilestoneKey(value: unknown): value is PatientJourneyMilestoneKey {
  return (
    typeof value === "string" &&
    (PATIENT_JOURNEY_MILESTONE_KEYS as readonly string[]).includes(value)
  );
}

export function isPatientDocumentSectionKey(value: unknown): value is PatientDocumentSectionKey {
  return (
    typeof value === "string" &&
    (PATIENT_DOCUMENT_SECTION_KEYS as readonly string[]).includes(value)
  );
}