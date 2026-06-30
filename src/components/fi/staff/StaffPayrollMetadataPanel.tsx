import type { StaffPayrollSourceDisplay } from "@/src/lib/staff/staffPayrollSourceDisplay";

function formatImportDate(iso: string | null): string {
  if (!iso?.trim()) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function StaffPayrollMetadataPanel({
  payroll,
  variant = "light",
}: {
  payroll: StaffPayrollSourceDisplay;
  variant?: "light" | "dark";
}) {
  const label = variant === "dark" ? "text-[#64748B]" : "text-gray-500";
  const value = variant === "dark" ? "text-[#E2E8F0]" : "text-slate-100";
  const box =
    variant === "dark"
      ? "rounded-lg border border-white/10 bg-white/[0.03] p-4"
      : "rounded-lg border border-amber-400/20 bg-amber-400/10 p-4";

  return (
    <div className={box}>
      <h3 className={`text-sm font-semibold ${value}`}>Payroll import (operational only)</h3>
      <p className={`mt-1 text-xs ${label}`}>
        Safe fields from Evolved payroll — no salary, tax, bank, or address data.
      </p>
      <dl className={`mt-4 grid gap-3 text-sm sm:grid-cols-2 ${value}`}>
        <div>
          <dt className={`text-xs font-medium uppercase tracking-wide ${label}`}>Payroll source</dt>
          <dd className="mt-1">{payroll.payroll_source ?? "payroll_export"}</dd>
        </div>
        <div>
          <dt className={`text-xs font-medium uppercase tracking-wide ${label}`}>Employee id</dt>
          <dd className="mt-1 font-mono text-xs">{payroll.employee_id}</dd>
        </div>
        <div>
          <dt className={`text-xs font-medium uppercase tracking-wide ${label}`}>
            Employment type
          </dt>
          <dd className="mt-1">{payroll.employment_type ?? "—"}</dd>
        </div>
        <div>
          <dt className={`text-xs font-medium uppercase tracking-wide ${label}`}>Start date</dt>
          <dd className="mt-1">{payroll.start_date ?? "—"}</dd>
        </div>
        <div>
          <dt className={`text-xs font-medium uppercase tracking-wide ${label}`}>Hours / week</dt>
          <dd className="mt-1">{payroll.hours_per_week ?? "—"}</dd>
        </div>
        <div>
          <dt className={`text-xs font-medium uppercase tracking-wide ${label}`}>Last import</dt>
          <dd className="mt-1">{formatImportDate(payroll.payroll_last_imported_at)}</dd>
        </div>
        {payroll.clinic_display_name ? (
          <div className="sm:col-span-2">
            <dt className={`text-xs font-medium uppercase tracking-wide ${label}`}>
              Clinic (payroll metadata)
            </dt>
            <dd className="mt-1">{payroll.clinic_display_name}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
