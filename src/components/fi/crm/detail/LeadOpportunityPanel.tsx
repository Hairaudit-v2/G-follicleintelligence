import type { CrmLeadOpportunitySnapshot } from "@/src/lib/crm/crmLeadOpportunityMeta";
import type { FiCrmLeadRow } from "@/src/lib/crm/types";
import { crmLeadCardClass } from "../shared";

export function LeadOpportunityPanel({
  lead,
  opportunity,
}: {
  lead: FiCrmLeadRow;
  opportunity: CrmLeadOpportunitySnapshot;
}) {
  return (
    <section className={crmLeadCardClass}>
      <h2 className="mb-2 text-sm font-semibold text-gray-900">Opportunity details</h2>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-gray-500">Current stage</dt>
          <dd className="font-medium text-gray-900">{opportunity.stageLabel}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Lead status</dt>
          <dd className="text-gray-900">{lead.status}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Priority</dt>
          <dd className="text-gray-900">{lead.priority?.trim() || "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Treatment value</dt>
          <dd className="text-gray-900">{opportunity.treatmentValueLabel ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Conversion probability</dt>
          <dd className="text-gray-900">{opportunity.conversionProbabilityLabel ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Organisation / clinic</dt>
          <dd className="font-mono text-xs text-gray-800">
            {lead.organisation_id?.slice(0, 8) ?? "—"} / {lead.clinic_id?.slice(0, 8) ?? "—"}
          </dd>
        </div>
        {opportunity.sourceSystem ? (
          <div className="sm:col-span-2">
            <dt className="text-gray-500">External source</dt>
            <dd className="text-gray-900">
              {opportunity.sourceSystem}
              {opportunity.sourceLeadId ? ` · ${opportunity.sourceLeadId}` : ""}
            </dd>
          </div>
        ) : null}
        {opportunity.opportunityNotes ? (
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Notes</dt>
            <dd className="whitespace-pre-wrap text-gray-800">{opportunity.opportunityNotes}</dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-3 text-xs text-gray-500">
        Set <code className="rounded bg-gray-100 px-1">treatment_value</code>,{" "}
        <code className="rounded bg-gray-100 px-1">conversion_probability</code>, or{" "}
        <code className="rounded bg-gray-100 px-1">opportunity_notes</code> on lead metadata to populate commercial fields.
      </p>
    </section>
  );
}
