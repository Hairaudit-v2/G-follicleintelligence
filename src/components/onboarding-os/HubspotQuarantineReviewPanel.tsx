"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import {
  loadHubspotQuarantineReviewWorkspaceAction,
  persistHubspotQuarantineReviewAction,
} from "@/lib/actions/fi-hubspot-quarantine-review-actions";
import type { HubspotQuarantineReviewRow } from "@/src/lib/integrations/hubspot/import/hubspotQuarantineReviewCore";

type Props = { tenantId: string; canMutate: boolean };

type FilterId =
  | "all"
  | "possible_legitimate"
  | "retained"
  | "excluded"
  | "reclassified"
  | "deferred"
  | HubspotQuarantineReviewRow["state"];

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "possible_legitimate", label: "Possible legitimate" },
  { id: "retained", label: "Retained" },
  { id: "excluded", label: "Excluded" },
  { id: "reclassified", label: "Reclassified" },
  { id: "deferred", label: "Deferred" },
];

function stateLabel(state: string): string {
  return state.replace(/_/g, " ");
}

export function HubspotQuarantineReviewPanel({ tenantId, canMutate }: Props) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<HubspotQuarantineReviewRow[]>([]);
  const [stateCounts, setStateCounts] = useState<Record<string, number>>({});
  const [reviewChecksum, setReviewChecksum] = useState<string | null>(null);
  const [inventoryChecksum, setInventoryChecksum] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    retainedCount: number;
    excludedCount: number;
    reclassifiedCount: number;
    deferredCount: number;
    possibleLegitimateCount: number;
  } | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showAudit, setShowAudit] = useState(false);

  const reload = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const res = await loadHubspotQuarantineReviewWorkspaceAction(tenantId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRows(res.data.rows);
      setStateCounts(res.data.stateCounts);
      setReviewChecksum(res.data.reviewChecksum);
      setInventoryChecksum(res.data.inventoryChecksum);
      setSummary({
        retainedCount: res.data.summary.retainedCount,
        excludedCount: res.data.summary.excludedCount,
        reclassifiedCount: res.data.summary.reclassifiedCount,
        deferredCount: res.data.summary.deferredCount,
        possibleLegitimateCount: res.data.summary.possibleLegitimateCount,
      });
      setIndex(0);
    });
  }, [tenantId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "possible_legitimate" && !row.possibleLegitimateContact) return false;
      if (filter === "retained" && !row.state.startsWith("retained_")) return false;
      if (filter === "excluded" && !row.state.startsWith("excluded_")) return false;
      if (filter === "reclassified" && !row.state.startsWith("reclassify_")) return false;
      if (filter === "deferred" && row.state !== "deferred_manual_review") return false;
      if (
        filter !== "all" &&
        filter !== "possible_legitimate" &&
        filter !== "retained" &&
        filter !== "excluded" &&
        filter !== "reclassified" &&
        filter !== "deferred" &&
        row.state !== filter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        row.hubspotContactId.includes(q) ||
        row.displayNameMasked.toLowerCase().includes(q) ||
        row.state.includes(q) ||
        row.reasonCode.includes(q) ||
        row.originalBucket.includes(q)
      );
    });
  }, [rows, filter, search]);

  const current = filtered[index] ?? null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight")
        setIndex((i) => Math.min(Math.max(filtered.length - 1, 0), i));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered.length]);

  function persist() {
    if (!canMutate) return;
    startTransition(async () => {
      setError(null);
      const res = await persistHubspotQuarantineReviewAction(tenantId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(
        "Quarantine classification persisted (review evidence only). Apply remains disabled."
      );
      setRows(res.data.rows);
      setStateCounts(res.data.stateCounts);
      setReviewChecksum(res.data.reviewChecksum);
      setSummary({
        retainedCount: res.data.summary.retainedCount,
        excludedCount: res.data.summary.excludedCount,
        reclassifiedCount: res.data.summary.reclassifiedCount,
        deferredCount: res.data.summary.deferredCount,
        possibleLegitimateCount: res.data.summary.possibleLegitimateCount,
      });
    });
  }

  return (
    <section className="space-y-4" aria-label="HubSpot quarantine and exclusion review">
      <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-50">
        1E-Q quarantine/exclusion classification (assurance only). Reclassified contacts remain
        unapplied. FI leads, mappings, patients, staff, users, tasks, messages, appointments, and
        watermarks are never written here. Next gate: FI-HUBSPOT-IMPORT-1E-FINAL.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-live="polite">
        <Stat label="Cohort" value={String(rows.length)} />
        <Stat label="Retained" value={String(summary?.retainedCount ?? 0)} />
        <Stat label="Excluded" value={String(summary?.excludedCount ?? 0)} />
        <Stat label="Reclassified" value={String(summary?.reclassifiedCount ?? 0)} />
        <Stat label="Deferred" value={String(summary?.deferredCount ?? 0)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded px-3 py-1.5 text-xs ${
              filter === item.id ? "bg-amber-500/30 text-amber-100" : "bg-slate-900 text-slate-400"
            }`}
            onClick={() => {
              setFilter(item.id);
              setIndex(0);
            }}
          >
            {item.label}
            {item.id === "possible_legitimate" && summary
              ? ` (${summary.possibleLegitimateCount})`
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
          placeholder="Contact ID, masked name, state, reason…"
        />
      </label>

      {error ? (
        <p className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          className="rounded border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-50"
          role="status"
        >
          {message}
        </p>
      ) : null}

      {current ? (
        <article className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-cyan-500/30 bg-slate-950/60 p-4">
            <h2 className="text-xs uppercase tracking-wide text-cyan-400">Contact identity</h2>
            <p className="mt-2 text-sm text-slate-100">HubSpot ID: {current.hubspotContactId}</p>
            <p className="text-sm text-slate-300">Masked name: {current.displayNameMasked}</p>
            <p className="text-sm text-slate-400">
              Email present: {current.emailPresent ? "yes" : "no"} · Phone present:{" "}
              {current.phonePresent ? "yes" : "no"}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Original: {current.originalBucket} / {current.originalDecision}
            </p>
            <p className="text-xs text-slate-500">
              Original reason: {current.originalReasonCode}
            </p>
            {current.possibleLegitimateContact ? (
              <p className="mt-2 text-sm text-emerald-300">
                Possible legitimate contact — reclassified read-only, not applied.
              </p>
            ) : null}
            {(current.checks.duplicateSourceEmail ||
              current.checks.duplicateSourcePhone ||
              current.checks.exactEmailPersonIds.length > 1 ||
              current.checks.multiLeadCandidateIds.length > 1) && (
              <p className="mt-2 text-sm text-amber-200">
                Duplicate / multi-match warning: identity is not unique enough to apply.
              </p>
            )}
            {(current.checks.patientWarning ||
              current.checks.exactEmailPatientIds.length > 0 ||
              current.checks.existingPatientSourceId) && (
              <p className="mt-2 text-sm text-rose-200">
                Patient warning: clinical identity may be involved — no patient link is applied here.
              </p>
            )}
          </div>
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4">
            <h2 className="text-xs uppercase tracking-wide text-amber-300">Final classification</h2>
            <p className="mt-2 text-sm font-medium text-amber-50">{stateLabel(current.state)}</p>
            <p className="text-sm text-amber-100/80">Reason: {current.reasonCode}</p>
            <ul className="mt-3 space-y-1 text-sm text-amber-50/90">
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
          disabled={index <= 0}
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
          disabled={index >= filtered.length - 1}
          onClick={() => setIndex((i) => Math.min(filtered.length - 1, i + 1))}
        >
          Next
        </button>
        <button
          type="button"
          className="rounded bg-amber-600/80 px-3 py-2 text-sm text-white disabled:opacity-40"
          disabled={!canMutate || pending}
          onClick={persist}
        >
          Persist classification
        </button>
        <button
          type="button"
          className="rounded border border-white/20 px-3 py-2 text-sm text-slate-200"
          onClick={() => setShowAudit((v) => !v)}
        >
          {showAudit ? "Hide audit details" : "Show audit details"}
        </button>
        <button
          type="button"
          className="rounded border border-white/20 px-3 py-2 text-sm text-slate-200"
          disabled={pending}
          onClick={reload}
        >
          Reload
        </button>
      </div>

      {showAudit ? (
        <div className="rounded border border-white/10 bg-slate-950/80 p-3 text-xs text-slate-300 space-y-1">
          <p>Inventory checksum: {inventoryChecksum ?? "—"}</p>
          <p>Review checksum: {reviewChecksum ?? "—"}</p>
          <p>Apply: disabled</p>
          <p>State counts: {JSON.stringify(stateCounts)}</p>
          {current ? (
            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-[11px] text-slate-400">
              {JSON.stringify(
                {
                  hubspotContactId: current.hubspotContactId,
                  state: current.state,
                  reasonCode: current.reasonCode,
                  checks: {
                    sameTenant: current.checks.sameTenant,
                    sourceFresh: current.checks.sourceFresh,
                    archived: current.checks.archived,
                    testOrSmoke: current.checks.testOrSmoke,
                    duplicateSourceEmail: current.checks.duplicateSourceEmail,
                    patientWarning: current.checks.patientWarning,
                    emailPersonCount: current.checks.exactEmailPersonIds.length,
                    phonePersonCount: current.checks.exactPhonePersonIds.length,
                    multiLeadCount: current.checks.multiLeadCandidateIds.length,
                    hasLeadMapping: Boolean(current.checks.existingContactLeadMappingId),
                    hasPersonSource: Boolean(current.checks.existingPersonSourceId),
                  },
                },
                null,
                2
              )}
            </pre>
          ) : null}
        </div>
      ) : null}
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
