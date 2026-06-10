/**
 * Clinic-facing date/time display by BCP 47 locale (separate from IANA scheduling timezone).
 * Internal storage and APIs remain ISO UTC; these helpers are display-only.
 */

import { fromDatetimeLocalValueInTimezone, normalizeCalendarTimezone, parseIsoUtcMs } from "@/src/lib/calendar/calendarTimezone";

export type ResolveClinicLocaleInput = {
  /** ISO 3166-1 alpha-2 (or UK) when known from clinic row or settings. */
  clinicCountry?: string | null;
  clinicMetadata?: Record<string, unknown> | null;
  tenantMetadata?: Record<string, unknown> | null;
  /**
   * When locale/country are unknown, `Australia/*` IANA zones imply `en-AU` (e.g. Evolved Perth
   * without explicit clinic metadata).
   */
  calendarTimezone?: string | null;
};

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

function readLocaleFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null;
  const raw = meta.locale ?? meta.display_locale;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  try {
    new Intl.DateTimeFormat(t).format(new Date(0));
    return t;
  } catch {
    return null;
  }
}

function readCountryFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null;
  const keys = ["country", "country_region", "tax_country_region", "country_code"] as const;
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function localeFromCountryCode(code: string | null | undefined): string | null {
  const c = code?.trim().toUpperCase();
  if (!c) return null;
  if (c === "AU") return "en-AU";
  if (c === "IN") return "en-IN";
  if (c === "GB" || c === "UK") return "en-GB";
  if (c === "US") return "en-US";
  return null;
}

/**
 * Resolves a BCP 47 locale for clinic UI (dates/times), independent of {@link normalizeCalendarTimezone}.
 *
 * Precedence: explicit `locale` / `display_locale` in clinic metadata → tenant metadata →
 * country code from `clinicCountry` field or metadata keys on clinic/tenant →
 * `en-AU` when {@link ResolveClinicLocaleInput.calendarTimezone} starts with `Australia/` →
 * default `en-GB`.
 */
export function resolveClinicLocale(input: ResolveClinicLocaleInput): string {
  const fromClinicMeta = readLocaleFromMetadata(input.clinicMetadata ?? null);
  if (fromClinicMeta) return fromClinicMeta;
  const fromTenantMeta = readLocaleFromMetadata(input.tenantMetadata ?? null);
  if (fromTenantMeta) return fromTenantMeta;

  const explicitCountry = input.clinicCountry?.trim();
  const fromCountry =
    localeFromCountryCode(explicitCountry) ??
    localeFromCountryCode(readCountryFromMetadata(input.clinicMetadata ?? null)) ??
    localeFromCountryCode(readCountryFromMetadata(input.tenantMetadata ?? null));
  if (fromCountry) return fromCountry;

  const tz = input.calendarTimezone?.trim() ?? "";
  if (tz.startsWith("Australia/")) return "en-AU";

  return "en-GB";
}

/** UTC noon on a calendar day key — stable weekday/month labels across zones. */
function utcNoonForDayKey(dayKey: string): Date | null {
  const m = DAY_KEY.exec(dayKey.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (![y, mo, d].every((x) => Number.isFinite(x))) return null;
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
}

function parseDayKeyOrPrefix(input: string): string | null {
  const t = input.trim();
  const m = DAY_KEY.exec(t);
  if (m) return m[0]!;
  const m2 = /^(\d{4}-\d{2}-\d{2})T/.exec(t);
  return m2 ? m2[1]! : null;
}

/** Short numeric date (e.g. en-AU dd/mm/yyyy, en-US mm/dd/yyyy). `dateIsoOrLocal` should be `YYYY-MM-DD` or start with it. */
export function formatClinicDate(dateIsoOrLocal: string, locale: string): string {
  const dayKey = parseDayKeyOrPrefix(dateIsoOrLocal);
  if (!dayKey) return dateIsoOrLocal.trim();
  const d = utcNoonForDayKey(dayKey);
  if (!d) return dateIsoOrLocal.trim();
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Long weekday date in the given locale (calendar day from `YYYY-MM-DD` prefix). */
export function formatClinicLongDate(dateIsoOrLocal: string, locale: string): string {
  const dayKey = parseDayKeyOrPrefix(dateIsoOrLocal);
  if (!dayKey) return dateIsoOrLocal.trim();
  const d = utcNoonForDayKey(dayKey);
  if (!d) return dateIsoOrLocal.trim();
  let s = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  // en-AU / en-GB often emit "Wednesday 10 June …"; Quick Book spec prefers a comma after weekday.
  // Avoid `\p{L}` (needs ES2018+ for TS); `[^\d\s,]+` matches the weekday token for typical locale output.
  s = s.replace(/^([^\d\s,]+)\s+(\d)/, "$1, $2");
  return s;
}

function normalizeWallDatetimeLocal(local: string): string {
  const t = local.trim();
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2}(?:\.\d{1,3})?)?$/.exec(t);
  return m ? m[1]! : t;
}

function wallLooksLikeDatetimeLocal(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s.trim()) && !/[zZ]$/.test(s.trim()) && !/[+-]\d{2}:?\d{2}$/.test(s.trim());
}

/**
 * Formats a clock time for the clinic zone. Accepts UTC ISO instants or clinic-wall `YYYY-MM-DDTHH:mm`
 * (interpreted with `timeZone`).
 */
export function formatClinicTime(isoOrWallLocal: string, locale: string, timeZone: string): string {
  const tz = normalizeCalendarTimezone(timeZone);
  const raw = isoOrWallLocal.trim();
  let ms: number | null = null;
  if (wallLooksLikeDatetimeLocal(raw)) {
    const wall = normalizeWallDatetimeLocal(raw);
    const iso = fromDatetimeLocalValueInTimezone(wall, tz);
    ms = iso ? parseIsoUtcMs(iso) : null;
  } else {
    ms = parseIsoUtcMs(raw);
  }
  if (ms == null) return "";
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

/** Two times in the same locale and zone, e.g. `4:00 pm – 4:45 pm`. */
export function formatClinicDateTimeRange(start: string, end: string, locale: string, timeZone: string): string {
  const a = formatClinicTime(start, locale, timeZone);
  const b = formatClinicTime(end, locale, timeZone);
  if (!a || !b) return a || b || "";
  return `${a} – ${b}`;
}
