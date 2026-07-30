/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 / 1B Governance Closure —
 * CSV / export safety + contract validation (pure).
 */

import { PILOT_CONTROL_MAX_EXPORT_ROWS } from "./pilotControlPagination";
import { PilotControlApiError } from "./pilotControlApiErrors";
import type {
  PilotControlExportFormat,
  PilotControlExportType,
} from "./pilotControlApiTypes";
import type { PilotControlRoleKey } from "../pilotControlContracts";
import { pilotControlRoleHasScope } from "../pilotControlContracts";

export { PILOT_CONTROL_MAX_EXPORT_ROWS };

export const PILOT_CONTROL_EXPORT_TYPES = [
  "patient_register",
  "active_blockers",
  "programme_summary",
  "activity_summary",
] as const satisfies readonly PilotControlExportType[];

export const PILOT_CONTROL_EXPORT_FORMATS = ["csv", "json"] as const satisfies readonly PilotControlExportFormat[];

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
  const v = String(raw ?? "").trim();
  if (!(PILOT_CONTROL_EXPORT_TYPES as readonly string[]).includes(v)) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_INVALID_EXPORT_TYPE",
      "The requested export type is not supported.",
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
  if (!(PILOT_CONTROL_EXPORT_FORMATS as readonly string[]).includes(v)) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_INVALID_EXPORT_FORMAT",
      "The requested export format is not supported.",
      400,
      correlationId
    );
  }
  return v as PilotControlExportFormat;
}

/** Fields that must never appear in finance exports. */
export const FINANCE_EXPORT_EXCLUDED_FIELDS = [
  "clinicalSummary",
  "clinicalDetail",
  "pathologyDetail",
  "pathologyProvenance",
  "medicationDetail",
  "consentContent",
  "consentProvenance",
  "technicalIdentityDetail",
  "technicalProvenance",
] as const;

/** Fields that must never appear in reception exports. */
export const RECEPTION_EXPORT_EXCLUDED_FIELDS = [
  "clinicalProvenance",
  "pathologyProvenance",
  "clinicalDetail",
  "pathologyDetail",
  "medicationDetail",
] as const;

/** Fields that must never appear in technical exports. */
export const TECHNICAL_EXPORT_EXCLUDED_FIELDS = [
  "financialDetail",
  "invoiceAmount",
  "depositAmount",
  "paymentAmount",
  "quoteNarrative",
] as const;

/**
 * Project export rows server-side before serialisation.
 * Do not select-all then hide in the browser.
 */
export function projectExportRowsForRole(
  rows: Array<Record<string, unknown>>,
  role: PilotControlRoleKey
): { rows: Array<Record<string, unknown>>; headers: string[] } {
  const excluded = new Set<string>();

  if (role === "finance" || (!pilotControlRoleHasScope(role, "detail_clinical_full") &&
      !pilotControlRoleHasScope(role, "detail_clinical_summary"))) {
    for (const f of FINANCE_EXPORT_EXCLUDED_FIELDS) excluded.add(f);
  }
  if (role === "reception") {
    for (const f of RECEPTION_EXPORT_EXCLUDED_FIELDS) excluded.add(f);
  }
  if (role === "technical" || !pilotControlRoleHasScope(role, "detail_financial_summary")) {
    if (role === "technical" || !pilotControlRoleHasScope(role, "detail_financial_full")) {
      for (const f of TECHNICAL_EXPORT_EXCLUDED_FIELDS) excluded.add(f);
    }
  }
  if (role === "finance") {
    // Finance: keep financial fields; strip clinical/pathology/tech provenance
    for (const f of FINANCE_EXPORT_EXCLUDED_FIELDS) excluded.add(f);
    excluded.add("clinicalProvenance");
  }

  const projected = rows.map((row) => {
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (excluded.has(k)) continue;
      next[k] = v;
    }
    return next;
  });

  const headerSet = new Set<string>();
  for (const row of projected) {
    for (const k of Object.keys(row)) headerSet.add(k);
  }
  return { rows: projected, headers: [...headerSet] };
}

/**
 * Safe audit payload for pilot_control_export_created — never includes row data.
 */
export function buildExportAuditPayload(args: {
  exportType: PilotControlExportType;
  format: PilotControlExportFormat;
  rowCount: number;
  role: PilotControlRoleKey;
  from?: string | null;
  to?: string | null;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    exportType: args.exportType,
    format: args.format,
    rowCount: args.rowCount,
    role: args.role,
  };
  if (args.from) payload.from = args.from;
  if (args.to) payload.to = args.to;
  return payload;
}

export function exportAuditContainsRowContent(payload: Record<string, unknown>): boolean {
  const forbidden = ["rows", "data", "records", "patients", "blockers", "csv", "body"];
  return forbidden.some((k) => k in payload && payload[k] != null);
}

/** UI ↔ API contract: query params the client must send. */
export const PILOT_CONTROL_EXPORT_UI_CONTRACT = {
  path: "/api/pilot-control/export",
  typeParam: "type",
  formatParam: "format",
  allowedTypes: PILOT_CONTROL_EXPORT_TYPES,
  allowedFormats: PILOT_CONTROL_EXPORT_FORMATS,
  activityRequires: ["from", "to"] as const,
  maxActivityRangeDays: 31,
} as const;
