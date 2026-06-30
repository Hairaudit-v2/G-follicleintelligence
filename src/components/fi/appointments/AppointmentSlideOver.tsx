"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  cancelBookingAction,
  completeBookingAction,
  linkAppointmentPatientFromLeadAction,
  loadAppointmentSlideOverBundleAction,
  sendAppointmentInstructionsAction,
  updateAppointmentProcedureAction,
  updateBookingAction,
} from "@/lib/actions/fi-booking-actions";
import {
  completeCrmTaskAction,
  convertCrmLeadAction,
  crmCreateNoteAction,
  crmCreateTaskAction,
  createCrmLeadNoteAction,
} from "@/lib/actions/fi-crm-actions";
import { defaultRangeIso, fromDatetimeLocalValue, toDatetimeLocalValue } from "@/src/components/fi/bookings/bookingFormUtils";
import { DEFAULT_CALENDAR_TIMEZONE } from "@/src/lib/calendar/calendarTimezone";
import {
  LeadActivityFeed,
  LeadNotesSection,
  LeadRemindersSection,
  LeadTasksSection,
} from "@/src/components/fi/crm/shared";
import {
  appendAppointmentStatusHistory,
  buildAppointmentStatusHistory,
  mergeAppointmentProcedureMetadata,
} from "@/src/lib/bookings/appointmentMetadata";
import { isBookingCancelled } from "@/src/lib/bookings";
import type { AppointmentCreatePrefill } from "@/src/lib/bookings/appointmentCreateTypes";
import type { AppointmentSlideOverPayload } from "@/src/lib/bookings/appointmentSlideOverLoader";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CrmShellClinicOption } from "@/src/lib/crm/types";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";
import { canMutateClinicFromOperatorContext } from "@/src/lib/crm/crmGatePolicy";
import { AppointmentCreateSlideOver } from "./AppointmentCreateSlideOver";
import {
  applyLeadUpdatesAfterAppointmentComplete,
  type AppointmentCompletionLeadOpts,
} from "@/src/lib/crm/appointmentCompletionLeadClient";
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
  defaultAppointmentCompletionLeadOpts,
} from "./shared";

export type AppointmentShellOperatorContext = {
  tenantId: string;
  operatorFiUserId: string;
  userRole: string;
  canUseClinicFeatures?: boolean;
};

type SlideOverCtx = AppointmentShellOperatorContext & {
  activeAppointmentId: string | null;
  createPrefill: AppointmentCreatePrefill | null;
  openAppointment: (appointmentId: string) => void;
  openCreateAppointment: (prefill?: Partial<AppointmentCreatePrefill>) => void;
  close: () => void;
};

const AppointmentSlideOverContext = createContext<SlideOverCtx | null>(null);

export function useAppointmentSlideOver(): SlideOverCtx {
  const v = useContext(AppointmentSlideOverContext);
  if (!v) throw new Error("useAppointmentSlideOver must be used within AppointmentSlideOverProvider");
  return v;
}

export function useAppointmentSlideOverOptional(): SlideOverCtx | null {
  return useContext(AppointmentSlideOverContext);
}

const defaultCreatePrefillBase = (calendarTimezone: string): AppointmentCreatePrefill => {
  const r = defaultRangeIso(calendarTimezone);
  return {
    leadId: null,
    personId: null,
    patientId: null,
    caseId: null,
    bookingType: "consultation",
    title: null,
    startIso: r.start,
    endIso: r.end,
    assignedUserId: null,
    assignedStaffId: null,
    clinicId: null,
    description: null,
    consultationId: null,
    initialMetadata: null,
  };
};

export function AppointmentSlideOverProvider({
  tenantId,
  operatorFiUserId,
  userRole,
  canUseClinicFeatures,
  children,
  assignees = [],
  clinics = [],
  existingBookings = [],
  calendarTimezone = DEFAULT_CALENDAR_TIMEZONE,
  services = [],
}: {
  tenantId: string;
  operatorFiUserId: string;
  userRole: string;
  canUseClinicFeatures?: boolean;
  children: ReactNode;
  assignees?: ClinicalStaffPickerOption[];
  clinics?: CrmShellClinicOption[];
  /** Bookings in the visible range — used for availability + drag checks in calendar. */
  existingBookings?: FiBookingRow[];
  /** Tenant clinic IANA zone for datetime-local fields in create / slide-over. */
  calendarTimezone?: string;
  /** Procedure catalog for create flow (durations, prices). */
  services?: FiServiceRow[];
}) {
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [createPrefill, setCreatePrefill] = useState<AppointmentCreatePrefill | null>(null);

  const openAppointment = useCallback((id: string) => {
    setCreatePrefill(null);
    setAppointmentId(id.trim());
  }, []);

  const openCreateAppointment = useCallback(
    (prefill?: Partial<AppointmentCreatePrefill>) => {
      setAppointmentId(null);
      const base = defaultCreatePrefillBase(calendarTimezone);
      setCreatePrefill({
        ...base,
        ...prefill,
        leadId: prefill?.leadId !== undefined ? prefill.leadId : base.leadId,
        personId: prefill?.personId !== undefined ? prefill.personId : base.personId,
        patientId: prefill?.patientId !== undefined ? prefill.patientId : base.patientId,
        caseId: prefill?.caseId !== undefined ? prefill.caseId : base.caseId,
        description: prefill?.description !== undefined ? prefill.description : base.description,
        consultationId: prefill?.consultationId !== undefined ? prefill.consultationId : base.consultationId,
        initialMetadata: prefill?.initialMetadata !== undefined ? prefill.initialMetadata : base.initialMetadata,
      });
    },
    [calendarTimezone]
  );

  const close = useCallback(() => {
    setAppointmentId(null);
    setCreatePrefill(null);
  }, []);

  const value = useMemo(
    () => ({
      tenantId,
      operatorFiUserId,
      userRole,
      canUseClinicFeatures,
      activeAppointmentId: appointmentId,
      createPrefill,
      openAppointment,
      openCreateAppointment,
      close,
    }),
    [tenantId, operatorFiUserId, userRole, canUseClinicFeatures, appointmentId, createPrefill, openAppointment, openCreateAppointment, close]
  );

  const shellOpen = appointmentId != null || createPrefill != null;

  return (
    <AppointmentSlideOverContext.Provider value={value}>
      {children}
      <AppointmentSlideOverShell
        tenantId={tenantId}
        appointmentId={appointmentId}
        createPrefill={createPrefill}
        open={shellOpen}
        onClose={close}
        operatorFiUserId={operatorFiUserId}
        userRole={userRole}
        canUseClinicFeatures={canUseClinicFeatures}
        assignees={assignees}
        clinics={clinics}
        existingBookings={existingBookings}
        calendarTimezone={calendarTimezone}
        services={services}
        onCreated={(id) => {
          setCreatePrefill(null);
          setAppointmentId(id);
        }}
      />
    </AppointmentSlideOverContext.Provider>
  );
}

function AppointmentSlideOverShell({
  tenantId,
  appointmentId,
  createPrefill,
  open,
  onClose,
  operatorFiUserId,
  userRole,
  canUseClinicFeatures,
  assignees,
  clinics,
  existingBookings,
  calendarTimezone,
  services,
  onCreated,
}: {
  tenantId: string;
  appointmentId: string | null;
  createPrefill: AppointmentCreatePrefill | null;
  open: boolean;
  onClose: () => void;
  operatorFiUserId: string;
  userRole: string;
  canUseClinicFeatures?: boolean;
  assignees: ClinicalStaffPickerOption[];
  clinics: CrmShellClinicOption[];
  existingBookings: FiBookingRow[];
  calendarTimezone: string;
  services: FiServiceRow[];
  onCreated: (bookingId: string) => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/30 sm:items-stretch"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="flex h-full max-h-[100dvh] w-full flex-col overflow-hidden border-l border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-xl sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-label={createPrefill ? "New appointment" : "Appointment preview"}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
          <h2 className="truncate text-sm font-semibold text-slate-100">
            {createPrefill ? "New appointment" : "Appointment preview"}
          </h2>
          <button type="button" className="shrink-0 text-sm text-slate-400 hover:text-slate-100" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
          {createPrefill ? (
            <AppointmentCreateSlideOver
              tenantId={tenantId}
              prefill={createPrefill}
              assignees={assignees}
              clinics={clinics}
              existingBookings={existingBookings}
              tenantCalendarTimezone={calendarTimezone}
              services={services}
              onClose={onClose}
              onCreated={onCreated}
            />
          ) : (
            <AppointmentSlideOverPanel
              tenantId={tenantId}
              appointmentId={appointmentId}
              open
              onClose={onClose}
              operatorFiUserId={operatorFiUserId}
              userRole={userRole}
              canUseClinicFeatures={canUseClinicFeatures}
              embedded
            />
          )}
        </div>
      </aside>
    </div>
  );
}

function syncProcedureForm(payload: AppointmentSlideOverPayload) {
  const p = payload.procedure;
  return {
    graftCountEstimate: p.graft_count_estimate ?? "",
    donorArea: p.donor_area ?? "",
    technique: p.technique ?? "",
    specialInstructions: p.special_instructions ?? "",
    surgeonUserId: p.surgeon_user_id ?? "",
    consultantUserId: p.consultant_user_id ?? "",
    techUserId: p.tech_user_id ?? "",
  };
}

function syncScheduleForm(booking: AppointmentSlideOverPayload["booking"], calendarTimezone: string) {
  return {
    startLocal: toDatetimeLocalValue(booking.start_at, calendarTimezone),
    endLocal: toDatetimeLocalValue(booking.end_at, calendarTimezone),
    bookingStatus: booking.booking_status,
  };
}

/** Right-hand slide-over panel (use {@link AppointmentSlideOverProvider} + {@link useAppointmentSlideOver} or render directly). */
export function AppointmentSlideOverPanel({
  tenantId,
  appointmentId,
  open,
  onClose,
  operatorFiUserId,
  userRole,
  canUseClinicFeatures,
  embedded = false,
}: {
  tenantId: string;
  appointmentId: string | null;
  open: boolean;
  onClose: () => void;
  operatorFiUserId: string;
  userRole: string;
  canUseClinicFeatures?: boolean;
  /** When true, only render inner content (shell provided by provider). */
  embedded?: boolean;
}) {
  const router = useRouter();
  const canMutate = canMutateClinicFromOperatorContext({ userRole, canUseClinicFeatures });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payload, setPayload] = useState<AppointmentSlideOverPayload | null>(null);

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [bookingStatus, setBookingStatus] = useState("scheduled");
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [rescheduleErr, setRescheduleErr] = useState<string | null>(null);

  const [graftCountEstimate, setGraftCountEstimate] = useState("");
  const [donorArea, setDonorArea] = useState("");
  const [technique, setTechnique] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [surgeonUserId, setSurgeonUserId] = useState("");
  const [consultantUserId, setConsultantUserId] = useState("");
  const [techUserId, setTechUserId] = useState("");
  const [procedureBusy, setProcedureBusy] = useState(false);
  const [procedureErr, setProcedureErr] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [instructionsBusy, setInstructionsBusy] = useState(false);
  const [instructionsErr, setInstructionsErr] = useState<string | null>(null);

  const [linkBusy, setLinkBusy] = useState(false);
  const [linkErr, setLinkErr] = useState<string | null>(null);
  const [convBusy, setConvBusy] = useState(false);
  const [convErr, setConvErr] = useState<string | null>(null);
  const [seedCase, setSeedCase] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskErr, setTaskErr] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [leadNoteBody, setLeadNoteBody] = useState("");
  const [leadNoteBusy, setLeadNoteBusy] = useState(false);
  const [leadNoteErr, setLeadNoteErr] = useState<string | null>(null);
  const [completionLeadOpts, setCompletionLeadOpts] = useState<AppointmentCompletionLeadOpts | null>(null);
  const [crmCompleteErr, setCrmCompleteErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !appointmentId) {
      setPayload(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      const r = await loadAppointmentSlideOverBundleAction(tenantId, appointmentId);
      if (cancelled) return;
      setLoading(false);
      if (!r.ok) {
        setLoadError(r.error);
        setPayload(null);
        return;
      }
      setPayload(r.data);
      const proc = syncProcedureForm(r.data);
      setGraftCountEstimate(proc.graftCountEstimate);
      setDonorArea(proc.donorArea);
      setTechnique(proc.technique);
      setSpecialInstructions(proc.specialInstructions);
      setSurgeonUserId(proc.surgeonUserId);
      setConsultantUserId(proc.consultantUserId);
      setTechUserId(proc.techUserId);
      const sched = syncScheduleForm(r.data.booking, r.data.calendarTimezone);
      setStartLocal(sched.startLocal);
      setEndLocal(sched.endLocal);
      setBookingStatus(sched.bookingStatus);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, appointmentId, tenantId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const booking = payload?.booking ?? null;
  const lead = payload?.leadAnchor?.lead ?? null;
  const leadId = lead?.id ?? null;
  const href = booking ? `/fi-admin/${tenantId}/appointments/${booking.id}` : "#";

  useEffect(() => {
    const stages = payload?.pipelineStages ?? [];
    const bType = booking?.booking_type;
    if (lead && stages.length && bType) {
      setCompletionLeadOpts(defaultAppointmentCompletionLeadOpts(lead, stages, bType));
    } else {
      setCompletionLeadOpts(null);
    }
  }, [lead, payload?.pipelineStages, booking?.booking_type]);

  async function refreshPayload() {
    if (!appointmentId) return;
    const r = await loadAppointmentSlideOverBundleAction(tenantId, appointmentId);
    if (r.ok) {
      setPayload(r.data);
      const proc = syncProcedureForm(r.data);
      setGraftCountEstimate(proc.graftCountEstimate);
      setDonorArea(proc.donorArea);
      setTechnique(proc.technique);
      setSpecialInstructions(proc.specialInstructions);
      setSurgeonUserId(proc.surgeonUserId);
      setConsultantUserId(proc.consultantUserId);
      setTechUserId(proc.techUserId);
      const sched = syncScheduleForm(r.data.booking, r.data.calendarTimezone);
      setStartLocal(sched.startLocal);
      setEndLocal(sched.endLocal);
      setBookingStatus(sched.bookingStatus);
    }
  }

  function patchBookingOptimistic(next: AppointmentSlideOverPayload["booking"]) {
    setPayload((p) => (p ? { ...p, booking: next } : p));
  }

  async function onRescheduleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!booking || !payload || !canMutate || isBookingCancelled(booking) || booking.booking_status === "completed")
      return;
    const tz = payload.calendarTimezone;
    const startIso = fromDatetimeLocalValue(startLocal, tz);
    const endIso = fromDatetimeLocalValue(endLocal, tz);
    if (!startIso || !endIso) {
      setRescheduleErr("Start and end times are required.");
      return;
    }
    setRescheduleErr(null);
    const snap = booking;
    const statusTrim = bookingStatus.trim();
    let metadata = booking.metadata ?? {};
    if (statusTrim !== snap.booking_status) {
      metadata = appendAppointmentStatusHistory(metadata, {
        at: new Date().toISOString(),
        status: statusTrim,
        source: "fi_admin_appointment_slideover",
        note: `From ${snap.booking_status} · ${operatorFiUserId.slice(0, 8)}`,
      });
    }
    const optimistic = {
      ...booking,
      start_at: startIso,
      end_at: endIso,
      booking_status: statusTrim,
      metadata,
      updated_at: new Date().toISOString(),
    };
    patchBookingOptimistic(optimistic);
    setRescheduleBusy(true);
    try {
      const r = await updateBookingAction(tenantId, booking.id, {
        leadId: booking.lead_id,
        personId: booking.person_id,
        patientId: booking.patient_id,
        caseId: booking.case_id,
        clinicId: booking.clinic_id,
        assignedUserId: booking.assigned_user_id,
        bookingStatus: statusTrim,
        startAt: startIso,
        endAt: endIso,
        timezone: booking.timezone,
        location: booking.location,
        metadata,
      });
      if (!r.ok) {
        patchBookingOptimistic(snap);
        setRescheduleErr(r.error);
        return;
      }
      setPayload((p) =>
        p ? { ...p, booking: r.booking, statusHistory: buildAppointmentStatusHistory(r.booking) } : p
      );
      await refreshPayload();
      router.refresh();
    } finally {
      setRescheduleBusy(false);
    }
  }

  async function onSaveProcedure(e: FormEvent) {
    e.preventDefault();
    if (!booking || !canMutate) return;
    setProcedureErr(null);
    const snapMeta = booking.metadata ?? {};
    const optimisticMeta = mergeAppointmentProcedureMetadata(snapMeta, {
      graft_count_estimate: graftCountEstimate.trim() || null,
      donor_area: donorArea.trim() || null,
      technique: technique.trim() || null,
      special_instructions: specialInstructions.trim() || null,
      surgeon_user_id: surgeonUserId.trim() || null,
      consultant_user_id: consultantUserId.trim() || null,
      tech_user_id: techUserId.trim() || null,
    });
    patchBookingOptimistic({ ...booking, metadata: optimisticMeta });
    setProcedureBusy(true);
    try {
      const r = await updateAppointmentProcedureAction(tenantId, booking.id, {
        graftCountEstimate: graftCountEstimate.trim() || null,
        donorArea: donorArea.trim() || null,
        technique: technique.trim() || null,
        specialInstructions: specialInstructions.trim() || null,
        surgeonUserId: surgeonUserId.trim() || null,
        consultantUserId: consultantUserId.trim() || null,
        techUserId: techUserId.trim() || null,
      });
      if (!r.ok) {
        patchBookingOptimistic({ ...booking, metadata: snapMeta });
        setProcedureErr(r.error);
        return;
      }
      setPayload((p) =>
        p
          ? {
              ...p,
              booking: r.booking,
              procedure: {
                graft_count_estimate: graftCountEstimate.trim() || null,
                donor_area: donorArea.trim() || null,
                technique: technique.trim() || null,
                special_instructions: specialInstructions.trim() || null,
                surgeon_user_id: surgeonUserId.trim() || null,
                consultant_user_id: consultantUserId.trim() || null,
                tech_user_id: techUserId.trim() || null,
              },
            }
          : p
      );
      router.refresh();
    } finally {
      setProcedureBusy(false);
    }
  }

  async function onComplete() {
    if (!booking || !canMutate) return;
    setActionErr(null);
    setCrmCompleteErr(null);
    const snap = booking;
    patchBookingOptimistic({ ...booking, booking_status: "completed", updated_at: new Date().toISOString() });
    setActionBusy(true);
    try {
      const r = await completeBookingAction(tenantId, booking.id, {});
      if (!r.ok) {
        patchBookingOptimistic(snap);
        setActionErr(r.error);
        return;
      }
      const linkedLead = payload?.leadAnchor?.lead;
      if (linkedLead && completionLeadOpts) {
        const crm = await applyLeadUpdatesAfterAppointmentComplete(
          tenantId,
          linkedLead,
          completionLeadOpts,
          operatorFiUserId
        );
        const parts = [crm.stageError, crm.metadataError].filter(Boolean);
        if (parts.length) setCrmCompleteErr(parts.join(" · "));
      }
      await refreshPayload();
      router.refresh();
    } finally {
      setActionBusy(false);
    }
  }

  async function onCancel() {
    if (!booking || !canMutate) return;
    const reason = window.prompt("Cancellation reason (optional):") ?? "";
    setActionErr(null);
    const snap = booking;
    const now = new Date().toISOString();
    patchBookingOptimistic({
      ...booking,
      booking_status: "cancelled",
      cancelled_at: now,
      cancellation_reason: reason.trim() || null,
    });
    setActionBusy(true);
    try {
      const r = await cancelBookingAction(tenantId, booking.id, { cancellationReason: reason.trim() || null });
      if (!r.ok) {
        patchBookingOptimistic(snap);
        setActionErr(r.error);
        return;
      }
      await refreshPayload();
      router.refresh();
    } finally {
      setActionBusy(false);
    }
  }

  async function onSendInstructions(kind: "pre_op" | "post_op") {
    if (!booking || !canMutate) return;
    setInstructionsErr(null);
    setInstructionsBusy(true);
    try {
      const r = await sendAppointmentInstructionsAction(tenantId, booking.id, { kind });
      if (!r.ok) {
        setInstructionsErr(r.error);
        return;
      }
      await refreshPayload();
      if (r.ok && leadId && payload) {
        const label = kind === "pre_op" ? "Pre-op instructions" : "Post-op instructions";
        setPayload((p) =>
          p
            ? {
                ...p,
                booking: r.booking,
                instructionsSent:
                  kind === "pre_op"
                    ? { ...p.instructionsSent, pre_op_at: new Date().toISOString() }
                    : { ...p.instructionsSent, post_op_at: new Date().toISOString() },
                timeline: {
                  ...p.timeline,
                  events: [
                    {
                      id: `temp-${Date.now()}`,
                      tenant_id: tenantId,
                      lead_id: leadId,
                      patient_id: booking.patient_id,
                      case_id: booking.case_id,
                      activity_kind: "appointment.instructions_sent",
                      title: label,
                      detail: { appointmentId: booking.id, kind },
                      occurred_at: new Date().toISOString(),
                      created_at: new Date().toISOString(),
                      fi_timeline_event_id: null,
                    },
                    ...p.timeline.events,
                  ],
                },
              }
            : p
        );
      }
      router.refresh();
    } finally {
      setInstructionsBusy(false);
    }
  }

  async function onLinkPatient() {
    if (!booking || !canMutate) return;
    setLinkErr(null);
    setLinkBusy(true);
    try {
      const r = await linkAppointmentPatientFromLeadAction(tenantId, booking.id, {});
      if (!r.ok) {
        setLinkErr(r.error);
        return;
      }
      await refreshPayload();
      router.refresh();
    } finally {
      setLinkBusy(false);
    }
  }

  async function onConvert(e: FormEvent) {
    e.preventDefault();
    if (!leadId || !canMutate) return;
    setConvErr(null);
    setConvBusy(true);
    try {
      const r = await convertCrmLeadAction(tenantId, leadId, { seedCase });
      if (!r.ok) {
        setConvErr(r.error);
        return;
      }
      setSeedCase(false);
      await refreshPayload();
      router.refresh();
    } finally {
      setConvBusy(false);
    }
  }

  async function onAddTask(e: FormEvent) {
    e.preventDefault();
    if (!leadId || !canMutate) return;
    const title = taskTitle.trim();
    if (!title) return;
    setTaskErr(null);
    setTaskBusy(true);
    try {
      const r = await crmCreateTaskAction(tenantId, leadId, {
        title,
        taskType: "follow_up",
        status: "open",
        dueAt: null,
      });
      if (!r.ok) {
        setTaskErr(r.error);
        return;
      }
      setTaskTitle("");
      setPayload((p) => (p ? { ...p, timeline: { ...p.timeline, tasks: [r.task, ...p.timeline.tasks] } } : p));
      router.refresh();
    } finally {
      setTaskBusy(false);
    }
  }

  async function onAddGeneralNote(e: FormEvent) {
    e.preventDefault();
    if (!leadId || !canMutate) return;
    const body = noteBody.trim();
    if (!body) return;
    setNoteErr(null);
    setNoteBusy(true);
    try {
      const r = await crmCreateNoteAction(tenantId, leadId, { body, visibility: "internal" });
      if (!r.ok) {
        setNoteErr(r.error);
        return;
      }
      setNoteBody("");
      setPayload((p) => (p ? { ...p, timeline: { ...p.timeline, notes: [r.note, ...p.timeline.notes] } } : p));
      router.refresh();
    } finally {
      setNoteBusy(false);
    }
  }

  async function onAddLeadNote(e: FormEvent) {
    e.preventDefault();
    if (!leadId || !canMutate) return;
    const body = leadNoteBody.trim();
    if (!body) return;
    setLeadNoteErr(null);
    setLeadNoteBusy(true);
    try {
      const r = await createCrmLeadNoteAction(tenantId, leadId, {
        noteBody: body,
        noteVisibility: "internal",
        isPinned: false,
      });
      if (!r.ok) {
        setLeadNoteErr(r.error);
        return;
      }
      setLeadNoteBody("");
      setPayload((p) =>
        p ? { ...p, timeline: { ...p.timeline, leadNotes: [r.note, ...p.timeline.leadNotes] } } : p
      );
      router.refresh();
    } finally {
      setLeadNoteBusy(false);
    }
  }

  async function onCompleteTask(taskId: string) {
    if (!leadId || !canMutate) return;
    const snap = payload?.timeline.tasks ?? [];
    const optimistic = snap.map((t) =>
      t.id === taskId ? { ...t, status: "done" as const, completed_at: new Date().toISOString() } : t
    );
    setPayload((p) => (p ? { ...p, timeline: { ...p.timeline, tasks: optimistic } } : p));
    const r = await completeCrmTaskAction(tenantId, leadId, taskId, {});
    if (!r.ok) {
      setPayload((p) => (p ? { ...p, timeline: { ...p.timeline, tasks: snap } } : p));
      return;
    }
    setPayload((p) =>
      p
        ? {
            ...p,
            timeline: {
              ...p.timeline,
              tasks: p.timeline.tasks.map((t) => (t.id === taskId ? r.task : t)),
            },
          }
        : p
    );
    router.refresh();
  }

  if (!open) return null;

  const cancelled = booking ? isBookingCancelled(booking) : false;

  const inner = (
    <>
      {!embedded ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            {booking ? (
              <Link href={href} className="text-xs text-blue-300 hover:underline" onClick={() => onClose()}>
                Open full page →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
      {loading ? <p className="text-slate-400">Loading…</p> : null}
      {loadError ? (
        <div className="rounded border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300" role="alert">
          {loadError}
        </div>
      ) : null}

      {!loading && booking && payload ? (
        <div className="space-y-4">
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
                canMutate={canMutate && !cancelled && booking.booking_status !== "completed"}
                rescheduleOpen={rescheduleOpen}
                onToggleReschedule={() => setRescheduleOpen((v) => !v)}
                startLocal={startLocal}
                endLocal={endLocal}
                bookingStatus={bookingStatus}
                onStartLocalChange={setStartLocal}
                onEndLocalChange={setEndLocal}
                onBookingStatusChange={setBookingStatus}
                onRescheduleSubmit={onRescheduleSubmit}
                rescheduleBusy={rescheduleBusy}
                rescheduleErr={rescheduleErr}
              />

              <AppointmentClinicalSection
                clinicalScalesSummary={payload.clinicalScalesSummary}
                clinicalLine={payload.clinicalLine}
                surgeryPlan={payload.surgeryPlan}
              />

              <AppointmentProcedureSection
                tenantId={tenantId}
                assignees={payload.assignees}
                graftCountEstimate={graftCountEstimate}
                donorArea={donorArea}
                technique={technique}
                specialInstructions={specialInstructions}
                surgeonUserId={surgeonUserId}
                consultantUserId={consultantUserId}
                techUserId={techUserId}
                canMutate={canMutate && !cancelled && booking.booking_status !== "completed"}
                busy={procedureBusy}
                error={procedureErr}
                onGraftCountEstimateChange={setGraftCountEstimate}
                onDonorAreaChange={setDonorArea}
                onTechniqueChange={setTechnique}
                onSpecialInstructionsChange={setSpecialInstructions}
                onSurgeonUserIdChange={setSurgeonUserId}
                onConsultantUserIdChange={setConsultantUserId}
                onTechUserIdChange={setTechUserId}
                onSubmit={onSaveProcedure}
              />

              {booking.description?.trim() ? (
                <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-3 shadow-lg shadow-black/40">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Appointment notes</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{booking.description}</p>
                </section>
              ) : null}

              <AppointmentGallerySection
                tenantId={tenantId}
                patientId={booking.patient_id}
                bundle={payload.patientImages}
              />

              {leadId ? (
                <>
                  <LeadActivityFeed
                    events={payload.timeline.events}
                    limit={8}
                    emptyMessage="No CRM activity on the linked lead yet."
                  />
                  <LeadTasksSection
                    tasks={payload.timeline.tasks}
                    canMutate={canMutate}
                    taskTitle={taskTitle}
                    taskBusy={taskBusy}
                    taskErr={taskErr}
                    onTaskTitleChange={setTaskTitle}
                    onAddTask={onAddTask}
                    onCompleteTask={onCompleteTask}
                  />
                  <LeadNotesSection
                    notes={payload.timeline.notes}
                    leadNotes={payload.timeline.leadNotes}
                    canMutate={canMutate}
                    noteBody={noteBody}
                    leadNoteBody={leadNoteBody}
                    noteBusy={noteBusy}
                    leadNoteBusy={leadNoteBusy}
                    noteErr={noteErr}
                    leadNoteErr={leadNoteErr}
                    onNoteBodyChange={setNoteBody}
                    onLeadNoteBodyChange={setLeadNoteBody}
                    onAddGeneralNote={onAddGeneralNote}
                    onAddLeadNote={onAddLeadNote}
                  />
                </>
              ) : (
                <LeadActivityFeed events={[]} emptyMessage="Link a lead to see CRM activity, tasks, and notes here." />
              )}

              <LeadRemindersSection
                reminderJobs={payload.reminderJobs}
                emptyMessage="No pending reminder jobs for this appointment or linked lead."
              />

              <AppointmentAnchorFlowsSection
                booking={booking}
                lead={lead}
                instructionsSent={payload.instructionsSent}
                canMutate={canMutate}
                linkBusy={linkBusy}
                linkErr={linkErr}
                convBusy={convBusy}
                convErr={convErr}
                seedCase={seedCase}
                onSeedCaseChange={setSeedCase}
                onLinkPatient={() => void onLinkPatient()}
                onConvert={onConvert}
              />

              {lead && completionLeadOpts && payload.pipelineStages.length > 0 && !cancelled && booking.booking_status !== "completed" ? (
                <AppointmentCompletionLeadWorkflow
                  lead={lead}
                  pipelineStages={payload.pipelineStages}
                  bookingType={booking.booking_type}
                  value={completionLeadOpts}
                  onChange={setCompletionLeadOpts}
                  disabled={actionBusy}
                />
              ) : null}

              <AppointmentActionsSection
                booking={booking}
                instructionsSent={payload.instructionsSent}
                canMutate={canMutate}
                actionBusy={actionBusy}
                actionErr={actionErr ?? crmCompleteErr}
                instructionsBusy={instructionsBusy}
                instructionsErr={instructionsErr}
                onRescheduleToggle={() => setRescheduleOpen(true)}
                onComplete={() => void onComplete()}
                onCancel={() => void onCancel()}
                onSendPreOp={() => void onSendInstructions("pre_op")}
                onSendPostOp={() => void onSendInstructions("post_op")}
              />

              {cancelled && booking.cancellation_reason?.trim() ? (
                <div className="rounded border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-200">
                  <p className="font-medium">Cancelled</p>
                  <p className="mt-1 text-slate-200">{booking.cancellation_reason}</p>
                </div>
              ) : null}
        </div>
      ) : null}
    </>
  );

  if (embedded) return <div className="text-sm">{inner}</div>;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/30 sm:items-stretch"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="flex h-full max-h-[100dvh] w-full flex-col overflow-hidden border-l border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-xl sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Appointment preview"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-100">Appointment preview</h2>
            {booking ? (
              <Link href={href} className="text-xs text-blue-300 hover:underline" onClick={() => onClose()}>
                Open full page →
              </Link>
            ) : null}
          </div>
          <button type="button" className="shrink-0 text-sm text-slate-400 hover:text-slate-100" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">{inner}</div>
      </aside>
    </div>
  );
}

/** Alias for {@link AppointmentSlideOverPanel}. */
export { AppointmentSlideOverPanel as AppointmentSlideOver };
