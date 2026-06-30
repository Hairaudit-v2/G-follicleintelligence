import Link from "next/link";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

const card = "rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40";

export function PatientTwinPathologyCard({ tenantId, patientId, twin }: { tenantId: string; patientId: string; twin: PatientTwinV1 }) {
  const { requests, results, item_cap, results_item_cap, abnormal_markers_total, last_result_reviewed_at, latest_ai_interpretation } = twin.pathology;

  if (requests.length === 0 && results.length === 0 && !latest_ai_interpretation) {
    return (
      <section className={card}>
        <h2 className="text-sm font-semibold text-slate-100">Pathology</h2>
        <p className="mt-2 text-sm text-slate-400">No blood test requests or results recorded for this patient yet.</p>
        <p className="mt-3 text-xs">
          <Link href={`/fi-admin/${tenantId}/patients/${patientId}/blood-results/new`} className="text-cyan-300 hover:underline">
            Upload blood results
          </Link>
          <span className="mx-2 text-gray-300">·</span>
          <Link href={`/fi-admin/${tenantId}/patients/${patientId}/blood-request`} className="text-cyan-300 hover:underline">
            Request blood tests
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className={card}>
      <h2 className="text-sm font-semibold text-slate-100">Pathology</h2>
      <p className="mt-1 text-xs text-slate-400">
        DoctorOS blood requests (up to {item_cap}) and structured blood results (up to {results_item_cap}) for this patient.
      </p>

      {(abnormal_markers_total > 0 || last_result_reviewed_at) && (
        <ul className="mt-2 flex flex-wrap gap-3 text-xs text-slate-300">
          {abnormal_markers_total > 0 ? (
            <li>
              <span className="font-semibold text-amber-200">{abnormal_markers_total}</span> abnormal marker(s) across recent results
            </li>
          ) : null}
          {last_result_reviewed_at ? (
            <li>
              Last reviewed:{" "}
              <span className="font-medium">{new Date(last_result_reviewed_at).toLocaleDateString()}</span>
            </li>
          ) : null}
        </ul>
      )}

      {latest_ai_interpretation ? (
        <div className="mt-4 rounded border border-sky-100 bg-cyan-500/10 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Latest AI hair interpretation</h3>
              <p className="mt-1 text-xs text-cyan-200">
                {latest_ai_interpretation.status.replace(/_/g, " ")}
                {latest_ai_interpretation.reviewed_at ? ` · reviewed ${new Date(latest_ai_interpretation.reviewed_at).toLocaleDateString()}` : ""}
              </p>
            </div>
            <Link
              href={`/fi-admin/${tenantId}/patients/${patientId}/blood-results/${latest_ai_interpretation.pathology_result_id}`}
              className="text-xs font-medium text-cyan-300 hover:underline"
            >
              Open result
            </Link>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2 text-xs text-sky-950">
            {latest_ai_interpretation.hair_loss_relevance_score != null ? (
              <li className="rounded-full bg-[#0F1629]/80 backdrop-blur-md px-2 py-1">Hair relevance: {latest_ai_interpretation.hair_loss_relevance_score}/100</li>
            ) : null}
            {latest_ai_interpretation.surgical_readiness_score != null ? (
              <li className="rounded-full bg-[#0F1629]/80 backdrop-blur-md px-2 py-1">Surgery readiness: {latest_ai_interpretation.surgical_readiness_score}/100</li>
            ) : null}
          </ul>
          {latest_ai_interpretation.main_contributors.length > 0 ? (
            <p className="mt-2 text-sm text-sky-950">Main contributors: {latest_ai_interpretation.main_contributors.join(", ")}</p>
          ) : latest_ai_interpretation.overview_snippet ? (
            <p className="mt-2 text-sm text-sky-950">{latest_ai_interpretation.overview_snippet}</p>
          ) : null}
        </div>
      ) : null}

      {requests.length > 0 ? (
        <>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Recent blood requests</h3>
          <ul className="mt-2 divide-y divide-white/[0.06] text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <div>
                  <Link
                    href={`/fi-admin/${tenantId}/patients/${patientId}/blood-request/${r.id}`}
                    className="font-medium text-cyan-300 hover:underline"
                  >
                    {r.request_date} · {r.template_used.replace(/_/g, " ")}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {r.status}
                    {r.emailed_to_patient_at ? " · emailed" : ""}
                    {r.cancelled_at ? " · cancelled" : ""}
                  </p>
                </div>
                <span className="font-mono text-[10px] text-gray-400">{r.id.slice(0, 8)}…</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {results.length > 0 ? (
        <>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Recent blood results</h3>
          <ul className="mt-2 divide-y divide-white/[0.06] text-sm">
            {results.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <div>
                  <Link
                    href={`/fi-admin/${tenantId}/patients/${patientId}/blood-results/${r.id}`}
                    className="font-medium text-cyan-300 hover:underline"
                  >
                    {r.result_date}
                    {r.provider_name ? ` · ${r.provider_name}` : ""}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {r.status} · {r.marker_count} marker(s)
                    {r.abnormal_marker_count > 0 ? ` · ${r.abnormal_marker_count} abnormal` : ""}
                    {r.pathology_request_id ? " · linked request" : ""}
                  </p>
                </div>
                <span className="font-mono text-[10px] text-gray-400">{r.id.slice(0, 8)}…</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
