/**
 * CalendarOS V2 — quick view presets (pure, filter-only).
 */

import type { CalendarHrefQuery, ParsedCalendarQuery } from "@/src/lib/bookings/calendarQuery";

export const CALENDAR_OS_VIEW_PRESET_IDS = [
  "front_desk",
  "surgery_day",
  "consultations",
  "nursing",
  "rooms",
  "all_resources",
] as const;

export type CalendarOsViewPresetId = (typeof CALENDAR_OS_VIEW_PRESET_IDS)[number];

export type CalendarOsViewPreset = {
  id: CalendarOsViewPresetId;
  label: string;
  description: string;
  /** Partial URL query patch applied when selecting the preset. */
  patch: CalendarHrefQuery;
};

export const CALENDAR_OS_VIEW_PRESETS: CalendarOsViewPreset[] = [
  {
    id: "front_desk",
    label: "Front desk",
    description: "Day view — all staff, reception focus",
    patch: {
      view: "day",
      resourceView: "staff",
      type: null,
      role: null,
      staffId: null,
      roomId: null,
      unassigned: false,
    },
  },
  {
    id: "surgery_day",
    label: "Surgery day",
    description: "Day view — surgery bookings and theatre staff",
    patch: {
      view: "day",
      type: "surgery",
      resourceView: "staff",
      role: null,
      staffId: null,
      roomId: null,
    },
  },
  {
    id: "consultations",
    label: "Consultations",
    description: "Week view — consultation types",
    patch: {
      view: "week",
      type: "consultation",
      resourceView: "staff",
      role: null,
      staffId: null,
      roomId: null,
    },
  },
  {
    id: "nursing",
    label: "Nursing",
    description: "Week view — nurse role bucket",
    patch: {
      view: "week",
      role: "nurse",
      type: null,
      resourceView: "staff",
      staffId: null,
      roomId: null,
    },
  },
  {
    id: "rooms",
    label: "Rooms",
    description: "Day view — room columns",
    patch: {
      view: "day",
      resourceView: "room",
      type: null,
      role: null,
      staffId: null,
      roomId: null,
    },
  },
  {
    id: "all_resources",
    label: "All resources",
    description: "Week view — full staff roster",
    patch: {
      view: "week",
      resourceView: "staff",
      type: null,
      role: null,
      staffId: null,
      roomId: null,
      unassigned: false,
    },
  },
];

export function calendarOsViewPresetById(id: string): CalendarOsViewPreset | null {
  return CALENDAR_OS_VIEW_PRESETS.find((p) => p.id === id) ?? null;
}

function queryMatchesPresetPatch(query: ParsedCalendarQuery, preset: CalendarOsViewPreset): boolean {
  const p = preset.patch;
  if (p.view != null && query.view !== p.view) return false;
  if (p.resourceView != null && query.resourceView !== p.resourceView) return false;

  const typeCleared = p.type === null || p.type === "";
  const roleCleared = p.role === null || p.role === "";
  const staffCleared = p.staffId === null || p.staffId === "";
  const roomCleared = p.roomId === null || p.roomId === "";

  if (typeCleared) {
    if (query.bookingType) return false;
  } else if (p.type && query.bookingType !== p.type) {
    return false;
  }

  if (roleCleared) {
    if (query.staffRoleBucket) return false;
  } else if (p.role && query.staffRoleBucket !== p.role) {
    return false;
  }

  if (staffCleared && query.staffId) return false;
  if (roomCleared && query.roomId) return false;

  if (p.unassigned === false && query.unassignedOnly) return false;

  return true;
}

export function activeCalendarOsViewPresetId(
  query: ParsedCalendarQuery
): CalendarOsViewPresetId | null {
  for (const preset of CALENDAR_OS_VIEW_PRESETS) {
    if (queryMatchesPresetPatch(query, preset)) return preset.id;
  }
  return null;
}

export function calendarOsPresetPatch(presetId: CalendarOsViewPresetId): CalendarHrefQuery {
  const preset = calendarOsViewPresetById(presetId);
  if (!preset) return {};
  return preset.patch;
}
