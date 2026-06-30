"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";

import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import {
  commitEvolvedPayrollStaffImportAction,
  parseEvolvedPayrollXlsxAction,
  previewEvolvedPayrollStaffImportAction,
} from "@/src/lib/actions/fi-evolved-payroll-staff-import-actions";
import type { HrStaffImportPageModel } from "@/src/lib/staff/staffHrImportPage.server";
import type { EvolvedPayrollStaffImportRowPlan } from "@/src/lib/staffImport/evolvedPayrollStaffImportTypes";
import type { EvolvedPayrollStaffImportRunResult } from "@/src/lib/staffImport/evolvedPayrollStaffImportRunner";

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

function PayrollRowPreviewCard({ p }: { p: EvolvedPayrollStaffImportRowPlan }) {
  return (
    <li className="rounded-lg border border-white/[0.06] bg-[#0a1020]/60 px-3 py-2.5 text-sm text-[#CBD5E1]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[#64748B]">row {p.rowIndex}</span>
        {p.matchKind !== "none" ? (
          <span className={chipClass("neutral")}>match: {p.matchKind.replace("_", " ")}</span>
        ) : null}
        {p.needsRoleAssignment ? <span className={chipClass("warn")}>needs role</span> : null}
      </div>
      <p className="mt-1.5 font-medium text-[#F1F5F9]">{p.row.full_name}</p>
      <p className="mt-0.5 text-xs text-[#94A3B8]">
        <span className="font-mono">{p.row.external_staff_id}</span>
        {p.row.email ? <> · {p.row.email}</> : null}
        {p.row.mobile ? <> · {p.row.mobile}</> : null}
        {p.row.employment_type ? <> · {p.row.employment_type}</> : null}
        {p.row.start_date ? <> · start {p.row.start_date}</> : null}
      </p>
    </li>
  );
}

export function PayrollStaffImportClient({
  tenantId,
  pageModel,
}: {
  tenantId: string;
  pageModel: HrStaffImportPageModel;
}) {
  const base = `/fi-admin/${tenantId}`;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<EvolvedPayrollStaffImportRunResult | null>(null);
  const [lockedPayload, setLockedPayload] = useState<{
    packedRows: unknown[];
    sourceRowIndices: number[];
    skippedSensitiveFields: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onFile = useCallback(
    (f: File | null) => {
      if (!f) return;
      setError(null);
      setPreview(null);
      setLockedPayload(null);
      setFileName(f.name);
      const reader = new FileReader();
      reader.onload = () => {
        const buf = reader.result;
        if (!(buf instanceof ArrayBuffer)) {
          setError("Could not read file.");
          return;
        }
        const bytes = new Uint8Array(buf);
        const base64 = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
        startTransition(async () => {
          const parsed = await parseEvolvedPayrollXlsxAction({ tenantId, fileBase64: base64 });
          if (!parsed.ok) {
            setError(parsed.error);
            return;
          }
          const r = await previewEvolvedPayrollStaffImportAction({
            tenantId,
            packedRows: parsed.rows,
            sourceRowIndices: parsed.sourceRowIndices,
            skippedSensitiveFields: parsed.skippedSensitiveFields,
          });
          if (!r.ok) {
            setError(r.error);
            return;
          }
          setPreview(r.result);
          setLockedPayload({
            packedRows: r.validatedPackedRows,
            sourceRowIndices: parsed.sourceRowIndices,
            skippedSensitiveFields: parsed.skippedSensitiveFields,
          });
        });
      };
      reader.readAsArrayBuffer(f);
    },
    [tenantId]
  );

  const onPreview = () => {
    if (!lockedPayload) {
      setError("Upload a payroll export (.xlsx) first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await previewEvolvedPayrollStaffImportAction({
        tenantId,
        packedRows: lockedPayload.packedRows,
        sourceRowIndices: lockedPayload.sourceRowIndices,
        skippedSensitiveFields: lockedPayload.skippedSensitiveFields,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPreview(r.result);
    });
  };

  const onCommit = () => {
    if (!lockedPayload || !preview?.ok) {
      setError("Run preview first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await commitEvolvedPayrollStaffImportAction({
        tenantId,
        confirm: true,
        packedRows: lockedPayload.packedRows,
        sourceRowIndices: lockedPayload.sourceRowIndices,
        skippedSensitiveFields: lockedPayload.skippedSensitiveFields,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPreview(r.result);
      if (r.result.ok && r.result.commit) {
        setLockedPayload(null);
        setFileName(null);
      }
    });
  };

  const buckets = preview?.preview;

  const counts = useMemo(() => {
    if (!preview) return null;
    return preview.commit && preview.appliedCounts ? preview.appliedCounts : preview.dryRunCounts;
  }, [preview]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">
          HR · Payroll import
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#F8FAFC] sm:text-3xl">
          Evolved payroll staff import
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Import operational staff from an Evolved payroll{" "}
          <span className="font-mono text-xs">EmployeeData</span> export for tenant{" "}
          <strong className="text-[#E2E8F0]">Evolved Hair Restoration</strong>, clinic{" "}
          <strong className="text-[#E2E8F0]">Evolved Hair Restoration Perth</strong>. TFN, DOB,
          address, bank, super, tax, and salary fields are never imported or shown here.
        </p>
        {pageModel.hasPerthClinic ? (
          <InfoNotice variant="info" title="Perth clinic detected">
            Payroll source rows will link to{" "}
            <span className="font-medium text-[#E2E8F0]">
              {pageModel.perthClinicDisplayName ?? "Perth clinic"}
            </span>{" "}
            via{" "}
            <span className="font-mono text-xs">
              fi_staff_source_ids.metadata.primary_fi_clinic_id
            </span>
            .
          </InfoNotice>
        ) : (
          <InfoNotice variant="warning" title="No Perth clinic match">
            Staff still import at tenant level; clinic display name is stored in payroll metadata
            only.
          </InfoNotice>
        )}
        <p className="text-sm text-[#64748B]">
          <Link
            href={`${base}/hr/staff-import`}
            className="text-[#94A3B8] underline-offset-2 hover:underline"
          >
            ← IIOHR HR import
          </Link>
        </p>
      </header>

      {error ? (
        <div
          className="rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <DashboardCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#F8FAFC]">Payroll export file</h2>
            <p className="mt-1 text-xs text-[#64748B]">
              Upload <span className="font-mono">EVOLVEDCLINICSPTYLTD_EmployeeData_*.xlsx</span>.
              Preview runs automatically after upload.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-[#E2E8F0] transition hover:bg-white/[0.08]"
          >
            <Upload className="h-4 w-4 text-[#22C1FF]" aria-hidden />
            Upload .xlsx
          </button>
        </div>
        {fileName ? <p className="mt-3 text-xs text-[#94A3B8]">Selected: {fileName}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending || !lockedPayload}
            onClick={onPreview}
            className="rounded-xl border border-[#22C1FF]/40 bg-[#22C1FF]/15 px-4 py-2 text-sm font-semibold text-[#22C1FF] transition hover:bg-[#22C1FF]/25 disabled:opacity-50"
          >
            {pending ? "Working…" : "Re-run preview"}
          </button>
          <button
            type="button"
            disabled={pending || !preview?.ok || preview.commit || !lockedPayload}
            onClick={onCommit}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-40"
          >
            Commit import
          </button>
        </div>
      </DashboardCard>

      {preview && preview.ok && preview.commit && buckets ? (
        <DashboardCard className="border-emerald-500/30 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-emerald-100">Import complete</h2>
          <p className="mt-1 text-sm text-[#94A3B8]">Payroll staff rows were written to FI OS.</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                [
                  "Created",
                  preview.appliedCounts?.createdStaff ?? preview.dryRunCounts.createdStaff,
                ],
                [
                  "Updated",
                  preview.appliedCounts?.updatedStaff ?? preview.dryRunCounts.updatedStaff,
                ],
                [
                  "Skipped",
                  preview.skippedRowCount +
                    buckets.duplicate_email_skipped.length +
                    buckets.invalid_email.length,
                ],
                ["Needs role assignment", buckets.needs_role_assignment.length],
              ] as const
            ).map(([k, v]) => (
              <div
                key={k}
                className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2"
              >
                <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-200/80">
                  {k}
                </dt>
                <dd className="mt-1 font-mono text-xl text-[#F8FAFC]">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`${base}/hr/staff-readiness`}
              className="inline-flex rounded-xl border border-[#22C1FF]/40 bg-[#22C1FF]/15 px-4 py-2.5 text-sm font-semibold text-[#E0F7FF] transition hover:bg-[#22C1FF]/25"
            >
              Open staff readiness dashboard
            </Link>
            {buckets.needs_role_assignment.length > 0 ? (
              <Link
                href={`${base}/staff/role-review`}
                className="inline-flex rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/25"
              >
                Assign staff roles now
              </Link>
            ) : null}
          </div>
          {buckets.needs_role_assignment.length > 0 ? (
            <p className="mt-2 text-xs text-[#64748B]">
              Staff readiness shows payroll links, HR onboarding, and clinical availability. Assign
              roles for imported staff with <span className="font-mono">needs_review</span>.
            </p>
          ) : (
            <p className="mt-2 text-xs text-[#64748B]">
              Review operational readiness across payroll, HR, training, and clinical availability.
            </p>
          )}
        </DashboardCard>
      ) : null}

      {preview && preview.ok && buckets ? (
        <div className="space-y-4">
          <DashboardCard className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[#F8FAFC]">Summary</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={chipClass(preview.commit ? "ok" : "info")}>
                {preview.commit ? "Committed" : "Dry-run"}
              </span>
              <span className={chipClass("neutral")}>
                Rows: {preview.validatedPackedRows?.length ?? 0}
              </span>
            </div>
            {counts ? (
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ["New fi_staff", counts.createdStaff],
                    ["Updated fi_staff", counts.updatedStaff],
                    ["New source ids", counts.createdSourceIds],
                    ["Deactivated", counts.deactivatedStaff],
                  ] as const
                ).map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-lg border border-white/[0.05] bg-[#0a1020]/50 px-3 py-2"
                  >
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">
                      {k}
                    </dt>
                    <dd className="mt-1 font-mono text-base text-[#F8FAFC]">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </DashboardCard>

          {buckets.skipped_sensitive_fields.length > 0 ? (
            <DashboardCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-[#F8FAFC]">Skipped sensitive fields</h3>
              <p className="mt-1 text-xs text-[#64748B]">
                Column names present in the export but never imported or displayed.
              </p>
              <p className="mt-2 font-mono text-xs leading-relaxed text-[#94A3B8]">
                {buckets.skipped_sensitive_fields.join(", ")}
              </p>
            </DashboardCard>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <DashboardCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-[#F8FAFC]">
                New staff ({buckets.new_staff.length})
              </h3>
              <ul className="mt-3 space-y-2">
                {buckets.new_staff.length ? (
                  buckets.new_staff.map((p) => (
                    <PayrollRowPreviewCard key={`n-${p.rowIndex}`} p={p} />
                  ))
                ) : (
                  <li className="text-sm text-[#64748B]">None</li>
                )}
              </ul>
            </DashboardCard>
            <DashboardCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-[#F8FAFC]">
                Matched existing staff ({buckets.matched_existing_staff.length})
              </h3>
              <ul className="mt-3 space-y-2">
                {buckets.matched_existing_staff.length ? (
                  buckets.matched_existing_staff.map((p) => (
                    <PayrollRowPreviewCard key={`m-${p.rowIndex}`} p={p} />
                  ))
                ) : (
                  <li className="text-sm text-[#64748B]">None</li>
                )}
              </ul>
            </DashboardCard>
            <DashboardCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-[#F8FAFC]">
                Needs role assignment ({buckets.needs_role_assignment.length})
              </h3>
              <p className="mt-1 text-xs text-[#64748B]">
                Imported with <span className="font-mono">staff_role = needs_review</span>. Paul can
                assign roles in Staff directory.
              </p>
              <ul className="mt-3 space-y-2">
                {buckets.needs_role_assignment.length ? (
                  buckets.needs_role_assignment.map((p) => (
                    <PayrollRowPreviewCard key={`r-${p.rowIndex}`} p={p} />
                  ))
                ) : (
                  <li className="text-sm text-[#64748B]">None</li>
                )}
              </ul>
            </DashboardCard>
            <DashboardCard className="p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-[#F8FAFC]">Email issues</h3>
              <p className="mt-1 text-xs text-[#64748B]">
                Missing: {buckets.missing_email.length} · Invalid: {buckets.invalid_email.length} ·
                Duplicate skipped: {buckets.duplicate_email_skipped.length}
              </p>
            </DashboardCard>
          </div>
        </div>
      ) : null}

      <DashboardCard className="p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-[#F8FAFC]">Assign roles after import</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
          Use the{" "}
          <Link
            href={`${base}/staff/role-review`}
            className="text-[#CBD5E1] underline-offset-2 hover:underline"
          >
            Assign staff roles
          </Link>{" "}
          workflow to set <span className="font-mono text-xs">staff_role</span> for each imported
          member (e.g. surgeon, nurse, consultant, technician). Payroll job titles are not mapped
          automatically.
        </p>
      </DashboardCard>
    </div>
  );
}
