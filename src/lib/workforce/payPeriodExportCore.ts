/**
 * WorkforceOS pay period payroll export — pure CSV builders for approved timesheets.
 */

import type { PayPeriodRange } from "./payPeriodCore";
import type { TimesheetEntry, TimesheetStatus } from "./wageProfileCore";

export const PAY_PERIOD_EXPORT_SCOPES = ["approved", "all"] as const;
export type PayPeriodExportScope = (typeof PAY_PERIOD_EXPORT_SCOPES)[number];

export const PAY_PERIOD_EXPORT_VIEWS = ["summary", "detail"] as const;
export type PayPeriodExportView = (typeof PAY_PERIOD_EXPORT_VIEWS)[number];

export type PayPeriodExportStaffRef = {
  staffMemberId: string;
  fiStaffId: string | null;
  staffFullName: string | null;
};

export type PayPeriodExportEntryRow = {
  workDate: string;
  staffMemberId: string;
  fiStaffId: string | null;
  staffFullName: string | null;
  entryType: string;
  minutesWorked: number;
  hoursWorked: number;
  rateType: string;
  baseRateAud: number;
  grossAud: number;
  awardLoadings: string;
  status: TimesheetStatus;
  notes: string | null;
};

export type PayPeriodExportSummaryRow = {
  staffMemberId: string;
  fiStaffId: string | null;
  staffFullName: string | null;
  totalMinutes: number;
  totalHours: number;
  grossAud: number;
  approvedEntryCount: number;
  entryCount: number;
};

export type PayPeriodExportBundle = {
  exportedAt: string;
  tenantId: string;
  payPeriod: PayPeriodRange;
  scope: PayPeriodExportScope;
  view: PayPeriodExportView;
  unapprovedEntryCount: number;
  rows: PayPeriodExportEntryRow[] | PayPeriodExportSummaryRow[];
};

export function parsePayPeriodExportScope(
  raw: string | null | undefined
): PayPeriodExportScope {
  const v = String(raw ?? "approved").trim().toLowerCase();
  return (PAY_PERIOD_EXPORT_SCOPES as readonly string[]).includes(v)
    ? (v as PayPeriodExportScope)
    : "approved";
}

export function parsePayPeriodExportView(
  raw: string | null | undefined
): PayPeriodExportView {
  const v = String(raw ?? "summary").trim().toLowerCase();
  return (PAY_PERIOD_EXPORT_VIEWS as readonly string[]).includes(v)
    ? (v as PayPeriodExportView)
    : "summary";
}

export function minutesToExportHours(minutes: number): number {
  const m = Math.max(0, Math.floor(minutes));
  return Math.round((m / 60) * 100) / 100;
}

export function centsToExportAud(cents: number): number {
  return Math.round(cents) / 100;
}

function formatAwardLoadings(
  loadings: Array<{ loadingCode: string; multiplier: number }>
): string {
  if (loadings.length === 0) return "";
  return loadings.map((l) => `${l.loadingCode}×${l.multiplier}`).join("; ");
}

export function buildPayPeriodExportEntryRows(
  entries: TimesheetEntry[],
  staffRefs: Map<string, PayPeriodExportStaffRef>,
  scope: PayPeriodExportScope
): { rows: PayPeriodExportEntryRow[]; unapprovedEntryCount: number } {
  const unapprovedEntryCount = entries.filter((e) => e.status !== "approved").length;
  const filtered =
    scope === "approved" ? entries.filter((e) => e.status === "approved") : entries;

  const rows = filtered
    .map((e) => {
      const ref = staffRefs.get(e.staffMemberId);
      return {
        workDate: e.workDate,
        staffMemberId: e.staffMemberId,
        fiStaffId: ref?.fiStaffId ?? null,
        staffFullName: e.staffFullName ?? ref?.staffFullName ?? null,
        entryType: e.entryType,
        minutesWorked: e.minutesWorked,
        hoursWorked: minutesToExportHours(e.minutesWorked),
        rateType: e.rateTypeSnapshot,
        baseRateAud: centsToExportAud(e.baseRateCentsSnapshot),
        grossAud: centsToExportAud(e.grossCostCents),
        awardLoadings: formatAwardLoadings(e.awardLoadingsSnapshot),
        status: e.status,
        notes: e.notes,
      };
    })
    .sort((a, b) => {
      const nameCmp = (a.staffFullName ?? "").localeCompare(b.staffFullName ?? "");
      if (nameCmp !== 0) return nameCmp;
      return a.workDate.localeCompare(b.workDate);
    });

  return { rows, unapprovedEntryCount };
}

export function buildPayPeriodExportSummaryRows(
  entryRows: PayPeriodExportEntryRow[]
): PayPeriodExportSummaryRow[] {
  const map = new Map<string, PayPeriodExportSummaryRow>();
  for (const e of entryRows) {
    const existing = map.get(e.staffMemberId);
    if (!existing) {
      map.set(e.staffMemberId, {
        staffMemberId: e.staffMemberId,
        fiStaffId: e.fiStaffId,
        staffFullName: e.staffFullName,
        totalMinutes: e.minutesWorked,
        totalHours: e.hoursWorked,
        grossAud: e.grossAud,
        approvedEntryCount: e.status === "approved" ? 1 : 0,
        entryCount: 1,
      });
      continue;
    }
    existing.totalMinutes += e.minutesWorked;
    existing.totalHours = minutesToExportHours(existing.totalMinutes);
    existing.grossAud = Math.round((existing.grossAud + e.grossAud) * 100) / 100;
    existing.entryCount += 1;
    if (e.status === "approved") existing.approvedEntryCount += 1;
  }
  return Array.from(map.values()).sort((a, b) =>
    (a.staffFullName ?? "").localeCompare(b.staffFullName ?? "")
  );
}

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(values: Array<string | number | null | undefined>): string {
  return values.map(csvEscape).join(",");
}

export function buildPayPeriodExportBundle(input: {
  tenantId: string;
  payPeriod: PayPeriodRange;
  entries: TimesheetEntry[];
  staffRefs: Map<string, PayPeriodExportStaffRef>;
  scope?: PayPeriodExportScope;
  view?: PayPeriodExportView;
  exportedAt?: string;
}): PayPeriodExportBundle {
  const scope = input.scope ?? "approved";
  const view = input.view ?? "summary";
  const { rows: entryRows, unapprovedEntryCount } = buildPayPeriodExportEntryRows(
    input.entries,
    input.staffRefs,
    scope
  );
  const rows =
    view === "detail" ? entryRows : buildPayPeriodExportSummaryRows(entryRows);

  return {
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    tenantId: input.tenantId,
    payPeriod: input.payPeriod,
    scope,
    view,
    unapprovedEntryCount,
    rows,
  };
}

export function serializePayPeriodExportCsv(bundle: PayPeriodExportBundle): string {
  const meta = [
    csvRow(["exported_at", bundle.exportedAt]),
    csvRow(["tenant_id", bundle.tenantId]),
    csvRow(["pay_period_start", bundle.payPeriod.start]),
    csvRow(["pay_period_end", bundle.payPeriod.end]),
    csvRow(["pay_period_frequency", bundle.payPeriod.frequency]),
    csvRow(["export_scope", bundle.scope]),
    csvRow(["export_view", bundle.view]),
    csvRow(["unapproved_entries_excluded", bundle.scope === "approved" ? bundle.unapprovedEntryCount : 0]),
    "",
  ];

  if (bundle.view === "detail") {
    const rows = bundle.rows as PayPeriodExportEntryRow[];
    const header = csvRow([
      "work_date",
      "staff_name",
      "employee_id",
      "entry_type",
      "hours",
      "minutes",
      "rate_type",
      "base_rate_aud",
      "gross_aud",
      "award_loadings",
      "status",
      "notes",
    ]);
    const body = rows.map((r) =>
      csvRow([
        r.workDate,
        r.staffFullName,
        r.fiStaffId ?? r.staffMemberId,
        r.entryType,
        r.hoursWorked,
        r.minutesWorked,
        r.rateType,
        r.baseRateAud.toFixed(2),
        r.grossAud.toFixed(2),
        r.awardLoadings,
        r.status,
        r.notes,
      ])
    );
    return [...meta, header, ...body].join("\n");
  }

  const rows = bundle.rows as PayPeriodExportSummaryRow[];
  const header = csvRow([
    "staff_name",
    "employee_id",
    "total_hours",
    "total_minutes",
    "gross_aud",
    "approved_entries",
    "total_entries",
  ]);
  const body = rows.map((r) =>
    csvRow([
      r.staffFullName,
      r.fiStaffId ?? r.staffMemberId,
      r.totalHours,
      r.totalMinutes,
      r.grossAud.toFixed(2),
      r.approvedEntryCount,
      r.entryCount,
    ])
  );
  return [...meta, header, ...body].join("\n");
}

export function payPeriodExportFilename(bundle: PayPeriodExportBundle): string {
  const view = bundle.view === "detail" ? "detail" : "summary";
  const scope = bundle.scope === "approved" ? "approved" : "all";
  return `workforce-payroll-${bundle.payPeriod.start}-${bundle.payPeriod.end}-${view}-${scope}.csv`;
}