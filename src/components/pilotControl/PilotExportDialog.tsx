"use client";

import { useState } from "react";

import { SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type {
  PilotControlExportFormat,
  PilotControlExportType,
} from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import { activityDateRangeIso } from "@/src/lib/pilotControl/ui/pilotControlFormatters";
import { EXPORT_ROLE_NOTICE, PILOT_CONTROL_MAX_EXPORT_ROWS } from "@/src/lib/pilotControl/ui/pilotControlUiConstants";
import { PilotControlClientError } from "@/src/lib/pilotControl/ui/pilotControlClient";

export function PilotExportDialog({
  programmeId,
  tenantId,
  open,
  onClose,
  onExport,
  busy,
  error,
}: {
  programmeId: string;
  tenantId?: string;
  open: boolean;
  onClose: () => void;
  onExport: (args: {
    programmeId: string;
    type: PilotControlExportType;
    format: PilotControlExportFormat;
    from?: string;
    to?: string;
    tenantId?: string;
  }) => Promise<void>;
  busy?: boolean;
  error?: Error | null;
}) {
  const [type, setType] = useState<PilotControlExportType>("active_blockers");
  const [format, setFormat] = useState<PilotControlExportFormat>("csv");
  const [confirmed, setConfirmed] = useState(false);

  if (!open) return null;

  const needsRange = type === "activity_summary";
  const range = activityDateRangeIso("30d");
  const corr = error instanceof PilotControlClientError ? error.correlationId : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Close export dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pilot-export-title"
        className="relative w-full max-w-md rounded-xl border border-white/10 bg-[#0B1220] p-4 shadow-xl"
      >
        <SectionHeader id="pilot-export-title" title="Export" description={EXPORT_ROLE_NOTICE} />
        <div className="mt-3 space-y-3 text-sm">
          <label className="block text-xs text-slate-400">
            Export type
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PilotControlExportType)}
              className="mt-1 block w-full rounded border border-white/10 bg-[#141C33] px-2 py-1.5 text-slate-100"
            >
              <option value="patient_register">Patient register</option>
              <option value="active_blockers">Active blockers</option>
              <option value="programme_summary">Programme summary</option>
              <option value="activity_summary">Activity summary</option>
            </select>
          </label>
          <label className="block text-xs text-slate-400">
            Format
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as PilotControlExportFormat)}
              className="mt-1 block w-full rounded border border-white/10 bg-[#141C33] px-2 py-1.5 text-slate-100"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </label>
          {needsRange ? (
            <p className="text-xs text-slate-400">
              Activity export uses the last {range.days} days (API cap 31).
            </p>
          ) : null}
          <label className="flex items-start gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I confirm this export is limited to at most {PILOT_CONTROL_MAX_EXPORT_ROWS} rows and
              fields permitted for my role.
            </span>
          </label>
          {error ? (
            <p className="text-xs text-rose-200" role="alert">
              {error.message}
              {corr ? ` · Correlation: ${corr}` : ""}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-white/15 px-3 py-1.5 text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!confirmed || busy}
              onClick={() =>
                void onExport({
                  programmeId,
                  type,
                  format,
                  from: needsRange ? range.from : undefined,
                  to: needsRange ? range.to : undefined,
                  tenantId,
                })
              }
              className="rounded bg-cyan-600/80 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              {busy ? "Exporting…" : "Download"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
