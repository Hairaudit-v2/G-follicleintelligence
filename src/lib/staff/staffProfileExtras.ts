/**
 * Optional profile fields stored under `fi_staff.working_hours._profile` (JSON object).
 * Keeps weekly hours and admin-editable profile extras in one column without a migration.
 */

export type StaffProfileExtras = {
  position_title: string | null;
  primary_clinic_id: string | null;
};

const PROFILE_KEY = "_profile";

function isObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

export function parseStaffProfileExtras(
  workingHours: Record<string, unknown> | null | undefined
): StaffProfileExtras {
  if (!isObject(workingHours)) {
    return { position_title: null, primary_clinic_id: null };
  }
  const raw = workingHours[PROFILE_KEY];
  if (!isObject(raw)) {
    return { position_title: null, primary_clinic_id: null };
  }
  const title = raw.position_title != null ? String(raw.position_title).trim() : "";
  const clinic = raw.primary_clinic_id != null ? String(raw.primary_clinic_id).trim() : "";
  return {
    position_title: title || null,
    primary_clinic_id: clinic || null,
  };
}

export function mergeStaffWorkingHoursDocument(
  weeklyDoc: Record<string, unknown>,
  extras: StaffProfileExtras,
  existingWorkingHours?: Record<string, unknown> | null
): Record<string, unknown> {
  const base = isObject(existingWorkingHours) ? { ...existingWorkingHours } : {};
  const out: Record<string, unknown> = { ...base, ...weeklyDoc };
  const profile: Record<string, unknown> = {};
  if (extras.position_title?.trim()) profile.position_title = extras.position_title.trim();
  if (extras.primary_clinic_id?.trim()) profile.primary_clinic_id = extras.primary_clinic_id.trim();
  if (Object.keys(profile).length > 0) {
    out[PROFILE_KEY] = profile;
  } else {
    delete out[PROFILE_KEY];
  }
  return out;
}
