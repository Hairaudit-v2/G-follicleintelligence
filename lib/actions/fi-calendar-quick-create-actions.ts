"use server";

import { z, ZodError } from "zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertCrmTenantWriteAllowed, CrmAccessError, tryResolveFiUserIdForTenant } from "@/src/lib/crm/crmGate";
import { createCrmLeadWithPerson, loadCrmLeadById } from "@/src/lib/crm/leads";
import { DEFAULT_CRM_PIPELINE_KEY } from "@/src/lib/crm/types";
import { resolveOrCreatePerson } from "@/src/lib/fi/foundation/resolvePerson";
import { resolveOrCreatePatient } from "@/src/lib/fi/foundation/resolvePatient";
import { BOOKING_TYPES, isAllowedBookingType } from "@/src/lib/bookings/bookingPolicy";
import { createBooking } from "@/src/lib/bookings/server";
import { logFiCalendarTimezoneDebug } from "@/src/lib/calendar/calendarTimezone";
import type { FiBookingRow } from "@/src/lib/bookings/types";

const UUID = z.string().uuid();
const optionalUuid = z.union([UUID, z.null()]).optional();

const procedureSchema = z.enum([...BOOKING_TYPES] as [string, ...string[]]);

const anchorSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("lead"),
      leadId: UUID,
    })
    .strict(),
  z
    .object({
      kind: z.literal("patient"),
      patientId: UUID,
      personId: UUID,
    })
    .strict(),
  z
    .object({
      kind: z.literal("new_lead"),
      displayName: z.string().min(1, "Name is required.").max(200),
      phone: z.string().min(6, "Phone is required.").max(40),
      email: z.union([z.string().email(), z.literal("")]).optional(),
    })
    .strict(),
  z.object({ kind: z.literal("block") }).strict(),
]);

const bodySchema = z
  .object({
    adminKey: z.string().optional(),
    startAt: z.string().min(1),
    endAt: z.string().min(1),
    calendarTimezone: z.string().min(1).max(128),
    bookingType: procedureSchema,
    title: z.string().max(2000).optional().nullable(),
    clinicId: optionalUuid,
    assignedStaffId: optionalUuid,
    assignedUserId: optionalUuid,
    templateId: z.string().max(80).optional().nullable(),
    anchor: anchorSchema,
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function leadIsConverted(lead: { converted_at?: string | null }): boolean {
  return Boolean(lead.converted_at?.trim());
}

async function findOpenLeadForPerson(
  tenantId: string,
  personId: string
): Promise<{ id: string; patient_id: string | null } | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_crm_leads")
    .select("id, patient_id")
    .eq("tenant_id", tenantId.trim())
    .eq("person_id", personId.trim())
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { id: string; patient_id: string | null };
  return { id: String(row.id), patient_id: row.patient_id ? String(row.patient_id) : null };
}

async function ensureOpenLeadForPatient(
  tenantId: string,
  personId: string,
  patientId: string,
  clinicId: string | null,
  patientLabel: string
): Promise<string> {
  const existing = await findOpenLeadForPerson(tenantId, personId);
  if (existing?.patient_id?.trim() === patientId.trim()) {
    return existing.id;
  }
  const lead = await createCrmLeadWithPerson(
    {
      tenantId: tenantId.trim(),
      personId: personId.trim(),
      patientId: patientId.trim(),
      clinicId: clinicId ?? undefined,
      summary: `Calendar — ${patientLabel}`.slice(0, 500),
      status: "open",
      metadata: { intake: "calendar_quick_create" },
      pipelineKey: DEFAULT_CRM_PIPELINE_KEY,
    },
    undefined
  );
  return lead.id;
}

async function resolveHoldPersonId(tenantId: string): Promise<string> {
  const tid = tenantId.trim();
  const { person } = await resolveOrCreatePerson(
    {
      tenant_id: tid,
      source_system: "fi_calendar_hold",
      source_person_id: tid,
      display_name: "Calendar hold",
      phone: null,
      email: null,
      metadata: {},
    },
    undefined
  );
  return person.id;
}

function bookingAnchorsForLead(lead: {
  id: string;
  person_id: string;
  patient_id: string | null;
  case_id: string | null;
  converted_at?: string | null;
}): { leadId: string; personId: string | null; patientId: string | null; caseId: string | null } {
  if (leadIsConverted(lead)) {
    return {
      leadId: lead.id,
      personId: lead.person_id?.trim() || null,
      patientId: lead.patient_id?.trim() || null,
      caseId: lead.case_id?.trim() || null,
    };
  }
  return { leadId: lead.id, personId: null, patientId: null, caseId: null };
}

export type CalendarQuickCreateBookingResult =
  | { ok: true; booking: FiBookingRow }
  | { ok: false; error: string };

/**
 * Calendar quick-create: {@link createBooking} with CRM anchors. Unconverted leads use `lead_id` only
 * (platform anchor rules); converted leads include person/patient/case on the booking row.
 */
export async function calendarQuickCreateBookingAction(
  tenantId: string,
  body: unknown
): Promise<CalendarQuickCreateBookingResult> {
  try {
    const parsed = bodySchema.parse(body);
    await assertCrmTenantWriteAllowed({ tenantId, adminKey: parsed.adminKey, request: undefined });

    const tid = tenantId.trim();
    if (!isAllowedBookingType(parsed.bookingType)) {
      return { ok: false, error: "Invalid procedure type." };
    }

    const startMs = Date.parse(parsed.startAt.trim());
    const endMs = Date.parse(parsed.endAt.trim());
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      return { ok: false, error: "Invalid start or end time." };
    }

    const tz = parsed.calendarTimezone.trim();
    const metaBase =
      parsed.metadata && typeof parsed.metadata === "object" && !Array.isArray(parsed.metadata) ? parsed.metadata : {};
    const templateMeta = parsed.templateId?.trim() ? { quick_template_id: parsed.templateId.trim() } : {};

    const createdByUserId = await tryResolveFiUserIdForTenant(tenantId, undefined);
    const clinicId = parsed.clinicId?.trim() || null;
    const assignedStaffId = parsed.assignedStaffId?.trim() || null;
    const assignedUserId = parsed.assignedUserId?.trim() || null;

    let leadId: string | null = null;
    let personId: string | null = null;
    let patientId: string | null = null;
    let caseId: string | null = null;

    if (parsed.anchor.kind === "lead") {
      const lead = await loadCrmLeadById(parsed.anchor.leadId, tid);
      if (!lead || lead.tenant_id.trim() !== tid) {
        return { ok: false, error: "Lead not found for this tenant." };
      }
      if (!leadIsConverted(lead) && parsed.bookingType.trim() !== "consultation") {
        return { ok: false, error: "Only consultation bookings are allowed before the lead is converted." };
      }
      const anchors = bookingAnchorsForLead(lead);
      leadId = anchors.leadId;
      personId = anchors.personId;
      patientId = anchors.patientId;
      caseId = anchors.caseId;
    } else if (parsed.anchor.kind === "patient") {
      personId = parsed.anchor.personId.trim();
      patientId = parsed.anchor.patientId.trim();
      const resolvedLeadId = await ensureOpenLeadForPatient(tid, personId, patientId, clinicId, "Patient");
      const lead = await loadCrmLeadById(resolvedLeadId, tid);
      if (!lead) return { ok: false, error: "Could not resolve CRM lead for this patient." };
      const anchors = bookingAnchorsForLead(lead);
      leadId = anchors.leadId;
      personId = anchors.personId;
      patientId = anchors.patientId;
      caseId = anchors.caseId;
    } else if (parsed.anchor.kind === "new_lead") {
      const dn = parsed.anchor.displayName.trim();
      const phone = parsed.anchor.phone.trim();
      const email = parsed.anchor.email?.trim() || null;
      const parts = dn.split(/\s+/).filter(Boolean);
      const firstName = parts[0] ?? "Unknown";
      const surname = parts.length > 1 ? parts.slice(1).join(" ") : firstName;

      const { person } = await resolveOrCreatePerson(
        {
          tenant_id: tid,
          source_system: "fi_calendar_quick_create",
          display_name: dn,
          phone,
          email,
          metadata: { first_name: firstName, surname },
        },
        undefined
      );

      const { patient } = await resolveOrCreatePatient(
        {
          tenant_id: tid,
          person_id: person.id,
          source_system: "fi_calendar_quick_create",
          primary_clinic_id: clinicId,
        },
        undefined
      );

      const lead = await createCrmLeadWithPerson(
        {
          tenantId: tid,
          personId: person.id,
          patientId: patient.id,
          clinicId: clinicId ?? undefined,
          summary: `Calendar — ${dn}`.slice(0, 500),
          status: "open",
          metadata: { source: "Calendar", intake: "calendar_quick_create" },
          pipelineKey: DEFAULT_CRM_PIPELINE_KEY,
        },
        undefined
      );

      const anchors = bookingAnchorsForLead(lead);
      leadId = anchors.leadId;
      personId = anchors.personId;
      patientId = anchors.patientId;
      caseId = anchors.caseId;
    } else if (parsed.anchor.kind === "block") {
      personId = await resolveHoldPersonId(tid);
      leadId = null;
      patientId = null;
      caseId = null;
    }

    const title = parsed.title?.trim() || null;
    const booking = await createBooking({
      tenantId: tid,
      leadId,
      personId,
      patientId,
      caseId,
      clinicId,
      assignedStaffId,
      assignedUserId,
      bookingType: parsed.bookingType.trim(),
      title,
      description: null,
      startAt: parsed.startAt.trim(),
      endAt: parsed.endAt.trim(),
      timezone: tz,
      location: null,
      metadata: { ...metaBase, ...templateMeta, intake: "calendar_quick_create" },
      createdByUserId,
    });

    logFiCalendarTimezoneDebug("quick-create-booking-saved", {
      calendarTimezone: tz,
      start_at: booking.start_at,
      end_at: booking.end_at,
    });

    return { ok: true, booking };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
