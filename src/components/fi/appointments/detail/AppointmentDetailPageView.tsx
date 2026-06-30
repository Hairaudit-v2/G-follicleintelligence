"use client";

import Link from "next/link";
import { Suspense } from "react";
import { BookingStatusBadge } from "@/src/components/fi/bookings/operator/BookingStatusBadge";
import { BookingTypeBadge } from "@/src/components/fi/bookings/operator/BookingTypeBadge";
import { buildAppointmentCreatePrefillFromLead } from "@/src/lib/bookings/bookingLeadPrefillShared";
import { appointmentTitleFromBooking } from "@/src/lib/bookings/appointmentDisplay";
import { isBookingCancelled } from "@/src/lib/bookings";
import type { AppointmentDetailTabId } from "@/src/lib/bookings/appointmentDetailTabs";
import type { AppointmentShellDetailPagePayload } from "@/src/lib/bookings/appointmentSlideOverLoader";
import {
  LeadActivityFeed,
  LeadNotesSection,
  LeadRemindersSection,
  LeadTasksSection,
} from "@/src/components/fi/crm/shared";
import {
  AppointmentActionsSection,
  AppointmentAnchorFlowsSection,
  AppointmentClinicalSection,
  AppointmentCompletionLeadWorkflow,
  AppointmentCoreDetailsSection,
  AppointmentGallerySection,
  AppointmentHeader,
  AppointmentLinkedLeadSection,
  AppointmentProcedureSection,
} from "../shared";
import { useAppointmentSlideOver } from "../AppointmentSlideOver";
import { AppointmentDetailBreadcrumbs } from "./AppointmentDetailBreadcrumbs";
import { AppointmentDetailPreviewBridge } from "./AppointmentDetailPreviewBridge";
import { AppointmentDetailTabNav } from "./AppointmentDetailTabNav";
import { AppointmentClinicalNotesPanel } from "./AppointmentClinicalNotesPanel";
import { AppointmentInvoicePreviewPanel } from "./AppointmentInvoicePreviewPanel";
import { AppointmentOverviewStats } from "./AppointmentOverviewStats";
import { ClinicalStaffingStatusCard } from "@/src/components/fi/workforce/ClinicalStaffingStatusCard";
import { AppointmentPostProcedurePlanPanel } from "./AppointmentPostProcedurePlanPanel";
import { AppointmentProcedurePhotosPanel } from "./AppointmentProcedurePhotosPanel";
import { useAppointmentDetailState } from "./useAppointmentDetailState";

export function AppointmentDetailPageView({
  tenantId,
  appointmentId,
  initialPayload,
  activeTab,
  previewAppointmentId,
}: {
  tenantId: string;
  appointmentId: string;
  initialPayload: AppointmentShellDetailPagePayload;
  activeTab: AppointmentDetailTabId;
  previewAppointmentId?: string;
}) {
  const state = useAppointmentDetailState(tenantId, appointmentId, initialPayload);
  const slide = useAppointmentSlideOver();
  const { payload, booking } = state;
  const title = appointmentTitleFromBooking(booking);
  const lead = payload.leadAnchor?.lead ?? null;
  const cancelled = isBookingCancelled(booking);
  const leadHref = lead ? `/fi-admin/${tenantId}/crm/leads/${lead.id}` : null;
  const patientHref = booking.patient_id ? `/fi-admin/${tenantId}/patients/${booking.patient_id}` : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <AppointmentDetailBreadcrumbs
        tenantId={tenantId}
        appointmentTitle={title}
        leadHref={leadHref}
        patientHref={patientHref}
      />

      <header className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
            <p className="text-sm text-slate-400">
              Appointment · <span className="font-mono text-xs">{booking.id}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <BookingTypeBadge type={booking.booking_type} />
            <BookingStatusBadge status={booking.booking_status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {leadHref ? (
            <Link href={leadHref} className="text-blue-300 hover:underline">
              CRM lead →
            </Link>
          ) : null}
          {patientHref ? (
            <Link href={patientHref} className="text-blue-300 hover:underline">
              Patient record →
            </Link>
          ) : null}
          {booking.case_id ? (
            <Link href={`/fi-admin/${tenantId}/cases/${booking.case_id}`} className="text-blue-300 hover:underline">
              Case →
            </Link>
          ) : null}
          <Link href={`/fi-admin/${tenantId}/appointments`} className="text-blue-300 hover:underline">
            All appointments
          </Link>
          {booking.booking_type.trim().toLowerCase() === "surgery" ? (
            <Link href={`/fi-admin/${tenantId}/surgery-readiness`} className="text-blue-300 hover:underline">
              Surgery readiness board
            </Link>
          ) : null}
        </div>
      </header>

      <Suspense fallback={<div className="h-16 animate-pulse rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md" aria-hidden />}>
        <AppointmentDetailPreviewBridge
          tenantId={tenantId}
          currentAppointmentId={booking.id}
          previewAppointmentId={previewAppointmentId}
          relatedAppointments={payload.relatedAppointments}
        />
      </Suspense>

      <Suspense fallback={<div className="h-10 animate-pulse rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md" aria-hidden />}>
        <AppointmentDetailTabNav tenantId={tenantId} appointmentId={appointmentId} activeTab={activeTab} />
      </Suspense>

      {activeTab === "overview" ? (
        <div className="space-y-4">
          {lead ? (
            <div className="flex justify-end">
              <button
                type="button"
                className="rounded border border-slate-700 px-3 py-1.5 text-sm hover:bg-white/[0.03]"
                onClick={() =>
                  slide.openCreateAppointment(
                    buildAppointmentCreatePrefillFromLead({ lead, bookings: [booking] })
                  )
                }
              >
                Book another appointment
              </button>
            </div>
          ) : null}
          <AppointmentOverviewStats
            pendingReminderCount={state.pendingReminderCount}
            openTaskCount={state.openTaskCount}
            procedureLabel={state.procedureLabel}
            nextScheduledLabel={state.nextScheduledLabel}
          />
          <AppointmentHeader
            tenantId={tenantId}
            booking={booking}
            lead={lead}
            personName={payload.leadAnchor?.personName ?? null}
            clinicalScalesSummary={payload.clinicalScalesSummary}
          />
          {payload.leadAnchor ? (
            <AppointmentLinkedLeadSection
              tenantId={tenantId}
              leadAnchor={payload.leadAnchor}
              pipelineStages={payload.pipelineStages}
              bookingType={booking.booking_type}
            />
          ) : null}
          <AppointmentCoreDetailsSection
            booking={booking}
            assignees={payload.assignees}
            clinics={payload.clinics}
            statusHistory={payload.statusHistory}
            canMutate={state.canMutate}
            rescheduleOpen={state.rescheduleOpen}
            onToggleReschedule={() => state.setRescheduleOpen((v) => !v)}
            startLocal={state.startLocal}
            endLocal={state.endLocal}
            bookingStatus={state.bookingStatus}
            onStartLocalChange={state.setStartLocal}
            onEndLocalChange={state.setEndLocal}
            onBookingStatusChange={state.setBookingStatus}
            onRescheduleSubmit={state.onRescheduleSubmit}
            rescheduleBusy={state.rescheduleBusy}
            rescheduleErr={state.rescheduleErr}
          />
          <ClinicalStaffingStatusCard
            tenantId={tenantId}
            summary={payload.clinicalStaffing}
            rosterLink={{
              eventSource: "booking",
              eventId: booking.id,
              date: booking.start_at,
            }}
          />
          <AppointmentAnchorFlowsSection
            booking={booking}
            lead={lead}
            instructionsSent={payload.instructionsSent}
            canMutate={state.canMutate}
            linkBusy={state.linkBusy}
            linkErr={state.linkErr}
            convBusy={state.convBusy}
            convErr={state.convErr}
            seedCase={state.seedCase}
            onSeedCaseChange={state.setSeedCase}
            onLinkPatient={() => void state.onLinkPatient()}
            onConvert={state.onConvert}
          />
          {lead && state.completionLeadOpts && payload.pipelineStages.length > 0 && !cancelled && booking.booking_status !== "completed" ? (
            <AppointmentCompletionLeadWorkflow
              lead={lead}
              pipelineStages={payload.pipelineStages}
              bookingType={booking.booking_type}
              value={state.completionLeadOpts}
              onChange={state.setCompletionLeadOpts}
              disabled={state.actionBusy}
            />
          ) : null}
          <AppointmentActionsSection
            booking={booking}
            instructionsSent={payload.instructionsSent}
            canMutate={state.canMutate}
            actionBusy={state.actionBusy}
            actionErr={state.actionErr ?? state.crmCompleteErr}
            instructionsBusy={state.instructionsBusy}
            instructionsErr={state.instructionsErr}
            onRescheduleToggle={() => state.setRescheduleOpen(true)}
            onComplete={() => void state.onComplete()}
            onCancel={() => void state.onCancel()}
            onSendPreOp={() => void state.onSendInstructions("pre_op")}
            onSendPostOp={() => void state.onSendInstructions("post_op")}
          />
        </div>
      ) : null}

      {activeTab === "clinical" ? (
        <AppointmentClinicalNotesPanel
          tenantId={tenantId}
          patientId={booking.patient_id}
          clinicalDetails={payload.clinicalDetails}
          clinicalScalesSummary={payload.clinicalScalesSummary}
          description={state.description}
          canMutate={state.canMutate}
          busy={state.descBusy}
          error={state.descErr}
          onDescriptionChange={state.setDescription}
          onSaveDescription={state.onSaveDescription}
        />
      ) : null}

      {activeTab === "procedure" ? (
        <div className="space-y-4">
          <AppointmentClinicalSection
            clinicalScalesSummary={payload.clinicalScalesSummary}
            clinicalLine={payload.clinicalLine}
            surgeryPlan={payload.surgeryPlan}
          />
          <AppointmentProcedureSection
            tenantId={tenantId}
            assignees={payload.assignees}
            graftCountEstimate={state.graftCountEstimate}
            donorArea={state.donorArea}
            technique={state.technique}
            specialInstructions={state.specialInstructions}
            surgeonUserId={state.surgeonUserId}
            consultantUserId={state.consultantUserId}
            techUserId={state.techUserId}
            canMutate={state.canMutate}
            busy={state.procedureBusy}
            error={state.procedureErr}
            onGraftCountEstimateChange={state.setGraftCountEstimate}
            onDonorAreaChange={state.setDonorArea}
            onTechniqueChange={state.setTechnique}
            onSpecialInstructionsChange={state.setSpecialInstructions}
            onSurgeonUserIdChange={state.setSurgeonUserId}
            onConsultantUserIdChange={state.setConsultantUserId}
            onTechUserIdChange={state.setTechUserId}
            onSubmit={state.onSaveProcedure}
          />
        </div>
      ) : null}

      {activeTab === "timeline" ? (
        <div className="space-y-4">
          {state.leadId ? (
            <>
              <LeadActivityFeed events={payload.timeline.events} limit={20} />
              <LeadTasksSection
                tasks={payload.timeline.tasks}
                canMutate={state.canMutate}
                taskTitle={state.taskTitle}
                taskBusy={state.taskBusy}
                taskErr={state.taskErr}
                onTaskTitleChange={state.setTaskTitle}
                onAddTask={state.onAddTask}
                onCompleteTask={state.onCompleteTask}
              />
              <LeadNotesSection
                notes={payload.timeline.notes}
                leadNotes={payload.timeline.leadNotes}
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
              <LeadRemindersSection reminderJobs={payload.reminderJobs} limit={20} />
            </>
          ) : (
            <LeadActivityFeed
              events={[]}
              emptyMessage="Link a lead to this appointment to see CRM activity, tasks, and notes."
            />
          )}
        </div>
      ) : null}

      {activeTab === "photos" ? (
        <AppointmentProcedurePhotosPanel
          tenantId={tenantId}
          patientId={booking.patient_id}
          bookingId={booking.id}
          leadId={booking.lead_id}
          caseId={booking.case_id}
          bundle={payload.patientImages}
        />
      ) : null}

      {activeTab === "billing" ? (
        <AppointmentInvoicePreviewPanel
          tenantId={tenantId}
          patientId={booking.patient_id}
          invoice={payload.invoicePreview}
        />
      ) : null}

      {activeTab === "post_op" ? (
        <AppointmentPostProcedurePlanPanel
          tenantId={tenantId}
          caseId={booking.case_id}
          surgeryPlan={payload.surgeryPlan}
          postOpTracking={payload.postOpTracking}
          instructionsSent={payload.instructionsSent}
          specialInstructions={state.specialInstructions}
        />
      ) : null}

      {activeTab === "overview" ? (
        <AppointmentGallerySection
          tenantId={tenantId}
          patientId={booking.patient_id}
          bundle={payload.patientImages}
        />
      ) : null}
    </div>
  );
}
