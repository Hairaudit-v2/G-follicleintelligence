import Link from "next/link";
import type { CaseIndexRow } from "@/src/lib/cases/caseLoaders";
import { fiCaseStatusLabel } from "@/src/lib/cases/caseLabels";

export function CasesIndexTable({ tenantId, rows }: { tenantId: string; rows: CaseIndexRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No cases for this tenant yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full text-sm" aria-labelledby="cases-index-table-caption">
        <caption id="cases-index-table-caption" className="sr-only">
          Tenant cases with person, lead, treatment, type, status, and dates
        </caption>
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
          <tr>
            <th className="px-3 py-2">Case</th>
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
            <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/80">
              <td className="px-3 py-2">
                <Link href={`/fi-admin/${tenantId}/cases/${r.id}`} className="font-medium text-blue-700 hover:underline">
                  {r.external_id?.trim() ? r.external_id : `${r.id.slice(0, 8)}…`}
                </Link>
              </td>
              <td className="px-3 py-2 text-gray-800">
                <div>{r.person_label}</div>
                {r.person_email ? <div className="text-xs text-gray-500">{r.person_email}</div> : null}
              </td>
              <td className="px-3 py-2">
                {r.lead ? (
                  <Link href={`/fi-admin/${tenantId}/crm/leads/${r.lead.id}`} className="text-blue-600 hover:underline">
                    {r.lead.title}
                  </Link>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-gray-700">{r.treatment_type ?? "—"}</td>
              <td className="px-3 py-2 text-gray-700">{r.case_type ?? "—"}</td>
              <td className="px-3 py-2 text-gray-800">{fiCaseStatusLabel(r.status)}</td>
              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">{r.updated_at ? r.updated_at.slice(0, 10) : "—"}</td>
              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">{r.created_at ? r.created_at.slice(0, 10) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
