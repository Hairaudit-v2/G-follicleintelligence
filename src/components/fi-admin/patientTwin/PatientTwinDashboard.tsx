import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

import { PatientTwinAuditCard } from "./PatientTwinAuditCard";
import { PatientTwinCasesCard } from "./PatientTwinCasesCard";
import { PatientTwinClinicalCard } from "./PatientTwinClinicalCard";
import { PatientTwinPathologyCard } from "./PatientTwinPathologyCard";
import { PatientTwinCrmCard } from "./PatientTwinCrmCard";
import { PatientTwinHeader } from "./PatientTwinHeader";
import { PatientTwinImagingCard } from "./PatientTwinImagingCard";
import { PatientTwinMediaCard } from "./PatientTwinMediaCard";
import { PatientTwinTimelineCard } from "./PatientTwinTimelineCard";
import { PatientTwinWarningsCard } from "./PatientTwinWarningsCard";

export type PatientTwinDashboardProps = {
  tenantId: string;
  patientId: string;
  twin: PatientTwinV1;
};

/**
 * Executive read-only layout for PatientTwin V1 — no client fetches, no writes.
 */
export function PatientTwinDashboard({ tenantId, patientId, twin }: PatientTwinDashboardProps) {
  return (
    <div className="scroll-mt-4 space-y-5">
      <PatientTwinHeader tenantId={tenantId} patientId={patientId} twin={twin} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <PatientTwinIdentityCard twin={twin} />
        <PatientTwinCrmCard twin={twin} />
      </div>

      <PatientTwinCasesCard tenantId={tenantId} twin={twin} />

      <PatientTwinPathologyCard tenantId={tenantId} patientId={patientId} twin={twin} />

      <PatientTwinImagingCard twin={twin} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <PatientTwinAuditCard tenantId={tenantId} twin={twin} />
        <PatientTwinMediaCard twin={twin} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <PatientTwinClinicalCard twin={twin} />
        <PatientTwinTimelineCard tenantId={tenantId} twin={twin} />
      </div>

      <PatientTwinWarningsCard twin={twin} />
    </div>
  );
}
