"use client";

import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import { crmLeadCardClass } from "./crmSharedStyles";

export type LeadPersonHeaderProps = {
  personName: string;
  leadId: string;
  leadSummary: string | null;
  /** From `formatClinicalScalesSummary` when lead has `patient_id`. */
  clinicalScalesSummary: string | null;
};

export function LeadPersonHeader({ personName, leadId, leadSummary, clinicalScalesSummary }: LeadPersonHeaderProps) {
  return (
    <section className={crmLeadCardClass}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Person</h3>
      <p className="font-medium text-gray-900">{personName}</p>
      <p className="mt-1 text-xs text-gray-500">Lead: {leadTitleFromRow(leadSummary, leadId)}</p>
      {clinicalScalesSummary ? (
        <p className="mt-2 text-xs text-gray-800">{clinicalScalesSummary}</p>
      ) : (
        <p className="mt-2 text-xs text-gray-500">No linked patient clinical summary yet.</p>
      )}
    </section>
  );
}
