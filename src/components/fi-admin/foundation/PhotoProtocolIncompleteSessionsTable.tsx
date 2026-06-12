import Link from "next/link";

import { FiCard } from "@/src/components/fi-design/FiCard";
import type { PhotoProtocolIncompleteSessionRow } from "@/src/lib/hair-intelligence/photoProtocols/photoProtocolAnalyticsLoader.server";
import { fiOsPatientTwinPhotoProtocolHref } from "@/src/lib/hair-intelligence/photoProtocols/protocolDeepLinks";

export function PhotoProtocolIncompleteSessionsTable({ tenantId, rows }: { tenantId: string; rows: PhotoProtocolIncompleteSessionRow[] }) {
  const tid = tenantId.trim();
  return (
    <FiCard>
      <h2 className="text-sm font-semibold text-slate-900">Incomplete protocol sessions</h2>
      <p className="mt-1 text-sm text-slate-600">
        Draft, in progress, or incomplete sessions in the analytics window (required-slot gaps drive “missing” counts).
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4">Patient</th>
              <th className="py-2 pr-4">Clinical context</th>
              <th className="py-2 pr-4">Protocol</th>
              <th className="py-2 pr-4">Missing required</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Started</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-500">
                  No incomplete sessions in this window.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.session_id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-slate-900">{r.patient_display}</td>
                  <td className="py-2 pr-4 text-slate-700">{r.clinical_context.replace(/_/g, " ")}</td>
                  <td className="py-2 pr-4 text-slate-700">
                    <span className="font-medium">{r.protocol_name}</span>
                    <span className="ml-1 text-xs text-slate-500">({r.protocol_template_slug})</span>
                  </td>
                  <td className="py-2 pr-4 font-mono text-slate-800">{r.missing_required_count}</td>
                  <td className="py-2 pr-4 text-slate-700">{r.status.replace(/_/g, " ")}</td>
                  <td className="py-2 pr-4 text-slate-600">{r.started_at ? new Date(r.started_at).toLocaleString() : "—"}</td>
                  <td className="py-2">
                    <Link
                      href={r.patient_id ? fiOsPatientTwinPhotoProtocolHref(tid, r.patient_id) : r.patient_twin_href}
                      className="font-medium text-sky-700 hover:underline"
                    >
                      Patient Twin
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </FiCard>
  );
}
