import Link from "next/link";
import type { CaseLeadLink } from "@/src/lib/cases/caseLoaders";
import { CASE_DETAIL_SECTION_IDS, caseDetailSectionHeadingId } from "@/src/lib/cases/caseDetailNavConstants";

export function CaseLinkedLeadCard({ tenantId, leads }: { tenantId: string; leads: CaseLeadLink[] }) {
  return (
    <div className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
      <h2 id={caseDetailSectionHeadingId(CASE_DETAIL_SECTION_IDS.lead)} className="text-sm font-semibold text-slate-100">
        Linked CRM leads
      </h2>
      {leads.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No CRM leads reference this patient.</p>
      ) : (
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm">
          {leads.map((l) => (
            <li key={l.id}>
              <Link href={`/fi-admin/${tenantId}/crm/leads/${l.id}`} className="font-medium text-blue-700 hover:underline">
                {l.title}
              </Link>
              <span className="ml-2 text-xs text-gray-500">
                ({l.link_reason === "case_id" ? "patient" : "conversion"} · {l.status})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
