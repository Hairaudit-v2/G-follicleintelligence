/**
 * FI-CALENDAR-WRITEBACK-1A — calendar / appointment capability keys.
 *
 * These are finer-grained than the global `canMutateBookings` gate.
 * Broad admin access must not be the only check.
 */

export const CALENDAR_APPOINTMENT_CAPABILITIES = [
  "calendar.view",
  "appointment.edit",
  "appointment.reschedule",
  "appointment.assign_resources",
  "appointment.link_patient",
  "appointment.convert_external",
  "calendar.google_writeback",
  "appointment.override_lock",
] as const;

export type CalendarAppointmentCapability = (typeof CALENDAR_APPOINTMENT_CAPABILITIES)[number];

export type CalendarAppointmentCapabilitySet = ReadonlySet<CalendarAppointmentCapability>;

export type CalendarCapabilityContext = {
  /** Signed-in operator can view the calendar. */
  canView: boolean;
  /** Global ClinicOS mutation gate (`canMutateBookings`). */
  canMutateBookings: boolean;
  /** Tenant has Google Calendar write credentials / integration ready. */
  googleWritebackReady: boolean;
  /**
   * Elevated operator (clinic/operations/platform admin) — convert external + override lock.
   * Ordinary booking mutators do not get these by default.
   */
  isElevatedOperator: boolean;
};

const VIEW_ONLY: CalendarAppointmentCapability[] = ["calendar.view"];

const MUTATION_BASE: CalendarAppointmentCapability[] = [
  "calendar.view",
  "appointment.edit",
  "appointment.reschedule",
  "appointment.assign_resources",
  "appointment.link_patient",
];

/** Resolve which calendar capabilities the current operator has for this tenant. */
export function resolveCalendarAppointmentCapabilities(
  ctx: CalendarCapabilityContext
): CalendarAppointmentCapabilitySet {
  if (!ctx.canView) {
    return new Set();
  }

  const caps = new Set<CalendarAppointmentCapability>(VIEW_ONLY);

  if (!ctx.canMutateBookings) {
    return caps;
  }

  for (const c of MUTATION_BASE) caps.add(c);

  if (ctx.googleWritebackReady) {
    caps.add("calendar.google_writeback");
  }

  if (ctx.isElevatedOperator) {
    caps.add("appointment.convert_external");
    caps.add("appointment.override_lock");
  }

  return caps;
}

export function calendarCapabilitySatisfies(
  caps: CalendarAppointmentCapabilitySet | Iterable<CalendarAppointmentCapability>,
  required: CalendarAppointmentCapability
): boolean {
  const set = caps instanceof Set ? caps : new Set(caps);
  return set.has(required);
}

/** Serialize for page DTOs (stable sorted array). */
export function serializeCalendarCapabilities(
  caps: CalendarAppointmentCapabilitySet
): CalendarAppointmentCapability[] {
  return CALENDAR_APPOINTMENT_CAPABILITIES.filter((c) => caps.has(c));
}

export function calendarCapabilitiesFromSerialized(
  list: readonly CalendarAppointmentCapability[] | null | undefined
): CalendarAppointmentCapabilitySet {
  return new Set(list ?? []);
}
