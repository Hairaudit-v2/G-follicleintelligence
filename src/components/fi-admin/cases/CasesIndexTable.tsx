import Link from "next/link";
import type { CaseIndexRow } from "@/src/lib/cases/caseLoaders";
import { fiCaseStatusLabel } from "@/src/lib/cases/caseLabels";

export function CasesIndexTable({ tenantId, rows }: { tenantId: string; rows: CaseIndexRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No patients for this tenant yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-lg shadow-black/40">
      <table className="min-w-full text-sm" aria-labelledby="cases-index-table-heading">
        <caption
          id="cases-index-table-heading"
          className="px-3 py-2 text-left text-sm font-semibold text-slate-100"
        >
          Tenant patients
        </caption>
        <thead className="bg-white/[0.03] text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-2">Patient</th>
            <th className="px-3 py-2">Person</th>
            <th className="px-3 py-2">Lead</th>
            <th className="px-3 py-2">Treatment</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Updated</th>
            <th className="px-3 py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-white/[0.06] hover:bg-white/[0.03]">
              <td className="px-3 py-2">
                <Link
                  href={`/fi-admin/${tenantId}/cases/${r.id}`}
                  className="font-medium text-blue-300 hover:underline"
                >
                  {r.external_id?.trim() ? r.external_id : `${r.id.slice(0, 8)}…`}
                </Link>
              </td>
              <td className="px-3 py-2 text-slate-200">
                <div>{r.person_label}</div>
                {r.person_email ? (
                  <div className="text-xs text-gray-500">{r.person_email}</div>
                ) : null}
              </td>
              <td className="px-3 py-2">
                {r.lead ? (
                  <Link
                    href={`/fi-admin/${tenantId}/crm/leads/${r.lead.id}`}
                    className="text-blue-300 hover:underline"
                  >
                    {r.lead.title}
                  </Link>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-slate-300">{r.treatment_type ?? "—"}</td>
              <td className="px-3 py-2 text-slate-300">{r.case_type ?? "—"}</td>
              <td className="px-3 py-2 text-slate-200">{fiCaseStatusLabel(r.status)}</td>
              <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-400">
                {r.updated_at ? r.updated_at.slice(0, 10) : "—"}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-400">
                {r.created_at ? r.created_at.slice(0, 10) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
