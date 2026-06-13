import Link from "next/link";
import type { PatientClinicalIntelligenceView } from "@/src/lib/fi-os/clinicalIntelligenceSignals";
import type { OutcomeMeasurementRow, OutcomeProtocolRow } from "@/src/lib/fi-os/outcomeIntelligence.server";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

import { PatientTwinAuditCard } from "./PatientTwinAuditCard";
import { PatientTwinCasesCard } from "./PatientTwinCasesCard";
import { PatientTwinClinicalIntelligenceCard } from "./PatientTwinClinicalIntelligenceCard";
import { PatientTwinClinicalCard } from "./PatientTwinClinicalCard";
import { PatientDonorIntelligenceCard } from "./PatientDonorIntelligenceCard";
import { PatientHairLossClassificationCard } from "./PatientHairLossClassificationCard";
import { PatientRecipientCandidacyCard } from "./PatientRecipientCandidacyCard";
import { PatientConsultationChecklistCard } from "./PatientConsultationChecklistCard";
import { PatientTwinHairProgressionCard } from "./PatientTwinHairProgressionCard";
import { PatientTwinMedicationsCard } from "./PatientTwinMedicationsCard";
import { PatientTwinOutcomeJourneyCard } from "./PatientTwinOutcomeJourneyCard";
import { PatientTwinPathologyCard } from "./PatientTwinPathologyCard";
import { PatientTwinCrmCard } from "./PatientTwinCrmCard";
import { PatientTwinHeader } from "./PatientTwinHeader";
import { PatientTwinIdentityCard } from "./PatientTwinIdentityCard";
import { PatientTwinImagingCard } from "./PatientTwinImagingCard";
import { PatientTwinPhotoProtocolCard } from "./PatientTwinPhotoProtocolCard";
import { PatientTwinMediaCard } from "./PatientTwinMediaCard";
import { PatientTwinTimelineCard } from "./PatientTwinTimelineCard";
import { PatientTwinWarningsCard } from "./PatientTwinWarningsCard";

export type PatientTwinDashboardProps = {
  tenantId: string;
  patientId: string;
  twin: PatientTwinV1;
  clinicalIntel: PatientClinicalIntelligenceView;
  outcomeMeasurements: OutcomeMeasurementRow[];
  outcomeProtocols: OutcomeProtocolRow[];
};

/**
 * Patient Twin dashboard: imaging + Smart Photography Protocol support client actions on the protocol card; other sections remain read-oriented unless otherwise noted.
 */
export function PatientTwinDashboard({ tenantId, patientId, twin, clinicalIntel, outcomeMeasurements, outcomeProtocols }: PatientTwinDashboardProps) {
  return (
    <div className="scroll-mt-4 space-y-5">
      <PatientTwinHeader tenantId={tenantId} patientId={patientId} twin={twin} />

      <div className="rounded-lg border border-white/[0.08] bg-[#0b1220]/80 p-4 text-sm text-slate-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400/90">Payments</p>
        <p className="mt-2 text-sm text-slate-400">
          Structured invoices and balances live on the patient profile Payments tab (RevenueOS).
        </p>
        <Link
          href={`/fi-admin/${tenantId}/patients/${patientId}?tab=payments`}
          className="mt-3 inline-block text-sm font-medium text-cyan-300 hover:underline"
        >
          Open Payments tab
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <PatientTwinIdentityCard twin={twin} />
        <PatientTwinCrmCard twin={twin} />
      </div>

      <PatientTwinCasesCard tenantId={tenantId} twin={twin} />

      <PatientTwinClinicalIntelligenceCard tenantId={tenantId} patientId={patientId} view={clinicalIntel} />

      <PatientHairLossClassificationCard key={`${tenantId}-${patientId}`} tenantId={tenantId} patientId={patientId} twin={twin} />

      <PatientTwinHairProgressionCard twin={twin} />

      <PatientDonorIntelligenceCard key={`donor-${tenantId}-${patientId}`} tenantId={tenantId} patientId={patientId} twin={twin} />

      <PatientRecipientCandidacyCard key={`recipient-${tenantId}-${patientId}`} tenantId={tenantId} patientId={patientId} twin={twin} />

      <PatientConsultationChecklistCard key={`checklist-${tenantId}-${patientId}`} tenantId={tenantId} patientId={patientId} twin={twin} />

      <PatientTwinOutcomeJourneyCard measurements={outcomeMeasurements} protocols={outcomeProtocols} />

      <PatientTwinPathologyCard tenantId={tenantId} patientId={patientId} twin={twin} />

      <PatientTwinImagingCard tenantId={tenantId} patientId={patientId} twin={twin} />

      <PatientTwinPhotoProtocolCard tenantId={tenantId} patientId={patientId} twin={twin} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <PatientTwinAuditCard tenantId={tenantId} twin={twin} />
        <PatientTwinMediaCard twin={twin} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <PatientTwinClinicalCard twin={twin} />
        <PatientTwinMedicationsCard twin={twin} />
        <PatientTwinTimelineCard tenantId={tenantId} twin={twin} />
      </div>

      <PatientTwinWarningsCard twin={twin} />
    </div>
  );
}
