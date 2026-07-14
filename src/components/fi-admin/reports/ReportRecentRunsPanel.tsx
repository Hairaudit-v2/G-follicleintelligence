"use client";

import { financialOsClasses } from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { ReportRunListItem } from "@/src/lib/reports/reportRunTypes";
import { cn } from "@/lib/utils";

export function ReportRecentRunsPanel(props: {
  runs: ReportRunListItem[];
  busy?: boolean;
  onOpen: (runId: string) => void;
}) {
  const { runs, busy, onOpen } = props;

  return (
    <section
      className={cn(financialOsClasses.formPanel, "space-y-3")}
      data-testid="report-recent-runs"
    >
      <div>
        <p className={financialOsClasses.metricLabel}>Snapshots</p>
        <h2 className="text-sm font-semibold text-slate-50">Recent report runs</h2>
        <p className={financialOsClasses.bodyTextXs}>
          Saved and scheduled snapshots. Open to review without regenerating.
        </p>
      </div>

      {runs.length === 0 ? (
        <p className={financialOsClasses.emptyState}>
          No saved runs yet. Generate a report and click Save snapshot.
        </p>
      ) : (
        <div className={financialOsClasses.tableShell}>
          <table className={financialOsClasses.table}>
            <thead className={financialOsClasses.tableHead}>
              <tr>
                <th className={financialOsClasses.tableHeadCell}>Report</th>
                <th className={financialOsClasses.tableHeadCell}>Period</th>
                <th className={financialOsClasses.tableHeadCell}>Source</th>
                <th className={financialOsClasses.tableHeadCell}>Saved</th>
                <th className={financialOsClasses.tableHeadCell}> </th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className={financialOsClasses.tableRow}>
                  <td className={financialOsClasses.tableCellStrong}>{run.title}</td>
                  <td className={financialOsClasses.tableCellMono}>
                    {run.period_start} → {run.period_end}
                  </td>
                  <td className={financialOsClasses.tableCell}>{run.source}</td>
                  <td className={financialOsClasses.tableCellMono}>
                    {run.created_at.slice(0, 16).replace("T", " ")}
                  </td>
                  <td className={financialOsClasses.tableCell}>
                    <button
                      type="button"
                      className={financialOsClasses.textButton}
                      disabled={busy}
                      onClick={() => onOpen(run.id)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
