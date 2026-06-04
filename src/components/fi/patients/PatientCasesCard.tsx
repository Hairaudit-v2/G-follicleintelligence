import Link from "next/link";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";

export function PatientCasesCard({ tenantId, data }: { tenantId: string; data: PatientProfileFoundationData }) {
  return (
    <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Cases</h2>
      {data.cases.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">No cases linked to this foundation patient.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {data.cases.map((c) => (
            <li key={c.id} className="py-2">
              <Link href={`/fi-admin/${tenantId}/cases/${c.id}`} className="text-sm font-medium text-blue-700 hover:underline">
                Case {c.id.slice(0, 8)}…
              </Link>
              <p className="text-xs text-gray-600">
                Status: <strong>{c.status}</strong>
                {c.case_type ? (
                  <>
                    {" "}
                    · Type: <strong>{c.case_type}</strong>
                  </>
                ) : null}
              </p>
              <p className="text-xs text-gray-500">Created {c.created_at.slice(0, 10)}</p>
              {c.sourceLeadId ? (
                <p className="mt-1 text-xs">
                  Source lead:{" "}
                  <Link href={`/fi-admin/${tenantId}/crm/leads/${c.sourceLeadId}`} className="text-blue-600 hover:underline">
                    {leadTitleFromRow(c.sourceLeadSummary, c.sourceLeadId)}
                  </Link>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
