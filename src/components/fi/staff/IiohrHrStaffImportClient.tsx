"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";

import {
  commitIiohrHrStaffImportAction,
  planIiohrHrStaffImportAction,
} from "@/src/lib/actions/fi-staff-import-actions";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import type { IiohrHrStaffImportAction } from "@/src/lib/staffImport/iiohrHrStaffImportTypes";
import type { IiohrHrStaffImportRunResult } from "@/src/lib/staffImport/iiohrHrStaffImportRunner";

function groupActions(actions: IiohrHrStaffImportAction[]): Map<string, IiohrHrStaffImportAction[]> {
  const m = new Map<string, IiohrHrStaffImportAction[]>();
  for (const a of actions) {
    const list = m.get(a.type) ?? [];
    list.push(a);
    m.set(a.type, list);
  }
  return m;
}

export function IiohrHrStaffImportClient({ tenantId }: { tenantId: string }) {
  const base = `/fi-admin/${tenantId}`;
  const [jsonText, setJsonText] = useState(
    '[\n  {\n    "external_staff_id": "HR-001",\n    "email": "person@clinic.example",\n    "full_name": "Example Person",\n    "staff_role": "consultant",\n    "employment_status": "active",\n    "source_url": "https://hr.example/p/001"\n  }\n]\n'
  );
  const [preview, setPreview] = useState<IiohrHrStaffImportRunResult | null>(null);
  const [lastRows, setLastRows] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => (preview ? groupActions(preview.plan.actions) : null), [preview]);

  const parseRows = useCallback((): unknown | null => {
    try {
      return JSON.parse(jsonText) as unknown;
    } catch {
      return null;
    }
  }, [jsonText]);

  const onPreview = () => {
    setError(null);
    const rows = parseRows();
    if (rows === null) {
      setError("Invalid JSON.");
      setPreview(null);
      setLastRows(null);
      return;
    }
    startTransition(async () => {
      const r = await planIiohrHrStaffImportAction({ tenantId, rows });
      if (!r.ok) {
        setError(r.error);
        setPreview(null);
        setLastRows(null);
        return;
      }
      setLastRows(JSON.stringify(rows));
      setPreview(r.result);
    });
  };

  const onCommit = () => {
    setError(null);
    const rows = parseRows();
    if (rows === null) {
      setError("Invalid JSON.");
      return;
    }
    if (lastRows !== null && JSON.stringify(rows) !== lastRows) {
      setError("JSON changed since last preview — run Preview Import again before committing.");
      return;
    }
    startTransition(async () => {
      const r = await commitIiohrHrStaffImportAction({ tenantId, rows, confirm: true });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPreview(r.result);
      if (r.result.ok && r.result.commit) {
        setLastRows(null);
      }
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">Staff</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#F8FAFC] sm:text-3xl">Import IIOHR HR staff</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#94A3B8]">
          Dry-run first, then commit. Links rows to <span className="font-mono text-xs">fi_staff</span>,{" "}
          <span className="font-mono text-xs">fi_users</span> (when email is present), and{" "}
          <span className="font-mono text-xs">fi_staff_source_ids</span> with{" "}
          <span className="font-mono text-xs">iiohr_hr</span>. Does not delete records or embed HR systems.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100" role="alert">
          {error}
        </div>
      ) : null}

      <DashboardCard className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[#F8FAFC]">Import JSON</h2>
        <p className="mt-2 text-xs text-[#64748B]">Paste a JSON array of row objects. Required per row: external_staff_id, full_name.</p>
        <textarea
          className="mt-4 h-64 w-full rounded-lg border border-white/10 bg-[#0a1020] p-3 font-mono text-xs text-[#E2E8F0] outline-none ring-[#22C1FF]/40 focus:ring-2"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          spellCheck={false}
          aria-label="IIOHR HR staff rows JSON"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={onPreview}
            className="rounded-xl border border-[#22C1FF]/40 bg-[#22C1FF]/15 px-4 py-2 text-sm font-semibold text-[#22C1FF] transition hover:bg-[#22C1FF]/25 disabled:opacity-50"
          >
            {pending ? "Working…" : "Preview import"}
          </button>
          <button
            type="button"
            disabled={pending || !preview?.ok || preview.commit || lastRows === null}
            onClick={onCommit}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-40"
            title={!preview ? "Preview first" : undefined}
          >
            Commit import
          </button>
        </div>
        <p className="mt-3 text-xs text-[#64748B]">
          Commit requires an unchanged JSON payload since the last successful preview, and explicit confirmation on the server.
        </p>
      </DashboardCard>

      {preview ? (
        <div className="space-y-4">
          <DashboardCard className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[#F8FAFC]">Result</h2>
            <p className="mt-2 text-sm text-[#94A3B8]">
              OK: <span className="font-mono text-[#E2E8F0]">{String(preview.ok)}</span>
              {preview.error ? (
                <>
                  {" "}
                  — <span className="text-rose-200">{preview.error}</span>
                </>
              ) : null}
              {preview.commit ? (
                <span className="ml-2 rounded border border-emerald-500/30 px-2 py-0.5 text-xs text-emerald-200">Committed</span>
              ) : (
                <span className="ml-2 rounded border border-[#22C1FF]/30 px-2 py-0.5 text-xs text-[#22C1FF]">Dry-run</span>
              )}
            </p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[#64748B]">Skipped rows</dt>
                <dd className="font-mono text-[#E2E8F0]">{preview.skippedRowCount}</dd>
              </div>
              <div>
                <dt className="text-[#64748B]">Planned actions</dt>
                <dd className="font-mono text-[#E2E8F0]">{preview.plan.actions.length}</dd>
              </div>
            </dl>
          </DashboardCard>

          {preview.validationErrors.length > 0 ? (
            <DashboardCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-amber-200">Schema / row validation</h3>
              <ul className="mt-2 list-inside list-disc text-sm text-[#94A3B8]">
                {preview.validationErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </DashboardCard>
          ) : null}

          {preview.plan.validationIssues.length > 0 ? (
            <DashboardCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-amber-200">Planner validation</h3>
              <ul className="mt-2 space-y-1 text-sm text-[#94A3B8]">
                {preview.plan.validationIssues.map((v, i) => (
                  <li key={`${v.rowIndex}-${i}`}>
                    Row {v.rowIndex}
                    {v.field ? ` (${v.field})` : ""}: {v.message}
                  </li>
                ))}
              </ul>
            </DashboardCard>
          ) : null}

          {preview.warnings.length > 0 ? (
            <DashboardCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-[#F8FAFC]">Warnings</h3>
              <ul className="mt-2 list-inside list-disc text-sm text-[#94A3B8]">
                {preview.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </DashboardCard>
          ) : null}

          {grouped && grouped.size > 0 ? (
            <DashboardCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-[#F8FAFC]">Planned actions by type</h3>
              <div className="mt-4 space-y-4">
                {Array.from(grouped.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([type, acts]) => (
                    <div key={type}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#22C1FF]/90">
                        {type} ({acts.length})
                      </p>
                      <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-white/10 bg-[#0a1020] p-3 text-[10px] leading-relaxed text-[#CBD5E1]">
                        {JSON.stringify(acts, null, 2)}
                      </pre>
                    </div>
                  ))}
              </div>
            </DashboardCard>
          ) : null}

          {preview.plan.perRow.some((p) => p.skippedDuplicate || p.skippedValidation) ? (
            <DashboardCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-[#F8FAFC]">Skipped / validation rows</h3>
              <ul className="mt-2 text-sm text-[#94A3B8]">
                {preview.plan.perRow
                  .filter((p) => p.skippedDuplicate || p.skippedValidation)
                  .map((p) => (
                    <li key={p.rowIndex}>
                      Row {p.rowIndex}: {p.skippedDuplicate ? "duplicate match" : "validation skip"}
                      {p.actions[0]?.type === "skip_row" ? ` — ${p.actions[0].payload.reason}` : ""}
                    </li>
                  ))}
              </ul>
            </DashboardCard>
          ) : null}
        </div>
      ) : null}

      <p className="text-center text-sm text-[#64748B]">
        <Link href={`${base}/staff`} className="text-[#94A3B8] underline-offset-2 hover:text-[#CBD5E1] hover:underline">
          Back to staff directory
        </Link>
      </p>
    </div>
  );
}
