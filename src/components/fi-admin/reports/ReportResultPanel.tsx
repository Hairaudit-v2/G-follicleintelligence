"use client";

import { financialOsClasses } from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { ReportGenerateResult } from "@/src/lib/reports/reportTypes";
import { cn } from "@/lib/utils";

export function ReportResultPanel(props: {
  result: ReportGenerateResult;
  onExportCsv?: () => void;
  exportBusy?: boolean;
  onClose?: () => void;
}) {
  const { result, onExportCsv, exportBusy, onClose } = props;

  return (
    <section
      className={cn(financialOsClasses.formPanel, "space-y-4")}
      data-testid="report-result-panel"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={financialOsClasses.metricLabel}>Generated report</p>
          <h2 className="mt-1 text-base font-semibold text-slate-50">{result.title}</h2>
          <p className={financialOsClasses.mutedMeta}>
            {result.periodStart} → {result.periodEnd} · {result.currency}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onExportCsv ? (
            <button
              type="button"
              className={financialOsClasses.primaryButton}
              disabled={exportBusy}
              onClick={onExportCsv}
            >
              {exportBusy
                ? "Exporting…"
                : result.reportId === "expense_export_pack"
                  ? "Download CSV pack"
                  : "Download CSV"}
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className={financialOsClasses.secondaryButton} onClick={onClose}>
              Close
            </button>
          ) : null}
        </div>
      </div>

      <div className={financialOsClasses.metricGrid}>
        {result.metrics.map((m) => (
          <div key={m.key} className={financialOsClasses.metricTile}>
            <p className={financialOsClasses.metricLabel}>{m.label}</p>
            <p className={financialOsClasses.metricValue}>{m.value}</p>
            {m.hint ? <p className={financialOsClasses.metricFoot}>{m.hint}</p> : null}
          </div>
        ))}
      </div>

      {result.emptyMessage ? (
        <p className={financialOsClasses.emptyState}>{result.emptyMessage}</p>
      ) : null}

      {result.table && result.table.rows.length > 0 ? (
        <div className={financialOsClasses.tableShell}>
          <table className={financialOsClasses.table}>
            <thead className={financialOsClasses.tableHead}>
              <tr>
                {result.table.columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      financialOsClasses.tableHeadCell,
                      col.align === "right" && "text-right"
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.table.rows.map((row, idx) => (
                <tr key={idx} className={financialOsClasses.tableRow}>
                  {result.table!.columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        col.align === "right"
                          ? financialOsClasses.tableCellMono
                          : financialOsClasses.tableCell,
                        col.align === "right" && "text-right"
                      )}
                    >
                      {row[col.key] == null ? "—" : String(row[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
