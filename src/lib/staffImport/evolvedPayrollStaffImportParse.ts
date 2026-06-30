/**
 * Parse Evolved payroll EmployeeData exports into safe FI OS staff import rows.
 * Sensitive payroll / tax / bank / super / address fields are never returned.
 */

import {
  EVOLVED_PAYROLL_SOURCE_SYSTEM,
  EVOLVED_PERTH_CLINIC_DISPLAY_NAME,
  PAYROLL_DEFAULT_STAFF_ROLE,
  PAYROLL_IMPORT_SOURCE,
  PAYROLL_SENSITIVE_EXPORT_FIELDS,
  type PayrollSensitiveExportField,
} from "./evolvedPayrollStaffImportConstants";
import type {
  EvolvedPayrollStaffImportRow,
  EvolvedPayrollStaffParseResult,
} from "./evolvedPayrollStaffImportTypes";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

function parseFiniteNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

/** Excel serial date → ISO `YYYY-MM-DD` (UTC, date-only). */
export function excelSerialToIsoDate(serial: unknown): string | null {
  const n = parseFiniteNumber(serial);
  if (n == null || n <= 0) return null;
  const epochMs = Date.UTC(1899, 11, 30);
  const d = new Date(epochMs + n * 86_400_000);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function parsePayrollExportDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/").map((x) => Number(x));
    if (d && m && y) return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return excelSerialToIsoDate(v);
}

export function buildPayrollFullName(raw: Record<string, unknown>): string {
  const title = str(raw.Title);
  const parts = [str(raw.FirstName), str(raw.MiddleName), str(raw.Surname)].filter(Boolean);
  const base = parts.join(" ").replace(/\s+/g, " ").trim();
  if (!base) return "";
  if (title && /^dr\.?$/i.test(title)) return `Dr ${base}`;
  return base;
}

export function normalizePayrollEmail(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  return s.toLowerCase();
}

export function isValidPayrollEmail(email: string | null): boolean {
  if (!email) return false;
  return EMAIL_RE.test(email);
}

export function normalizePayrollMobile(v: unknown): string | null {
  const s = str(v);
  return s || null;
}

export function listPresentSensitivePayrollFields(
  raw: Record<string, unknown>
): PayrollSensitiveExportField[] {
  const present: PayrollSensitiveExportField[] = [];
  for (const key of PAYROLL_SENSITIVE_EXPORT_FIELDS) {
    const v = raw[key];
    if (v == null || v === "") continue;
    present.push(key);
  }
  return present;
}

export function isEvolvedPayrollExportRow(raw: unknown): raw is Record<string, unknown> {
  return raw != null && typeof raw === "object" && !Array.isArray(raw) && "EmployeeId" in raw;
}

/**
 * Map one payroll export object row to a safe import row, or null when not a data row.
 */
export function parseEvolvedPayrollExportRow(
  raw: Record<string, unknown>,
  opts?: { clinicDisplayName?: string }
): EvolvedPayrollStaffImportRow | null {
  const employeeId = str(raw.EmployeeId);
  if (!employeeId) return null;

  const full_name = buildPayrollFullName(raw);
  if (!full_name) return null;

  const end_date = parsePayrollExportDate(raw.EndDate);
  const clinic = opts?.clinicDisplayName?.trim() || EVOLVED_PERTH_CLINIC_DISPLAY_NAME;

  return {
    external_staff_id: employeeId,
    full_name,
    email: normalizePayrollEmail(raw.EmailAddress),
    mobile: normalizePayrollMobile(raw.MobilePhone),
    employment_type: str(raw.EmploymentType) || null,
    start_date: parsePayrollExportDate(raw.StartDate),
    end_date,
    hours_per_week: parseFiniteNumber(raw.HoursPerWeek),
    hours_per_day: parseFiniteNumber(raw.HoursPerDay),
    source: PAYROLL_IMPORT_SOURCE,
    source_system: EVOLVED_PAYROLL_SOURCE_SYSTEM,
    clinic_display_name: clinic,
    is_active: !end_date,
    staff_role: PAYROLL_DEFAULT_STAFF_ROLE,
  };
}

/**
 * Parse an array of payroll export rows (from xlsx `sheet_to_json` or JSON upload).
 */
export function parseEvolvedPayrollExportRows(rows: unknown[]): EvolvedPayrollStaffParseResult {
  const validationErrors: string[] = [];
  const parsed: EvolvedPayrollStaffImportRow[] = [];
  const sourceRowIndices: number[] = [];
  const sensitiveSet = new Set<PayrollSensitiveExportField>();
  let isPayrollExport = false;

  if (!Array.isArray(rows)) {
    return {
      rows: [],
      sourceRowIndices: [],
      validationErrors: ["Input must be an array of payroll export rows."],
      skippedSensitiveFields: [],
      isPayrollExport: false,
    };
  }

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    if (!isEvolvedPayrollExportRow(raw)) {
      validationErrors.push(`Row ${i}: not a payroll export row (missing EmployeeId).`);
      continue;
    }
    isPayrollExport = true;
    for (const f of listPresentSensitivePayrollFields(raw)) sensitiveSet.add(f);

    const row = parseEvolvedPayrollExportRow(raw);
    if (!row) {
      validationErrors.push(`Row ${i}: could not derive full_name from FirstName/Surname.`);
      continue;
    }
    parsed.push(row);
    sourceRowIndices.push(i);
  }

  return {
    rows: parsed,
    sourceRowIndices,
    validationErrors,
    skippedSensitiveFields: Array.from(sensitiveSet).sort(),
    isPayrollExport,
  };
}

/** Read the first worksheet of an Evolved payroll `.xlsx` buffer. */
export function parseEvolvedPayrollExportXlsxBuffer(
  buffer: ArrayBuffer | Buffer
): EvolvedPayrollStaffParseResult {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx") as typeof import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = wb.SheetNames.includes("Export") ? "Export" : wb.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [],
      sourceRowIndices: [],
      validationErrors: ["Workbook has no worksheets."],
      skippedSensitiveFields: [],
      isPayrollExport: false,
    };
  }
  const ws = wb.Sheets[sheetName]!;
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as unknown[];
  return parseEvolvedPayrollExportRows(rawRows);
}
