"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import {
  loadHubspotPatientReviewWorkspaceAction,
  persistHubspotPatientReviewAction,
  previewHubspotPatientReviewAction,
} from "@/lib/actions/fi-hubspot-patient-link-review-actions";
import type { HubspotPatientLinkReviewRow } from "@/src/lib/integrations/hubspot/import/hubspotPatientLinkReviewCore";

type Props = { tenantId: string; canMutate: boolean };

type FilterId = "all" | HubspotPatientLinkReviewRow["state"];

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "deferred_clinical_identity_review", label: "Deferred" },
  { id: "approved_link_existing_patient", label: "Approved link" },
  {
    id: "link_existing_lead_patient_relationship_already_trusted",
    label: "Trusted lead→patient",
  },
  { id: "retain_crm_lead_only", label: "CRM lead only" },
  { id: "quarantine_ambiguous_patient_identity", label: "Ambiguous" },
  { id: "quarantine_multi_patient_conflict", label: "Multi-patient" },
  { id: "excluded_non_patient", label: "Excluded" },
  { id: "already_resolved", label: "Already resolved" },
];

function stateLabel(state: HubspotPatientLinkReviewRow["state"]): string {
  return state.replace(/_/g, " ");
}

export function HubspotPatientReviewPanel({ tenantId, canMutate }: Props) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<HubspotPatientLinkReviewRow[]>([]);
  const [stateCounts, setStateCounts] = useState<Record<string, number>>({});
  const [reviewChecksum, setReviewChecksum] = useState<string | null>(null);
  const [inventoryChecksum, setInventoryChecksum] = useState<string | null>(null);
  const [proposedLinks, setProposedLinks] = useState(0);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showAudit, setShowAudit] = useState(false);

  const reload = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const res = await loadHubspotPatientReviewWorkspaceAction(tenantId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRows(res.data.rows);
      setStateCounts(res.data.stateCounts);
      setReviewChecksum(res.data.reviewChecksum);
      setInventoryChecksum(res.data.inventoryChecksum);
      setProposedLinks(res.data.mutationPlan.proposedProductionLinks);
      setIndex(0);
    });
  }, [tenantId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && row.state !== filter) return false;
      if (!q) return true;
      return (
        row.hubspotContactId.includes(q) ||
        row.displayNameMasked.toLowerCase().includes(q) ||
        row.state.includes(q) ||
        row.reasonCode.includes(q)
      );
    });
  }, [rows, filter, search]);

  const current = filtered[index] ?? null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(Math.max(filtered.length - 1, 0), i));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered.length]);

  function persist() {
    if (!canMutate) return;
    startTransition(async () => {
      setError(null);
      const res = await persistHubspotPatientReviewAction(tenantId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Patient-link review decisions persisted (apply still disabled).");
      setRows(res.data.rows);
      setStateCounts(res.data.stateCounts);
      setReviewChecksum(res.data.reviewChecksum);
      setProposedLinks(res.data.mutationPlan.proposedProductionLinks);
    });
  }

  function preview() {
    if (!canMutate) return;
    startTransition(async () => {
      setError(null);
      const res = await previewHubspotPatientReviewAction(tenantId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(
        `${res.preview.plainLanguage.primaryAction} Proposed links: ${res.preview.proposedProductionLinkCount} (max 2).`
      );
      setReviewChecksum(res.preview.reviewChecksum);
      setProposedLinks(res.preview.proposedProductionLinkCount);
      setRows(res.preview.rows);
      setStateCounts(res.preview.stateCounts);
    });
  }

  return (
    <section className="space-y-4" aria-label="HubSpot patient-link clinical identity review">
      <div className="rounded border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-50">
        1E-P patient-link review (read-only interim). CRM identity and clinical patient identity are
        reviewed separately. Apply is disabled until explicit human approval at 1E-Q. Patients are
        never created, merged, or modified here.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
        <Stat label="Cohort" value={String(rows.length)} />
        <Stat label="Proposed links" value={`${proposedLinks} / 2`} />
        <Stat
          label="Deferred"
          value={String(stateCounts.deferred_clinical_identity_review ?? 0)}
        />
        <Stat label="Apply" value="Disabled" />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded px-3 py-1.5 text-xs ${
              filter === item.id ? "bg-rose-500/30 text-rose-100" : "bg-slate-900 text-slate-400"
            }`}
            onClick={() => {
              setFilter(item.id);
              setIndex(0);
            }}
          >
            {item.label}
            {item.id !== "all" && stateCounts[item.id] != null
              ? ` (${stateCounts[item.id]})`
              : ""}
          </button>
        ))}
      </div>

      <label className="block text-sm text-slate-300">
        Search
        <input
          className="mt-1 w-full rounded border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIndex(0);
          }}
          placeholder="Contact ID, masked name, state…"
        />
      </label>

      {error ? (
        <p className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-50" role="status">
          {message}
        </p>
      ) : null}

      {current ? (
        <article className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-cyan-500/30 bg-slate-950/60 p-4">
            <h2 className="text-xs uppercase tracking-wide text-cyan-400">CRM contact identity</h2>
            <p className="mt-2 text-sm text-slate-100">HubSpot ID: {current.hubspotContactId}</p>
            <p className="text-sm text-slate-300">Masked name: {current.displayNameMasked}</p>
            <p className="text-sm text-slate-400">
              Email present: {current.emailPresent ? "yes" : "no"} · Phone present:{" "}
              {current.phonePresent ? "yes" : "no"}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Inventory reason: {current.inventoryReasonCode}
            </p>
          </div>
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-4">
            <h2 className="text-xs uppercase tracking-wide text-rose-300">
              Clinical patient identity
            </h2>
            <p className="mt-2 text-sm font-medium text-rose-50">{stateLabel(current.state)}</p>
            <p className="text-sm text-rose-100/80">Reason: {current.reasonCode}</p>
            <p className="text-sm text-rose-100/70">
              Confidence: {current.confidence} · Target:{" "}
              {current.possiblePatientTargetId
                ? `${current.possiblePatientTargetId.slice(0, 8)}…`
                : "none"}
            </p>
            <ul className="mt-3 space-y-1 text-sm text-rose-50/90">
              {current.plainLanguageEvidence.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {current.warnings.length ? (
              <ul className="mt-3 space-y-1 text-xs text-amber-200">
                {current.warnings.map((line) => (
                  <li key={line}>Warning: {line}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </article>
      ) : (
        <p className="text-sm text-slate-400">No records match the current filter.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-100 disabled:opacity-40"
          disabled={pending || index <= 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          Previous
        </button>
        <span className="text-xs text-slate-400">
          {filtered.length ? index + 1 : 0} / {filtered.length}
        </span>
        <button
          type="button"
          className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-100 disabled:opacity-40"
          disabled={pending || index >= filtered.length - 1}
          onClick={() => setIndex((i) => Math.min(filtered.length - 1, i + 1))}
        >
          Next
        </button>
        <button
          type="button"
          className="rounded bg-cyan-700/80 px-3 py-2 text-sm text-cyan-50 disabled:opacity-40"
          disabled={pending || !canMutate}
          onClick={persist}
        >
          Persist decisions
        </button>
        <button
          type="button"
          className="rounded bg-amber-700/70 px-3 py-2 text-sm text-amber-50 disabled:opacity-40"
          disabled={pending || !canMutate}
          onClick={preview}
        >
          Freeze interim preview
        </button>
        <button
          type="button"
          className="rounded border border-white/20 px-3 py-2 text-sm text-slate-500"
          disabled
          title="Apply requires explicit human approval at FI-HUBSPOT-IMPORT-1E-Q"
        >
          Apply (disabled — approval required)
        </button>
      </div>

      <details
        className="rounded border border-white/10 bg-slate-950/40 p-3 text-sm text-slate-400"
        open={showAudit}
        onToggle={(e) => setShowAudit((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-slate-300">Audit details (hidden by default)</summary>
        <div className="mt-2 space-y-1 text-xs">
          <p>Inventory checksum: {inventoryChecksum ?? "—"}</p>
          <p>Review checksum: {reviewChecksum ?? "—"}</p>
          {current ? (
            <>
              <p>Matched identifiers: {current.checks.matchedReliableIdentifiers.join(", ") || "none"}</p>
              <p>Missing identifiers: {current.checks.missingReliableIdentifiers.join(", ") || "none"}</p>
              <p>Conflicts: {current.checks.conflicts.join(", ") || "none"}</p>
              <p>Related lead: {current.relatedLeadId ?? "none"}</p>
              <p>Operator: {current.operatorLabel ?? "—"} · {current.reviewedAt ?? "—"}</p>
            </>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-slate-950/50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg text-slate-100">{value}</p>
    </div>
  );
}
