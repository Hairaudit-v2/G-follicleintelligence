import Link from "next/link";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { FiCard } from "@/src/components/fi-design/FiCard";
import type { PhotoProtocolIncompleteSessionRow } from "@/src/lib/hair-intelligence/photoProtocols/photoProtocolAnalyticsLoader.server";
import { fiOsPatientTwinPhotoProtocolHref } from "@/src/lib/hair-intelligence/photoProtocols/protocolDeepLinks";

export function PhotoProtocolIncompleteSessionsTable({
  tenantId,
  rows,
  variant = "light",
}: {
  tenantId: string;
  rows: PhotoProtocolIncompleteSessionRow[];
  variant?: "light" | "darkGlass";
}) {
  const tid = tenantId.trim();
  const dark = variant === "darkGlass";

  const table = (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr
            className={
              dark
                ? "border-b border-white/[0.08] text-xs font-semibold uppercase tracking-wide text-slate-500"
                : "border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500"
            }
          >
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
              <td colSpan={7} className={`py-6 text-center ${dark ? "text-slate-500" : "text-slate-500"}`}>
                No incomplete sessions in this window.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.session_id} className={dark ? "border-b border-white/[0.06]" : "border-b border-slate-100"}>
                <td className={`py-2 pr-4 ${dark ? "text-slate-200" : "text-slate-900"}`}>{r.patient_display}</td>
                <td className={`py-2 pr-4 ${dark ? "text-slate-400" : "text-slate-700"}`}>{r.clinical_context.replace(/_/g, " ")}</td>
                <td className={`py-2 pr-4 ${dark ? "text-slate-400" : "text-slate-700"}`}>
                  <span className="font-medium">{r.protocol_name}</span>
                  <span className={`ml-1 text-xs ${dark ? "text-slate-600" : "text-slate-500"}`}>({r.protocol_template_slug})</span>
                </td>
                <td className={`py-2 pr-4 font-mono ${dark ? "text-slate-300" : "text-slate-800"}`}>{r.missing_required_count}</td>
                <td className={`py-2 pr-4 ${dark ? "text-slate-400" : "text-slate-700"}`}>{r.status.replace(/_/g, " ")}</td>
                <td className={`py-2 pr-4 ${dark ? "text-slate-500" : "text-slate-600"}`}>
                  {r.started_at ? new Date(r.started_at).toLocaleString() : "—"}
                </td>
                <td className="py-2">
                  <Link
                    href={r.patient_id ? fiOsPatientTwinPhotoProtocolHref(tid, r.patient_id) : r.patient_twin_href}
                    className={`font-medium hover:underline ${dark ? "text-cyan-300 hover:text-cyan-200" : "text-sky-700"}`}
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
  );

  if (dark) {
    return (
      <DashboardCard className="p-4 sm:p-5">
        <SectionHeader
          title="Incomplete protocol sessions"
          description="Draft, in progress, or incomplete sessions in the analytics window."
        />
        {table}
      </DashboardCard>
    );
  }

  return (
    <FiCard>
      <h2 className="text-sm font-semibold text-slate-900">Incomplete protocol sessions</h2>
      <p className="mt-1 text-sm text-slate-600">
        Draft, in progress, or incomplete sessions in the analytics window (required-slot gaps drive “missing” counts).
      </p>
      {table}
    </FiCard>
  );
}
