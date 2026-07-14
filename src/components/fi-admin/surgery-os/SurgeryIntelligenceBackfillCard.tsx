"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { runSurgeryIntelligenceBackfillAction } from "@/lib/actions/fi-surgery-intelligence-backfill-actions";
import type { SurgeryIntelligenceBackfillSummary } from "@/src/lib/outcomeIntelligence/surgeryIntelligenceBackfillCore";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#0c1426]/80 px-3 py-2 text-sm text-[#E2E8F0] placeholder:text-[#64748B] focus:border-[#22C1FF]/50 focus:outline-none";

function SummaryGrid({ summary }: { summary: SurgeryIntelligenceBackfillSummary }) {
  const items = [
    { label: "Scanned", value: summary.scanned },
    { label: "Eligible", value: summary.eligible },
    { label: summary.dryRun ? "Would publish" : "Published", value: summary.published },
    { label: summary.dryRun ? "Would update" : "Updated", value: summary.updated },
    { label: "Skipped (no final count)", value: summary.skippedNoFinalCount },
    { label: "Skipped (missing context)", value: summary.skippedMissingContext },
    { label: "Skipped (newer version)", value: summary.skippedNewerVersion },
    { label: "Failed", value: summary.failed },
  ];

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-white/[0.06] px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
            {item.label}
          </div>
          <div className="text-lg font-semibold tabular-nums text-[#F8FAFC]">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function SurgeryIntelligenceBackfillCard({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [surgeryId, setSurgeryId] = useState("");
  const [caseId, setCaseId] = useState("");
  const [procedureFrom, setProcedureFrom] = useState("");
  const [procedureTo, setProcedureTo] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [force, setForce] = useState(false);
  const [lastSummary, setLastSummary] = useState<SurgeryIntelligenceBackfillSummary | null>(null);

  const runBackfill = useCallback(() => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await runSurgeryIntelligenceBackfillAction(tenantId, {
        dryRun,
        force: force || undefined,
        adminKey: adminKey.trim() || undefined,
        surgery_id: surgeryId.trim() || undefined,
        case_id: caseId.trim() || undefined,
        procedure_date_from: procedureFrom.trim() || undefined,
        procedure_date_to: procedureTo.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
      setLastSummary(result.data.summary);
      if (!result.data.summary.dryRun) router.refresh();
    });
  }, [tenantId, dryRun, force, adminKey, surgeryId, caseId, procedureFrom, procedureTo, router]);

  return (
    <DashboardCard className="p-5">
      <SectionHeader
        title="Rebuild intelligence facts"
        description="Backfill published surgery_case_intelligence_facts for historical reviewed cases. Run a dry-run preview before writing to fi_analytics_events."
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
            Surgery ID (optional)
          </span>
          <input
            type="text"
            value={surgeryId}
            onChange={(e) => setSurgeryId(e.target.value)}
            placeholder="Single surgery rebuild"
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
            Case ID (optional)
          </span>
          <input
            type="text"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
            Admin key (required for force)
          </span>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className={inputClass}
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
            Procedure from
          </span>
          <input
            type="date"
            value={procedureFrom}
            onChange={(e) => setProcedureFrom(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
            Procedure to
          </span>
          <input
            type="date"
            value={procedureTo}
            onChange={(e) => setProcedureTo(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[#CBD5E1]">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="rounded border-white/20"
          />
          Dry run (preview only)
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
            className="rounded border-white/20"
          />
          Force overwrite newer facts version
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={runBackfill}
          className="rounded-lg bg-[#22C1FF]/15 px-4 py-2 text-sm font-medium text-[#22C1FF] ring-1 ring-[#22C1FF]/30 hover:bg-[#22C1FF]/25 disabled:opacity-50"
        >
          {pending ? "Running…" : dryRun ? "Preview backfill" : "Run backfill"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
      {lastSummary ? <SummaryGrid summary={lastSummary} /> : null}
      {lastSummary?.failures.length ? (
        <ul className="mt-3 space-y-1 text-xs text-red-200">
          {lastSummary.failures.map((f) => (
            <li key={`${f.surgeryId}-${f.reason}`}>
              {f.surgeryId}: {f.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </DashboardCard>
  );
}
