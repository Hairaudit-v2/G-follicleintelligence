/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 — CSV / export safety (pure).
 */

import { PILOT_CONTROL_MAX_EXPORT_ROWS } from "./pilotControlPagination";
import { PilotControlApiError } from "./pilotControlApiErrors";
import type {
  PilotControlExportFormat,
  PilotControlExportType,
} from "./pilotControlApiTypes";

export { PILOT_CONTROL_MAX_EXPORT_ROWS };

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Neutralise CSV formula injection (Excel/Sheets). */
export function sanitizeCsvCell(value: unknown): string {
  if (value == null) return "";
  let s = String(value);
  // Escape quotes
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  const unquoted = s.startsWith('"') ? s.slice(1, -1).replace(/""/g, '"') : s;
  if (FORMULA_PREFIX.test(unquoted) || FORMULA_PREFIX.test(s)) {
    const safe = `'${unquoted}`;
    if (s.startsWith('"')) return `"${safe.replace(/"/g, '""')}"`;
    return safe;
  }
  return s;
}

export function rowsToCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [headers.map(sanitizeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => sanitizeCsvCell(row[h])).join(","));
  }
  return lines.join("\r\n");
}

export function safeExportFilename(args: {
  programmeKey: string;
  exportType: PilotControlExportType;
  format: PilotControlExportFormat;
  at?: string;
}): string {
  const key = args.programmeKey.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 64);
  const stamp = (args.at ?? new Date().toISOString()).replace(/[:.]/g, "-");
  return `pilot-control_${key}_${args.exportType}_${stamp}.${args.format}`;
}

export function clampExportRows<T>(rows: readonly T[], correlationId: string): T[] {
  if (rows.length > PILOT_CONTROL_MAX_EXPORT_ROWS) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_INVALID_FILTER",
      `Export exceeds maximum of ${PILOT_CONTROL_MAX_EXPORT_ROWS} rows.`,
      400,
      correlationId
    );
  }
  return [...rows];
}

export function parseExportType(
  raw: string | null | undefined,
  correlationId: string
): PilotControlExportType {
  const allowed = [
    "patient_register",
    "active_blockers",
    "programme_summary",
    "activity_summary",
  ] as const;
  const v = String(raw ?? "").trim();
  if (!(allowed as readonly string[]).includes(v)) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_INVALID_FILTER",
      `exportType must be one of: ${allowed.join(", ")}.`,
      400,
      correlationId
    );
  }
  return v as PilotControlExportType;
}

export function parseExportFormat(
  raw: string | null | undefined,
  correlationId: string
): PilotControlExportFormat {
  const v = String(raw ?? "csv").trim().toLowerCase();
  if (v !== "csv" && v !== "json") {
    throw new PilotControlApiError(
      "PILOT_CONTROL_INVALID_FILTER",
      "format must be csv or json.",
      400,
      correlationId
    );
  }
  return v;
}
