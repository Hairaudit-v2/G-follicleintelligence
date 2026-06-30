"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertFiTenantExists, isFiAdminUuid } from "@/lib/server/fiAdminKeyGate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertCrmTenantWriteAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";

function errMsg(e: unknown): string {
  if (e instanceof CrmAccessError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed.";
}

const inputSchema = z.object({
  adminKey: z
    .string()
    .optional()
    .transform((s) => (s == null || s.trim() === "" ? undefined : s.trim())),
  tenantId: z.string().uuid("Invalid tenant id."),
  clinic_id: z.string().uuid("Select a valid clinic."),
  first_name: z.string().trim().min(1, "First name is required.").max(120),
  last_name: z.string().trim().min(1, "Last name is required.").max(120),
  email: z.string().trim().email("Enter a valid email.").max(320),
  phone: z.string().trim().min(3, "Phone is required.").max(80),
  date_of_birth: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  case_type: z.string().trim().min(1, "Patient type is required.").max(256),
  treatment_type: z.string().trim().min(1, "Treatment type is required.").max(512),
  case_status: z.enum(["consultation"]).optional().default("consultation"),
  source: z.string().trim().max(128).optional().default("manual_admin_test"),
});

export type CreateFirstPatientCaseWizardResult =
  | { ok: true; caseId: string }
  | { ok: false; error: string };

/**
 * FI Admin: create fi_person → fi_patient → fi_case (+ optional fi_timeline_events) in one guarded flow.
 * Writes use service role only; validates tenant and clinic ownership.
 * Authorisation: `assertCrmTenantWriteAllowed` (signed-in CRM mutation role or optional `FI_ADMIN_API_KEY`).
 */
export async function createFirstPatientCaseWizardAction(
  raw: unknown
): Promise<CreateFirstPatientCaseWizardResult> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  const tenantId = input.tenantId.trim();
  try {
    await assertCrmTenantWriteAllowed({
      tenantId,
      adminKey: input.adminKey,
      request: undefined,
    });
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }

  const t = await assertFiTenantExists(tenantId);
  if (!t.ok) return { ok: false, error: t.error };

  const clinicId = input.clinic_id.trim();
  if (!isFiAdminUuid(clinicId)) return { ok: false, error: "Invalid clinic id." };

  const supabase = supabaseAdmin();

  const { data: clinic, error: clinicErr } = await supabase
    .from("fi_clinics")
    .select("id, tenant_id, organisation_id")
    .eq("id", clinicId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (clinicErr) return { ok: false, error: "Could not verify clinic." };
  if (!clinic) return { ok: false, error: "Clinic not found for this tenant." };

  const organisationId =
    clinic.organisation_id != null && typeof clinic.organisation_id === "string"
      ? clinic.organisation_id
      : null;

  const displayName = `${input.first_name} ${input.last_name}`.trim();
  const emailNormalized = input.email.trim().toLowerCase();
  const source = (input.source ?? "manual_admin_test").trim() || "manual_admin_test";
  const caseStatus = input.case_status ?? "consultation";

  const personMetadata: Record<string, unknown> = {
    display_name: displayName,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email: input.email.trim(),
    email_normalized: emailNormalized,
    phone: input.phone.trim(),
    ...(input.date_of_birth ? { date_of_birth: input.date_of_birth } : {}),
  };

  const { data: personRow, error: personErr } = await supabase
    .from("fi_persons")
    .insert({
      tenant_id: tenantId,
      metadata: personMetadata,
    })
    .select("id")
    .single();

  if (personErr || !personRow?.id) {
    return { ok: false, error: personErr?.message ?? "Could not create person." };
  }
  const personId = String(personRow.id);

  const { data: patientRow, error: patientErr } = await supabase
    .from("fi_patients")
    .insert({
      tenant_id: tenantId,
      person_id: personId,
      primary_clinic_id: clinicId,
      metadata: {},
    })
    .select("id")
    .single();

  if (patientErr || !patientRow?.id) {
    await supabase.from("fi_persons").delete().eq("id", personId).eq("tenant_id", tenantId);
    return { ok: false, error: patientErr?.message ?? "Could not create patient." };
  }
  const patientId = String(patientRow.id);

  const caseMetadata: Record<string, unknown> = {
    case_type: input.case_type.trim(),
    source,
    created_via: "fi_admin_first_case_wizard",
  };

  const { data: caseRow, error: caseErr } = await supabase
    .from("fi_cases")
    .insert({
      tenant_id: tenantId,
      clinic_id: clinicId,
      organisation_id: organisationId,
      foundation_patient_id: patientId,
      treatment_type: input.treatment_type.trim(),
      status: caseStatus,
      metadata: caseMetadata,
    })
    .select("id")
    .single();

  if (caseErr || !caseRow?.id) {
    await supabase.from("fi_patients").delete().eq("id", patientId).eq("tenant_id", tenantId);
    await supabase.from("fi_persons").delete().eq("id", personId).eq("tenant_id", tenantId);
    return { ok: false, error: caseErr?.message ?? "Could not create patient." };
  }
  const caseId = String(caseRow.id);

  const { error: timelineErr } = await supabase.from("fi_timeline_events").insert({
    tenant_id: tenantId,
    case_id: caseId,
    patient_id: patientId,
    organisation_id: organisationId,
    event_kind: "case_created",
    title: "Case created",
    detail: {
      source,
      wizard: "first_patient_case",
      case_status: caseStatus,
    },
    occurred_at: new Date().toISOString(),
  });

  if (timelineErr) {
    // Best-effort: case + patient remain valid if timeline insert fails (permissions, drift, etc.).
    console.error(
      "[createFirstPatientCaseWizardAction] fi_timeline_events insert failed:",
      timelineErr.message
    );
  }

  revalidatePath(`/fi-admin/${tenantId}/cases`);
  revalidatePath(`/fi-admin/${tenantId}/cases/${caseId}`);
  revalidatePath(`/fi-admin/${tenantId}/directory`);
  revalidatePath(`/fi-admin/${tenantId}/foundation-integrity`);

  return { ok: true, caseId };
}
