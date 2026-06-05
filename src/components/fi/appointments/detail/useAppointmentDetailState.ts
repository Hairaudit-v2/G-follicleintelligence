"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { bookingTypeLabel } from "@/src/lib/bookings/operatorBookingLabels";
import { buildAppointmentStatusHistory } from "@/src/lib/bookings/appointmentMetadata";
import type { AppointmentShellDetailPagePayload } from "@/src/lib/bookings/appointmentSlideOverLoader";
import { isCrmMutationRole } from "@/src/lib/crm/crmGatePolicy";
import {
  applyLeadUpdatesAfterAppointmentComplete,
  type AppointmentCompletionLeadOpts,
} from "@/src/lib/crm/appointmentCompletionLeadClient";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "@/src/components/fi/bookings/bookingFormUtils";
import { defaultAppointmentCompletionLeadOpts } from "../shared";
import { useAppointmentSlideOver } from "../AppointmentSlideOver";

const MUTATION_SOURCE = "fi_admin_appointment_detail";

export function useAppointmentDetailState(
  tenantId: string,
  appointmentId: string,
  initialPayload: AppointmentShellDetailPagePayload
) {
  const router = useRouter();
  const { operatorFiUserId, userRole } = useAppointmentSlideOver();
  const canMutate = isCrmMutationRole(userRole);

  const [payload, setPayload] = useState(initialPayload);
  const booking = payload.booking;
  const leadId = booking.lead_id?.trim() || null;

  useEffect(() => {
    setPayload(initialPayload);
    const b = initialPayload.booking;
    setDescription(b.description ?? "");
    setStartLocal(toDatetimeLocalValue(b.start_at));
    setEndLocal(toDatetimeLocalValue(b.end_at));
    setBookingStatus(b.booking_status);
    setGraftCountEstimate(initialPayload.procedure.graft_count_estimate ?? "");
    setDonorArea(initialPayload.procedure.donor_area ?? "");
    setTechnique(initialPayload.procedure.technique ?? "");
    setSpecialInstructions(initialPayload.procedure.special_instructions ?? "");
    setSurgeonUserId(initialPayload.procedure.surgeon_user_id ?? "");
    setConsultantUserId(initialPayload.procedure.consultant_user_id ?? "");
    setTechUserId(initialPayload.procedure.tech_user_id ?? "");
  }, [initialPayload]);

  const [description, setDescription] = useState(booking.description ?? "");
  const [descBusy, setDescBusy] = useState(false);
  const [descErr, setDescErr] = useState<string | null>(null);

  const [graftCountEstimate, setGraftCountEstimate] = useState(payload.procedure.graft_count_estimate ?? "");
  const [donorArea, setDonorArea] = useState(payload.procedure.donor_area ?? "");
  const [technique, setTechnique] = useState(payload.procedure.technique ?? "");
  const [specialInstructions, setSpecialInstructions] = useState(payload.procedure.special_instructions ?? "");
  const [surgeonUserId, setSurgeonUserId] = useState(payload.procedure.surgeon_user_id ?? "");
  const [consultantUserId, setConsultantUserId] = useState(payload.procedure.consultant_user_id ?? "");
  const [techUserId, setTechUserId] = useState(payload.procedure.tech_user_id ?? "");
  const [procedureBusy, setProcedureBusy] = useState(false);
  const [procedureErr, setProcedureErr] = useState<string | null>(null);

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [startLocal, setStartLocal] = useState(toDatetimeLocalValue(booking.start_at));
  const [endLocal, setEndLocal] = useState(toDatetimeLocalValue(booking.end_at));
  const [bookingStatus, setBookingStatus] = useState(booking.booking_status);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const [rescheduleErr, setRescheduleErr] = useState<string | null>(null);

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

  const linkedLead = payload.leadAnchor?.lead ?? null;

  useEffect(() => {
    if (linkedLead && payload.pipelineStages.length) {
      setCompletionLeadOpts(
        defaultAppointmentCompletionLeadOpts(linkedLead, payload.pipelineStages, booking.booking_type)
      );
    } else {
      setCompletionLeadOpts(null);
    }
  }, [linkedLead?.id, booking.booking_type, payload.pipelineStages]);

  const procedureLabel = useMemo(() => bookingTypeLabel(booking.booking_type), [booking.booking_type]);

  const nextScheduledLabel = useMemo(() => {
    const s = new Date(booking.start_at);
    if (Number.isNaN(s.getTime())) return null;
    return s.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }, [booking.start_at]);

  const openTaskCount = useMemo(
    () => payload.timeline.tasks.filter((t) => t.completed_at == null).length,
    [payload.timeline.tasks]
  );

  const pendingReminderCount = useMemo(() => {
    const now = Date.now();
    return payload.reminderJobs.filter(
      (j) => j.status === "pending" && new Date(j.scheduled_at).getTime() >= now - 120_000
    ).length;
  }, [payload.reminderJobs]);

  const refreshPayload = useCallback(async () => {
    const r = await loadAppointmentSlideOverBundleAction(tenantId, appointmentId);
    if (!r.ok) return;
    setPayload((prev) => ({
      ...prev,
      ...r.data,
      relatedAppointments: prev.relatedAppointments,
      invoicePreview: prev.invoicePreview,
      postOpTracking: prev.postOpTracking,
    }));
    const b = r.data.booking;
    setDescription(b.description ?? "");
    setStartLocal(toDatetimeLocalValue(b.start_at));
    setEndLocal(toDatetimeLocalValue(b.end_at));
    setBookingStatus(b.booking_status);
    setGraftCountEstimate(r.data.procedure.graft_count_estimate ?? "");
    setDonorArea(r.data.procedure.donor_area ?? "");
    setTechnique(r.data.procedure.technique ?? "");
    setSpecialInstructions(r.data.procedure.special_instructions ?? "");
    setSurgeonUserId(r.data.procedure.surgeon_user_id ?? "");
    setConsultantUserId(r.data.procedure.consultant_user_id ?? "");
    setTechUserId(r.data.procedure.tech_user_id ?? "");
    router.refresh();
  }, [tenantId, appointmentId, router]);

  const onSaveDescription = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canMutate) return;
      setDescErr(null);
      const snap = booking;
      const optimistic = { ...booking, description: description.trim() || null };
      setPayload((p) => ({ ...p, booking: optimistic }));
      setDescBusy(true);
      try {
        const r = await updateBookingAction(tenantId, booking.id, {
          leadId: booking.lead_id,
          personId: booking.person_id,
          patientId: booking.patient_id,
          caseId: booking.case_id,
          description: description.trim() || null,
          metadata: booking.metadata ?? {},
        });
        if (!r.ok) {
          setPayload((p) => ({ ...p, booking: snap }));
          setDescErr(r.error);
          return;
        }
        setPayload((p) => ({ ...p, booking: r.booking }));
        router.refresh();
      } finally {
        setDescBusy(false);
      }
    },
    [canMutate, description, booking, tenantId, router]
  );

  const onSaveProcedure = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canMutate) return;
      setProcedureErr(null);
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
          setProcedureErr(r.error);
          return;
        }
        await refreshPayload();
      } finally {
        setProcedureBusy(false);
      }
    },
    [
      canMutate,
      tenantId,
      booking.id,
      graftCountEstimate,
      donorArea,
      technique,
      specialInstructions,
      surgeonUserId,
      consultantUserId,
      techUserId,
      refreshPayload,
    ]
  );

  const onRescheduleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canMutate) return;
      const startIso = fromDatetimeLocalValue(startLocal);
      const endIso = fromDatetimeLocalValue(endLocal);
      if (!startIso || !endIso) {
        setRescheduleErr("Start and end times are required.");
        return;
      }
      setRescheduleErr(null);
      setRescheduleBusy(true);
      try {
        const r = await updateBookingAction(tenantId, booking.id, {
          leadId: booking.lead_id,
          personId: booking.person_id,
          patientId: booking.patient_id,
          caseId: booking.case_id,
          clinicId: booking.clinic_id,
          assignedUserId: booking.assigned_user_id,
          bookingStatus: bookingStatus.trim(),
          startAt: startIso,
          endAt: endIso,
          metadata: booking.metadata ?? {},
        });
        if (!r.ok) {
          setRescheduleErr(r.error);
          return;
        }
        setPayload((p) => ({
          ...p,
          booking: r.booking,
          statusHistory: buildAppointmentStatusHistory(r.booking),
        }));
        router.refresh();
      } finally {
        setRescheduleBusy(false);
      }
    },
    [canMutate, startLocal, endLocal, bookingStatus, booking, tenantId, router]
  );

  const onComplete = useCallback(async () => {
    if (!canMutate) return;
    setActionErr(null);
    setCrmCompleteErr(null);
    setActionBusy(true);
    try {
      const r = await completeBookingAction(tenantId, booking.id, {});
      if (!r.ok) {
        setActionErr(r.error);
        return;
      }
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
    } finally {
      setActionBusy(false);
    }
  }, [
    canMutate,
    tenantId,
    booking.id,
    refreshPayload,
    linkedLead,
    completionLeadOpts,
    operatorFiUserId,
  ]);

  const onCancel = useCallback(async () => {
    if (!canMutate) return;
    const reason = window.prompt("Cancellation reason (optional):") ?? "";
    setActionErr(null);
    setActionBusy(true);
    try {
      const r = await cancelBookingAction(tenantId, booking.id, { cancellationReason: reason.trim() || null });
      if (!r.ok) setActionErr(r.error);
      else await refreshPayload();
    } finally {
      setActionBusy(false);
    }
  }, [canMutate, tenantId, booking.id, refreshPayload]);

  const onSendInstructions = useCallback(
    async (kind: "pre_op" | "post_op") => {
      if (!canMutate) return;
      setInstructionsErr(null);
      setInstructionsBusy(true);
      try {
        const r = await sendAppointmentInstructionsAction(tenantId, booking.id, { kind });
        if (!r.ok) setInstructionsErr(r.error);
        else await refreshPayload();
      } finally {
        setInstructionsBusy(false);
      }
    },
    [canMutate, tenantId, booking.id, refreshPayload]
  );

  const onLinkPatient = useCallback(async () => {
    if (!canMutate) return;
    setLinkErr(null);
    setLinkBusy(true);
    try {
      const r = await linkAppointmentPatientFromLeadAction(tenantId, booking.id, {});
      if (!r.ok) setLinkErr(r.error);
      else await refreshPayload();
    } finally {
      setLinkBusy(false);
    }
  }, [canMutate, tenantId, booking.id, refreshPayload]);

  const onConvert = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!leadId || !canMutate) return;
      setConvErr(null);
      setConvBusy(true);
      try {
        const r = await convertCrmLeadAction(tenantId, leadId, { seedCase });
        if (!r.ok) setConvErr(r.error);
        else {
          setSeedCase(false);
          await refreshPayload();
        }
      } finally {
        setConvBusy(false);
      }
    },
    [leadId, canMutate, tenantId, seedCase, refreshPayload]
  );

  const onAddTask = useCallback(
    async (e: React.FormEvent) => {
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
        if (!r.ok) setTaskErr(r.error);
        else {
          setTaskTitle("");
          setPayload((p) => ({ ...p, timeline: { ...p.timeline, tasks: [r.task, ...p.timeline.tasks] } }));
          router.refresh();
        }
      } finally {
        setTaskBusy(false);
      }
    },
    [leadId, canMutate, taskTitle, tenantId, router]
  );

  const onCompleteTask = useCallback(
    async (taskId: string) => {
      if (!leadId || !canMutate) return;
      const snap = payload.timeline.tasks;
      const optimistic = snap.map((t) =>
        t.id === taskId ? { ...t, status: "done" as const, completed_at: new Date().toISOString() } : t
      );
      setPayload((p) => ({ ...p, timeline: { ...p.timeline, tasks: optimistic } }));
      const r = await completeCrmTaskAction(tenantId, leadId, taskId, {});
      if (!r.ok) {
        setPayload((p) => ({ ...p, timeline: { ...p.timeline, tasks: snap } }));
        return;
      }
      setPayload((p) => ({
        ...p,
        timeline: { ...p.timeline, tasks: p.timeline.tasks.map((t) => (t.id === taskId ? r.task : t)) },
      }));
      router.refresh();
    },
    [leadId, canMutate, payload.timeline.tasks, tenantId, router]
  );

  const onAddGeneralNote = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!leadId || !canMutate) return;
      const body = noteBody.trim();
      if (!body) return;
      setNoteErr(null);
      setNoteBusy(true);
      try {
        const r = await crmCreateNoteAction(tenantId, leadId, { body, visibility: "internal" });
        if (!r.ok) setNoteErr(r.error);
        else {
          setNoteBody("");
          setPayload((p) => ({ ...p, timeline: { ...p.timeline, notes: [r.note, ...p.timeline.notes] } }));
          router.refresh();
        }
      } finally {
        setNoteBusy(false);
      }
    },
    [leadId, canMutate, noteBody, tenantId, router]
  );

  const onAddLeadNote = useCallback(
    async (e: React.FormEvent) => {
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
        if (!r.ok) setLeadNoteErr(r.error);
        else {
          setLeadNoteBody("");
          setPayload((p) => ({
            ...p,
            timeline: { ...p.timeline, leadNotes: [r.note, ...p.timeline.leadNotes] },
          }));
          router.refresh();
        }
      } finally {
        setLeadNoteBusy(false);
      }
    },
    [leadId, canMutate, leadNoteBody, tenantId, router]
  );

  return {
    payload,
    booking,
    leadId,
    linkedLead,
    completionLeadOpts,
    setCompletionLeadOpts,
    crmCompleteErr,
    canMutate,
    procedureLabel,
    nextScheduledLabel,
    openTaskCount,
    pendingReminderCount,
    description,
    setDescription,
    descBusy,
    descErr,
    onSaveDescription,
    graftCountEstimate,
    setGraftCountEstimate,
    donorArea,
    setDonorArea,
    technique,
    setTechnique,
    specialInstructions,
    setSpecialInstructions,
    surgeonUserId,
    setSurgeonUserId,
    consultantUserId,
    setConsultantUserId,
    techUserId,
    setTechUserId,
    procedureBusy,
    procedureErr,
    onSaveProcedure,
    rescheduleOpen,
    setRescheduleOpen,
    startLocal,
    setStartLocal,
    endLocal,
    setEndLocal,
    bookingStatus,
    setBookingStatus,
    rescheduleBusy,
    rescheduleErr,
    onRescheduleSubmit,
    actionBusy,
    actionErr,
    instructionsBusy,
    instructionsErr,
    onComplete,
    onCancel,
    onSendInstructions,
    linkBusy,
    linkErr,
    onLinkPatient,
    convBusy,
    convErr,
    seedCase,
    setSeedCase,
    onConvert,
    taskTitle,
    setTaskTitle,
    taskBusy,
    taskErr,
    onAddTask,
    onCompleteTask,
    noteBody,
    setNoteBody,
    noteBusy,
    noteErr,
    onAddGeneralNote,
    leadNoteBody,
    setLeadNoteBody,
    leadNoteBusy,
    leadNoteErr,
    onAddLeadNote,
    operatorFiUserId,
    mutationSource: MUTATION_SOURCE,
  };
}
