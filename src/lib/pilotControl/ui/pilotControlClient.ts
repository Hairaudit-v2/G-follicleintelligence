/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.5 — browser fetch client for 1A.4 APIs.
 * Client-safe: no server-only imports, no engines, no DB.
 */

import type {
  PilotControlActivityItem,
  PilotControlApiErrorBody,
  PilotControlApiResponse,
  PilotControlExportFormat,
  PilotControlExportType,
  PilotControlHealthResponse,
  PilotControlOverview,
  PilotControlPaginatedResponse,
  PilotBlockerListItem,
  PilotPatientControlDetail,
  PilotPatientRegisterRow,
  PilotProgrammeSummary,
} from "../api/pilotControlApiTypes";
import { PILOT_CONTROL_API_BASE } from "./pilotControlUiConstants";

export class PilotControlClientError extends Error {
  readonly code: string;
  readonly correlationId: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, correlationId: string, httpStatus: number) {
    super(message);
    this.name = "PilotControlClientError";
    this.code = code;
    this.correlationId = correlationId;
    this.httpStatus = httpStatus;
  }
}

function buildUrl(path: string, query?: Record<string, string | undefined>): string {
  const url = new URL(
    `${PILOT_CONTROL_API_BASE}${path.startsWith("/") ? path : `/${path}`}`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost"
  );
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && String(v).trim()) url.searchParams.set(k, String(v).trim());
    }
  }
  return `${url.pathname}${url.search}`;
}

async function pilotControlFetch<T>(
  path: string,
  query?: Record<string, string | undefined>,
  opts?: { automaticRefresh?: boolean; signal?: AbortSignal }
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts?.automaticRefresh) headers["x-fi-pilot-refresh"] = "1";

  const res = await fetch(buildUrl(path, query), {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    headers,
    signal: opts?.signal,
  });

  const json = (await res.json().catch(() => null)) as
    | T
    | PilotControlApiErrorBody
    | null;

  if (!res.ok) {
    const errBody = json as PilotControlApiErrorBody | null;
    throw new PilotControlClientError(
      errBody?.error?.code ?? "PILOT_CONTROL_EVALUATION_FAILED",
      errBody?.error?.message ?? `Request failed (${res.status})`,
      errBody?.error?.correlationId ?? "unknown",
      res.status
    );
  }

  return json as T;
}

export function fetchPilotProgrammes(opts?: {
  tenantId?: string;
  automaticRefresh?: boolean;
  signal?: AbortSignal;
}) {
  return pilotControlFetch<PilotControlApiResponse<PilotProgrammeSummary[]>>(
    "/programmes",
    { tenantId: opts?.tenantId },
    opts
  );
}

export function fetchPilotOverview(
  programmeId: string,
  opts?: { tenantId?: string; automaticRefresh?: boolean; signal?: AbortSignal }
) {
  return pilotControlFetch<PilotControlApiResponse<PilotControlOverview>>(
    "/overview",
    { programmeId, tenantId: opts?.tenantId },
    opts
  );
}

export function fetchPilotHealth(
  programmeId: string,
  opts?: { tenantId?: string; automaticRefresh?: boolean; signal?: AbortSignal }
) {
  return pilotControlFetch<PilotControlApiResponse<PilotControlHealthResponse>>(
    "/health",
    { programmeId, tenantId: opts?.tenantId },
    opts
  );
}

export function fetchPilotPatients(
  query: Record<string, string>,
  opts?: { automaticRefresh?: boolean; signal?: AbortSignal }
) {
  return pilotControlFetch<PilotControlPaginatedResponse<PilotPatientRegisterRow>>(
    "/patients",
    query,
    opts
  );
}

export function fetchPilotPatientDetail(
  patientId: string,
  programmeId: string,
  opts?: { tenantId?: string; signal?: AbortSignal }
) {
  return pilotControlFetch<PilotControlApiResponse<PilotPatientControlDetail>>(
    `/patients/${encodeURIComponent(patientId)}`,
    { programmeId, tenantId: opts?.tenantId },
    opts
  );
}

export function fetchPilotBlockers(
  query: Record<string, string>,
  opts?: { automaticRefresh?: boolean; signal?: AbortSignal }
) {
  return pilotControlFetch<PilotControlPaginatedResponse<PilotBlockerListItem>>(
    "/blockers",
    query,
    opts
  );
}

export function fetchPilotActivity(
  query: Record<string, string>,
  opts?: { automaticRefresh?: boolean; signal?: AbortSignal }
) {
  return pilotControlFetch<PilotControlPaginatedResponse<PilotControlActivityItem>>(
    "/activity",
    query,
    opts
  );
}

export async function fetchPilotExport(args: {
  programmeId: string;
  type: PilotControlExportType;
  format: PilotControlExportFormat;
  from?: string;
  to?: string;
  tenantId?: string;
}): Promise<{ blob: Blob; filename: string; correlationId?: string }> {
  const url = buildUrl("/export", {
    programmeId: args.programmeId,
    type: args.type,
    format: args.format,
    from: args.from,
    to: args.to,
    tenantId: args.tenantId,
  });
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: args.format === "csv" ? "text/csv" : "application/json" },
  });

  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as PilotControlApiErrorBody | null;
    throw new PilotControlClientError(
      json?.error?.code ?? "PILOT_CONTROL_EXPORT_DENIED",
      json?.error?.message ?? `Export failed (${res.status})`,
      json?.error?.correlationId ?? "unknown",
      res.status
    );
  }

  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename =
    match?.[1] ??
    `pilot-control-${args.type}.${args.format === "csv" ? "csv" : "json"}`;
  const blob = await res.blob();
  return { blob, filename };
}
