"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { backfillFoundationFromProcessedEventsAction } from "@/lib/actions/fi-actions";
import { DashboardCard, InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import type { FoundationIntegrityMetrics } from "@/src/lib/fi/foundation/integrity";

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#141C33]/70 px-3 py-2.5 shadow-inner shadow-black/20 backdrop-blur-sm">
      <div className="text-xs leading-snug text-[#94A3B8]">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-[#F8FAFC]">{value}</div>
    </div>
  );
}

/** True when core foundation rows are still empty — zeros are expected, not a failure. */
function isNewClinicSnapshot(m: FoundationIntegrityMetrics): boolean {
  const t = m.totals;
  return t.fi_cases === 0 && t.fi_patients === 0 && t.fi_persons === 0 && t.fi_timeline_events === 0;
}

const listShell = "max-h-48 space-y-1 overflow-auto rounded-xl border border-white/[0.08] bg-[#081020]/60 p-2 text-xs text-[#CBD5E1]";
const linkClass = "font-mono text-[#22C1FF] hover:text-[#0EA5E9] hover:underline";

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
        `Backfill: scanned ${res.scanned}, attempted ${res.attempted}, succeeded ${res.succeeded}, skipped ${res.skipped}, failed ${res.failed}.`,
      );
      if (res.errors.length) setBackfillMsg((m) => `${m} Errors: ${res.errors.join("; ")}`);
      load();
    } else {
      setBackfillMsg(res.error);
    }
  };

  if (loading) {
    return (
      <DashboardCard className="p-6 text-sm text-[#94A3B8]">
        <p className="animate-pulse">Loading foundation integrity…</p>
      </DashboardCard>
    );
  }
  if (error) {
    return (
      <InfoNotice variant="danger" title="Could not load metrics">
        <p className="text-sm">{error}</p>
      </InfoNotice>
    );
  }
  if (!data) {
    return (
      <DashboardCard className="p-6 text-sm text-[#94A3B8]">
        <p>No data.</p>
      </DashboardCard>
    );
  }

  const m = data;
  const newClinic = isNewClinicSnapshot(m);

  return (
    <div className="space-y-8 text-sm">
      {newClinic ? (
        <InfoNotice variant="info" title="You are looking at a fresh workspace">
          <p className="text-sm leading-relaxed text-[#CBD5E1]">
            <strong className="text-[#F8FAFC]">Zeros are normal here</strong> until patients, cases, and timeline activity
            exist. Event totals can still appear from platform ingestion — focus on persons, patients, cases, and timeline
            climbing as you onboard.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">
            These numbers will grow once patients, cases, and timeline events are created.
          </p>
        </InfoNotice>
      ) : null}

      <section>
        <h3 className="mb-2 text-base font-semibold text-[#F8FAFC] sm:text-lg">Foundation coverage summary</h3>
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
        <h3 className="mb-2 text-base font-semibold text-[#F8FAFC] sm:text-lg">Event → link → case coverage</h3>
        <p className="mb-2 text-xs leading-relaxed text-[#64748B] sm:text-sm">
          Counts use the latest fi_event_links row per event (by created_at). Scanned up to 200k events per tenant.
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Metric label="Events with fi_case_id link" value={m.coverage.events_with_fi_case_link} />
          <Metric label="Those with foundation_patient on case" value={m.coverage.events_with_foundation_patient_on_linked_case} />
          <Metric label="Those with person on foundation patient" value={m.coverage.events_with_person_on_linked_foundation_patient} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-base font-semibold text-[#F8FAFC] sm:text-lg">Risks & gaps</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          <Metric label="Unresolved global patients (view)" value={m.risks.unresolved_global_patients} />
          <Metric label="Patients w/o foundation_patient (view)" value={m.risks.unresolved_cases_no_foundation_patient} />
          <Metric label="Duplicate-risk person emails (groups)" value={m.risks.duplicate_person_email_normalized_groups} />
          <Metric label="Duplicate patient rows / person_id" value={m.risks.duplicate_patient_rows_same_person_id} />
          <Metric label="fi_media_assets without case_id" value={m.risks.fi_media_assets_without_case_id} />
          <Metric label="Unified media rows w/o case (view)" value={m.unified_media_without_case_id} />
          <Metric label="Timeline rows w/ empty detail (sample)" value={m.risks.fi_timeline_events_detail_empty_or_null} />
        </div>
      </section>

      {m.notes.length > 0 && (
        <section className="rounded-xl border border-amber-500/25 bg-amber-950/35 p-3 text-xs text-amber-100 backdrop-blur-sm">
          <strong className="text-amber-50">Notes:</strong> {m.notes.join(" ")}
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="mb-2 font-semibold text-[#E2E8F0]">Unresolved global patients (preview)</h4>
          <ul className={listShell}>
            {m.previews.unresolved_global_patients.length === 0 ? (
              <li className="text-[#64748B]">None in preview window.</li>
            ) : (
              m.previews.unresolved_global_patients.map((r) => (
                <li key={r.global_patient_id}>
                  <Link href={`/fi-admin/${routeTenant}/patients/${r.global_patient_id}`} className={linkClass}>
                    {r.global_patient_id}
                  </Link>{" "}
                  — {r.source_system}:{r.source_patient_id}
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <h4 className="mb-2 font-semibold text-[#E2E8F0]">Patients without foundation patient (preview)</h4>
          <ul className={listShell}>
            {m.previews.unresolved_cases.length === 0 ? (
              <li className="text-[#64748B]">None in preview window.</li>
            ) : (
              m.previews.unresolved_cases.map((r) => (
                <li key={r.case_id}>
                  <span className="font-mono text-[#94A3B8]">{r.case_id}</span> — {r.status} — {r.source_case_id ?? "no source_case_id"}
                  {r.global_patient_id ? (
                    <>
                      {" "}
                      ·{" "}
                      <Link href={`/fi-admin/${routeTenant}/patients/${r.global_patient_id}`} className={linkClass}>
                        Patient record
                      </Link>
                    </>
                  ) : null}
                  {" · "}
                  <Link href={`/fi-admin/${routeTenant}/cases/${r.case_id}`} className={linkClass}>
                    Patient record
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section>
        <h4 className="mb-2 font-semibold text-[#E2E8F0]">Duplicate-risk: shared email_normalized</h4>
        <ul className="max-h-40 space-y-1 overflow-auto rounded-xl border border-white/[0.08] bg-[#081020]/60 p-2 text-xs text-[#CBD5E1]">
          {m.previews.duplicate_person_emails.length === 0 ? (
            <li className="text-[#64748B]">No duplicate groups detected in scan.</li>
          ) : (
            m.previews.duplicate_person_emails.map((r) => (
              <li key={r.email_normalized}>
                <strong className="text-[#F8FAFC]">{r.email_normalized}</strong> — {r.person_count} persons ({r.person_ids.join(", ")})
              </li>
            ))
          )}
        </ul>
      </section>

      <DashboardCard elevated className="border-violet-500/25 bg-[#120a1e]/55 p-4 sm:p-5">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em] text-violet-300/90">Deployment operators</p>
        <h4 className="mt-1 text-base font-semibold text-[#F8FAFC]">Manual foundation backfill</h4>
        <p className="mt-2 text-xs leading-relaxed text-[#94A3B8] sm:text-sm">
          Replays dual-write for up to 50 recent <strong className="text-[#E2E8F0]">processed</strong> events that have no timeline row with matching{" "}
          <code className="rounded bg-[#141C33] px-1.5 py-0.5 text-[0.7rem] text-[#22C1FF]">fi_event_id</code>. Requires server{" "}
          <code className="rounded bg-[#141C33] px-1.5 py-0.5 text-[0.7rem] text-[#22C1FF]">FI_ADMIN_API_KEY</code>. Does not run automatically.
        </p>
        <form onSubmit={runBackfill} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex min-w-[12rem] flex-1 flex-col text-xs text-[#94A3B8]">
            Admin key
            <input
              type="password"
              autoComplete="off"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-lg border border-white/[0.12] bg-[#081020]/90 px-3 py-2 text-sm text-[#F8FAFC] outline-none focus:border-[#22C1FF]/45 focus:ring-2 focus:ring-[#22C1FF]/20"
              placeholder="FI_ADMIN_API_KEY value"
            />
          </label>
          <button
            type="submit"
            disabled={backfillBusy || !adminKey.trim()}
            className="rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md transition hover:from-cyan-500 hover:to-sky-500 disabled:opacity-45"
          >
            {backfillBusy ? "Running…" : "Run batch backfill (max 50)"}
          </button>
        </form>
        {backfillMsg ? <p className="mt-3 text-xs text-[#94A3B8] sm:text-sm">{backfillMsg}</p> : null}
      </DashboardCard>
    </div>
  );
}
