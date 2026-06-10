export type StaffPinClinicSession = {
  tenantId: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  sessionToken: string;
  expiresAt: string;
};

export type StaffPinClinicAction =
  | "calendar.view"
  | "calendar.quick_book"
  | "patient.check_in"
  | "reception.board_flow"
  | "appointment.notes"
  | "tasks.view_assigned"
  | "patient.appointment_context"
  | "settings.any"
  | "services.pricing"
  | "staff.manage"
  | "tax.settings"
  | "admin.dashboard"
  | "data.export"
  | "prescriptions.send"
  | "records.delete"
  | "platform.admin";

const PIN_ALLOWED_ACTIONS = new Set<StaffPinClinicAction>([
  "calendar.view",
  "calendar.quick_book",
  "patient.check_in",
  "reception.board_flow",
  "appointment.notes",
  "tasks.view_assigned",
  "patient.appointment_context",
]);

const PIN_RESTRICTED_ROUTE_PREFIXES = [
  "/settings",
  "/configuration",
  "/system-status",
  "/audit",
  "/prescriptions",
  "/medication-reorders",
  "/services",
  "/staff",
  "/analytics",
  "/doctor",
  "/cases",
  "/crm",
  "/hr/",
] as const;

export function canUseStaffPinClinicSession(
  session: StaffPinClinicSession | null | undefined,
  action: StaffPinClinicAction
): boolean {
  if (!session) return false;
  if (!session.tenantId?.trim() || !session.staffId?.trim()) return false;
  if (new Date(session.expiresAt).getTime() <= Date.now()) return false;
  return PIN_ALLOWED_ACTIONS.has(action);
}

export function isStaffPinRestrictedRoute(pathname: string, tenantBase: string): boolean {
  const path = pathname.trim();
  if (!path.startsWith(tenantBase)) return true;
  const suffix = path.slice(tenantBase.length) || "/";
  if (suffix === "/" || suffix === "") return false;
  return PIN_RESTRICTED_ROUTE_PREFIXES.some((prefix) => suffix === prefix || suffix.startsWith(`${prefix}/`));
}

export function staffPinSessionIsExpired(session: StaffPinClinicSession): boolean {
  return new Date(session.expiresAt).getTime() <= Date.now();
}
