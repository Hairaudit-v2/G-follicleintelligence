export const APPOINTMENT_DETAIL_TABS = [
  "overview",
  "clinical",
  "procedure",
  "timeline",
  "photos",
  "billing",
  "post_op",
] as const;

export type AppointmentDetailTabId = (typeof APPOINTMENT_DETAIL_TABS)[number];

const TAB_SET = new Set<string>(APPOINTMENT_DETAIL_TABS);

export const APPOINTMENT_DETAIL_TAB_LABELS: Record<AppointmentDetailTabId, string> = {
  overview: "Overview",
  clinical: "Clinical notes",
  procedure: "Procedure",
  timeline: "Timeline",
  photos: "Photos",
  billing: "Invoice preview",
  post_op: "Post-procedure plan",
};

export function parseAppointmentDetailTab(
  raw: string | string[] | undefined
): AppointmentDetailTabId {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const t = v?.trim().toLowerCase();
  if (t && TAB_SET.has(t)) return t as AppointmentDetailTabId;
  return "overview";
}
