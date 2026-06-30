/**
 * Read-only Timely REST API client (server-only — TIMELY_API_KEY must never reach client code).
 *
 * Scope of this module (Probe phase):
 *   - Authenticate to the Timely API with TIMELY_API_KEY.
 *   - Fetch services and appointments/bookings for inspection.
 *   - NEVER mutate Timely (GET only — `timelyApiGet` is the single transport and hard-codes GET).
 *
 * This is deliberately conservative because the exact Timely API contract for this account is not
 * yet confirmed. Endpoint paths, auth scheme, and response shapes are marked with TODOs below and
 * are surfaced as actionable errors by `scripts/timely-api-probe.ts` rather than guessed silently.
 *
 * Security invariants:
 *   - The API key is read from process.env only; it is never returned, never embedded in error
 *     messages, and never logged. Errors carry HTTP status + endpoint path only.
 *   - Nothing here is `NEXT_PUBLIC_*`; importing this into client code would leak the key, so don't.
 */

export const TIMELY_API_ENV = {
  apiKey: "TIMELY_API_KEY",
  baseUrl: "TIMELY_API_BASE_URL",
} as const;

/**
 * Timely API endpoint paths (relative to TIMELY_API_BASE_URL).
 *
 * TODO(timely-api): Confirm these against the Timely API documentation for this account/region.
 * Timely (gettimely.com) commonly exposes `/services`, `/staff`, `/customers`, and refers to
 * appointments as "bookings" (`/bookings`). If your account differs, update these constants — the
 * probe will tell you exactly which path returned a non-2xx/non-JSON response.
 */
export const TIMELY_API_ENDPOINTS = {
  /** TODO(timely-api): confirm — lightweight call used purely to verify auth works. */
  authProbe: "/services",
  /** TODO(timely-api): confirm — service catalogue. */
  services: "/services",
  /** TODO(timely-api): confirm — appointments are typically "bookings" in Timely. */
  appointments: "/bookings",
  /** TODO(timely-api): confirm — staff/practitioners. */
  staff: "/staff",
} as const;

export type TimelyApiConfig = {
  apiKey: string;
  baseUrl: string;
};

export type ResolveTimelyApiConfigResult =
  | { ok: true; config: TimelyApiConfig }
  | { ok: false; missing: string[] };

/** Resolve client config from the environment without throwing or exposing the key. */
export function resolveTimelyApiConfig(
  env: NodeJS.ProcessEnv = process.env
): ResolveTimelyApiConfigResult {
  const apiKey = env[TIMELY_API_ENV.apiKey]?.trim();
  const baseUrl = env[TIMELY_API_ENV.baseUrl]?.trim();

  const missing: string[] = [];
  if (!apiKey) missing.push(TIMELY_API_ENV.apiKey);
  if (!baseUrl) missing.push(TIMELY_API_ENV.baseUrl);
  if (missing.length > 0) return { ok: false, missing };

  return {
    ok: true,
    config: { apiKey: apiKey!, baseUrl: baseUrl!.replace(/\/+$/, "") },
  };
}

/** Error from a Timely API call. Carries status + endpoint only — never the key or payload secrets. */
export class TimelyApiError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly status?: number,
    public readonly kind: "auth" | "not_found" | "http" | "network" | "parse" = "http"
  ) {
    super(message);
    this.name = "TimelyApiError";
  }
}

/**
 * Build the auth headers for a Timely API request.
 *
 * TODO(timely-api): Confirm the auth scheme for this account. This sends a standard
 * `Authorization: Bearer <TIMELY_API_KEY>`. If Timely requires OAuth2 access tokens or a custom
 * header (e.g. `Gettimely-Api-Key`), adjust here — do not log or echo the key while doing so.
 */
function buildAuthHeaders(config: TimelyApiConfig): Record<string, string> {
  return {
    accept: "application/json",
    authorization: `Bearer ${config.apiKey}`,
  };
}

const DEFAULT_TIMEOUT_MS = 20_000;

export type TimelyApiQuery = Record<string, string | number | undefined>;

/**
 * The ONLY transport in this module. Hard-coded to GET so the client cannot mutate Timely.
 * Returns parsed JSON. Throws a sanitized {@link TimelyApiError} on any failure.
 */
export async function timelyApiGet<T = unknown>(
  config: TimelyApiConfig,
  path: string,
  query?: TimelyApiQuery,
  opts?: { timeoutMs?: number }
): Promise<T> {
  const url = new URL(`${config.baseUrl}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }
  // Path only (no query/secrets) for diagnostics.
  const endpoint = `${config.baseUrl}${path}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: buildAuthHeaders(config),
      signal: ctrl.signal,
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new TimelyApiError("Timely API request timed out.", endpoint, undefined, "network");
    }
    // Surface the non-sensitive cause code (e.g. ENOTFOUND, ECONNREFUSED,
    // UNABLE_TO_VERIFY_LEAF_SIGNATURE) to make network/TLS failures actionable.
    const code = (e as { cause?: { code?: string } })?.cause?.code;
    throw new TimelyApiError(
      `Timely API network error${code ? ` (${code})` : ""}.`,
      endpoint,
      undefined,
      "network"
    );
  } finally {
    clearTimeout(t);
  }

  if (res.status === 401 || res.status === 403) {
    throw new TimelyApiError(
      `Timely API authentication failed (${res.status}). Verify ${TIMELY_API_ENV.apiKey} and the auth scheme.`,
      endpoint,
      res.status,
      "auth"
    );
  }
  if (res.status === 404) {
    throw new TimelyApiError(
      `Timely API endpoint not found (404). Confirm the path is correct for this account.`,
      endpoint,
      404,
      "not_found"
    );
  }
  if (!res.ok) {
    throw new TimelyApiError(
      `Timely API request failed (${res.status}).`,
      endpoint,
      res.status,
      "http"
    );
  }

  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new TimelyApiError(
      `Timely API returned a non-JSON response. Confirm the endpoint returns JSON.`,
      endpoint,
      res.status,
      "parse"
    );
  }
}

/** Verify authentication with a lightweight read. Resolves to true on success; throws otherwise. */
export async function verifyTimelyAuth(config: TimelyApiConfig): Promise<true> {
  await timelyApiGet(config, TIMELY_API_ENDPOINTS.authProbe, { page: 1 });
  return true;
}

/** Fetch the Timely service catalogue (read-only). */
export async function fetchTimelyServices(config: TimelyApiConfig): Promise<unknown> {
  return timelyApiGet(config, TIMELY_API_ENDPOINTS.services);
}

export type FetchTimelyAppointmentsParams = {
  /** Inclusive start of the date range (YYYY-MM-DD or ISO 8601). */
  startDate: string;
  /** Inclusive/exclusive end of the date range (YYYY-MM-DD or ISO 8601). */
  endDate: string;
  page?: number;
  /** Soft cap on rows; many Timely list endpoints page rather than honour a limit. */
  limit?: number;
};

/**
 * Fetch appointments/bookings for a small date range (read-only).
 *
 * TODO(timely-api): Confirm the query parameter names. Timely list endpoints commonly accept
 * `start_date`/`end_date` (or `since`/`until`) plus `page`. If the names differ for this account,
 * adjust the query keys below — the probe surfaces the raw response shape to help.
 */
export async function fetchTimelyAppointments(
  config: TimelyApiConfig,
  params: FetchTimelyAppointmentsParams
): Promise<unknown> {
  return timelyApiGet(config, TIMELY_API_ENDPOINTS.appointments, {
    start_date: params.startDate,
    end_date: params.endDate,
    page: params.page ?? 1,
    limit: params.limit,
  });
}

// ---------------------------------------------------------------------------
// Sanitization helpers — describe SHAPE (field names / types), never values.
// Used by the probe so no patient-sensitive data is printed.
// ---------------------------------------------------------------------------

/** Pull the first appointment-like record out of common list/envelope response shapes. */
export function extractFirstAppointmentRecord(payload: unknown): Record<string, unknown> | null {
  const fromArray = (arr: unknown[]): Record<string, unknown> | null => {
    const first = arr.find((x) => x && typeof x === "object" && !Array.isArray(x));
    return (first as Record<string, unknown>) ?? null;
  };
  if (Array.isArray(payload)) return fromArray(payload);
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    for (const key of ["bookings", "appointments", "data", "results", "items"] as const) {
      if (Array.isArray(o[key])) {
        const rec = fromArray(o[key] as unknown[]);
        if (rec) return rec;
      }
    }
    // Some endpoints return a single object.
    if (Object.keys(o).length > 0) return o;
  }
  return null;
}

function valueType(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

/**
 * Field-name + type summary of a record, one level deep into nested objects, with NO values.
 * e.g. `["id: number", "customer: { id: number, name: string }", "status: string"]`.
 */
export function summarizeRecordShape(record: Record<string, unknown>): string[] {
  return Object.keys(record)
    .sort()
    .map((key) => {
      const v = record[key];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const inner = Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => `${k}: ${valueType((v as Record<string, unknown>)[k])}`)
          .join(", ");
        return `${key}: { ${inner} }`;
      }
      return `${key}: ${valueType(v)}`;
    });
}

export type TimelyCanonicalField =
  | "appointment_id"
  | "customer_id"
  | "service_name"
  | "staff_name"
  | "start_time"
  | "end_time"
  | "status";

/**
 * Best-effort mapping of canonical FI concepts → the Timely field NAME that appears to hold them.
 * Returns names only (never values), so it is safe to print. A `null` means "not auto-detected —
 * confirm manually from the shape summary".
 */
export function detectTimelyCanonicalFields(
  record: Record<string, unknown>
): Record<TimelyCanonicalField, string | null> {
  const keys = Object.keys(record);
  const has = (name: string) => keys.find((k) => k.toLowerCase() === name.toLowerCase()) ?? null;
  const first = (...names: string[]) => {
    for (const n of names) {
      const hit = has(n);
      if (hit) return hit;
    }
    return null;
  };

  return {
    appointment_id: first("id", "booking_id", "appointment_id", "uid"),
    customer_id: first("customer_id", "customerId", "client_id", "patient_id", "customer"),
    service_name: first("service_name", "service", "service_title", "title"),
    staff_name: first("staff_name", "staff", "practitioner", "employee", "resource"),
    start_time: first("start_time", "startTime", "start", "starts_at", "start_at"),
    end_time: first("end_time", "endTime", "end", "ends_at", "end_at"),
    status: first("status", "state", "booking_status"),
  };
}
