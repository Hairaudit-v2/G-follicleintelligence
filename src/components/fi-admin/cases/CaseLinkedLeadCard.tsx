import Link from "next/link";
import type { CaseLeadLink } from "@/src/lib/cases/caseLoaders";

export function CaseLinkedLeadCard({ tenantId, leads }: { tenantId: string; leads: CaseLeadLink[] }) {
  return (
    <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Linked CRM leads</h2>
      {leads.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No CRM leads reference this case.</p>
      ) : (
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm">
          {leads.map((l) => (
            <li key={l.id}>
              <Link href={`/fi-admin/${tenantId}/crm/leads/${l.id}`} className="font-medium text-blue-700 hover:underline">
                {l.title}
              </Link>
              <span className="ml-2 text-xs text-gray-500">
                ({l.link_reason === "case_id" ? "case" : "conversion"} · {l.status})
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
