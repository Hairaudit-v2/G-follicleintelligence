"use client";

import { Suspense } from "react";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import type { CrmLeadDetailTabId } from "@/src/lib/crm/crmLeadDetailTabs";
import type { CrmLeadShellDetailPagePayload } from "@/src/lib/crm/crmShellLoaders";
import { CrmActivityPanel, CrmMessagesPanel, CrmNotesPanel, CrmPipelinePanel } from "../CrmDataPanels";
import { CrmLeadDetailPreviewBridge } from "../CrmLeadDetailPreviewBridge";
import { CrmLeadConversionPanel } from "../CrmLeadConversionPanel";
import { CrmLeadCommunicationsWorkflow } from "../CrmLeadCommunicationsWorkflow";
import { CrmLeadEditPanel } from "../CrmLeadEditPanel";
import { CrmLeadNotesWorkflow } from "../CrmLeadNotesWorkflow";
import { CrmLeadTasksWorkflow } from "../CrmLeadTasksWorkflow";
import { LeadBookingPanel } from "@/src/components/fi/bookings/LeadBookingPanel";
import {
  LeadNotesSection,
  LeadPersonHeader,
  LeadQuickEditPanel,
  LeadRemindersSection,
  LeadStageSection,
  LeadTasksSection,
} from "../shared";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import { CrmLeadDetailTabNav } from "./CrmLeadDetailTabNav";
import { CrmLeadDetailBreadcrumbs } from "./CrmLeadDetailBreadcrumbs";
import { LeadClinicalDetailsPanel } from "./LeadClinicalDetailsPanel";
import { LeadOpportunityPanel } from "./LeadOpportunityPanel";
import { LeadBookNextAppointmentCard } from "./LeadBookNextAppointmentCard";
import { LeadOverviewStats } from "./LeadOverviewStats";
import { LeadPhotoGalleryPanel } from "./LeadPhotoGalleryPanel";
import { useCrmLeadDetailState } from "./useCrmLeadDetailState";
import { PatientTwinNavLink } from "@/src/components/fi-admin/patientTwin/PatientTwinNavLink";

export function CrmLeadDetailPageView({
  tenantId,
  leadId,
  initialPayload,
  activeTab,
  previewLeadId,
  groupingNowIso,
  services = [],
}: {
  tenantId: string;
  leadId: string;
  initialPayload: CrmLeadShellDetailPagePayload;
  activeTab: CrmLeadDetailTabId;
  previewLeadId?: string;
  groupingNowIso: string;
  services?: FiServiceRow[];
}) {
  const state = useCrmLeadDetailState(tenantId, leadId, initialPayload);
  const { payload, lead, personName } = state;
  const leadTitle = leadTitleFromRow(lead.summary, lead.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <CrmLeadDetailBreadcrumbs tenantId={tenantId} leadTitle={leadTitle} />

      <header className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{leadTitle}</h1>
          {lead.patient_id ? <PatientTwinNavLink tenantId={tenantId} patientId={lead.patient_id} /> : null}
        </div>
        <p className="text-sm text-gray-600">
          CRM lead · <span className="font-mono text-xs">{lead.id}</span>
          {lead.patient_id ? (
            <>
              {" "}
              · Patient <span className="font-mono text-xs">{lead.patient_id}</span>
            </>
          ) : null}
        </p>
      </header>

      <Suspense fallback={<div className="h-16 animate-pulse rounded border border-gray-200 bg-white" aria-hidden />}>
        <CrmLeadDetailPreviewBridge
          tenantId={tenantId}
          currentLeadId={lead.id}
          previewLeadId={previewLeadId}
          relatedLeads={payload.relatedLeads}
        />
      </Suspense>

      <Suspense fallback={<div className="h-10 animate-pulse rounded border border-gray-200 bg-white" aria-hidden />}>
        <CrmLeadDetailTabNav tenantId={tenantId} leadId={leadId} activeTab={activeTab} />
      </Suspense>

      {activeTab === "overview" ? (
        <div className="space-y-4">
          <LeadBookNextAppointmentCard
            tenantId={tenantId}
            lead={lead}
            bookings={payload.detail.leadBookings}
            groupingNowIso={groupingNowIso}
          />
          <LeadOverviewStats
            opportunity={state.opportunity}
            nextAction={state.nextAction}
            openTaskCount={state.openTaskCount}
            pendingReminderCount={state.pendingReminderCount}
          />
          <LeadPersonHeader
            tenantId={tenantId}
            patientId={lead.patient_id}
            personName={personName}
            leadId={lead.id}
            leadSummary={lead.summary}
            clinicalScalesSummary={payload.clinicalScalesSummary}
          />
          <LeadQuickEditPanel
            lead={lead}
            owners={payload.detail.owners}
            summary={state.summary}
            status={state.status}
            priority={state.priority}
            ownerId={state.ownerId}
            canMutate={state.canMutate}
            busy={state.detailBusy}
            error={state.detailErr}
            onSummaryChange={state.setSummary}
            onStatusChange={state.setStatus}
            onPriorityChange={state.setPriority}
            onOwnerIdChange={state.setOwnerId}
            onSubmit={state.onSaveBasics}
          />
          <LeadBookingPanel
            tenantId={tenantId}
            lead={lead}
            bookings={payload.detail.leadBookings}
            assigneeOptions={payload.detail.owners}
            clinicOptions={payload.detail.clinics}
            groupingNowIso={groupingNowIso}
            calendarTimezone={payload.calendarTimezone}
            services={services}
          />
        </div>
      ) : null}

      {activeTab === "clinical" ? (
        <div className="space-y-4">
          <LeadClinicalDetailsPanel
            tenantId={tenantId}
            patientId={lead.patient_id}
            clinicalDetails={payload.clinicalDetails}
            clinicalScalesSummary={payload.clinicalScalesSummary}
          />
          <LeadPhotoGalleryPanel tenantId={tenantId} patientId={lead.patient_id} bundle={payload.patientImages} />
        </div>
      ) : null}

      {activeTab === "pipeline" ? (
        <div className="space-y-4">
          <LeadOpportunityPanel lead={lead} opportunity={state.opportunity} />
          <LeadStageSection
            lead={lead}
            stages={payload.stages}
            stageHistory={payload.stageHistory}
            canMutate={state.canMutate}
            stageBusy={state.stageBusy}
            stageErr={state.stageErr}
            historyLimit={50}
            onStageChange={state.onStageChange}
          />
          <CrmPipelinePanel stages={payload.stages} />
        </div>
      ) : null}

      {activeTab === "timeline" ? (
        <div className="space-y-4">
          <CrmActivityPanel events={payload.detail.events} />
          <LeadTasksSection
            tasks={payload.detail.tasks}
            canMutate={state.canMutate}
            taskTitle={state.taskTitle}
            taskBusy={state.taskBusy}
            taskErr={state.taskErr}
            onTaskTitleChange={state.setTaskTitle}
            onAddTask={state.onAddTask}
            onCompleteTask={state.onCompleteTask}
          />
          <CrmLeadTasksWorkflow
            tenantId={tenantId}
            leadId={lead.id}
            tasks={payload.detail.tasks}
            assigneeOptions={payload.detail.owners}
            groupingNowIso={groupingNowIso}
          />
          <LeadRemindersSection reminderJobs={payload.reminderJobs} limit={20} />
        </div>
      ) : null}

      {activeTab === "documents" ? (
        <div className="space-y-4">
          <LeadNotesSection
            notes={payload.detail.notes}
            leadNotes={payload.detail.leadNotes}
            previewLimit={12}
            canMutate={state.canMutate}
            noteBody={state.noteBody}
            leadNoteBody={state.leadNoteBody}
            noteBusy={state.noteBusy}
            leadNoteBusy={state.leadNoteBusy}
            noteErr={state.noteErr}
            leadNoteErr={state.leadNoteErr}
            onNoteBodyChange={state.setNoteBody}
            onLeadNoteBodyChange={state.setLeadNoteBody}
            onAddGeneralNote={state.onAddGeneralNote}
            onAddLeadNote={state.onAddLeadNote}
          />
          <CrmLeadNotesWorkflow tenantId={tenantId} leadId={lead.id} leadNotes={payload.detail.leadNotes} />
          <CrmLeadCommunicationsWorkflow
            tenantId={tenantId}
            leadId={lead.id}
            leadCommunications={payload.detail.leadCommunications}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <CrmNotesPanel notes={payload.detail.notes} />
            <CrmMessagesPanel messages={payload.detail.messages} />
          </div>
        </div>
      ) : null}

      {activeTab === "convert" ? (
        <div className="space-y-4">
          <CrmLeadConversionPanel
            tenantId={tenantId}
            leadId={lead.id}
            conversionState={payload.detail.conversionState}
          />
          <CrmLeadEditPanel
            tenantId={tenantId}
            lead={lead}
            owners={payload.detail.owners}
            organisations={payload.detail.organisations}
            clinics={payload.detail.clinics}
          />
        </div>
      ) : null}
    </div>
  );
}
