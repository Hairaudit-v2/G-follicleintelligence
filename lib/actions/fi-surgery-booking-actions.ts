"use server";

import { z, ZodError } from "zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertCrmTenantReadAllowed,
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import { StaffPinMutationBlockedError } from "@/src/lib/staffPin/staffPinMutationGuard";
import {
  loadClinicalStaffPickerCached,
  loadTenantRoomsCached,
} from "@/src/lib/performance/referenceDataCache.server";
import { loadCrmShellScopePickerOptions } from "@/src/lib/crm/crmShellLoaders";
import { confirmSurgeryBooking } from "@/src/lib/surgeryBooking/surgeryBookingEngine.server";
import {
  surgeryBookingConfirmBodySchema,
  type SurgeryBookingConfirmResult,
  type SurgeryBookingWizardPrefill,
} from "@/src/lib/surgeryBooking/surgeryBookingTypes";

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof StaffPinMutationBlockedError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

const wizardContextSchema = z.object({
  tenantId: z.string().uuid(),
  clinicId: z.string().uuid().optional(),
  adminKey: z.string().optional(),
});

export type SurgeryBookingWizardContext = {
  clinics: Array<{ id: string; display_name: string }>;
  staff: Array<{ id: string; display_name: string; role: string; fi_user_id: string | null }>;
  rooms: Array<{ id: string; display_name: string; clinic_id: string }>;
};

export async function loadSurgeryBookingWizardContextAction(
  raw: unknown
): Promise<{ ok: true; data: SurgeryBookingWizardContext } | { ok: false; error: string }> {
  try {
    const parsed = wizardContextSchema.parse(raw);
    await assertCrmTenantReadAllowed({
      tenantId: parsed.tenantId,
      adminKey: parsed.adminKey,
      request: undefined,
    });

    const tid = parsed.tenantId.trim();
    const scope = await loadCrmShellScopePickerOptions(tid);
    const clinics = scope.clinics;
    const staffRows = await loadClinicalStaffPickerCached(tid);
    const clinicId = parsed.clinicId?.trim() || clinics[0]?.id || null;
    const allRooms = clinicId ? await loadTenantRoomsCached(tid) : [];
    const rooms = clinicId
      ? allRooms.filter((r) => r.clinic_id === clinicId && r.is_active !== false)
      : [];

    return {
      ok: true,
      data: {
        clinics: clinics.map((c) => ({
          id: c.id,
          display_name: c.display_name?.trim() || "Clinic",
        })),
        staff: staffRows.map((s) => ({
          id: s.id,
          display_name: s.full_name?.trim() || s.staff_role?.trim() || "Staff",
          role: s.staff_role?.trim() || "member",
          fi_user_id: s.fi_user_id ?? null,
        })),
        rooms: rooms.map((r) => ({
          id: r.id,
          display_name: r.display_name?.trim() || r.room_code?.trim() || "Room",
          clinic_id: r.clinic_id,
        })),
      },
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function confirmSurgeryBookingAction(
  tenantId: string,
  body: unknown
): Promise<{ ok: true; result: SurgeryBookingConfirmResult } | { ok: false; error: string }> {
  try {
    const parsed = surgeryBookingConfirmBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({
      tenantId,
      adminKey: parsed.adminKey,
      request: undefined,
      staffPinFloorAction: "calendar.quick_book",
    });

    const actingUserId = await tryResolveFiUserIdForTenant(tenantId, undefined);
    const result = await confirmSurgeryBooking({
      tenantId,
      body: parsed,
      createdByFiUserId: actingUserId,
    });
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const prefillSchema = z.object({
  tenantId: z.string().uuid(),
  patientId: z.string().uuid().optional(),
  caseId: z.string().uuid().optional(),
  adminKey: z.string().optional(),
});

export async function loadSurgeryBookingPrefillAction(
  raw: unknown
): Promise<{ ok: true; prefill: SurgeryBookingWizardPrefill } | { ok: false; error: string }> {
  try {
    const parsed = prefillSchema.parse(raw);
    await assertCrmTenantReadAllowed({
      tenantId: parsed.tenantId,
      adminKey: parsed.adminKey,
      request: undefined,
    });

    const tid = parsed.tenantId.trim();
    const supabase = supabaseAdmin();
    const prefill: SurgeryBookingWizardPrefill = {
      patientId: parsed.patientId ?? null,
      caseId: parsed.caseId ?? null,
    };

    if (parsed.patientId?.trim()) {
      const { data: patient } = await supabase
        .from("fi_patients")
        .select("id, person_id")
        .eq("tenant_id", tid)
        .eq("id", parsed.patientId.trim())
        .maybeSingle();
      if (patient) {
        prefill.personId = patient.person_id != null ? String(patient.person_id) : null;
        if (patient.person_id) {
          const { data: person } = await supabase
            .from("fi_persons")
            .select("display_name")
            .eq("tenant_id", tid)
            .eq("id", String(patient.person_id))
            .maybeSingle();
          prefill.patientDisplayName =
            person?.display_name != null ? String(person.display_name) : null;
        }
      }
    }

    if (parsed.caseId?.trim()) {
      const { data: caseRow } = await supabase
        .from("fi_cases")
        .select("id, patient_id, clinic_id, lead_id, case_type")
        .eq("tenant_id", tid)
        .eq("id", parsed.caseId.trim())
        .is("deleted_at", null)
        .maybeSingle();
      if (caseRow) {
        prefill.caseId = String(caseRow.id);
        prefill.patientId =
          caseRow.patient_id != null ? String(caseRow.patient_id) : prefill.patientId ?? null;
        prefill.clinicId = caseRow.clinic_id != null ? String(caseRow.clinic_id) : null;
        prefill.leadId = caseRow.lead_id != null ? String(caseRow.lead_id) : null;
        prefill.caseLabel =
          caseRow.case_type != null ? String(caseRow.case_type) : "Surgery case";
      }

      const { data: plan } = await supabase
        .from("fi_case_surgery_plans")
        .select(
          "planned_procedure_type, estimated_grafts_min, estimated_grafts_max, planned_zones, planning_notes"
        )
        .eq("tenant_id", tid)
        .eq("case_id", parsed.caseId.trim())
        .maybeSingle();
      if (plan) {
        prefill.procedureType =
          plan.planned_procedure_type != null ? String(plan.planned_procedure_type) : null;
        const min = plan.estimated_grafts_min;
        const max = plan.estimated_grafts_max;
        if (min != null && max != null) prefill.graftEstimate = `${min}–${max}`;
        else if (min != null) prefill.graftEstimate = String(min);
        else if (max != null) prefill.graftEstimate = String(max);
        if (Array.isArray(plan.planned_zones)) {
          prefill.plannedZones = plan.planned_zones as Array<{ key: string; label?: string | null }>;
        }
        prefill.clinicalNotes =
          plan.planning_notes != null ? String(plan.planning_notes) : prefill.clinicalNotes;
      }
    }

    return { ok: true, prefill };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}