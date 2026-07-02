/**
 * FI Platform Event Bus — canonical event registry (GC-10).
 * Extend when adding new OS module publishers; bump per-event version when payload contracts change.
 */

export const FI_SOURCE_MODULES = [
  "calendar_os",
  "leadflow",
  "patient_os",
  "surgery_os",
  "financial_os",
  "workforce_os",
  "analytics_os",
  "audit_os",
  "academy_os",
  "platform_core",
] as const;

export type FiSourceModule = (typeof FI_SOURCE_MODULES)[number];

/** CalendarOS events — actively emitted in GC-10. */
export const CALENDAR_OS_EVENTS = {
  "calendar.event.created": 1,
  "calendar.event.updated": 1,
  "calendar.event.cancelled": 1,
  "calendar.event.deleted": 1,
  "calendar.sync.started": 1,
  "calendar.sync.completed": 1,
  "calendar.sync.failed": 1,
  "calendar.webhook.received": 1,
  "calendar.webhook.subscription.created": 1,
  "calendar.webhook.subscription.renewed": 1,
  "calendar.webhook.subscription.expired": 1,
  "calendar.reconciliation.conflict_detected": 1,
  "calendar.review_item.created": 1,
} as const;

/** Future module placeholders — registered but not wired yet. */
export const FUTURE_FI_EVENTS = {
  "lead.created": 1,
  "lead.converted": 1,
  "patient.created": 1,
  "consultation.booked": 1,
  "payment.received": 1,
  "surgery.booked": 1,
  "surgery.completed": 1,
  "staff.readiness.updated": 1,
  "audit.completed": 1,
  "staff.uat.feedback": 1,
  "staff.uat.friction": 1,
} as const;

export const FI_EVENT_REGISTRY = {
  ...CALENDAR_OS_EVENTS,
  ...FUTURE_FI_EVENTS,
} as const;

export type FiEventName = keyof typeof FI_EVENT_REGISTRY;

export type FiEventProcessingStatus = "pending" | "processing" | "processed" | "failed" | "ignored";

export type FiEventDeliveryStatus = "pending" | "processing" | "delivered" | "failed" | "skipped";

const EVENT_NAME_SET = new Set<string>(Object.keys(FI_EVENT_REGISTRY));

export function isFiEventName(value: string): value is FiEventName {
  return EVENT_NAME_SET.has(value.trim());
}

export function getFiEventVersion(eventName: FiEventName): number {
  return FI_EVENT_REGISTRY[eventName];
}

export function isCalendarOsEventName(value: string): value is keyof typeof CALENDAR_OS_EVENTS {
  return value in CALENDAR_OS_EVENTS;
}

export function listCalendarOsEventNames(): (keyof typeof CALENDAR_OS_EVENTS)[] {
  return Object.keys(CALENDAR_OS_EVENTS) as (keyof typeof CALENDAR_OS_EVENTS)[];
}

export function listFutureFiEventNames(): (keyof typeof FUTURE_FI_EVENTS)[] {
  return Object.keys(FUTURE_FI_EVENTS) as (keyof typeof FUTURE_FI_EVENTS)[];
}
