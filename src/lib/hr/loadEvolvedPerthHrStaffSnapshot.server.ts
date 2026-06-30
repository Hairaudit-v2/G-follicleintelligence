import "server-only";

import type { IiohrHrPortalStaffRecord } from "@/src/lib/hr/iiohrFiStaffSyncMapper";

function optionalCount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Loads Evolved Hair Restoration Perth staff rows from the IIOHR HR portal export feed.
 *
 * Configure `IIOHR_HR_PERTH_STAFF_FEED_URL` (GET) to return JSON:
 * `{ "staff": [ ... ] }`, `{ "rows": [ ... ] }`, or a bare array of `IiohrHrPortalStaffRecord`-shaped objects.
 *
 * Optional `IIOHR_HR_PERTH_STAFF_FEED_KEY` sets `Authorization: Bearer <key>`.
 */
export async function loadEvolvedPerthHrStaffRecordsForFiPush(): Promise<
  IiohrHrPortalStaffRecord[]
> {
  const url = process.env.IIOHR_HR_PERTH_STAFF_FEED_URL?.trim();
  if (!url) {
    throw new Error(
      "Evolved Perth HR staff feed is not configured. Set IIOHR_HR_PERTH_STAFF_FEED_URL to the IIOHR HR JSON export endpoint for Perth staff."
    );
  }

  const key = process.env.IIOHR_HR_PERTH_STAFF_FEED_KEY?.trim();
  const headers: Record<string, string> = { accept: "application/json" };
  if (key) headers.authorization = `Bearer ${key}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25_000);
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }

  if (!res.ok) {
    throw new Error(`HR staff feed request failed (${res.status}).`);
  }

  const parsed = (await res.json().catch(() => null)) as unknown;
  let raw: unknown[] = [];
  if (Array.isArray(parsed)) {
    raw = parsed;
  } else if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if (Array.isArray(o.staff)) raw = o.staff as unknown[];
    else if (Array.isArray(o.rows)) raw = o.rows as unknown[];
  }

  const out: IiohrHrPortalStaffRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const r = item as Record<string, unknown>;
    const external_staff_id = String(r.external_staff_id ?? "").trim();
    const full_name = String(r.full_name ?? "").trim();
    if (!external_staff_id || !full_name) continue;
    out.push({
      external_staff_id,
      iiohr_user_id: r.iiohr_user_id != null ? String(r.iiohr_user_id).trim() || null : null,
      full_name,
      email: r.email != null ? String(r.email).trim() : null,
      staff_role: r.staff_role != null ? String(r.staff_role).trim() : null,
      employment_status: r.employment_status != null ? String(r.employment_status).trim() : null,
      employment_type: r.employment_type != null ? String(r.employment_type).trim() : null,
      source_url: r.source_url != null ? String(r.source_url).trim() : null,
      default_timezone: r.default_timezone != null ? String(r.default_timezone).trim() : null,
      working_hours: r.working_hours,
      clinic_name: r.clinic_name != null ? String(r.clinic_name).trim() : null,
      role_label: r.role_label != null ? String(r.role_label).trim() : null,
      compliance_summary: r.compliance_summary != null ? String(r.compliance_summary) : null,
      training_summary: r.training_summary != null ? String(r.training_summary) : null,
      last_hr_updated_at: r.last_hr_updated_at != null ? String(r.last_hr_updated_at).trim() : null,
      onboarding_status: r.onboarding_status != null ? String(r.onboarding_status).trim() : null,
      onboarding_completed_at:
        r.onboarding_completed_at != null ? String(r.onboarding_completed_at).trim() : null,
      required_documents_missing_count: optionalCount(r.required_documents_missing_count),
      training_required_count: optionalCount(r.training_required_count),
      certificates_outstanding_count: optionalCount(r.certificates_outstanding_count),
      hr_profile_url: r.hr_profile_url != null ? String(r.hr_profile_url).trim() : null,
    });
  }
  return out;
}
