import Link from "next/link";
import type { PatientClinicalIntelligenceView } from "@/src/lib/fi-os/clinicalIntelligenceSignals";
import type {
  OutcomeMeasurementRow,
  OutcomeProtocolRow,
} from "@/src/lib/fi-os/outcomeIntelligence.server";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";
import type { PatientIntelligenceOverviewModel } from "@/src/lib/patientTwin/patientTwinOverviewTypes";

import { PatientIntelligenceOverview } from "./PatientIntelligenceOverview";
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
import { PatientTwinVieCard } from "./PatientTwinVieCard";
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
  /** Optional story overview (2A.4). When present, renders above the historic card collage. */
  overview?: PatientIntelligenceOverviewModel | null;
};

function DetailCards(props: PatientTwinDashboardProps) {
  const {
    tenantId,
    patientId,
    twin,
    clinicalIntel,
    outcomeMeasurements,
    outcomeProtocols,
  } = props;

  return (
    <div className="space-y-5">
      {!props.overview ? (
        <div className="rounded-lg border border-white/[0.08] bg-[#0b1220]/80 p-4 text-sm text-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400/90">Payments</p>
          <p className="mt-2 text-sm text-slate-400">
            Structured invoices and balances live on the patient profile Payments tab (Payments).
          </p>
          <Link
            href={`/fi-admin/${tenantId}/patients/${patientId}?tab=payments`}
            className="mt-3 inline-block text-sm font-medium text-cyan-300 hover:underline"
          >
            Open Payments tab
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <PatientTwinIdentityCard twin={twin} />
        <PatientTwinCrmCard twin={twin} />
      </div>

      <PatientTwinCasesCard tenantId={tenantId} twin={twin} />

      <PatientTwinClinicalIntelligenceCard
        tenantId={tenantId}
        patientId={patientId}
        view={clinicalIntel}
      />

      <PatientHairLossClassificationCard
        key={`${tenantId}-${patientId}`}
        tenantId={tenantId}
        patientId={patientId}
        twin={twin}
      />

      <PatientTwinHairProgressionCard twin={twin} />

      <PatientDonorIntelligenceCard
        key={`donor-${tenantId}-${patientId}`}
        tenantId={tenantId}
        patientId={patientId}
        twin={twin}
      />

      <PatientRecipientCandidacyCard
        key={`recipient-${tenantId}-${patientId}`}
        tenantId={tenantId}
        patientId={patientId}
        twin={twin}
      />

      <PatientConsultationChecklistCard
        key={`checklist-${tenantId}-${patientId}`}
        tenantId={tenantId}
        patientId={patientId}
        twin={twin}
      />

      <PatientTwinOutcomeJourneyCard
        measurements={outcomeMeasurements}
        protocols={outcomeProtocols}
      />

      <PatientTwinPathologyCard tenantId={tenantId} patientId={patientId} twin={twin} />

      <PatientTwinImagingCard tenantId={tenantId} patientId={patientId} twin={twin} />

      <PatientTwinVieCard tenantId={tenantId} patientId={patientId} twin={twin} />

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

/**
 * Health record dashboard: story overview first (when composed), then existing detail cards.
 * Imaging + Smart Photography Protocol support client actions on the protocol card; other
 * sections remain read-oriented unless otherwise noted.
 */
export function PatientTwinDashboard(props: PatientTwinDashboardProps) {
  const { tenantId, patientId, twin, overview } = props;
  const presentationMode = Boolean(overview?.presentationMode);

  return (
    <div className="scroll-mt-4 space-y-5">
      <PatientTwinHeader tenantId={tenantId} patientId={patientId} twin={twin} />

      {overview ? <PatientIntelligenceOverview overview={overview} /> : null}

      {presentationMode ? (
        <details className="rounded-xl border border-white/[0.08] bg-[#0b1220]/70 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-200">
            Full health record cards
          </summary>
          <div className="mt-4">
            <DetailCards {...props} />
          </div>
        </details>
      ) : (
        <>
          {overview ? (
            <h2 className="text-sm font-semibold tracking-tight text-slate-300">
              Full health record
            </h2>
          ) : null}
          <DetailCards {...props} />
        </>
      )}
    </div>
  );
}
