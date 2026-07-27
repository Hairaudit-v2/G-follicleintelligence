/**
 * FI-PATIENT-APP-1F — provider-neutral notification preferences + policy (pure).
 *
 * Optional channels respect preferences. Transactional/safety events remain allowed
 * even when marketing-style optional channels are opted out.
 */

export const PATIENT_GATEWAY_NOTIFICATION_CHANNELS = ["email", "sms", "push"] as const;
export type PatientGatewayNotificationChannel =
  (typeof PATIENT_GATEWAY_NOTIFICATION_CHANNELS)[number];

export const PATIENT_GATEWAY_NOTIFICATION_EVENTS = [
  "new_message",
  "appointment_upcoming",
  "appointment_changed",
  "images_due",
  "invoice_due",
  "payment_received",
  "review_due",
] as const;

export type PatientGatewayNotificationEvent =
  (typeof PATIENT_GATEWAY_NOTIFICATION_EVENTS)[number];

export type PatientGatewayNotificationPreferences = {
  email: boolean;
  sms: boolean;
  push: boolean;
  appointmentReminders: boolean;
  journeyReminders: boolean;
  billingNotifications: boolean;
  messageNotifications: boolean;
};

/** Events that must not be blocked by optional marketing/reminder opt-outs. */
export const TRANSACTIONAL_NOTIFICATION_EVENTS: readonly PatientGatewayNotificationEvent[] = [
  "appointment_changed",
  "payment_received",
] as const;

export const DEFAULT_PATIENT_GATEWAY_NOTIFICATION_PREFERENCES: PatientGatewayNotificationPreferences =
  {
    email: true,
    sms: true,
    push: false,
    appointmentReminders: true,
    journeyReminders: true,
    billingNotifications: true,
    messageNotifications: true,
  };

export const NOTIFICATION_PREFERENCES_METADATA_KEY =
  "patient_gateway_notification_preferences" as const;

export function normalizeNotificationPreferences(
  raw: unknown
): PatientGatewayNotificationPreferences {
  const base = { ...DEFAULT_PATIENT_GATEWAY_NOTIFICATION_PREFERENCES };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof PatientGatewayNotificationPreferences)[]) {
    if (typeof o[key] === "boolean") base[key] = o[key] as boolean;
  }
  return base;
}

/**
 * Merge patient-allowed preference patch. Unknown keys ignored.
 * Does not accept disabling transactional policy at this layer — that is enforced
 * at dispatch via `isTransactionalNotificationEvent`.
 */
export function applyNotificationPreferencesPatch(
  current: PatientGatewayNotificationPreferences,
  patch: Record<string, unknown>
): PatientGatewayNotificationPreferences {
  const next = { ...current };
  for (const key of Object.keys(next) as (keyof PatientGatewayNotificationPreferences)[]) {
    if (typeof patch[key] === "boolean") next[key] = patch[key] as boolean;
  }
  return next;
}

export function isTransactionalNotificationEvent(
  event: PatientGatewayNotificationEvent
): boolean {
  return (TRANSACTIONAL_NOTIFICATION_EVENTS as readonly string[]).includes(event);
}

export type NotificationDispatchDecision = {
  event: PatientGatewayNotificationEvent;
  channels: PatientGatewayNotificationChannel[];
  preview: string;
  transactional: boolean;
  skippedReason: string | null;
};

/** Privacy-safe previews — never embed clinical detail. */
export function buildPrivacySafeNotificationPreview(
  event: PatientGatewayNotificationEvent
): string {
  switch (event) {
    case "new_message":
      return "New message from your clinical team.";
    case "appointment_upcoming":
    case "appointment_changed":
      return "You have an appointment update in Follicle Intelligence.";
    case "images_due":
    case "review_due":
      return "You have an update in Follicle Intelligence.";
    case "invoice_due":
    case "payment_received":
      return "You have a billing update in Follicle Intelligence.";
  }
}

/**
 * Provider-neutral channel selection from preferences + transactional rules.
 * Push may be selected but remain inactive until a later provider adapter.
 */
export function decideNotificationDispatch(input: {
  event: PatientGatewayNotificationEvent;
  preferences: PatientGatewayNotificationPreferences;
}): NotificationDispatchDecision {
  const transactional = isTransactionalNotificationEvent(input.event);
  const prefs = input.preferences;
  const channels: PatientGatewayNotificationChannel[] = [];

  const categoryAllowed = (() => {
    switch (input.event) {
      case "new_message":
        return transactional || prefs.messageNotifications;
      case "appointment_upcoming":
      case "appointment_changed":
        return transactional || prefs.appointmentReminders;
      case "images_due":
      case "review_due":
        return transactional || prefs.journeyReminders;
      case "invoice_due":
      case "payment_received":
        return transactional || prefs.billingNotifications;
    }
  })();

  if (!categoryAllowed) {
    return {
      event: input.event,
      channels: [],
      preview: buildPrivacySafeNotificationPreview(input.event),
      transactional,
      skippedReason: "category_opt_out",
    };
  }

  if (prefs.email) channels.push("email");
  if (prefs.sms) channels.push("sms");
  if (prefs.push) channels.push("push");

  // Transactional fallback: if patient opted out of all channels, still keep email
  // for required events (appointment changes / payment receipts).
  if (transactional && channels.length === 0) {
    channels.push("email");
  }

  return {
    event: input.event,
    channels,
    preview: buildPrivacySafeNotificationPreview(input.event),
    transactional,
    skippedReason: channels.length === 0 ? "no_channels" : null,
  };
}

/**
 * Derive baseline channel toggles from FiOS reminder_consent + preferred_contact_method
 * when gateway preferences have never been saved.
 */
export function seedPreferencesFromPatientContact(input: {
  reminderConsent: boolean | null | undefined;
  preferredContactMethod: string | null | undefined;
  stored: unknown;
}): PatientGatewayNotificationPreferences {
  const stored = normalizeNotificationPreferences(input.stored);
  if (input.stored && typeof input.stored === "object") return stored;

  const method = (input.preferredContactMethod ?? "").trim().toLowerCase();
  const consent = Boolean(input.reminderConsent);
  return {
    ...stored,
    email: method === "email" || method === "both" || method === "" ? true : consent,
    sms: method === "sms" || method === "both" ? true : false,
    appointmentReminders: consent,
    journeyReminders: consent,
  };
}
