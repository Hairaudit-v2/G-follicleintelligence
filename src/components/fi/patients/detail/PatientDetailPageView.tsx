"use client";

import { Suspense, type ReactNode } from "react";
import type { PatientDetailTabId } from "@/src/lib/patients/patientDetailTabs";
import type { PatientDetailPayload } from "@/src/lib/patients/patientDetailLoader";
import { PatientPhotoCaptureActions } from "../PatientPhotoCaptureActions";
import { PatientCommandHero } from "@/src/components/fi-admin/patients/PatientCommandHero";
import { PatientDetailsSummary } from "@/src/components/fi-admin/patients/PatientDetailsSummary";
import { PatientCommandSummaryRow } from "@/src/components/fi-admin/patients/PatientCommandSummaryRow";
import { PatientClinicalDetailsCard } from "../PatientClinicalDetailsCard";
import { PatientImagesCard } from "@/src/components/fi/patient-images/PatientImagesCard";
import { PatientCasesCard } from "../PatientCasesCard";
import { PatientTreatmentTimelineCard } from "../timeline/PatientTreatmentTimelineCard";
import { PatientDetailBreadcrumbs } from "./PatientDetailBreadcrumbs";
import { PatientDetailTabNav } from "./PatientDetailTabNav";
import { PatientDetailPreviewUrlSync } from "./PatientDetailPreviewUrlSync";
import { PatientPhotoAddedFeedback } from "./PatientPhotoAddedFeedback";
import { PatientPersonLeadHistoryCard } from "../shared/PatientPersonLeadHistoryCard";
import { PatientConsultationsCard } from "../shared/PatientConsultationsCard";
import { PatientPreviousProceduresCard } from "./PatientPreviousProceduresCard";
import { PatientProgressCompare } from "../progress/PatientProgressCompare";
import { PatientAppointmentsTab } from "./PatientAppointmentsTab";
import { PatientDocumentsTab } from "./PatientDocumentsTab";
import { PatientVoiceClinicalNotesCard } from "@/src/components/fi/clinical-notes/PatientVoiceClinicalNotesCard";
import { PatientRevenueInvoicesPanel } from "@/src/components/fi-admin/revenue/PatientRevenueInvoicesPanel";
import type { PatientInvoiceSummary } from "@/src/lib/revenueOs/revenueInvoiceLoaders.server";
import type { PaymentRecordRow } from "@/src/lib/payments/paymentRecordModel";
import { PatientOverviewTab } from "@/src/components/fi-admin/patients/PatientOverviewTab";
import { derivePatientJourneyStatus } from "@/src/lib/fiAdmin/patientJourneyStatus";
import { legacyJourneyLabelFromCanonical } from "@/src/lib/patientJourney/patientJourneyStateCore";
import type { PatientJourneySnapshot } from "@/src/lib/patientJourney/patientJourneyState.server";
import { PatientJourneyRibbon } from "@/src/components/fi-admin/patients/PatientJourneyRibbon";
import { StaffUatClarityFeedback } from "@/src/components/fi-admin/staff-uat/StaffUatClarityFeedback";
import { StaffUatScreenGuide } from "@/src/components/fi-admin/staff-uat/StaffUatScreenGuide";

export function PatientDetailPageView({
  tenantId,
  patientId,
  initialPayload,
  activeTab,
  previewPatientId,
  operationalTodayYmd,
  initialPaymentRecords = [],
  canMutatePaymentRecords = false,
  patientInvoiceSummary,
  /** Server-rendered async tab; passed from the route so this client module never imports prescribing loaders. */
  prescriptionsTab,
  canCapturePatientPhotos = false,
  patientJourney = null,
}: {
  tenantId: string;
  patientId: string;
  initialPayload: PatientDetailPayload;
  activeTab: PatientDetailTabId;
  previewPatientId?: string;
  operationalTodayYmd: string;
  initialPaymentRecords?: PaymentRecordRow[];
  canMutatePaymentRecords?: boolean;
  patientInvoiceSummary: PatientInvoiceSummary;
  prescriptionsTab?: ReactNode;
  canCapturePatientPhotos?: boolean;
  patientJourney?: PatientJourneySnapshot | null;
}) {
  const { profile } = initialPayload;

  const legacyJourney = derivePatientJourneyStatus({
    totalLeads: profile.summary.totalLeads,
    consultations: initialPayload.consultations,
    nextAppointment: initialPayload.nextAppointment,
    treatmentPlanSummary: initialPayload.treatmentPlanSummary,
    previousProcedures: initialPayload.previousProcedures,
    upcomingBookings: profile.summary.upcomingBookings,
    completedBookings: profile.summary.completedBookings,
  });

  const journeyStatus = patientJourney
    ? {
        label: legacyJourneyLabelFromCanonical(patientJourney.state),
        tone:
          patientJourney.presentation.tone === "critical"
            ? ("warning" as const)
            : patientJourney.presentation.tone === "success"
              ? ("success" as const)
              : patientJourney.presentation.tone === "warning"
                ? ("warning" as const)
                : patientJourney.presentation.tone === "info"
                  ? ("info" as const)
                  : ("neutral" as const),
        description: patientJourney.presentation.description,
      }
    : legacyJourney;

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6 pb-24 md:pb-6">
      <PatientDetailBreadcrumbs tenantId={tenantId} patientName={initialPayload.displayName} />

      <StaffUatScreenGuide screenKey="patient_profile" />

      {patientJourney ? (
        <>
          <PatientJourneyRibbon journey={patientJourney} />
          <StaffUatScreenGuide screenKey="patient_journey" />
        </>
      ) : null}

      <PatientCommandHero
        tenantId={tenantId}
        patientId={patientId}
        data={profile}
        nextAppointment={initialPayload.nextAppointment}
        treatmentPlanSummary={initialPayload.treatmentPlanSummary}
        journeyStatus={journeyStatus}
        canCapturePhotos={canCapturePatientPhotos}
        trialConsentGate={profile.trialConsentGate}
      />

      <PatientDetailsSummary data={profile} />

      <PatientCommandSummaryRow
        tenantId={tenantId}
        patientId={patientId}
        nextAppointment={initialPayload.nextAppointment}
        treatmentPlanSummary={initialPayload.treatmentPlanSummary}
        journeyStatus={journeyStatus}
      />

      <Suspense fallback={null}>
        <PatientDetailPreviewUrlSync
          currentPatientId={patientId}
          previewPatientId={previewPatientId}
        />
      </Suspense>

      <Suspense fallback={null}>
        <PatientPhotoAddedFeedback />
      </Suspense>

      <Suspense
        fallback={
          <div
            className="h-10 animate-pulse rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md"
            aria-hidden
          />
        }
      >
        <PatientDetailTabNav tenantId={tenantId} patientId={patientId} activeTab={activeTab} />
      </Suspense>

      {activeTab === "overview" ? (
        <PatientOverviewTab
          tenantId={tenantId}
          patientId={patientId}
          payload={initialPayload}
          profile={profile}
          journeyStatus={journeyStatus}
          operationalTodayYmd={operationalTodayYmd}
          initialPaymentRecords={initialPaymentRecords}
          canMutatePaymentRecords={canMutatePaymentRecords}
        />
      ) : null}

      {activeTab === "clinical" ? (
        <div className="space-y-4">
          <PatientVoiceClinicalNotesCard
            tenantId={tenantId}
            items={initialPayload.voiceClinicalNotes}
          />
          <PatientClinicalDetailsCard tenantId={tenantId} data={profile} />
          <PatientPreviousProceduresCard procedures={initialPayload.previousProcedures} />
          <PatientConsultationsCard
            tenantId={tenantId}
            consultations={initialPayload.consultations}
          />
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
          <PatientConsultationsCard
            tenantId={tenantId}
            consultations={initialPayload.consultations}
          />
          <PatientPreviousProceduresCard procedures={initialPayload.previousProcedures} />
          <PatientCasesCard tenantId={tenantId} data={profile} />
        </div>
      ) : null}

      {activeTab === "timeline" ? (
        <PatientTreatmentTimelineCard
          patientTimeline={profile.patientTimeline}
          patientImages={profile.patientImages}
        />
      ) : null}

      {activeTab === "prescriptions" ? prescriptionsTab : null}

      {activeTab === "payments" ? (
        <PatientRevenueInvoicesPanel
          tenantId={tenantId}
          patientId={patientId}
          summary={patientInvoiceSummary}
        />
      ) : null}

      {activeTab === "documents" ? (
        <PatientDocumentsTab tenantId={tenantId} data={profile} />
      ) : null}

      <StaffUatClarityFeedback screenKey="patient_profile" />

      <PatientPhotoCaptureActions
        tenantId={tenantId}
        patientId={patientId}
        canCapture={canCapturePatientPhotos}
        trialConsentGate={profile.trialConsentGate}
        source="patient_profile"
        variant="mobile-bar"
      />
    </div>
  );
}
