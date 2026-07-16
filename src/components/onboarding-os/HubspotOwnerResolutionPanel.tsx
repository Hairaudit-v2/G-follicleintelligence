"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import {
  applyHubspotOwnerResolutionBatchAction,
  loadHubspotOwnerResolutionWorkspaceAction,
  previewHubspotOwnerResolutionBatchAction,
  saveHubspotOwnerResolutionDecisionAction,
} from "@/lib/actions/fi-hubspot-owner-resolution-actions";
import type {
  HubspotOwnerResolutionFilter,
  HubspotOwnerResolutionState,
  HubspotOwnerWorkspaceRow,
  HubspotOwnerWorkspaceSummary,
} from "@/src/lib/integrations/hubspot/import/hubspotOwnerResolutionTypes";

type Props = {
  tenantId: string;
  canMutate: boolean;
};

const FILTERS: { id: HubspotOwnerResolutionFilter; label: string }[] = [
  { id: "needs_attention", label: "Needs attention" },
  { id: "suggested_match", label: "Suggested match" },
  { id: "no_match", label: "No match found" },
  { id: "archived", label: "Archived" },
  { id: "historical_only", label: "Historical only" },
  { id: "conflict", label: "Conflict" },
  { id: "mapped", label: "Mapped" },
  { id: "all", label: "All" },
];

const STATE_LABEL: Record<HubspotOwnerResolutionState, string> = {
  mapped: "Mapped",
  proposed: "Proposed",
  unresolved: "Unresolved",
  no_matching_staff: "No matching staff",
  archived_source_owner: "Archived source owner",
  historical_only: "Historical only",
  conflict: "Conflict",
  excluded: "Excluded",
  already_applied: "Already applied",
};

function evidenceLabel(e: string): string {
  switch (e) {
    case "exact_staff_email_within_tenant":
      return "Exact email match in this clinic";
    case "exact_name_with_supporting_evidence":
      return "Exact name (suggestion only — not enough alone)";
    default:
      return e.replace(/_/g, " ");
  }
}

export function HubspotOwnerResolutionPanel({ tenantId, canMutate }: Props) {
  const [filter, setFilter] = useState<HubspotOwnerResolutionFilter>("needs_attention");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState<HubspotOwnerWorkspaceSummary | null>(null);
  const [rows, setRows] = useState<HubspotOwnerWorkspaceRow[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showAudit, setShowAudit] = useState(false);
  const [preview, setPreview] = useState<{
    batchId: string;
    checksum: string;
    mappingsToCreate: Array<{ hubspotOwnerId: string; staffId: string; staffName: string }>;
    classifications: Record<string, number>;
  } | null>(null);
  const [confirmId, setConfirmId] = useState("");

  const reload = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const res = await loadHubspotOwnerResolutionWorkspaceAction(tenantId, filter, search);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSummary(res.data.summary);
      setRows(res.data.rows);
      setIndex(0);
      setSelectedStaffId(null);
      setNote("");
    });
  }, [tenantId, filter, search]);

  useEffect(() => {
    reload();
  }, [reload]);

  const current = rows[index] ?? null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndex((i) => Math.min(Math.max(rows.length - 1, 0), i + 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows.length]);

  useEffect(() => {
    if (!current) return;
    setSelectedStaffId(current.targetStaffId);
    setNote(current.operatorNote ?? "");
  }, [current]);

  const primaryActionLabel = useMemo(() => {
    if (preview) return "Apply approved owner mappings";
    return "Save decision";
  }, [preview]);

  function saveDecision(state: HubspotOwnerResolutionState) {
    if (!current || !canMutate) return;
    if ((state === "proposed" || state === "mapped") && !selectedStaffId) {
      setError("Select a staff member before mapping.");
      return;
    }
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const res = await saveHubspotOwnerResolutionDecisionAction(tenantId, {
        hubspotOwnerId: current.hubspotOwnerId,
        resolutionState: state,
        targetStaffId: selectedStaffId,
        operatorNote: note || null,
        matchEvidence: {
          operator_confirmed: state === "proposed",
          candidate_evidence:
            current.candidates.find((c) => c.staffId === selectedStaffId)?.evidence ?? [],
        },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Decision saved. You can leave and return later.");
      reload();
    });
  }

  function runPreview() {
    if (!canMutate) return;
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const res = await previewHubspotOwnerResolutionBatchAction(tenantId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPreview(res.preview);
      setConfirmId("");
      setMessage(
        res.preview.mappingsToCreate.length
          ? `Preview ready: ${res.preview.mappingsToCreate.length} mapping(s) to create.`
          : "Preview ready: no new staff mappings — classifications only."
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
      const res = await applyHubspotOwnerResolutionBatchAction(
        tenantId,
        preview.batchId,
        preview.checksum,
        confirmId.trim()
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(
        `Applied ${res.result.applied} mapping(s); already applied ${res.result.alreadyApplied}. Staff, users, leads and patients were not changed.`
      );
      setPreview(null);
      reload();
    });
  }

  return (
    <section className="space-y-4" aria-label="HubSpot owner resolution workspace">
      <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
        Review HubSpot owners and save decisions safely. Mapping creates source-ID links only — it does
        not create staff, users, leads, or patients, and does not reassign records.
      </div>

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
          <Stat label="Total owners" value={String(summary.totalOwners)} />
          <Stat label="Mapped" value={String(summary.mapped)} />
          <Stat label="Proposed" value={String(summary.proposed)} />
          <Stat label="Needs attention" value={String(summary.needingAttention)} />
          <Stat label="Unresolved" value={String(summary.unresolved)} />
          <Stat label="Archived / historical" value={String(summary.archivedOrHistorical)} />
          <Stat label="Conflicts" value={String(summary.conflicts)} />
          <Stat
            label="Relevant coverage"
            value={
              summary.relevantActiveCoveragePct == null
                ? "—"
                : `${summary.relevantActiveCoveragePct}%`
            }
            detail={`${summary.relevantActiveMapped} of ${summary.relevantActiveDenominator} relevant owners`}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-300">
          Filter
          <select
            className="mt-1 block rounded border border-white/10 bg-slate-900 px-3 py-2 text-slate-100"
            value={filter}
            onChange={(e) => setFilter(e.target.value as HubspotOwnerResolutionFilter)}
          >
            {FILTERS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[16rem] flex-1 text-sm text-slate-300">
          Search owners or staff
          <input
            className="mt-1 w-full rounded border border-white/10 bg-slate-900 px-3 py-2 text-slate-100"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email, or ID"
          />
        </label>
        <button
          type="button"
          className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-200"
          onClick={reload}
          disabled={pending}
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
        <p className="text-sm text-slate-400">No owners in this filter.</p>
      ) : (
        <article className="rounded-xl border border-white/10 bg-slate-950/60 p-4 space-y-4">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Owner {index + 1} of {rows.length}
              </p>
              <h2 className="text-xl font-semibold text-slate-50">{current.displayName}</h2>
              <p className="text-sm text-slate-400">{current.email ?? "No email on source owner"}</p>
              <p className="mt-1 text-xs text-slate-500">
                Status: {STATE_LABEL[current.resolutionState]}
                {current.archived ? " · Archived in HubSpot" : " · Active in HubSpot"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
                disabled={index <= 0 || pending}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
                disabled={index >= rows.length - 1 || pending}
                onClick={() => setIndex((i) => Math.min(rows.length - 1, i + 1))}
              >
                Next
              </button>
            </div>
          </header>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 text-sm">
            <Stat label="Contacts owned" value={String(current.ownedContacts)} />
            <Stat label="Deals owned" value={String(current.ownedDeals)} />
            <Stat label="Tasks owned" value={String(current.ownedTasks)} />
            <Stat label="Activities owned" value={String(current.ownedActivities)} />
            <Stat label="In migration cohort" value={current.inMigrationCohort ? "Yes" : "No"} />
            <Stat label="HubSpot owner ID" value={current.hubspotOwnerId} />
          </div>

          {current.conflictReason ? (
            <p className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
              {current.conflictReason}
            </p>
          ) : null}

          <div>
            <h3 className="text-sm font-medium text-slate-200">Suggested staff</h3>
            <p className="text-xs text-slate-500 mb-2">
              Suggestions are never applied automatically. Exact email is the only deterministic match.
            </p>
            <ul className="space-y-2">
              {current.candidates.length === 0 ? (
                <li className="text-sm text-slate-500">No ranked candidates.</li>
              ) : (
                current.candidates.map((c) => (
                  <li key={c.staffId}>
                    <label className="flex cursor-pointer gap-3 rounded border border-white/10 p-3 hover:bg-white/5">
                      <input
                        type="radio"
                        name="staff"
                        checked={selectedStaffId === c.staffId}
                        onChange={() => setSelectedStaffId(c.staffId)}
                        disabled={!canMutate || pending}
                      />
                      <span className="text-sm text-slate-200">
                        <span className="font-medium">{c.fullName}</span>
                        {" · "}
                        {c.role || "Staff"} · {c.status}
                        {c.email ? ` · ${c.email}` : ""}
                        {c.alreadyHasHubspotOwner ? " · Already has a HubSpot mapping" : ""}
                        <br />
                        <span className="text-xs text-slate-500">
                          {c.evidence.map(evidenceLabel).join(" · ")}
                          {c.deterministic ? " · Deterministic if confirmed" : " · Suggestion only"}
                        </span>
                      </span>
                    </label>
                  </li>
                ))
              )}
            </ul>
          </div>

          <label className="block text-sm text-slate-300">
            Operator note (optional)
            <textarea
              className="mt-1 w-full rounded border border-white/10 bg-slate-900 px-3 py-2 text-slate-100"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={!canMutate || pending}
            />
          </label>

          {canMutate ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                disabled={pending || !selectedStaffId}
                onClick={() => saveDecision("proposed")}
              >
                {primaryActionLabel === "Save decision" ? "Propose mapping to selected staff" : primaryActionLabel}
              </button>
              <button
                type="button"
                className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-200"
                disabled={pending}
                onClick={() => saveDecision("archived_source_owner")}
              >
                Mark archived source owner
              </button>
              <button
                type="button"
                className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-200"
                disabled={pending}
                onClick={() => saveDecision("historical_only")}
              >
                Mark historical only
              </button>
              <button
                type="button"
                className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-200"
                disabled={pending}
                onClick={() => saveDecision("no_matching_staff")}
              >
                Confirm no matching staff
              </button>
              <button
                type="button"
                className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-200"
                disabled={pending}
                onClick={() => saveDecision("excluded")}
              >
                Exclude from this migration
              </button>
              <button
                type="button"
                className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-200"
                disabled={pending}
                onClick={() => saveDecision("unresolved")}
              >
                Leave unresolved
              </button>
              <button
                type="button"
                className="rounded bg-amber-700/80 px-3 py-2 text-sm text-amber-50"
                disabled={pending}
                onClick={() => saveDecision("conflict")}
              >
                Escalate as conflict
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">You can view this workspace but cannot save or apply mappings.</p>
          )}

          <button
            type="button"
            className="text-sm text-cyan-300"
            onClick={() => setShowAudit((v) => !v)}
          >
            {showAudit ? "Hide audit details" : "View audit details"}
          </button>
          {showAudit ? (
            <pre className="overflow-auto rounded bg-black/40 p-3 text-xs text-slate-400">
              {JSON.stringify(
                {
                  hubspotOwnerId: current.hubspotOwnerId,
                  targetStaffId: current.targetStaffId,
                  resolutionState: current.resolutionState,
                  decisionId: current.decisionId,
                  candidates: current.candidates,
                },
                null,
                2
              )}
            </pre>
          ) : null}
        </article>
      )}

      {canMutate ? (
        <div className="rounded-xl border border-white/10 p-4 space-y-3">
          <h3 className="text-lg font-medium text-slate-100">Preview & apply</h3>
          <p className="text-sm text-slate-400">
            Preview builds a bounded batch (max 10 mappings). Applying only creates HubSpot→staff source
            links. Staff, users, leads and patients will not be changed.
          </p>
          <button
            type="button"
            className="rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-40"
            disabled={pending}
            onClick={runPreview}
          >
            Preview proposed mappings
          </button>

          {preview ? (
            <div className="space-y-3 rounded border border-cyan-500/30 bg-cyan-500/5 p-3">
              <p className="text-sm text-cyan-100">
                Batch <code className="text-xs">{preview.batchId}</code>
              </p>
              <ul className="text-sm text-slate-300 list-disc pl-5">
                <li>Mappings to create: {preview.mappingsToCreate.length}</li>
                {preview.mappingsToCreate.map((m) => (
                  <li key={m.hubspotOwnerId}>
                    Owner {m.hubspotOwnerId} → {m.staffName}
                  </li>
                ))}
                <li>Tables that will change: fi_staff_source_ids, fi_import_batches, decision rows</li>
                <li>Staff, users, leads and patients will not be changed</li>
              </ul>
              <label className="block text-sm text-slate-300">
                Type the batch ID to confirm
                <input
                  className="mt-1 w-full rounded border border-white/10 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100"
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
                Apply approved owner mappings
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded border border-white/10 bg-slate-900/50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-50">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}
