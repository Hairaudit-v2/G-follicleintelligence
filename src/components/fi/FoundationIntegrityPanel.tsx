"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { backfillFoundationFromProcessedEventsAction } from "@/lib/actions/fi-actions";
import type { FoundationIntegrityMetrics } from "@/src/lib/fi/foundation/integrity";

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-gray-200 bg-white px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

export function FoundationIntegrityPanel({ tenantId }: { tenantId: string }) {
  const params = useParams();
  const routeTenant = (params?.tenantId as string | undefined) ?? tenantId;
  const [data, setData] = useState<FoundationIntegrityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState("");
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);

  const load = useCallback(() => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/tenants/${tenantId}/foundation-integrity`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.metrics) setData(d.metrics as FoundationIntegrityMetrics);
        else setError(d.error ?? "Failed to load integrity metrics.");
      })
      .catch(() => setError("Failed to load integrity metrics."))
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const runBackfill = async (e: React.FormEvent) => {
    e.preventDefault();
    setBackfillBusy(true);
    setBackfillMsg(null);
    const res = await backfillFoundationFromProcessedEventsAction(tenantId, adminKey);
    setBackfillBusy(false);
    if (res.ok) {
      setBackfillMsg(
        `Backfill: scanned ${res.scanned}, attempted ${res.attempted}, succeeded ${res.succeeded}, skipped ${res.skipped}, failed ${res.failed}.`
      );
      if (res.errors.length) setBackfillMsg((m) => `${m} Errors: ${res.errors.join("; ")}`);
      load();
    } else {
      setBackfillMsg(res.error);
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Loading foundation integrity…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">No data.</p>;

  const m = data;

  return (
    <div className="space-y-8 text-sm">
      <section>
        <h3 className="mb-2 text-base font-medium text-gray-900">Foundation coverage summary</h3>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Metric label="fi_events" value={m.totals.fi_events} />
          <Metric label="fi_events (processed)" value={m.totals.fi_events_processed} />
          <Metric label="fi_persons" value={m.totals.fi_persons} />
          <Metric label="fi_patients" value={m.totals.fi_patients} />
          <Metric label="fi_cases" value={m.totals.fi_cases} />
          <Metric label="fi_cases w/ foundation_patient_id" value={m.totals.fi_cases_with_foundation_patient_id} />
          <Metric label="fi_timeline_events" value={m.totals.fi_timeline_events} />
          <Metric label="fi_media_assets" value={m.totals.fi_media_assets} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-base font-medium text-gray-900">Event → link → case coverage</h3>
        <p className="mb-2 text-xs text-gray-500">
          Counts use the latest fi_event_links row per event (by created_at). Scanned up to 200k events per tenant.
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Metric label="Events with fi_case_id link" value={m.coverage.events_with_fi_case_link} />
          <Metric label="Those with foundation_patient on case" value={m.coverage.events_with_foundation_patient_on_linked_case} />
          <Metric label="Those with person on foundation patient" value={m.coverage.events_with_person_on_linked_foundation_patient} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-base font-medium text-gray-900">Risks & gaps</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          <Metric label="Unresolved global patients (view)" value={m.risks.unresolved_global_patients} />
          <Metric label="Cases w/o foundation_patient (view)" value={m.risks.unresolved_cases_no_foundation_patient} />
          <Metric label="Duplicate-risk person emails (groups)" value={m.risks.duplicate_person_email_normalized_groups} />
          <Metric label="Duplicate patient rows / person_id" value={m.risks.duplicate_patient_rows_same_person_id} />
          <Metric label="fi_media_assets without case_id" value={m.risks.fi_media_assets_without_case_id} />
          <Metric label="Unified media rows w/o case (view)" value={m.unified_media_without_case_id} />
          <Metric label="Timeline rows w/ empty detail (sample)" value={m.risks.fi_timeline_events_detail_empty_or_null} />
        </div>
      </section>

      {m.notes.length > 0 && (
        <section className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Notes:</strong> {m.notes.join(" ")}
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-2 font-medium text-gray-900">Unresolved global patients (preview)</h4>
          <ul className="max-h-48 space-y-1 overflow-auto rounded border border-gray-200 bg-white p-2 text-xs">
            {m.previews.unresolved_global_patients.length === 0 ? (
              <li className="text-gray-500">None in preview window.</li>
            ) : (
              m.previews.unresolved_global_patients.map((r) => (
                <li key={r.global_patient_id}>
                  <Link
                    href={`/fi-admin/${routeTenant}/patients/${r.global_patient_id}`}
                    className="font-mono text-blue-700 hover:underline"
                  >
                    {r.global_patient_id}
                  </Link>{" "}
                  — {r.source_system}:{r.source_patient_id}
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <h4 className="mb-2 font-medium text-gray-900">Cases without foundation patient (preview)</h4>
          <ul className="max-h-48 space-y-1 overflow-auto rounded border border-gray-200 bg-white p-2 text-xs">
            {m.previews.unresolved_cases.length === 0 ? (
              <li className="text-gray-500">None in preview window.</li>
            ) : (
              m.previews.unresolved_cases.map((r) => (
                <li key={r.case_id}>
                  <span className="font-mono">{r.case_id}</span> — {r.status} —{" "}
                  {r.source_case_id ?? "no source_case_id"}
                  {r.global_patient_id ? (
                    <>
                      {" "}
                      ·{" "}
                      <Link
                        href={`/fi-admin/${routeTenant}/patients/${r.global_patient_id}`}
                        className="text-blue-700 hover:underline"
                      >
                        Patient record
                      </Link>
                    </>
                  ) : null}
                  {" · "}
                  <Link href={`/fi-admin/${routeTenant}/cases/${r.case_id}`} className="text-blue-700 hover:underline">
                    Case record
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section>
        <h4 className="mb-2 font-medium text-gray-900">Duplicate-risk: shared email_normalized</h4>
        <ul className="max-h-40 space-y-1 overflow-auto rounded border border-gray-200 bg-white p-2 text-xs">
          {m.previews.duplicate_person_emails.length === 0 ? (
            <li className="text-gray-500">No duplicate groups detected in scan.</li>
          ) : (
            m.previews.duplicate_person_emails.map((r) => (
              <li key={r.email_normalized}>
                <strong>{r.email_normalized}</strong> — {r.person_count} persons ({r.person_ids.join(", ")})
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded border border-gray-300 bg-gray-50 p-4">
        <h4 className="mb-2 font-medium text-gray-900">Manual foundation backfill</h4>
        <p className="mb-3 text-xs text-gray-600">
          Replays dual-write for up to 50 recent <strong>processed</strong> events that have no timeline row with matching{" "}
          <code className="rounded bg-gray-200 px-1">fi_event_id</code>. Requires server env{" "}
          <code className="rounded bg-gray-200 px-1">FI_ADMIN_API_KEY</code>. Does not run automatically.
        </p>
        <form onSubmit={runBackfill} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs">
            Admin key
            <input
              type="password"
              autoComplete="off"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="mt-1 w-64 rounded border px-2 py-1"
              placeholder="FI_ADMIN_API_KEY value"
            />
          </label>
          <button
            type="submit"
            disabled={backfillBusy || !adminKey.trim()}
            className="rounded bg-gray-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {backfillBusy ? "Running…" : "Run batch backfill (max 50)"}
          </button>
        </form>
        {backfillMsg && <p className="mt-2 text-xs text-gray-700">{backfillMsg}</p>}
      </section>
    </div>
  );
}
