"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import {
  applyHubspotContactMigrationBatchAction,
  loadHubspotContactMigrationWorkspaceAction,
  previewHubspotContactMigrationBatchAction,
  reconcileHubspotContactMigrationBatchAction,
  saveHubspotContactMigrationDecisionAction,
  selectHubspotContactMigrationBatchAction,
} from "@/lib/actions/fi-hubspot-contact-lead-expansion-actions";
import type {
  HubspotContactLeadDataQualityProfile,
  HubspotContactLeadExpansionFilter,
  HubspotContactLeadExpansionRow,
  HubspotContactLeadExpansionSummary,
} from "@/src/lib/integrations/hubspot/import/hubspotContactLeadExpansionTypes";

type Props = { tenantId: string; canMutate: boolean };

const FILTERS: { id: HubspotContactLeadExpansionFilter; label: string }[] = [
  { id: "ready", label: "Ready" },
  { id: "existing_lead", label: "Existing lead" },
  { id: "new_lead", label: "New lead" },
  { id: "patient_review", label: "Patient review" },
  { id: "missing_identity", label: "Missing identity" },
  { id: "duplicate", label: "Duplicate" },
  { id: "test_smoke", label: "Test/smoke" },
  { id: "conflict", label: "Conflict" },
  { id: "applied", label: "Applied" },
  { id: "remaining", label: "Remaining" },
  { id: "all", label: "All" },
];

function actionLabel(decision: HubspotContactLeadExpansionRow["decision"]): string {
  switch (decision) {
    case "link_existing_lead":
      return "Link to existing lead";
    case "create_new_lead":
      return "Create new lead";
    case "already_linked":
      return "Already linked";
    case "patient_link_review_required":
      return "Patient-link review required";
    case "already_applied":
      return "Already applied";
    default:
      return decision.replace(/_/g, " ");
  }
}

export function HubspotContactMigrationPanel({ tenantId, canMutate }: Props) {
  const [filter, setFilter] = useState<HubspotContactLeadExpansionFilter>("ready");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState<HubspotContactLeadExpansionSummary | null>(null);
  const [dataQuality, setDataQuality] = useState<HubspotContactLeadDataQualityProfile | null>(null);
  const [rows, setRows] = useState<HubspotContactLeadExpansionRow[]>([]);
  const [batchMax, setBatchMax] = useState(100);
  const [priorGate, setPriorGate] = useState<{
    priorBatchId: string | null;
    reconciled: boolean;
    status: string | null;
  } | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showAudit, setShowAudit] = useState(false);
  const [stage, setStage] = useState<
    "draft" | "ready_for_review" | "approved" | "applied" | "reconciled"
  >("draft");
  const [preview, setPreview] = useState<{
    batchId: string;
    checksum: string;
    links: Array<{ hubspotContactId: string; leadId: string; displayName: string }>;
    creates: Array<{ hubspotContactId: string; displayName: string }>;
    quarantined: number;
    patientReviewsExcluded: number;
  } | null>(null);
  const [confirmId, setConfirmId] = useState("");
  const [lastAppliedBatchId, setLastAppliedBatchId] = useState<string | null>(null);

  const reload = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const res = await loadHubspotContactMigrationWorkspaceAction(tenantId, filter, search);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSummary(res.data.summary);
      setDataQuality(res.data.dataQuality);
      setRows(res.data.rows);
      setBatchMax(res.data.batchMax);
      setPriorGate(res.data.priorGate);
      setIndex(0);
    });
  }, [tenantId, filter, search]);

  useEffect(() => {
    reload();
  }, [reload]);

  const current = rows[index] ?? null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(Math.max(rows.length - 1, 0), i + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows.length]);

  function saveDecision(
    decision: HubspotContactLeadExpansionRow["decision"],
    approvedForApply: boolean
  ) {
    if (!current || !canMutate) return;
    startTransition(async () => {
      setError(null);
      const res = await saveHubspotContactMigrationDecisionAction(tenantId, {
        hubspotContactId: current.hubspotContactId,
        decision,
        approvedForApply,
        targetLeadId: current.proposedLeadId,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Decision saved.");
      reload();
    });
  }

  function runSelectBatch() {
    if (!canMutate) return;
    startTransition(async () => {
      setError(null);
      const res = await selectHubspotContactMigrationBatchAction(tenantId, batchMax);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStage("ready_for_review");
      setMessage(
        `Batch E${res.result.batchSequence} selected: ${res.result.selected.length} contact(s) (max ${res.result.batchMax}).`
      );
      reload();
    });
  }

  function runPreview() {
    if (!canMutate) return;
    startTransition(async () => {
      setError(null);
      const res = await previewHubspotContactMigrationBatchAction(tenantId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPreview(res.preview);
      setConfirmId("");
      setStage("approved");
      setMessage(
        `Preview ready: ${res.preview.links.length} link(s), ${res.preview.creates.length} new lead(s).`
      );
    });
  }

  function runApply() {
    if (!canMutate || !preview) return;
    if (confirmId.trim() !== preview.batchId) {
      setError("Enter the batch ID to confirm. Nothing will be applied until it matches.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const res = await applyHubspotContactMigrationBatchAction(
        tenantId,
        preview.batchId,
        preview.checksum,
        confirmId.trim()
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLastAppliedBatchId(preview.batchId);
      setStage("applied");
      setMessage(
        `Applied: linked ${res.result.linked}, created ${res.result.created}, already applied ${res.result.alreadyApplied}. Patients unchanged (${res.result.patientCountBefore} → ${res.result.patientCountAfter}).`
      );
      setPreview(null);
      reload();
    });
  }

  function runReconcile() {
    if (!canMutate || !lastAppliedBatchId) return;
    startTransition(async () => {
      setError(null);
      const res = await reconcileHubspotContactMigrationBatchAction(tenantId, lastAppliedBatchId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStage("reconciled");
      setMessage(
        res.reconciliation.balanced
          ? `Batch reconciled — unexplained ${res.reconciliation.unexplained}. Ready for next batch.`
          : `Reconciliation failed — unexplained ${res.reconciliation.unexplained}.`
      );
      reload();
    });
  }

  const primaryLabel =
    stage === "draft"
      ? "Select next batch"
      : stage === "ready_for_review"
        ? "Preview batch"
        : stage === "approved"
          ? "Apply approved batch"
          : stage === "applied"
            ? "Verify batch"
            : "Prepare next batch";

  return (
    <section className="space-y-4" aria-label="HubSpot contact migration expansion">
      <div className="rounded border border-cyan-500/30 bg-cyan-500/5 p-3 text-sm text-cyan-100">
        Migrate HubSpot contacts into FI lead mappings in bounded batches. Patients are never created
        or linked automatically. First batch max {batchMax}. Prior batch must reconcile before the
        next apply.
      </div>

      {priorGate && priorGate.priorBatchId && !priorGate.reconciled ? (
        <p className="rounded border border-amber-500/50 bg-amber-500/15 p-3 text-sm text-amber-50" role="status">
          Previous batch is not reconciled yet. Verify and reconcile before starting the next batch.
        </p>
      ) : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
          <Stat label="Source contacts" value={String(summary.totalSourceContacts)} />
          <Stat label="Already linked" value={String(summary.alreadyLinked)} />
          <Stat label="Ready to link" value={String(summary.readyToLink)} />
          <Stat label="New leads proposed" value={String(summary.proposedNewLeads)} />
          <Stat label="Patient review" value={String(summary.patientReview)} />
          <Stat label="Quarantined" value={String(summary.quarantined)} />
          <Stat label="Remaining" value={String(summary.remaining)} />
          <Stat label="Completion" value={`${summary.migrationCompletionPercent}%`} />
        </div>
      ) : null}

      {dataQuality ? (
        <details className="rounded border border-white/10 bg-slate-950/40 p-3 text-sm text-slate-300">
          <summary className="cursor-pointer text-slate-200">Data-quality profile</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <span>Missing names: {dataQuality.missingNames}</span>
            <span>Missing emails: {dataQuality.missingEmails}</span>
            <span>Missing phones: {dataQuality.missingPhones}</span>
            <span>Duplicate emails: {dataQuality.duplicateEmails}</span>
            <span>Test/smoke: {dataQuality.possibleTestOrSmoke}</span>
            <span>Patient overlap: {dataQuality.possiblePatientOverlap}</span>
            <span>Already mapped: {dataQuality.sourceIdsAlreadyMapped}</span>
            <span>Multi-target: {dataQuality.multipleFiLeadTargets}</span>
            <span>Missing owners (deferred): {dataQuality.missingOwners}</span>
          </div>
        </details>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-300">
          Filter
          <select
            className="mt-1 block rounded border border-white/10 bg-slate-900 px-3 py-2"
            value={filter}
            onChange={(e) => setFilter(e.target.value as HubspotContactLeadExpansionFilter)}
          >
            {FILTERS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[16rem] flex-1 text-sm text-slate-300">
          Search
          <input
            className="mt-1 w-full rounded border border-white/10 bg-slate-900 px-3 py-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email, or contact ID"
          />
        </label>
        <button
          type="button"
          className="rounded bg-slate-800 px-3 py-2 text-sm"
          disabled={pending}
          onClick={() => reload()}
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-100" role="status">
          {message}
        </p>
      ) : null}

      {!current ? (
        <p className="text-sm text-slate-400">No contacts in this filter.</p>
      ) : (
        <article className="space-y-4 rounded-xl border border-white/10 bg-slate-950/60 p-4">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Contact {index + 1} of {rows.length}
              </p>
              <h2 className="text-xl font-semibold text-slate-50">{current.displayName}</h2>
              <p className="text-sm text-slate-400">
                {[current.email, current.phone].filter(Boolean).join(" · ") || "No email/phone"}
              </p>
              <p
                className={`mt-1 text-sm ${
                  current.decision === "create_new_lead" ? "text-amber-200" : "text-cyan-200"
                }`}
              >
                {actionLabel(current.decision)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded bg-slate-800 px-3 py-2 text-sm disabled:opacity-40"
                disabled={index <= 0 || pending}
                onClick={() => setIndex((i) => i - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="rounded bg-slate-800 px-3 py-2 text-sm disabled:opacity-40"
                disabled={index >= rows.length - 1 || pending}
                onClick={() => setIndex((i) => i + 1)}
              >
                Next
              </button>
            </div>
          </header>

          {current.patientProtectionWarning ? (
            <p className="rounded border border-amber-500/50 bg-amber-500/15 p-3 text-sm text-amber-50">
              {current.patientProtectionWarning}
            </p>
          ) : null}
          {current.quarantineReason ? (
            <p className="rounded border border-slate-500/40 bg-slate-800/60 p-3 text-sm text-slate-200">
              {current.quarantineReason}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <Stat label="Matched lead" value={current.proposedLeadLabel ?? "—"} />
            <Stat label="Match confidence" value={current.identityTier.replace(/_/g, " ")} />
            <Stat label="Owner status" value={current.ownerResolutionStatus.replace(/_/g, " ")} />
            <Stat
              label="Stage"
              value={
                current.mappedFiStageSlug
                  ? current.mappedFiStageSlug.replace(/_/g, " ")
                  : current.sourceStageLabel ?? "Deferred (not on source)"
              }
            />
            <Stat label="Apply eligible" value={current.applyEligible ? "Yes" : "No"} />
          </div>

          {canMutate ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                disabled={
                  pending ||
                  !["link_existing_lead", "already_linked", "create_new_lead"].includes(
                    current.decision
                  )
                }
                onClick={() => saveDecision(current.decision, true)}
              >
                Approve for batch
              </button>
              <button
                type="button"
                className="rounded bg-slate-800 px-3 py-2 text-sm"
                disabled={pending}
                onClick={() => saveDecision("quarantine_test_or_smoke", false)}
              >
                Mark as test or smoke
              </button>
              <button
                type="button"
                className="rounded bg-slate-800 px-3 py-2 text-sm"
                disabled={pending}
                onClick={() => saveDecision("patient_link_review_required", false)}
              >
                Escalate for patient-link review
              </button>
              <button
                type="button"
                className="rounded bg-slate-800 px-3 py-2 text-sm"
                disabled={pending}
                onClick={() => saveDecision("excluded", false)}
              >
                Exclude
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">View only — you cannot approve or apply migration batches.</p>
          )}

          <button type="button" className="text-sm text-cyan-300" onClick={() => setShowAudit((v) => !v)}>
            {showAudit ? "Hide audit details" : "View audit details"}
          </button>
          {showAudit ? (
            <pre className="overflow-auto rounded bg-black/40 p-3 text-xs text-slate-400">
              {JSON.stringify(
                {
                  hubspotContactId: current.hubspotContactId,
                  proposedLeadId: current.proposedLeadId,
                  decision: current.decision,
                  reasonCode: current.reasonCode,
                  identityTier: current.identityTier,
                },
                null,
                2
              )}
            </pre>
          ) : null}
        </article>
      )}

      {canMutate ? (
        <div className="space-y-3 rounded-xl border border-white/10 p-4">
          <h3 className="text-lg font-medium text-slate-100">Batch dashboard</h3>
          <p className="text-sm text-slate-400">
            Batch max {batchMax}. Patients, appointments, staff, users, and notifications will not
            change. Only one primary action is shown for the current stage.
          </p>
          {stage === "draft" ? (
            <button
              type="button"
              className="rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-40"
              disabled={pending || Boolean(priorGate?.priorBatchId && !priorGate.reconciled)}
              onClick={runSelectBatch}
            >
              {primaryLabel}
            </button>
          ) : null}
          {stage === "ready_for_review" ? (
            <button
              type="button"
              className="rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-40"
              disabled={pending}
              onClick={runPreview}
            >
              {primaryLabel}
            </button>
          ) : null}
          {stage === "approved" && preview ? (
            <div className="space-y-3 rounded border border-cyan-500/30 bg-cyan-500/5 p-3">
              <p className="text-sm text-cyan-100">
                Batch <code className="text-xs">{preview.batchId}</code>
              </p>
              <ul className="list-disc pl-5 text-sm text-slate-300">
                <li>Existing leads to link: {preview.links.length}</li>
                <li>New leads to create: {preview.creates.length}</li>
                <li>Patient-review excluded: {preview.patientReviewsExcluded}</li>
                <li>Quarantined (not applied): {preview.quarantined}</li>
              </ul>
              <label className="block text-sm text-slate-300">
                Type the batch ID to confirm
                <input
                  className="mt-1 w-full rounded border border-white/10 bg-slate-900 px-3 py-2 font-mono text-xs"
                  value={confirmId}
                  onChange={(e) => setConfirmId(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                className="rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                disabled={pending || confirmId.trim() !== preview.batchId}
                onClick={runApply}
              >
                {primaryLabel}
              </button>
            </div>
          ) : null}
          {stage === "applied" && lastAppliedBatchId ? (
            <button
              type="button"
              className="rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-40"
              disabled={pending}
              onClick={runReconcile}
            >
              {primaryLabel}
            </button>
          ) : null}
          {stage === "reconciled" ? (
            <button
              type="button"
              className="rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-40"
              disabled={pending}
              onClick={() => {
                setStage("draft");
                setLastAppliedBatchId(null);
                setMessage("Ready to prepare the next batch.");
              }}
            >
              Prepare next batch
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-slate-900/50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-50">{value}</p>
    </div>
  );
}
