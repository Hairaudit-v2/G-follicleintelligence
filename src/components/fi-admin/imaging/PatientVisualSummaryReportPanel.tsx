"use client";

import { useCallback, useState, useTransition } from "react";

import {
  approvePatientVisualSummaryReportAction,
  loadPatientVisualSummaryReportAction,
  regeneratePatientVisualSummaryReportAction,
} from "@/lib/actions/fi-imaging-actions";
import { PatientVisualSummaryReportView } from "./PatientVisualSummaryReport";
import type {
  PatientVisualSummaryReport,
  PatientVisualSummaryReportType,
} from "@/src/lib/imaging-os/patientVisualSummaryReportTypes";

export function PatientVisualSummaryReportPanel({
  tenantId,
  patientId,
  caseId,
  surgeryId,
  reportType,
  adminKey,
  compact = false,
}: {
  tenantId: string;
  patientId: string;
  caseId?: string | null;
  surgeryId?: string | null;
  reportType: PatientVisualSummaryReportType;
  adminKey?: string;
  compact?: boolean;
}) {
  const [report, setReport] = useState<PatientVisualSummaryReport | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const loadReport = useCallback(() => {
    start(async () => {
      setMessage(null);
      const res = await loadPatientVisualSummaryReportAction(tenantId, patientId, {
        adminKey,
        reportType,
        caseId: caseId ?? null,
        surgeryId: surgeryId ?? null,
      });
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setReport(res.report);
      setOpen(true);
    });
  }, [tenantId, patientId, adminKey, reportType, caseId, surgeryId]);

  const approve = () => {
    if (!caseId) {
      setMessage("Link a case to approve this report for patient access.");
      return;
    }
    start(async () => {
      const res = await approvePatientVisualSummaryReportAction(tenantId, {
        adminKey,
        caseId,
        reportType,
        surgeryId: surgeryId ?? null,
      });
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setMessage("Report approved for patient access.");
      loadReport();
    });
  };

  const regenerate = () => {
    if (!caseId) {
      loadReport();
      return;
    }
    start(async () => {
      const res = await regeneratePatientVisualSummaryReportAction(tenantId, {
        adminKey,
        caseId,
        reportType,
        surgeryId: surgeryId ?? null,
      });
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setMessage("Report regenerated from latest data (draft).");
      loadReport();
    });
  };

  const exportPdfUrl = () => {
    const params = new URLSearchParams();
    params.set("reportType", reportType);
    if (caseId) params.set("caseId", caseId);
    if (surgeryId) params.set("surgeryId", surgeryId);
    if (adminKey) params.set("adminKey", adminKey);
    return `/api/tenants/${tenantId.trim()}/patients/${patientId.trim()}/imaging/visual-summary/pdf?${params}`;
  };

  const btnClass = compact
    ? "rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/5 disabled:opacity-50"
    : "rounded-lg border border-cyan-500/30 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50";

  return (
    <div className={compact ? "inline-flex flex-wrap items-center gap-2" : "space-y-3"}>
      {!compact ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Patient visual summary
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Staff-approved, patient-safe post-op or audit report. No AI diagnosis or predictions.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnClass} disabled={pending} onClick={loadReport}>
          Preview patient summary
        </button>
        <a href={exportPdfUrl()} className={btnClass} target="_blank" rel="noopener noreferrer">
          Export PDF
        </a>
        <button type="button" className={btnClass} disabled={pending || !caseId} onClick={approve}>
          Mark approved for patient
        </button>
        <button type="button" className={btnClass} disabled={pending} onClick={regenerate}>
          Regenerate from latest images/data
        </button>
      </div>

      {message ? <p className="text-xs text-amber-200/90">{message}</p> : null}

      {open && report ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8">
          <div className="relative w-full max-w-4xl">
            <button
              type="button"
              className="absolute right-2 top-2 z-10 rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
            <PatientVisualSummaryReportView report={report} />
          </div>
        </div>
      ) : null}
    </div>
  );
}