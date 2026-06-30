"use server";

import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadCaseAppointmentBookingsForShell } from "@/src/lib/cases/caseAppointmentShellLoader.server";
import { loadCaseAdminDetail } from "@/src/lib/cases/caseLoaders";
import { pickPrimaryLinkedSurgeryBookingYmd } from "@/src/lib/cases/caseProcedureDayLinkedBooking";
import { loadProcedureDayForCase } from "@/src/lib/cases/procedureDayLoaders";
import { loadTenantOperationalCalendarSettings } from "@/src/lib/calendar/tenantOperationalCalendarSettings.server";
import {
  assertCrmTenantWriteAllowed,
  CrmAccessError,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import { instantiateSurgeryPostopMedicationBundle } from "@/src/lib/medicationOs/surgeryPostopMedicationBundle.server";
import { loadSurgeryPlanForCase } from "@/src/lib/cases/surgeryPlanningLoaders";

const postopMedicationPlanActionBodySchema = z.object({
  adminKey: z.string().optional(),
});

function errMsg(e: unknown): string {
  if (e instanceof ZodError) return e.errors[0]?.message ?? "Invalid input.";
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

function ymdFromProcedureOrBookingDate(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  return t.slice(0, 10);
}

async function resolveSurgeryAnchorDateYmd(
  tenantId: string,
  caseId: string,
  foundationPatientId: string | null
): Promise<string | null> {
  const supabase = supabaseAdmin();
  const proc = await loadProcedureDayForCase(tenantId, caseId, supabase);
  const fromProc = ymdFromProcedureOrBookingDate(proc?.procedure_date ?? null);
  if (fromProc) return fromProc;

  const bookings = await loadCaseAppointmentBookingsForShell(tenantId, caseId, foundationPatientId);
  const cal = await loadTenantOperationalCalendarSettings(tenantId);
  const { ymd } = pickPrimaryLinkedSurgeryBookingYmd(bookings, cal.calendarTimezone);
  return ymd;
}

export type CreateCasePostopMedicationPlanActionResult =
  | { ok: true; outcome: "created" | "existing"; planId: string }
  | { ok: false; error: string };

/**
 * Manual SurgeryOS entry point: draft MedicationOS post-op therapy plan from the default bundle.
 * Idempotent per tenant/patient/case/surgeryPlanId + source `surgery_postop_bundle`. No prescribing side effects.
 */
export async function createCasePostopMedicationPlanAction(
  tenantId: string,
  caseId: string,
  body: unknown
): Promise<CreateCasePostopMedicationPlanActionResult> {
  try {
    const parsed = postopMedicationPlanActionBodySchema.parse(body);
    await assertCrmTenantWriteAllowed({
      tenantId,
      adminKey: parsed.adminKey ?? null,
      request: undefined,
    });

    const tid = tenantId.trim();
    const cid = caseId.trim();
    const supabase = supabaseAdmin();

    const detail = await loadCaseAdminDetail(tid, cid);
    if (!detail) {
      return { ok: false, error: "Case not found." };
    }
    const foundationPatientId =
      detail.foundation_patient_id?.trim() || detail.patient?.foundation_patient_id?.trim() || null;
    if (!foundationPatientId) {
      return {
        ok: false,
        error: "Link a foundation patient to this case before creating a medication plan.",
      };
    }

    const surgeryAnchorDate = await resolveSurgeryAnchorDateYmd(tid, cid, foundationPatientId);
    if (!surgeryAnchorDate) {
      return {
        ok: false,
        error:
          "Set a procedure day date or add a non-cancelled surgery booking so the post-op plan can anchor to a surgery date.",
      };
    }

    const planRow = await loadSurgeryPlanForCase(tid, cid, supabase);
    const surgeryPlanId = planRow?.id?.trim() || null;

    const actorUserId = await tryResolveFiUserIdForTenant(tid, undefined);

    const result = await instantiateSurgeryPostopMedicationBundle({
      supabase,
      tenantId: tid,
      patientId: foundationPatientId,
      caseId: cid,
      surgeryPlanId,
      consultationId: null,
      actorUserId: actorUserId ?? undefined,
      surgeryAnchorDate,
      dryRun: false,
    });

    const planId = result.status === "dry_run" ? "" : result.plan.id;
    if (!planId) {
      return { ok: false, error: "Unexpected dry-run response from post-op bundle instantiation." };
    }

    revalidatePath(`/fi-admin/${tid}/cases`);
    revalidatePath(`/fi-admin/${tid}/cases/${cid}`);
    revalidatePath(`/fi-admin/${tid}/surgery-readiness`);
    revalidatePath(`/fi-admin/${tid}/procedure-day`);
    revalidatePath(`/fi-admin/${tid}/patients/${foundationPatientId}/twin`);

    if (result.status === "existing") {
      return { ok: true, outcome: "existing", planId };
    }
    return { ok: true, outcome: "created", planId };
  } catch (e: unknown) {
    return { ok: false, error: errMsg(e) };
  }
}
