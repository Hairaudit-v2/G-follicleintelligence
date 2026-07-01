"use client";

import { PatientVisualSummaryReportView } from "@/src/components/fi-admin/imaging/PatientVisualSummaryReport";
import type { PatientPortalVisualSummaryItem } from "@/src/lib/imaging-os/patientVisualSummaryPortalCore";

export function PatientVisualSummaryPortalClient({
  items,
}: {
  items: PatientPortalVisualSummaryItem[];
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
        <p className="text-sm text-slate-300">
          No approved visual summaries are available in your portal yet.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Your clinic will share an approved summary after clinical review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-100">Visual summaries</h1>
        <p className="text-sm text-slate-400">
          Approved post-surgery and audit summaries for your records. Not a guarantee of outcome.
        </p>
      </header>
      {items.map((item) => {
        const pdfParams = new URLSearchParams({
          caseId: item.caseId,
          reportType: item.reportType,
        });
        return (
          <div key={`${item.caseId}-${item.reportType}`} className="space-y-2">
            <div className="flex justify-end">
              <a
                href={`visual-summary/pdf?${pdfParams}`}
                className="rounded-lg border border-cyan-500/30 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/10"
              >
                Download PDF
              </a>
            </div>
            <PatientVisualSummaryReportView report={item.report} />
          </div>
        );
      })}
    </div>
  );
}