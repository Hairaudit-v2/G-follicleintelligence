/**
 * Optional profile fields stored under `fi_staff.working_hours._profile` (JSON object).
 * Keeps weekly hours and admin-editable profile extras in one column without a migration.
 */

export type StaffProfileExtras = {
  position_title: string | null;
  primary_clinic_id: string | null;
  /** Additional clinic memberships stored under `_profile.additional_clinic_ids`. */
  additional_clinic_ids: string[];
};

const PROFILE_KEY = "_profile";

function isObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function parseClinicIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const id = String(item ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function parseStaffProfileExtras(
  workingHours: Record<string, unknown> | null | undefined
): StaffProfileExtras {
  if (!isObject(workingHours)) {
    return { position_title: null, primary_clinic_id: null, additional_clinic_ids: [] };
  }
  const raw = workingHours[PROFILE_KEY];
  if (!isObject(raw)) {
    return { position_title: null, primary_clinic_id: null, additional_clinic_ids: [] };
  }
  const title = raw.position_title != null ? String(raw.position_title).trim() : "";
  const clinic = raw.primary_clinic_id != null ? String(raw.primary_clinic_id).trim() : "";
  const additional = parseClinicIdList(
    raw.additional_clinic_ids ?? raw.clinic_ids ?? raw.clinicIds
  );
  return {
    position_title: title || null,
    primary_clinic_id: clinic || null,
    additional_clinic_ids: additional.filter((id) => id !== clinic),
  };
}

/** Primary + additional memberships (deduped, primary first). */
export function staffClinicMembershipIds(extras: StaffProfileExtras): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of [extras.primary_clinic_id, ...extras.additional_clinic_ids]) {
    const t = id?.trim() || "";
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
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
  if (extras.additional_clinic_ids?.length) {
    profile.additional_clinic_ids = extras.additional_clinic_ids
      .map((id) => id.trim())
      .filter(Boolean);
  }
  if (Object.keys(profile).length > 0) {
    out[PROFILE_KEY] = profile;
  } else {
    delete out[PROFILE_KEY];
  }
  return out;
}
