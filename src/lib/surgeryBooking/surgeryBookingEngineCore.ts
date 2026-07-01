import { mergeAppointmentProcedureMetadata } from "@/src/lib/bookings/appointmentMetadata";
import type { SurgeryPlanningUpsertPatch } from "@/src/lib/cases/surgeryPlanningTypes";
import {
  buildPreOpChecklistFlags,
  type PreOpChecklistFlags,
} from "@/src/lib/surgery/procedureDayBoardModel";
import type { SurgeryBookingConfirmBody } from "./surgeryBookingTypes";

export const SURGERY_BOOKING_WIZARD_STEPS = [
  { id: 1, key: "context", label: "Patient & case" },
  { id: 2, key: "clinical", label: "Procedure plan" },
  { id: 3, key: "schedule", label: "Schedule & team" },
  { id: 4, key: "finance", label: "Deposit & confirm" },
] as const;

export type SurgeryBookingWizardStepId = (typeof SURGERY_BOOKING_WIZARD_STEPS)[number]["id"];

export const PRE_OP_CHECKLIST_LABELS: Record<keyof PreOpChecklistFlags, string> = {
  caseLinked: "Surgery case linked",
  consentProxy: "Consultation / quote acceptance",
  pathologyReviewed: "Pathology reviewed",
  depositOkOrUntracked: "Deposit requirement satisfied or not tracked",
  procedurePlanComplete: "Procedure plan documented",
  surgeonAssigned: "Surgeon assigned",
  roomOk: "Procedure room assigned",
};

export function preOpChecklistDisplayItems(
  flags: PreOpChecklistFlags
): Array<{ key: string; label: string; complete: boolean }> {
  return (Object.keys(PRE_OP_CHECKLIST_LABELS) as Array<keyof PreOpChecklistFlags>).map(
    (key) => ({
      key,
      label: PRE_OP_CHECKLIST_LABELS[key],
      complete: flags[key],
    })
  );
}

export function buildPreOpChecklistFlagsForBookingDraft(body: SurgeryBookingConfirmBody): PreOpChecklistFlags {
  return buildPreOpChecklistFlags({
    caseId: body.caseId ?? null,
    consultRows: [],
    hasPathologyResult: false,
    surgeryPaymentRecord: null,
    todayYmd: new Date().toISOString().slice(0, 10),
    hasSurgeryPlanRow: Boolean(body.procedureType?.trim()),
    surgeryPlanningComplete: Boolean(body.procedureType?.trim() && body.graftEstimate?.trim()),
    hasBookingAssignee: Boolean(body.surgeonStaffId?.trim()),
    hasProcedureSurgeon: Boolean(body.surgeonStaffId?.trim()),
    roomRequired: body.roomRequired !== false,
    hasRoom: Boolean(body.roomId?.trim()),
  });
}

export function listSurgeryBookingMissingRequirements(
  body: Partial<SurgeryBookingConfirmBody>,
  step: SurgeryBookingWizardStepId
): string[] {
  const missing: string[] = [];
  if (step >= 1) {
    if (!body.patientId?.trim()) missing.push("Select a patient.");
    if (!body.clinicId?.trim()) missing.push("Select a clinic.");
  }
  if (step >= 2) {
    if (!body.procedureType?.trim()) missing.push("Enter a procedure type.");
    if (!body.surgeonStaffId?.trim()) missing.push("Select a surgeon.");
  }
  if (step >= 3) {
    if (!body.startAt?.trim() || !body.endAt?.trim()) missing.push("Select date and time.");
    if (!body.roomId?.trim() && body.roomRequired !== false) missing.push("Select a procedure room.");
  }
  return missing;
}

export function buildSurgeryPlanPatchFromBookingBody(
  body: SurgeryBookingConfirmBody
): SurgeryPlanningUpsertPatch {
  const graft = body.graftEstimate?.trim() || null;
  const graftMin = graft && /^\d+$/.test(graft) ? Number(graft) : null;
  const graftMax = graftMin;
  return {
    planning_status: "in_progress",
    planned_procedure_type: body.procedureType.trim(),
    planned_zones: body.plannedZones ?? [],
    estimated_grafts_min: graftMin,
    estimated_grafts_max: graftMax,
    planning_notes: body.clinicalNotes?.trim() || null,
    surgical_plan_summary: body.clinicalNotes?.trim() || null,
  };
}

export function buildSurgeryBookingDescription(body: SurgeryBookingConfirmBody): string {
  const lines = [
    `Surgery booking — ${body.procedureType.trim()}.`,
    body.graftEstimate?.trim() ? `Graft estimate: ${body.graftEstimate.trim()}.` : null,
    body.clinicalNotes?.trim() ? `Notes: ${body.clinicalNotes.trim()}` : null,
    body.crmQuoteId?.trim() ? `Accepted quote: ${body.crmQuoteId.trim()}.` : null,
    body.consultationId?.trim() ? `Consultation: ${body.consultationId.trim()}.` : null,
  ].filter(Boolean) as string[];
  return lines.join("\n").trim();
}

export function buildSurgeryBookingMetadata(
  body: SurgeryBookingConfirmBody,
  preOpChecklist: Array<{ key: string; label: string; complete: boolean }>
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    surgery_booking_engine_v1: true,
    surgery_booking_entry_source: body.entrySource?.trim() || "wizard",
    pre_op_checklist: preOpChecklist,
    pre_op_checklist_generated_at: new Date().toISOString(),
    ...(body.crmQuoteId?.trim() ? { crm_quote_id: body.crmQuoteId.trim() } : {}),
    ...(body.consultationId?.trim() ? { consultation_id: body.consultationId.trim() } : {}),
  };
  const procedurePatch = {
    graft_count_estimate: body.graftEstimate?.trim() || null,
    surgeon_user_id: null,
    special_instructions: body.clinicalNotes?.trim() || null,
    technique: body.procedureType.trim(),
    donor_area: body.plannedZones?.length
      ? body.plannedZones.map((z) => z.label?.trim() || z.key).join(", ")
      : null,
    consultant_user_id: null,
    tech_user_id: null,
  };
  return mergeAppointmentProcedureMetadata(base, procedurePatch);
}

export function buildSurgeryBookingCreateParams(body: SurgeryBookingConfirmBody): {
  tenantScoped: {
    patientId: string;
    personId: string | null;
    caseId: string | null;
    leadId: string | null;
    clinicId: string;
    roomId: string;
    roomRequired: boolean;
    assignedStaffId: string;
    bookingType: "surgery";
    title: string;
    description: string;
    startAt: string;
    endAt: string;
    timezone: string | null;
    metadata: Record<string, unknown>;
    resourceAssignments: SurgeryBookingConfirmBody["resourceAssignments"];
  };
} {
  const preOpFlags = buildPreOpChecklistFlagsForBookingDraft(body);
  const preOpChecklist = preOpChecklistDisplayItems(preOpFlags);
  return {
    tenantScoped: {
      patientId: body.patientId.trim(),
      personId: body.personId?.trim() || null,
      caseId: body.caseId?.trim() || null,
      leadId: body.leadId?.trim() || null,
      clinicId: body.clinicId.trim(),
      roomId: body.roomId.trim(),
      roomRequired: body.roomRequired !== false,
      assignedStaffId: body.surgeonStaffId.trim(),
      bookingType: "surgery",
      title: `${body.procedureType.trim()} — surgery`,
      description: buildSurgeryBookingDescription(body),
      startAt: body.startAt.trim(),
      endAt: body.endAt.trim(),
      timezone: body.timezone?.trim() || null,
      metadata: {
        ...buildSurgeryBookingMetadata(body, preOpChecklist),
        booking_status_intent: body.bookingStatus ?? "scheduled",
      },
      resourceAssignments: body.resourceAssignments,
    },
  };
}

export function buildSurgeryBookingNextActions(input: {
  tenantId: string;
  bookingId: string;
  caseId: string | null;
  patientId: string;
}): Array<{ label: string; href: string }> {
  const tid = input.tenantId.trim();
  const actions: Array<{ label: string; href: string }> = [
    {
      label: "Open calendar appointment",
      href: `/fi-admin/${tid}/appointments/${input.bookingId.trim()}`,
    },
    {
      label: "Surgery readiness board",
      href: `/fi-admin/${tid}/surgery-readiness`,
    },
  ];
  if (input.caseId?.trim()) {
    actions.push({
      label: "Open surgery case",
      href: `/fi-admin/${tid}/cases/${input.caseId.trim()}`,
    });
  }
  actions.push({
    label: "Patient profile",
    href: `/fi-admin/${tid}/patients/${input.patientId.trim()}`,
  });
  return actions;
}