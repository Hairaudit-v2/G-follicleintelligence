"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import {
  hubspotCrmImportCommitStage1Action,
  hubspotCrmImportDryRunAction,
  hubspotCrmImportRollbackBatchAction,
  hubspotCrmImportUploadCsvAction,
} from "@/lib/actions/fi-hubspot-crm-import-actions";
import type { HubspotContactsDryRunReport } from "@/src/lib/crm/hubspotImport/validateHubspotContactsImport";
import type {
  FiImportBatchRow,
  StagingRowDb,
} from "@/src/lib/crm/hubspotImport/hubspotImportBatchLoad.server";

function isDryRunReport(value: unknown): value is HubspotContactsDryRunReport {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.generatedAt === "string" &&
    Array.isArray(o.rowResults) &&
    typeof o.passed === "boolean"
  );
}

export function HubspotCrmImportCentre({
  tenantId,
  initialBatch,
  stagingPreview,
}: {
  tenantId: string;
  initialBatch: FiImportBatchRow | null;
  stagingPreview: StagingRowDb[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchId = searchParams.get("batchId")?.trim() || null;
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localReport, setLocalReport] = useState<HubspotContactsDryRunReport | null>(() =>
    initialBatch?.dry_run_report && isDryRunReport(initialBatch.dry_run_report)
      ? initialBatch.dry_run_report
      : null
  );
  const [localBatch, setLocalBatch] = useState<FiImportBatchRow | null>(initialBatch);

  const effectiveBatch = useMemo(() => {
    if (!batchId) return null;
    return localBatch?.id === batchId
      ? localBatch
      : initialBatch?.id === batchId
        ? initialBatch
        : null;
  }, [batchId, initialBatch, localBatch]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const onUpload = (file: File) => {
    setError(null);
    setMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      startTransition(async () => {
        const res = await hubspotCrmImportUploadCsvAction(tenantId, text);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setMessage(`Uploaded ${res.rowCount} rows.`);
        router.push(
          `/fi-admin/${tenantId}/settings/imports/hubspot?batchId=${encodeURIComponent(res.batchId)}`
        );
        router.refresh();
      });
    };
    reader.onerror = () => setError("Could not read file.");
    reader.readAsText(file, "UTF-8");
  };

  const onDryRun = () => {
    if (!batchId) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await hubspotCrmImportDryRunAction(tenantId, batchId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLocalReport(res.report);
      setLocalBatch(res.batch);
      setMessage(
        res.report.passed
          ? "Dry-run passed. You may import up to 100 valid rows."
          : "Dry-run completed with blocking issues."
      );
      refresh();
    });
  };

  const onImport = () => {
    if (!batchId) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await hubspotCrmImportCommitStage1Action(tenantId, batchId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLocalBatch(res.batch);
      setMessage(`Import finished: ${res.imported} row(s) imported, ${res.skipped} skipped.`);
      if (res.errors.length) {
        setError(res.errors.slice(0, 8).join("\n") + (res.errors.length > 8 ? "\n…" : ""));
      }
      refresh();
    });
  };

  const onRollback = () => {
    if (!batchId) return;
    if (
      !window.confirm(
        "Rollback will delete fi_crm_leads, fi_patients, and fi_persons rows tagged with this import batch. Continue?"
      )
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await hubspotCrmImportRollbackBatchAction(tenantId, batchId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(
        `Rolled back: ${res.summary.leadsDeleted} leads, ${res.summary.patientsDeleted} patients, ${res.summary.personsDeleted} persons removed.`
      );
      setLocalBatch(null);
      setLocalReport(null);
      refresh();
    });
  };

  const previewRows = stagingPreview;
  const dryRunPassed = Boolean(effectiveBatch?.dry_run_passed);
  const terminalDryRunBlock = ["import_completed", "rolled_back", "importing"];
  const canDryRun =
    Boolean(batchId) && effectiveBatch && !terminalDryRunBlock.includes(effectiveBatch.status);
  const canImport = Boolean(batchId) && dryRunPassed && effectiveBatch?.status === "dry_run_passed";
  const canRollback = Boolean(batchId) && effectiveBatch?.status === "import_completed";

  return (
    <div className="space-y-4">
      {error ? (
        <InfoNotice variant="danger" title="Error">
          <pre className="whitespace-pre-wrap text-xs">{error}</pre>
        </InfoNotice>
      ) : null}
      {message ? (
        <InfoNotice variant="success" title="Status">
          <p className="text-sm">{message}</p>
        </InfoNotice>
      ) : null}

      <DashboardCard className="p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-100">Upload HubSpot contacts CSV</h2>
        <p className="mt-1 text-xs text-slate-400">
          Stage 1: persons, patients (when qualified), CRM leads, deal id mappings.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.07]">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={pending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
            Choose CSV
          </label>
          <p className="text-xs text-slate-400">
            Expected columns include Record ID, First Name, Last Name, Email, Phone Number, Lead
            Status, Stage of Journey, Associated Deal IDs, etc.
          </p>
        </div>
      </DashboardCard>

      {batchId ? (
        <>
          <DashboardCard className="p-4 sm:p-5">
            <h2 className="text-base font-semibold text-slate-100">
              Preview (first 50 staged rows)
            </h2>
            <p className="mt-1 font-mono text-[11px] text-slate-500">Batch {batchId}</p>
            <div className="mt-4 max-h-[360px] overflow-auto rounded border border-white/10">
              <table className="min-w-full text-left text-xs text-slate-200">
                <thead className="sticky top-0 bg-[#0b1220] text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">Record ID</th>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Email</th>
                    <th className="px-2 py-2">Phone</th>
                    <th className="px-2 py-2">Lifecycle</th>
                    <th className="px-2 py-2">Journey</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r) => (
                    <tr key={r.id} className="border-t border-white/[0.06]">
                      <td className="px-2 py-1.5 text-slate-500">{r.row_index}</td>
                      <td className="px-2 py-1.5 font-mono text-[11px]">{r.record_id ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="px-2 py-1.5">{r.email ?? "—"}</td>
                      <td className="px-2 py-1.5">{r.phone_number ?? "—"}</td>
                      <td className="px-2 py-1.5">{r.lifecycle_stage ?? "—"}</td>
                      <td className="px-2 py-1.5">{r.stage_of_journey ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!previewRows.length ? (
                <p className="p-3 text-sm text-slate-500">No staged rows loaded.</p>
              ) : null}
            </div>
          </DashboardCard>

          <DashboardCard className="p-4 sm:p-5">
            <h2 className="text-base font-semibold text-slate-100">Dry-run & import</h2>
            <p className="mt-1 text-xs text-slate-400">
              Service-role writes only after dry-run passes. Import processes at most 100 valid
              rows.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || !canDryRun}
                onClick={onDryRun}
                className="rounded-md bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Run dry-run
              </button>
              <button
                type="button"
                disabled={pending || !canImport}
                onClick={onImport}
                className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Import first 100 valid rows
              </button>
              <button
                type="button"
                disabled={pending || !canRollback}
                onClick={onRollback}
                className="rounded-md border border-rose-500/50 bg-rose-950/40 px-3 py-2 text-sm font-medium text-rose-100 hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Rollback batch
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Batch status:{" "}
              <span className="font-mono text-slate-300">
                {effectiveBatch?.status ?? "unknown"}
              </span>
              {dryRunPassed ? <span className="ml-2 text-emerald-400">dry_run_passed</span> : null}
            </p>
          </DashboardCard>

          {localReport ? (
            <DashboardCard className="p-4 sm:p-5">
              <h2 className="text-base font-semibold text-slate-100">Dry-run report</h2>
              <p className="mt-1 text-xs text-slate-400">
                Blocking: {localReport.blockingCount} · Warnings: {localReport.warningCount}
              </p>
              <div className="mt-4 max-h-[420px] overflow-auto rounded border border-white/10">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#0b1220] text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-2 py-2">Row</th>
                      <th className="px-2 py-2">Record</th>
                      <th className="px-2 py-2">Class</th>
                      <th className="px-2 py-2">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localReport.rowResults.slice(0, 200).map((rr) => (
                      <tr
                        key={rr.rowIndex}
                        className="border-t border-white/[0.06] align-top text-slate-200"
                      >
                        <td className="px-2 py-1.5">{rr.rowIndex}</td>
                        <td className="px-2 py-1.5 font-mono text-[11px]">{rr.recordId ?? "—"}</td>
                        <td className="px-2 py-1.5">{rr.classification}</td>
                        <td className="px-2 py-1.5 text-[11px] text-slate-400">
                          {rr.issues.length
                            ? rr.issues
                                .map((i) => `${i.code}${i.blocking ? " (!)" : ""}`)
                                .join(", ")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DashboardCard>
          ) : null}
        </>
      ) : (
        <InfoNotice variant="info" title="No batch selected">
          <p className="text-sm">
            Upload a CSV to create a batch, or open this page with ?batchId=…
          </p>
        </InfoNotice>
      )}
    </div>
  );
}
