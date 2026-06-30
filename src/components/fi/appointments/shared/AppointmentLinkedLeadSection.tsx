"use client";

import Link from "next/link";
import { BookingTypeBadge } from "@/src/components/fi/bookings/operator/BookingTypeBadge";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import { parseCrmLeadOpportunitySnapshot } from "@/src/lib/crm/crmLeadOpportunityMeta";
import type { AppointmentSlideOverLeadAnchor } from "@/src/lib/bookings/appointmentSlideOverLoader";
import type { FiCrmPipelineStageRow } from "@/src/lib/crm/types";
import { appointmentCardClass } from "./appointmentSharedStyles";

export function AppointmentLinkedLeadSection({
  tenantId,
  leadAnchor,
  pipelineStages = [],
  bookingType,
}: {
  tenantId: string;
  leadAnchor: AppointmentSlideOverLeadAnchor;
  pipelineStages?: FiCrmPipelineStageRow[];
  bookingType?: string;
}) {
  const { lead, personName } = leadAnchor;
  const leadHref = `/fi-admin/${tenantId}/crm/leads/${lead.id}`;
  const opportunity = parseCrmLeadOpportunitySnapshot(lead, pipelineStages);
  const patientHref = lead.patient_id ? `/fi-admin/${tenantId}/patients/${lead.patient_id}` : null;

  return (
    <section className={appointmentCardClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Linked CRM lead</h3>
          <p className="mt-1 text-sm font-medium text-slate-100">{leadTitleFromRow(lead.summary, lead.id)}</p>
          {personName && personName !== "—" ? <p className="text-sm text-slate-300">{personName}</p> : null}
        </div>
        {bookingType ? <BookingTypeBadge type={bookingType} /> : null}
      </div>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-gray-500">Stage</dt>
          <dd className="font-medium text-slate-100">{opportunity.stageLabel}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Lead status</dt>
          <dd className="text-slate-100">{lead.status}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Treatment value</dt>
          <dd className="text-slate-100">{opportunity.treatmentValueLabel ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Conversion probability</dt>
          <dd className="text-slate-100">{opportunity.conversionProbabilityLabel ?? "—"}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <Link href={leadHref} className="font-medium text-blue-300 hover:underline">
          Open lead detail →
        </Link>
        {patientHref ? (
          <Link href={patientHref} className="text-blue-300 hover:underline">
            Patient record →
          </Link>
        ) : (
          <span className="text-gray-500">No patient linked</span>
        )}
      </div>
    </section>
  );
}
