"use client";

import Link from "next/link";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import { crmLeadCardClass } from "./crmSharedStyles";

export type LeadPersonHeaderProps = {
  tenantId?: string;
  patientId?: string | null;
  personName: string;
  leadId: string;
  leadSummary: string | null;
  /** From `formatClinicalScalesSummary` when lead has `patient_id`. */
  clinicalScalesSummary: string | null;
};

export function LeadPersonHeader({
  tenantId,
  patientId,
  personName,
  leadId,
  leadSummary,
  clinicalScalesSummary,
}: LeadPersonHeaderProps) {
  const pid = patientId?.trim() || null;
  return (
    <section className={crmLeadCardClass}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Person</h3>
        {tenantId && pid ? (
          <p className="flex flex-wrap gap-x-3 text-xs">
            <Link href={`/fi-admin/${tenantId}/patients`} className="text-blue-600 hover:underline">
              Patient directory
            </Link>
            <Link href={`/fi-admin/${tenantId}/patients/${pid}`} className="text-blue-600 hover:underline">
              Profile →
            </Link>
          </p>
        ) : null}
      </div>
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
