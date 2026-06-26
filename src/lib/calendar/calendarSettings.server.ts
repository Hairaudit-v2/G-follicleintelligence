import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  calendarSettingsDocumentToRowPayload,
  DEFAULT_CALENDAR_SETTINGS,
  mergeCalendarSettingsFromStorage,
  type FiCalendarSettingsDocument,
} from "@/src/lib/calendar/calendarSettingsCore";

const SETTINGS_SELECT =
  "day_start_hour, day_end_hour, slot_minutes, default_view, show_weekends, buffer_minutes, resource_column_mode, show_cancelled_bookings";

async function loadCalendarSettingsRow(opts: {
  tenantId: string;
  clinicId: string | null;
}): Promise<FiCalendarSettingsDocument | null> {
  const tid = opts.tenantId.trim();
  const cid = opts.clinicId?.trim() || null;
  const supabase = supabaseAdmin();
  let q = supabase.from("fi_calendar_settings").select(SETTINGS_SELECT).eq("tenant_id", tid);
  q = cid ? q.eq("clinic_id", cid) : q.is("clinic_id", null);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mergeCalendarSettingsFromStorage(
    data as {
      day_start_hour: number;
      day_end_hour: number;
      slot_minutes: number;
      default_view: string;
      show_weekends: boolean;
      buffer_minutes: number;
      resource_column_mode: string;
      show_cancelled_bookings: boolean;
    }
  );
}

/**
 * Effective calendar display settings: clinic row → tenant default row → null (caller applies defaults / legacy).
 */
export async function getCalendarSettingsForTenant(
  tenantId: string,
  clinicId?: string | null
): Promise<FiCalendarSettingsDocument> {
  const resolved = await resolveCalendarSettingsForScope(tenantId, clinicId);
  return resolved ?? { ...DEFAULT_CALENDAR_SETTINGS };
}

/** Returns stored settings when a row exists; null when falling back to hard defaults / legacy metadata. */
export async function resolveCalendarSettingsForScope(
  tenantId: string,
  clinicId?: string | null
): Promise<FiCalendarSettingsDocument | null> {
  const tid = tenantId.trim();
  const cid = clinicId?.trim() || null;

  if (cid) {
    const clinicDoc = await loadCalendarSettingsRow({ tenantId: tid, clinicId: cid });
    if (clinicDoc) return clinicDoc;
  }

  const tenantDoc = await loadCalendarSettingsRow({ tenantId: tid, clinicId: null });
  if (tenantDoc) return tenantDoc;

  return null;
}

export async function upsertCalendarSettings(opts: {
  tenantId: string;
  clinicId: string | null;
  document: FiCalendarSettingsDocument;
}): Promise<void> {
  const tid = opts.tenantId.trim();
  const cid = opts.clinicId?.trim() || null;
  const payload = calendarSettingsDocumentToRowPayload(tid, cid, opts.document);
  const supabase = supabaseAdmin();

  let existing = supabase.from("fi_calendar_settings").select("id").eq("tenant_id", tid);
  existing = cid ? existing.eq("clinic_id", cid) : existing.is("clinic_id", null);
  const { data: row, error: findErr } = await existing.maybeSingle();
  if (findErr) throw new Error(findErr.message);

  if (row) {
    const { error: upErr } = await supabase
      .from("fi_calendar_settings")
      .update(payload)
      .eq("id", String((row as { id: string }).id));
    if (upErr) throw new Error(upErr.message);
    return;
  }

  const { error: insErr } = await supabase.from("fi_calendar_settings").insert({
    ...payload,
    created_at: new Date().toISOString(),
  });
  if (insErr) throw new Error(insErr.message);
}

export async function loadClinicsForCalendarSettings(tenantId: string): Promise<
  { id: string; displayName: string }[]
> {
  const tid = tenantId.trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id, display_name")
    .eq("tenant_id", tid)
    .order("display_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: String((r as { id: string }).id),
    displayName: String((r as { display_name: string }).display_name ?? ""),
  }));
}

export type CalendarSettingsSectionData = {
  clinicId: string | null;
  clinics: { id: string; displayName: string }[];
  initialSettings: FiCalendarSettingsDocument;
  canEdit: boolean;
};

function resolveCalendarSettingsClinicId(
  clinicIdParam: string | null,
  clinics: { id: string; displayName: string }[]
): string | null {
  if (!clinicIdParam?.trim()) return null;
  const cid = clinicIdParam.trim();
  return clinics.some((c) => c.id === cid) ? cid : null;
}

/** Shared loader for standalone calendar settings route and Configuration → Calendar tab. */
export async function loadCalendarSettingsSectionData(
  tenantId: string,
  clinicIdParam: string | null,
  access: { canEdit: boolean }
): Promise<CalendarSettingsSectionData> {
  const clinics = await loadClinicsForCalendarSettings(tenantId);
  const clinicId = resolveCalendarSettingsClinicId(clinicIdParam, clinics);
  const initialSettings = await getCalendarSettingsForTenant(tenantId, clinicId);
  return {
    clinicId,
    clinics,
    initialSettings,
    canEdit: access.canEdit,
  };
}
