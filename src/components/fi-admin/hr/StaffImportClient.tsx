"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { Download, Upload } from "lucide-react";

import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { commitHrStaffImportAction, previewHrStaffImportAction } from "@/src/lib/actions/fi-hr-staff-import-actions";
import { syncIiohrHrStaffPayloadAction } from "@/src/lib/actions/fi-hr-staff-sync-actions";
import { pushCurrentHrStaffToFiAction } from "@/src/lib/actions/push-current-hr-staff-to-fi-actions";
import type { HrStaffImportPageModel } from "@/src/lib/staff/staffHrImportPage.server";
import type { IiohrHrStaffImportRowPlan } from "@/src/lib/staffImport/iiohrHrStaffImportTypes";
import type { IiohrHrStaffImportRunResult } from "@/src/lib/staffImport/iiohrHrStaffImportRunner";
import type { IiohrHrStaffSyncPayload, IiohrHrStaffSyncSummary } from "@/src/lib/staffImport/iiohrHrStaffSyncTypes";

/** Sample CSV for Evolved Perth HR import (client download only). */
const HR_STAFF_IMPORT_SAMPLE_CSV =
  "external_staff_id,full_name,email,staff_role,employment_status,source_url\n" +
  "EHR-PERTH-N001,Jordan Lee,jordan.lee.perth.nurse@example.com,nurse,active,https://hr.example.com/perth/staff/EHR-PERTH-N001\n" +
  "EHR-PERTH-D002,Sam Patel,sam.patel.perth.doctor@example.com,doctor,current,https://hr.example.com/perth/staff/EHR-PERTH-D002\n" +
  "EHR-PERTH-T003,Riley Chen,riley.chen.perth.tech@example.com,technician,employed,https://hr.example.com/perth/staff/EHR-PERTH-T003\n";

function downloadHrStaffImportSampleCsv(): void {
  const blob = new Blob([HR_STAFF_IMPORT_SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "evolved-perth-hr-staff-import-sample.csv";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && c === delimiter) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsvToRowObjects(text: string): unknown[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = parseDelimitedLine(lines[0]!, ",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseDelimitedLine(lines[i]!, ",");
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j]!;
      const raw = cells[j] ?? "";
      if (!key) continue;
      if (key === "working_hours" && raw) {
        try {
          row[key] = JSON.parse(raw) as unknown;
        } catch {
          row[key] = raw;
        }
      } else {
        row[key] = raw === "" ? null : raw;
      }
    }
    rows.push(row);
  }
  return rows;
}

function parseInputToRows(raw: string): { rows: unknown[]; error: string | null } {
  const t = raw.trim();
  if (!t) return { rows: [], error: "Paste or upload data first." };
  try {
    const parsed = JSON.parse(t) as unknown;
    if (Array.isArray(parsed)) return { rows: parsed, error: null };
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { rows?: unknown }).rows)) {
      return { rows: (parsed as { rows: unknown[] }).rows, error: null };
    }
    return { rows: [], error: "JSON must be an array of row objects, or an object with a `rows` array." };
  } catch {
    const csvRows = parseCsvToRowObjects(t);
    if (csvRows.length === 0) return { rows: [], error: "Could not parse as JSON or CSV (need a header row + data rows)." };
    return { rows: csvRows, error: null };
  }
}

function rowGroup(p: IiohrHrStaffImportRowPlan): "linked_staff" | "linked_user" | "new_staff" | "skipped" {
  if (p.skippedDuplicate || p.skippedValidation) return "skipped";
  if (p.matchKind === "user_email") return "linked_user";
  if (p.matchKind === "source_id" || p.matchKind === "staff_email") return "linked_staff";
  return "new_staff";
}

function formatStaffSyncRunTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function chipClass(kind: "neutral" | "ok" | "warn" | "bad" | "info"): string {
  const base =
    "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset";
  switch (kind) {
    case "ok":
      return `${base} bg-emerald-500/10 text-emerald-200 ring-emerald-500/25`;
    case "warn":
      return `${base} bg-amber-500/10 text-amber-100 ring-amber-500/30`;
    case "bad":
      return `${base} bg-rose-500/10 text-rose-100 ring-rose-500/30`;
    case "info":
      return `${base} bg-sky-500/10 text-sky-100 ring-sky-500/25`;
    default:
      return `${base} bg-white/[0.04] text-[#94A3B8] ring-white/10`;
  }
}

function RowPreviewCard({ p }: { p: IiohrHrStaffImportRowPlan }) {
  const g = rowGroup(p);
  const label =
    g === "linked_staff"
      ? "Existing FI staff"
      : g === "linked_user"
        ? "Existing FI user → new staff"
        : g === "new_staff"
          ? "New staff"
          : "Skipped";

  return (
    <li className="rounded-lg border border-white/[0.06] bg-[#0a1020]/60 px-3 py-2.5 text-sm text-[#CBD5E1]">
      <div className="flex flex-wrap items-center gap-2">
        <span className={chipClass(g === "skipped" ? "bad" : g === "new_staff" ? "info" : "ok")}>{label}</span>
        <span className="text-xs text-[#64748B]">source row {p.rowIndex}</span>
        {p.matchKind !== "none" ? (
          <span className={chipClass("neutral")}>match: {p.matchKind.replace("_", " ")}</span>
        ) : null}
      </div>
      <p className="mt-1.5 font-medium text-[#F1F5F9]">{p.row.full_name}</p>
      <p className="mt-0.5 text-xs text-[#94A3B8]">
        <span className="font-mono">{p.row.external_staff_id}</span>
        {p.row.email ? (
          <>
            {" "}
            · {p.row.email}
          </>
        ) : null}
        {p.row.staff_role ? (
          <>
            {" "}
            · role {p.row.staff_role}
          </>
        ) : null}
      </p>
      {p.skippedDuplicate ? <p className="mt-1 text-xs text-amber-200/90">Duplicate match — no actions.</p> : null}
      {p.skippedValidation && p.actions[0]?.type === "skip_row" ? (
        <p className="mt-1 text-xs text-rose-200/90">{p.actions[0].payload.reason}</p>
      ) : null}
    </li>
  );
}

export function StaffImportClient({
  tenantId,
  pageModel,
}: {
  tenantId: string;
  pageModel: HrStaffImportPageModel;
}) {
  const base = `/fi-admin/${tenantId}`;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [rawInput, setRawInput] = useState(
    '[\n  {\n    "external_staff_id": "HR-001",\n    "email": "person@clinic.example",\n    "full_name": "Example Person",\n    "staff_role": "consultant",\n    "employment_status": "active",\n    "source_url": "https://hr.example/p/001"\n  }\n]\n'
  );
  const [preview, setPreview] = useState<IiohrHrStaffImportRunResult | null>(null);
  const [lockedRows, setLockedRows] = useState<unknown[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [syncRawInput, setSyncRawInput] = useState(
    '[\n  {\n    "external_staff_id": "HR-SYNC-001",\n    "full_name": "Sync Example",\n    "email": "sync@clinic.example",\n    "staff_role": "nurse",\n    "employment_status": "active",\n    "source_url": "https://hr.example/staff/HR-SYNC-001",\n    "metadata_snapshot": { "training": [{ "id": "t1", "label": "CPR", "status": "current" }] }\n  }\n]\n'
  );
  const [syncSummary, setSyncSummary] = useState<IiohrHrStaffSyncSummary | null>(null);
  const [syncLockedPayload, setSyncLockedPayload] = useState<IiohrHrStaffSyncPayload | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncPending, startSyncTransition] = useTransition();

  const [fiOutboundError, setFiOutboundError] = useState<string | null>(null);
  const [fiOutboundOk, setFiOutboundOk] = useState<
    Awaited<ReturnType<typeof pushCurrentHrStaffToFiAction>> & { ok: true } | null
  >(null);
  const [fiOutboundPending, startFiOutboundTransition] = useTransition();

  const syncCounts = useMemo(() => {
    if (!syncSummary) return null;
    return syncSummary.result.commit && syncSummary.result.appliedCounts
      ? syncSummary.result.appliedCounts
      : syncSummary.result.dryRunCounts;
  }, [syncSummary]);

  const groupedRows = useMemo(() => {
    if (!preview?.ok || !preview.plan.perRow.length) return null;
    const m = {
      linked_staff: [] as IiohrHrStaffImportRowPlan[],
      linked_user: [] as IiohrHrStaffImportRowPlan[],
      new_staff: [] as IiohrHrStaffImportRowPlan[],
      skipped: [] as IiohrHrStaffImportRowPlan[],
    };
    for (const p of preview.plan.perRow) {
      m[rowGroup(p)].push(p);
    }
    return m;
  }, [preview]);

  const onFile = useCallback((f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setRawInput(text);
      setError(null);
      setPreview(null);
      setLockedRows(null);
    };
    reader.readAsText(f);
  }, []);

  const onPreview = () => {
    setError(null);
    const { rows, error: parseErr } = parseInputToRows(rawInput);
    if (parseErr) {
      setError(parseErr);
      setPreview(null);
      setLockedRows(null);
      return;
    }
    startTransition(async () => {
      const r = await previewHrStaffImportAction({ tenantId, rows });
      if (!r.ok) {
        setError(r.error);
        setPreview(null);
        setLockedRows(null);
        return;
      }
      setPreview(r.result);
      setLockedRows(r.validatedPackedRows);
    });
  };

  const onCommit = () => {
    setError(null);
    if (!lockedRows) {
      setError("Run Preview import first.");
      return;
    }
    startTransition(async () => {
      const r = await commitHrStaffImportAction({ tenantId, rows: lockedRows, confirm: true });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPreview(r.result);
      if (r.result.ok && r.result.commit) {
        setLockedRows(null);
      }
    });
  };

  const onSyncPreview = () => {
    setSyncError(null);
    const { rows, error: parseErr } = parseInputToRows(syncRawInput);
    if (parseErr) {
      setSyncError(parseErr);
      setSyncSummary(null);
      setSyncLockedPayload(null);
      return;
    }
    startSyncTransition(async () => {
      const r = await syncIiohrHrStaffPayloadAction({ tenantId, mode: "preview", rows });
      if (!r.ok) {
        setSyncError(r.error);
        setSyncSummary(null);
        setSyncLockedPayload(null);
        return;
      }
      setSyncSummary(r.summary);
      if ("validatedPayload" in r) {
        setSyncLockedPayload(r.validatedPayload);
      }
    });
  };

  const onSyncCommit = () => {
    setSyncError(null);
    if (!syncLockedPayload) {
      setSyncError("Run Preview sync payload first.");
      return;
    }
    startSyncTransition(async () => {
      const r = await syncIiohrHrStaffPayloadAction({
        tenantId,
        mode: "commit",
        confirm: true,
        rows: syncLockedPayload.rows,
      });
      if (!r.ok) {
        setSyncError(r.error);
        return;
      }
      if ("validatedPayload" in r) {
        return;
      }
      setSyncSummary(r.summary);
      if (r.summary.result.ok && r.summary.result.commit) {
        setSyncLockedPayload(null);
      }
    });
  };

  const onFiOutboundPreview = () => {
    setFiOutboundError(null);
    startFiOutboundTransition(async () => {
      const r = await pushCurrentHrStaffToFiAction({ tenantId, mode: "preview" });
      if (!r.ok) {
        setFiOutboundError(r.error);
        setFiOutboundOk(null);
        return;
      }
      setFiOutboundOk(r);
    });
  };

  const onFiOutboundCommit = () => {
    setFiOutboundError(null);
    startFiOutboundTransition(async () => {
      const r = await pushCurrentHrStaffToFiAction({ tenantId, mode: "commit", confirm: true });
      if (!r.ok) {
        setFiOutboundError(r.error);
        setFiOutboundOk(null);
        return;
      }
      setFiOutboundOk(r);
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">HR</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#F8FAFC] sm:text-3xl">Staff import</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Import <strong className="text-[#E2E8F0]">Evolved Hair Restoration Perth</strong> HR exports into Follicle
          Intelligence. Rows link to <span className="font-mono text-xs">fi_staff</span>,{" "}
          <span className="font-mono text-xs">fi_users</span> (by email when present), and{" "}
          <span className="font-mono text-xs">fi_staff_source_ids</span> with <span className="font-mono text-xs">iiohr_hr</span>.
          Review the plan, then commit — nothing is written until you confirm.
        </p>
        {pageModel.hasPerthClinic ? (
          <InfoNotice variant="info" title="Perth clinic detected">
            Imports will tag HR source rows with{" "}
            <span className="font-mono text-xs text-[#E2E8F0]">primary_fi_clinic_id</span> for{" "}
            <span className="font-medium text-[#E2E8F0]">{pageModel.perthClinicDisplayName ?? "Perth clinic"}</span>.
          </InfoNotice>
        ) : (
          <InfoNotice variant="warning" title="No Perth clinic match">
            We could not find a clinic whose name includes &quot;Perth&quot; for this tenant. Staff will still import at
            tenant level; add or rename a Perth site in Foundation if you need clinic linkage metadata on HR source ids.
          </InfoNotice>
        )}
        <InfoNotice variant="info" title="Outbound: IIOHR HR → FI (Evolved Perth)">
          When Perth staff changes in the IIOHR HR portal, use <span className="font-mono text-[#94A3B8]">Preview FI staff sync</span> then{" "}
          <span className="font-mono text-[#94A3B8]">Push FI staff sync</span> in the card below. Requires{" "}
          <span className="font-mono text-[#94A3B8]">IIOHR_HR_PERTH_STAFF_FEED_URL</span> on this host, and{" "}
          <span className="font-mono text-[#94A3B8]">FI_BASE_URL</span> plus <span className="font-mono text-[#94A3B8]">IIOHR_HR_SYNC_SECRET</span> matching
          the FI staff-sync API. Only the operational projection is sent — no contracts, letters, or payroll payloads.
        </InfoNotice>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100" role="alert">
          {error}
        </div>
      ) : null}

      <DashboardCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#F8FAFC]">Data</h2>
            <p className="mt-1 text-xs text-[#64748B]">
              Upload a CSV (header row) or paste JSON / CSV. Required columns: <span className="font-mono">external_staff_id</span>,{" "}
              <span className="font-mono">full_name</span>.
            </p>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-[#64748B]">
              Keep <span className="font-mono text-[#94A3B8]">external_staff_id</span> stable across exports — it is the key
              for matching and updating the same person on future re-imports (via{" "}
              <span className="font-mono text-[#94A3B8]">fi_staff_source_ids</span>).
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={downloadHrStaffImportSampleCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-transparent px-3 py-2 text-sm font-medium text-[#94A3B8] transition hover:border-white/12 hover:bg-white/[0.03] hover:text-[#CBD5E1]"
            >
              <Download className="h-4 w-4 opacity-80" aria-hidden />
              Download sample CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv,.json,.txt,text/csv,application/json" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-[#E2E8F0] transition hover:bg-white/[0.08]"
            >
              <Upload className="h-4 w-4 text-[#22C1FF]" aria-hidden />
              Upload CSV / JSON
            </button>
          </div>
        </div>
        <textarea
          className="mt-4 h-56 w-full rounded-lg border border-white/10 bg-[#0a1020] p-3 font-mono text-xs text-[#E2E8F0] outline-none ring-[#22C1FF]/40 focus:ring-2 sm:h-64"
          value={rawInput}
          onChange={(e) => {
            setRawInput(e.target.value);
            setPreview(null);
            setLockedRows(null);
          }}
          spellCheck={false}
          aria-label="HR staff import rows"
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
            disabled={pending || !preview?.ok || preview.commit || lockedRows === null}
            onClick={onCommit}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-40"
            title={!preview ? "Preview first" : undefined}
          >
            Commit import
          </button>
        </div>
        <p className="mt-3 text-xs text-[#64748B]">
          Commit uses the exact row set returned from your last successful preview. Edit the text area after preview to discard the lock and preview again.
        </p>
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[#F8FAFC]">Outbound: IIOHR HR → Follicle Intelligence</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
          Reads the configured Evolved Perth HR JSON feed, maps to FI staff-sync rows, and POSTs to{" "}
          <span className="font-mono text-xs text-[#CBD5E1]">POST …/integrations/iiohr-hr/staff-sync</span> on the FI
          deployment (<span className="font-mono text-xs">FI_BASE_URL</span>). Preview is dry-run on FI; push applies when FI accepts the commit.
        </p>

        {fiOutboundError ? (
          <div className="mt-4 rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100" role="alert">
            {fiOutboundError}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={fiOutboundPending}
            onClick={onFiOutboundPreview}
            className="rounded-xl border border-violet-500/40 bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-50"
          >
            {fiOutboundPending ? "Working…" : "Preview FI staff sync"}
          </button>
          <button
            type="button"
            disabled={fiOutboundPending}
            onClick={onFiOutboundCommit}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-50"
          >
            {fiOutboundPending ? "Working…" : "Push FI staff sync"}
          </button>
        </div>

        {fiOutboundOk ? (
          <div className="mt-6 space-y-3 rounded-lg border border-white/[0.06] bg-[#0a1020]/50 p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-[#CBD5E1]">
              <span className={chipClass(fiOutboundOk.display.fiOk ? "ok" : "bad")}>
                {fiOutboundOk.display.fiOk ? "FI accepted run" : "FI reported failure"}
              </span>
              <span className="text-xs text-[#64748B]">
                HTTP <span className="font-mono text-[#94A3B8]">{fiOutboundOk.fi.httpStatus}</span>
              </span>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["Rows sent", fiOutboundOk.display.rowsSent],
                  ["FI runId", fiOutboundOk.display.runId ?? "—"],
                  ["Created (rollup)", fiOutboundOk.display.created ?? "—"],
                  ["Updated (rollup)", fiOutboundOk.display.updated ?? "—"],
                  ["Linked", fiOutboundOk.display.linked ?? "—"],
                  ["Skipped rows", fiOutboundOk.display.skipped ?? "—"],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded border border-white/[0.05] bg-[#0a1020]/40 px-2 py-1.5">
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-[#64748B]">{k}</dt>
                  <dd className="font-mono text-sm text-[#F8FAFC]">{v}</dd>
                </div>
              ))}
            </dl>
            {fiOutboundOk.display.warnings.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-amber-200">Warnings</p>
                <ul className="mt-1 list-inside list-disc text-xs text-[#94A3B8]">
                  {fiOutboundOk.display.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-[#64748B]">
              Mapped <span className="font-mono text-[#94A3B8]">{fiOutboundOk.mappedRowCount}</span> HR feed row(s) before POST.
            </p>
          </div>
        ) : null}
      </DashboardCard>

      <DashboardCard className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[#F8FAFC]">IIOHR HR Sync</h2>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#94A3B8]">
          <p>
            <strong className="text-[#E2E8F0]">IIOHR HR</strong> remains the HR system of record. Follicle Intelligence keeps only{" "}
            <span className="font-mono text-xs text-[#CBD5E1]">fi_staff</span> (operational scheduling),{" "}
            <span className="font-mono text-xs text-[#CBD5E1]">fi_users</span> (tenant membership), and the identity bridge{" "}
            <span className="font-mono text-xs text-[#CBD5E1]">fi_staff_source_ids</span> with{" "}
            <span className="font-mono text-xs text-[#CBD5E1]">source_system = iiohr_hr</span> and{" "}
            <span className="font-mono text-xs text-[#CBD5E1]">source_staff_id</span> = your stable{" "}
            <span className="font-mono text-xs text-[#CBD5E1]">external_staff_id</span>.
          </p>
          <p>
            HR documents, contracts, letters, and full training history stay in IIOHR. Optional{" "}
            <span className="font-mono text-xs text-[#CBD5E1]">metadata_snapshot</span> is merged only into that source-id row as a{" "}
            <strong className="text-[#E2E8F0]">bounded</strong> JSON snapshot (plus <span className="font-mono text-xs">last_synced_at</span> on each sync).
          </p>
        </div>

        {syncError ? (
          <div className="mt-4 rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100" role="alert">
            {syncError}
          </div>
        ) : null}

        <textarea
          className="mt-4 h-40 w-full rounded-lg border border-white/10 bg-[#0a1020] p-3 font-mono text-xs text-[#E2E8F0] outline-none ring-[#22C1FF]/40 focus:ring-2 sm:h-48"
          value={syncRawInput}
          onChange={(e) => {
            setSyncRawInput(e.target.value);
            setSyncSummary(null);
            setSyncLockedPayload(null);
          }}
          spellCheck={false}
          aria-label="IIOHR HR sync payload"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={syncPending}
            onClick={onSyncPreview}
            className="rounded-xl border border-sky-500/40 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/25 disabled:opacity-50"
          >
            {syncPending ? "Working…" : "Preview sync payload"}
          </button>
          <button
            type="button"
            disabled={syncPending || syncLockedPayload === null}
            onClick={onSyncCommit}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-40"
            title={!syncSummary ? "Preview sync first" : undefined}
          >
            Commit sync payload
          </button>
        </div>
        <p className="mt-3 text-xs text-[#64748B]">
          Commit applies the same row objects from your last successful sync preview. Uses the same planner as staff import, then stamps sync metadata on{" "}
          <span className="font-mono text-[#94A3B8]">fi_staff_source_ids</span> only.
        </p>

        {syncSummary && syncCounts ? (
          <div className="mt-6 space-y-3 rounded-lg border border-white/[0.06] bg-[#0a1020]/50 p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-[#CBD5E1]">
              <span className={chipClass(syncSummary.result.commit ? "ok" : "info")}>
                {syncSummary.result.commit ? "Committed" : "Sync preview"}
              </span>
              <span className="text-xs text-[#64748B]">
                last_synced_at stamp: <span className="font-mono text-[#94A3B8]">{syncSummary.lastSyncedAt}</span>
              </span>
            </div>
            {!syncSummary.result.ok && syncSummary.result.error ? (
              <p className="text-sm text-rose-200">{syncSummary.result.error}</p>
            ) : null}
            <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["New fi_users", syncCounts.createdUsers],
                  ["Updated fi_users", syncCounts.updatedUsers],
                  ["New fi_staff", syncCounts.createdStaff],
                  ["Updated fi_staff", syncCounts.updatedStaff],
                  ["Staff ↔ user links", syncCounts.linkedStaff],
                  ["Deactivated staff", syncCounts.deactivatedStaff],
                  ["New source ids", syncCounts.createdSourceIds],
                  ["Updated source ids", syncCounts.updatedSourceIds],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded border border-white/[0.05] bg-[#0a1020]/40 px-2 py-1.5">
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-[#64748B]">{k}</dt>
                  <dd className="font-mono text-sm text-[#F8FAFC]">{v}</dd>
                </div>
              ))}
            </dl>
            {syncSummary.result.warnings.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-amber-200">Warnings</p>
                <ul className="mt-1 list-inside list-disc text-xs text-[#94A3B8]">
                  {syncSummary.result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8 border-t border-white/[0.06] pt-6">
          <h3 className="text-sm font-semibold text-[#F8FAFC]">Recent IIOHR HR API sync runs</h3>
          <p className="mt-1 text-xs text-[#64748B]">
            Last five producer POSTs to{" "}
            <span className="font-mono text-[#94A3B8]">/api/tenants/…/integrations/iiohr-hr/staff-sync</span> (header{" "}
            <span className="font-mono text-[#94A3B8]">x-iiohr-sync-secret</span>), stored in{" "}
            <span className="font-mono text-[#94A3B8]">fi_staff_sync_runs</span>.
          </p>
          {pageModel.recentStaffSyncRuns.length === 0 ? (
            <p className="mt-3 text-sm text-[#64748B]">No API sync runs recorded yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-white/[0.06]">
              <table className="w-full min-w-[720px] text-left text-xs text-[#CBD5E1]">
                <thead className="border-b border-white/[0.06] bg-[#0a1020]/80 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                  <tr>
                    <th className="px-3 py-2">Started</th>
                    <th className="px-3 py-2">Mode</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Rows</th>
                    <th className="px-3 py-2 text-right">Created</th>
                    <th className="px-3 py-2 text-right">Updated</th>
                    <th className="px-3 py-2 text-right">Linked</th>
                    <th className="px-3 py-2 text-right">Skipped</th>
                    <th className="px-3 py-2 text-right">Warnings</th>
                    <th className="px-3 py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {pageModel.recentStaffSyncRuns.map((r) => (
                    <tr key={r.id} className="border-b border-white/[0.04] last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 text-[#94A3B8]">{formatStaffSyncRunTime(r.started_at)}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[#E2E8F0]">{r.mode}</td>
                      <td className="px-3 py-2">
                        <span
                          className={chipClass(
                            r.status === "success" ? "ok" : r.status === "failed" ? "bad" : r.status === "running" ? "warn" : "neutral"
                          )}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{r.received_rows}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.created_count ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.updated_count ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.linked_count ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.skipped_count ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.warning_count ?? "—"}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-rose-200/90" title={r.error_message ?? undefined}>
                        {r.error_message ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardCard>

      {preview && preview.ok ? (
        <div className="space-y-4">
          <DashboardCard className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[#F8FAFC]">Summary</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={chipClass(preview.commit ? "ok" : "info")}>{preview.commit ? "Committed" : "Dry-run"}</span>
              {preview.skippedRowCount > 0 ? (
                <span className={chipClass("warn")}>Skipped rows: {preview.skippedRowCount}</span>
              ) : null}
              <span className={chipClass("neutral")}>Planned actions: {preview.plan.actions.length}</span>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["New fi_users", preview.dryRunCounts.createdUsers],
                  ["Updated fi_users", preview.dryRunCounts.updatedUsers],
                  ["New fi_staff", preview.dryRunCounts.createdStaff],
                  ["Updated fi_staff", preview.dryRunCounts.updatedStaff],
                  ["Staff ↔ user links", preview.dryRunCounts.linkedStaff],
                  ["Deactivated staff", preview.dryRunCounts.deactivatedStaff],
                  ["New source ids", preview.dryRunCounts.createdSourceIds],
                  ["Updated source ids", preview.dryRunCounts.updatedSourceIds],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-white/[0.05] bg-[#0a1020]/50 px-3 py-2">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">{k}</dt>
                  <dd className="mt-1 font-mono text-base text-[#F8FAFC]">{v}</dd>
                </div>
              ))}
            </dl>
            {preview.commit && preview.appliedCounts ? (
              <p className="mt-4 text-xs text-emerald-200/90">Applied counts match the summary above for this run.</p>
            ) : null}
          </DashboardCard>

          {preview.validationErrors.length > 0 ? (
            <DashboardCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-amber-200">Row schema validation</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[#94A3B8]">
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
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[#94A3B8]">
                {preview.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </DashboardCard>
          ) : null}

          {groupedRows ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <DashboardCard className="p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-[#F8FAFC]">Linked existing FI staff</h3>
                <p className="mt-1 text-xs text-[#64748B]">Matched by HR external id or staff email.</p>
                <ul className="mt-3 space-y-2">{groupedRows.linked_staff.length ? groupedRows.linked_staff.map((p) => <RowPreviewCard key={`${p.rowIndex}-${p.row.external_staff_id}`} p={p} />) : <li className="text-sm text-[#64748B]">None</li>}</ul>
              </DashboardCard>
              <DashboardCard className="p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-[#F8FAFC]">Linked existing FI user</h3>
                <p className="mt-1 text-xs text-[#64748B]">Email matched a tenant user; a new staff row is created and linked.</p>
                <ul className="mt-3 space-y-2">{groupedRows.linked_user.length ? groupedRows.linked_user.map((p) => <RowPreviewCard key={`${p.rowIndex}-${p.row.external_staff_id}`} p={p} />) : <li className="text-sm text-[#64748B]">None</li>}</ul>
              </DashboardCard>
              <DashboardCard className="p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-[#F8FAFC]">New staff to create</h3>
                <p className="mt-1 text-xs text-[#64748B]">No existing staff or user match — creates staff (and user when email is new).</p>
                <ul className="mt-3 space-y-2">{groupedRows.new_staff.length ? groupedRows.new_staff.map((p) => <RowPreviewCard key={`${p.rowIndex}-${p.row.external_staff_id}`} p={p} />) : <li className="text-sm text-[#64748B]">None</li>}</ul>
              </DashboardCard>
              <DashboardCard className="p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-[#F8FAFC]">Skipped / duplicates</h3>
                <ul className="mt-3 space-y-2">{groupedRows.skipped.length ? groupedRows.skipped.map((p) => <RowPreviewCard key={`${p.rowIndex}-${p.row.external_staff_id}`} p={p} />) : <li className="text-sm text-[#64748B]">None</li>}</ul>
              </DashboardCard>
            </div>
          ) : null}
        </div>
      ) : null}

      {preview && !preview.ok ? (
        <DashboardCard className="p-5 sm:p-6">
          <p className="text-sm text-rose-200">{preview.error ?? "Import could not complete."}</p>
        </DashboardCard>
      ) : null}

      <p className="text-center text-sm text-[#64748B]">
        <Link href={`${base}/staff`} className="text-[#94A3B8] underline-offset-2 hover:text-[#CBD5E1] hover:underline">
          Staff directory
        </Link>
        <span className="mx-2 text-[#475569]">·</span>
        <Link href={base} className="text-[#94A3B8] underline-offset-2 hover:text-[#CBD5E1] hover:underline">
          Dashboard
        </Link>
      </p>
    </div>
  );
}
