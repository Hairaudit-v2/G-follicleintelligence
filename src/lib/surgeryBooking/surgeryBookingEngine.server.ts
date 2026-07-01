import "server-only";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { createBooking, updateBooking } from "@/src/lib/bookings/server";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { upsertSurgeryPlanForCase } from "@/src/lib/cases/surgeryPlanningUpdate";
import { appendPatientTimelineEvent } from "@/src/lib/integrations/hubspot/appendPatientTimelineEvent.server";
import { readFiPaymentsEnabled } from "@/src/lib/payments/fiPaymentEnv.server";
import { createDepositInvoiceFromSurgeryCase } from "@/src/lib/revenueOs/revenueInvoiceMutations.server";
import {
  buildPreOpChecklistFlagsForBookingDraft,
  buildSurgeryBookingCreateParams,
  buildSurgeryBookingNextActions,
  buildSurgeryPlanPatchFromBookingBody,
  preOpChecklistDisplayItems,
} from "./surgeryBookingEngineCore";
import type { SurgeryBookingConfirmBody, SurgeryBookingConfirmResult } from "./surgeryBookingTypes";

export type ConfirmSurgeryBookingInput = {
  tenantId: string;
  body: SurgeryBookingConfirmBody;
  createdByFiUserId: string | null;
  client?: SupabaseClient;
};

async function assertSurgeryBookingAnchorsBelongToTenant(
  supabase: SupabaseClient,
  tenantId: string,
  body: SurgeryBookingConfirmBody
): Promise<void> {
  const tid = tenantId.trim();
  const checks: Array<{ table: string; id: string; label: string }> = [
    { table: "fi_patients", id: body.patientId, label: "Patient" },
    ...(body.caseId?.trim()
      ? [{ table: "fi_cases", id: body.caseId, label: "Case" }]
      : []),
    ...(body.leadId?.trim() ? [{ table: "fi_crm_leads", id: body.leadId, label: "Lead" }] : []),
    ...(body.personId?.trim()
      ? [{ table: "fi_persons", id: body.personId, label: "Person" }]
      : []),
    { table: "fi_clinics", id: body.clinicId, label: "Clinic" },
    { table: "fi_clinic_rooms", id: body.roomId, label: "Room" },
  ];

  for (const check of checks) {
    const id = assertNonEmptyUuid(check.id, check.label);
    const { data, error } = await supabase
      .from(check.table)
      .select("id, tenant_id")
      .eq("tenant_id", tid)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`${check.label} not found for this tenant.`);
    const rowTenant = String((data as { tenant_id?: string }).tenant_id ?? "").trim();
    if (rowTenant && rowTenant !== tid) {
      throw new Error(`${check.label} does not belong to this tenant.`);
    }
  }

  const staffId = assertNonEmptyUuid(body.surgeonStaffId, "surgeonStaffId");
  const { data: staff, error: staffErr } = await supabase
    .from("fi_staff")
    .select("id, fi_user_id")
    .eq("tenant_id", tid)
    .eq("id", staffId)
    .eq("is_active", true)
    .maybeSingle();
  if (staffErr) throw new Error(staffErr.message);
  if (!staff) throw new Error("Surgeon not found for this tenant.");
}

async function resolveSurgeonFiUserId(
  supabase: SupabaseClient,
  tenantId: string,
  surgeonStaffId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("fi_staff")
    .select("fi_user_id")
    .eq("tenant_id", tenantId.trim())
    .eq("id", surgeonStaffId.trim())
    .maybeSingle();
  return data?.fi_user_id != null ? String(data.fi_user_id) : null;
}

/**
 * Orchestrates surgery booking: calendar appointment, surgery plan, readiness checklist metadata,
 * optional deposit invoice, CRM/timeline audit, and analytics.
 */
export async function confirmSurgeryBooking(
  input: ConfirmSurgeryBookingInput
): Promise<SurgeryBookingConfirmResult> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId").trim();
  const body = input.body;
  const supabase = input.client ?? supabaseAdmin();

  await assertSurgeryBookingAnchorsBelongToTenant(supabase, tid, body);

  if (body.caseId?.trim()) {
    await upsertSurgeryPlanForCase(
      {
        tenantId: tid,
        caseId: body.caseId.trim(),
        patch: buildSurgeryPlanPatchFromBookingBody(body),
      },
      supabase
    );
  }

  const { tenantScoped } = buildSurgeryBookingCreateParams(body);
  const surgeonFiUserId = await resolveSurgeonFiUserId(supabase, tid, body.surgeonStaffId);
  if (surgeonFiUserId) {
    tenantScoped.metadata = {
      ...tenantScoped.metadata,
      surgeon_user_id: surgeonFiUserId,
    };
  }
  let booking: FiBookingRow = await createBooking(
    {
      tenantId: tid,
      leadId: tenantScoped.leadId,
      personId: tenantScoped.personId,
      patientId: tenantScoped.patientId,
      caseId: tenantScoped.caseId,
      clinicId: tenantScoped.clinicId,
      roomId: tenantScoped.roomId,
      roomRequired: tenantScoped.roomRequired,
      assignedStaffId: tenantScoped.assignedStaffId,
      bookingType: tenantScoped.bookingType,
      title: tenantScoped.title,
      description: tenantScoped.description,
      startAt: tenantScoped.startAt,
      endAt: tenantScoped.endAt,
      timezone: tenantScoped.timezone,
      metadata: tenantScoped.metadata,
      resourceAssignments: tenantScoped.resourceAssignments,
      createdByUserId: input.createdByFiUserId,
    },
    supabase
  );

  if ((body.bookingStatus ?? "scheduled") === "confirmed" && booking.booking_status !== "confirmed") {
    booking = await updateBooking(
      {
        tenantId: tid,
        bookingId: booking.id,
        bookingStatus: "confirmed",
      },
      supabase
    );
  }

  const preOpChecklist = preOpChecklistDisplayItems(buildPreOpChecklistFlagsForBookingDraft(body));

  let depositInvoiceId: string | null = null;
  if (
    body.createDepositRequest &&
    body.caseId?.trim() &&
    readFiPaymentsEnabled()
  ) {
    try {
      const invoice = await createDepositInvoiceFromSurgeryCase({
        tenantId: tid,
        caseId: body.caseId.trim(),
        clinicId: body.clinicId.trim(),
        createdByFiUserId: input.createdByFiUserId,
      });
      depositInvoiceId = invoice.id;
    } catch {
      /* deposit invoice is best-effort when rules are manual-only or misconfigured */
    }
  }

  const now = new Date().toISOString();
  const detail = {
    booking_id: booking.id,
    case_id: booking.case_id,
    patient_id: booking.patient_id,
    procedure_type: body.procedureType.trim(),
    start_at: booking.start_at,
    entry_source: body.entrySource?.trim() || "wizard",
    pre_op_checklist: preOpChecklist,
    deposit_invoice_id: depositInvoiceId,
  };

  if (booking.lead_id || booking.patient_id) {
    await appendCrmActivityEvent(
      {
        tenantId: tid,
        leadId: booking.lead_id,
        patientId: booking.patient_id,
        caseId: booking.case_id,
        activityKind: "surgery.booked",
        title: "Surgery booked",
        detail,
        occurredAt: now,
      },
      supabase
    );
  }

  if (booking.patient_id) {
    await appendPatientTimelineEvent(supabase, {
      tenantId: tid,
      patientId: booking.patient_id,
      personId: booking.person_id,
      crmLeadId: booking.lead_id,
      source: "fi_surgery_booking_engine",
      eventType: "surgery_booked",
      eventTimestamp: now,
      title: "Surgery scheduled",
      description: body.procedureType.trim(),
      dedupeKey: `surgery-booking:${booking.id}`,
      metadata: detail,
    });
  }

  if (booking.patient_id) {
    const { advancePatientJourneyOnEvent } = await import(
      "@/src/lib/patientJourney/patientJourneyState.server"
    );
    await advancePatientJourneyOnEvent({
      tenantId: tid,
      patientId: booking.patient_id,
      event: "surgery_booked",
      reason: "surgery_booked",
      leadId: booking.lead_id,
      caseId: booking.case_id,
      actorFiUserId: input.createdByFiUserId,
      client: supabase,
    }).catch(() => undefined);
  }

  revalidatePath(`/fi-admin/${tid}/appointments`);
  revalidatePath(`/fi-admin/${tid}/surgery-readiness`);
  revalidatePath(`/fi-admin/${tid}/reception-os`);
  revalidatePath(`/fi-admin/${tid}/reception-board`);
  revalidatePath(`/fi-admin/${tid}/surgery-os`);
  if (booking.case_id) revalidatePath(`/fi-admin/${tid}/cases/${booking.case_id}`);
  if (booking.patient_id) revalidatePath(`/fi-admin/${tid}/patients/${booking.patient_id}`);

  return {
    bookingId: booking.id,
    caseId: booking.case_id,
    patientId: booking.patient_id ?? body.patientId.trim(),
    preOpChecklist,
    depositInvoiceId,
    nextActions: buildSurgeryBookingNextActions({
      tenantId: tid,
      bookingId: booking.id,
      caseId: booking.case_id,
      patientId: booking.patient_id ?? body.patientId.trim(),
    }),
  };
}