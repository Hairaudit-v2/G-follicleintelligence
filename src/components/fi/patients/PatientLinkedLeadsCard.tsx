import Link from "next/link";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";

export function PatientLinkedLeadsCard({ tenantId, data }: { tenantId: string; data: PatientProfileFoundationData }) {
  return (
    <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
      <h2 className="text-sm font-semibold text-slate-100">Linked CRM leads</h2>
      {data.leads.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">No leads linked to this patient yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-white/[0.06]">
          {data.leads.map(({ lead, stageLabel, ownerLabel }) => (
            <li key={lead.id} className="py-2">
              <Link href={`/fi-admin/${tenantId}/crm/leads/${lead.id}`} className="text-sm font-medium text-blue-700 hover:underline">
                {leadTitleFromRow(lead.summary, lead.id)}
              </Link>
              <p className="text-xs text-slate-400">
                Lead status: <strong>{lead.status}</strong>
                {stageLabel ? (
                  <>
                    {" "}
                    · Stage: <strong>{stageLabel}</strong>
                  </>
                ) : null}
                {ownerLabel ? (
                  <>
                    {" "}
                    · Owner: <strong>{ownerLabel}</strong>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
