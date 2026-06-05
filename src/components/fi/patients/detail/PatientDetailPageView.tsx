"use client";

import { Suspense } from "react";
import type { PatientDetailTabId } from "@/src/lib/patients/patientDetailTabs";
import type { PatientDetailPayload } from "@/src/lib/patients/patientDetailLoader";
import { PatientProfileHeader } from "../PatientProfileHeader";
import { PatientProfileSummaryCards } from "../PatientProfileSummaryCards";
import { PatientClinicalDetailsCard } from "../PatientClinicalDetailsCard";
import { PatientImagesCard } from "@/src/components/fi/patient-images/PatientImagesCard";
import { PatientPersonDetailsCard } from "../PatientPersonDetailsCard";
import { PatientCasesCard } from "../PatientCasesCard";
import { PatientTreatmentTimelineCard } from "../timeline/PatientTreatmentTimelineCard";
import { PatientDetailBreadcrumbs } from "./PatientDetailBreadcrumbs";
import { PatientDetailTabNav } from "./PatientDetailTabNav";
import { PatientDetailPreviewUrlSync } from "./PatientDetailPreviewUrlSync";
import { PatientNextAppointmentCard } from "./PatientNextAppointmentCard";
import { PatientPersonLeadHistoryCard } from "../shared/PatientPersonLeadHistoryCard";
import { PatientConsultationsCard } from "../shared/PatientConsultationsCard";
import { PatientPreviousProceduresCard } from "./PatientPreviousProceduresCard";
import { PatientProgressCompare } from "../progress/PatientProgressCompare";
import { PatientAppointmentsTab } from "./PatientAppointmentsTab";
import { PatientDocumentsTab } from "./PatientDocumentsTab";

export function PatientDetailPageView({
  tenantId,
  patientId,
  initialPayload,
  activeTab,
  previewPatientId,
}: {
  tenantId: string;
  patientId: string;
  initialPayload: PatientDetailPayload;
  activeTab: PatientDetailTabId;
  previewPatientId?: string;
}) {
  const { profile } = initialPayload;

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <PatientDetailBreadcrumbs tenantId={tenantId} patientName={initialPayload.displayName} />

      <header className="space-y-1">
        <PatientProfileHeader data={profile} />
        <p className="text-sm text-gray-600">
          Foundation patient · <span className="font-mono text-xs">{patientId}</span>
        </p>
      </header>

      <Suspense fallback={null}>
        <PatientDetailPreviewUrlSync currentPatientId={patientId} previewPatientId={previewPatientId} />
      </Suspense>

      <Suspense fallback={<div className="h-10 animate-pulse rounded border border-gray-200 bg-white" aria-hidden />}>
        <PatientDetailTabNav tenantId={tenantId} patientId={patientId} activeTab={activeTab} />
      </Suspense>

      {activeTab === "overview" ? (
        <div className="space-y-4">
          <PatientNextAppointmentCard tenantId={tenantId} patientId={patientId} payload={initialPayload} />
          <PatientProfileSummaryCards data={profile} />
          <PatientConsultationsCard tenantId={tenantId} consultations={initialPayload.consultations} compact />
          <PatientPersonLeadHistoryCard
            tenantId={tenantId}
            currentPatientId={patientId}
            items={initialPayload.personLeadHistory}
            activity={initialPayload.personCrmActivity}
            compact
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <PatientPersonDetailsCard data={profile} />
            <PatientCasesCard tenantId={tenantId} data={profile} />
          </div>
        </div>
      ) : null}

      {activeTab === "clinical" ? (
        <div className="space-y-4">
          <PatientClinicalDetailsCard tenantId={tenantId} data={profile} />
          <PatientPreviousProceduresCard procedures={initialPayload.previousProcedures} />
          <PatientConsultationsCard tenantId={tenantId} consultations={initialPayload.consultations} />
        </div>
      ) : null}

      {activeTab === "appointments" ? (
        <PatientAppointmentsTab tenantId={tenantId} patientId={patientId} data={profile} />
      ) : null}

      {activeTab === "gallery" ? (
        <div className="space-y-4">
          <PatientProgressCompare bundle={profile.patientImages} />
          <PatientImagesCard tenantId={tenantId} data={profile} />
        </div>
      ) : null}

      {activeTab === "treatment_history" ? (
        <div className="space-y-4">
          <PatientPersonLeadHistoryCard
            tenantId={tenantId}
            currentPatientId={patientId}
            items={initialPayload.personLeadHistory}
            activity={initialPayload.personCrmActivity}
          />
          <PatientConsultationsCard tenantId={tenantId} consultations={initialPayload.consultations} />
          <PatientPreviousProceduresCard procedures={initialPayload.previousProcedures} />
          <PatientCasesCard tenantId={tenantId} data={profile} />
        </div>
      ) : null}

      {activeTab === "timeline" ? (
        <PatientTreatmentTimelineCard patientTimeline={profile.patientTimeline} patientImages={profile.patientImages} />
      ) : null}

      {activeTab === "documents" ? <PatientDocumentsTab tenantId={tenantId} data={profile} /> : null}
    </div>
  );
}
