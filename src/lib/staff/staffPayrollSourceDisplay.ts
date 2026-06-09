import { EVOLVED_PAYROLL_SOURCE_SYSTEM } from "@/src/lib/staffImport/evolvedPayrollStaffImportConstants";
import { normalizeFiStaffSourceSystem } from "@/src/lib/staff/staffSourceIdsNormalize";

/** Safe payroll metadata fields shown in FI OS UI — never salary, tax, bank, or address. */
export type StaffPayrollSourceDisplay = {
  source_system: string;
  employee_id: string;
  payroll_source: string | null;
  employment_type: string | null;
  start_date: string | null;
  hours_per_week: number | null;
  hours_per_day: number | null;
  clinic_display_name: string | null;
  primary_fi_clinic_id: string | null;
  payroll_last_imported_at: string | null;
};

const EVOLVED_PAYROLL = normalizeFiStaffSourceSystem(EVOLVED_PAYROLL_SOURCE_SYSTEM);

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : null;
}

export function buildStaffPayrollSourceDisplay(input: {
  source_system: string;
  source_staff_id: string;
  metadata: Record<string, unknown> | null | undefined;
}): StaffPayrollSourceDisplay | null {
  if (normalizeFiStaffSourceSystem(input.source_system) !== EVOLVED_PAYROLL) return null;
  const md = input.metadata ?? {};
  return {
    source_system: EVOLVED_PAYROLL,
    employee_id: String(input.source_staff_id).trim(),
    payroll_source: str(md.source) ?? "payroll_export",
    employment_type: str(md.employment_type),
    start_date: str(md.start_date),
    hours_per_week: num(md.hours_per_week),
    hours_per_day: num(md.hours_per_day),
    clinic_display_name: str(md.clinic_display_name),
    primary_fi_clinic_id: str(md.primary_fi_clinic_id),
    payroll_last_imported_at: str(md.payroll_last_imported_at),
  };
}

export function pickPayrollSourceDisplayFromRows(
  rows: { source_system: string; source_staff_id: string; metadata: Record<string, unknown> | null | undefined }[]
): StaffPayrollSourceDisplay | null {
  for (const row of rows) {
    const d = buildStaffPayrollSourceDisplay(row);
    if (d) return d;
  }
  return null;
}
