"use client";

import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import type { PatientDetailTabId } from "@/src/lib/patients/patientDetailTabs";
import type { PatientDetailPayload } from "@/src/lib/patients/patientDetailLoader";
import { PatientProfileHeader } from "../PatientProfileHeader";
import { PatientContactDetailsCard } from "../PatientContactDetailsCard";
import { PatientImportedSourceSection } from "../PatientImportedSourceSection";
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
import { PatientVoiceClinicalNotesCard } from "@/src/components/fi/clinical-notes/PatientVoiceClinicalNotesCard";
import { VoiceNoteEntryButton } from "@/src/components/fi/clinical-notes/VoiceNoteEntryButton";
import { PaymentRecordPanel } from "@/src/components/fi-admin/payments/PaymentRecordPanel";
import type { PaymentRecordRow } from "@/src/lib/payments/paymentRecordModel";

export function PatientDetailPageView({
  tenantId,
  patientId,
  initialPayload,
  activeTab,
  previewPatientId,
  operationalTodayYmd,
  initialPaymentRecords = [],
  canMutatePaymentRecords = false,
  /** Server-rendered async tab; passed from the route so this client module never imports prescribing loaders. */
  prescriptionsTab,
}: {
  tenantId: string;
  patientId: string;
  initialPayload: PatientDetailPayload;
  activeTab: PatientDetailTabId;
  previewPatientId?: string;
  operationalTodayYmd: string;
  initialPaymentRecords?: PaymentRecordRow[];
  canMutatePaymentRecords?: boolean;
  prescriptionsTab?: ReactNode;
}) {
  const { profile } = initialPayload;

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <PatientDetailBreadcrumbs tenantId={tenantId} patientName={initialPayload.displayName} />

      <header className="space-y-1">
        <PatientProfileHeader tenantId={tenantId} data={profile} />
        <p className="text-sm text-gray-600">
          Foundation patient · <span className="font-mono text-xs">{patientId}</span>
        </p>
      </header>

      <PatientContactDetailsCard data={profile} />
      <PatientImportedSourceSection data={profile} />

      <Suspense fallback={null}>
        <PatientDetailPreviewUrlSync currentPatientId={patientId} previewPatientId={previewPatientId} />
      </Suspense>

      <Suspense fallback={<div className="h-10 animate-pulse rounded border border-gray-200 bg-white" aria-hidden />}>
        <PatientDetailTabNav tenantId={tenantId} patientId={patientId} activeTab={activeTab} />
      </Suspense>

      <div id="patient-actions" className="flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-gray-50/80 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</span>
        <VoiceNoteEntryButton tenantId={tenantId} patientId={patientId} />
        <Link
          href={`/fi-admin/${tenantId}/patients/${patientId}/blood-request`}
          className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
        >
          Request blood tests
        </Link>
        <Link
          href={`/fi-admin/${tenantId}/patients/${patientId}/blood-results/new`}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-50"
        >
          Upload blood results
        </Link>
        <Link
          href={`/fi-admin/${tenantId}/patients/${patientId}/imaging`}
          className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-900 hover:bg-indigo-100"
        >
          ImagingOS
        </Link>
        <Link
          href={`/fi-admin/${tenantId}/patients/${patientId}/twin`}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-50"
        >
          Patient Twin
        </Link>
        <Link
          href={`/fi-admin/${tenantId}/surgery-readiness`}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-50"
        >
          Surgery readiness
        </Link>
      </div>

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
          <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
            <PaymentRecordPanel
              tenantId={tenantId}
              todayYmd={operationalTodayYmd}
              paymentContext="other"
              patientId={patientId}
              initialRows={initialPaymentRecords}
              canMutate={canMutatePaymentRecords}
              noManualPaymentRecordsCopy="No manual payment records linked to this patient yet."
            />
          </div>
        </div>
      ) : null}

      {activeTab === "clinical" ? (
        <div className="space-y-4">
          <PatientVoiceClinicalNotesCard tenantId={tenantId} items={initialPayload.voiceClinicalNotes} />
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

      {activeTab === "prescriptions" ? prescriptionsTab : null}

      {activeTab === "documents" ? <PatientDocumentsTab tenantId={tenantId} data={profile} /> : null}
    </div>
  );
}
