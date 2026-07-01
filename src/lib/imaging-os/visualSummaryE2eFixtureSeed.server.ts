import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  defaultPatientVisualSummaryApproval,
  mergePatientVisualSummaryApprovalMetadata,
} from "./patientVisualSummaryApprovalCore";

export const VISUAL_SUMMARY_E2E_FIXTURE_KEY = "e2e_visual_summary_fixture_v1" as const;
export const VISUAL_SUMMARY_E2E_FIXTURE_METADATA_FLAG = "e2e_visual_summary_fixture" as const;

export type VisualSummaryE2eFixtureSeedResult = {
  ok: boolean;
  tenantId: string;
  patientId: string;
  caseId: string;
  portalEmail: string;
  portalPassword: string;
  created: {
    person: boolean;
    patient: boolean;
    case: boolean;
    authUser: boolean;
    image: boolean;
  };
  env: Record<string, string>;
  warnings: string[];
};

type FixtureOpts = {
  tenantId: string;
  portalEmail?: string;
  portalPassword?: string;
  client?: SupabaseClient;
};

function fixtureEmail(opts: FixtureOpts): string {
  return (
    opts.portalEmail?.trim() ||
    process.env.FI_E2E_PATIENT_PORTAL_EMAIL?.trim() ||
    "e2e-visual-summary-portal@fi-demo.example"
  );
}

function fixturePassword(opts: FixtureOpts): string {
  return (
    opts.portalPassword?.trim() ||
    process.env.FI_E2E_PATIENT_PORTAL_PASSWORD?.trim() ||
    "E2eVisualSummary!2026"
  );
}

async function loadFirstClinicId(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? String((data as { id: string }).id) : null;
}

async function ensurePortalAuthUser(
  supabase: SupabaseClient,
  email: string,
  password: string
): Promise<{ authUserId: string; created: boolean }> {
  const normalized = email.trim().toLowerCase();
  const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw new Error(listErr.message);

  const existing = listed.users.find((u) => u.email?.trim().toLowerCase() === normalized);
  if (existing?.id) {
    const { error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (updateErr) throw new Error(updateErr.message);
    return { authUserId: existing.id, created: false };
  }

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: normalized,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user?.id) {
    throw new Error(createErr?.message ?? "Failed to create portal auth user.");
  }
  return { authUserId: created.user.id, created: true };
}

async function findFixturePatient(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ id: string; person_id: string } | null> {
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, person_id, metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const meta = (row as { metadata?: unknown }).metadata;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      if ((meta as Record<string, unknown>)[VISUAL_SUMMARY_E2E_FIXTURE_METADATA_FLAG] === true) {
        return {
          id: String((row as { id: string }).id),
          person_id: String((row as { person_id: string }).person_id),
        };
      }
    }
  }
  return null;
}

async function findFixtureCase(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_cases")
    .select("id, metadata, patient_id, foundation_patient_id")
    .eq("tenant_id", tenantId)
    .or(`patient_id.eq.${patientId},foundation_patient_id.eq.${patientId}`);
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const meta = (row as { metadata?: unknown }).metadata;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      if ((meta as Record<string, unknown>)[VISUAL_SUMMARY_E2E_FIXTURE_METADATA_FLAG] === true) {
        return String((row as { id: string }).id);
      }
    }
  }
  return null;
}

export async function seedVisualSummaryE2eFixture(
  opts: FixtureOpts
): Promise<VisualSummaryE2eFixtureSeedResult> {
  const warnings: string[] = [];
  const supabase = opts.client ?? supabaseAdmin();
  const tenantId = opts.tenantId.trim();
  if (!tenantId) throw new Error("tenantId is required.");

  const portalEmail = fixtureEmail(opts);
  const portalPassword = fixturePassword(opts);
  const now = new Date().toISOString();
  const created = {
    person: false,
    patient: false,
    case: false,
    authUser: false,
    image: false,
  };

  const { authUserId, created: authCreated } = await ensurePortalAuthUser(
    supabase,
    portalEmail,
    portalPassword
  );
  created.authUser = authCreated;

  const clinicId = await loadFirstClinicId(supabase, tenantId);
  if (!clinicId) {
    warnings.push("No clinic found for tenant; patient will be created without primary_clinic_id.");
  }

  let patientId: string;
  let personId: string;

  const existingPatient = await findFixturePatient(supabase, tenantId);
  if (existingPatient) {
    patientId = existingPatient.id;
    personId = existingPatient.person_id;
    const { error: linkErr } = await supabase
      .from("fi_patients")
      .update({
        portal_auth_user_id: authUserId,
        updated_at: now,
      })
      .eq("tenant_id", tenantId)
      .eq("id", patientId);
    if (linkErr) throw new Error(linkErr.message);
  } else {
    const personMetadata = {
      display_name: "E2E Visual Summary Patient",
      email: portalEmail,
      email_normalized: portalEmail.toLowerCase(),
      [VISUAL_SUMMARY_E2E_FIXTURE_METADATA_FLAG]: true,
      fixture_key: VISUAL_SUMMARY_E2E_FIXTURE_KEY,
    };
    const { data: personRow, error: personErr } = await supabase
      .from("fi_persons")
      .insert({
        tenant_id: tenantId,
        metadata: personMetadata,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (personErr) throw new Error(personErr.message);
    personId = String((personRow as { id: string }).id);
    created.person = true;

    const patientMetadata = {
      [VISUAL_SUMMARY_E2E_FIXTURE_METADATA_FLAG]: true,
      fixture_key: VISUAL_SUMMARY_E2E_FIXTURE_KEY,
    };
    const { data: patientRow, error: patientErr } = await supabase
      .from("fi_patients")
      .insert({
        tenant_id: tenantId,
        person_id: personId,
        primary_clinic_id: clinicId,
        portal_auth_user_id: authUserId,
        metadata: patientMetadata,
        patient_status: "active",
        reminder_consent: true,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (patientErr) throw new Error(patientErr.message);
    patientId = String((patientRow as { id: string }).id);
    created.patient = true;
  }

  let caseId = await findFixtureCase(supabase, tenantId, patientId);
  const caseMetadata = mergePatientVisualSummaryApprovalMetadata(
    {
      [VISUAL_SUMMARY_E2E_FIXTURE_METADATA_FLAG]: true,
      fixture_key: VISUAL_SUMMARY_E2E_FIXTURE_KEY,
    },
    defaultPatientVisualSummaryApproval("surgery_post_op_summary")
  );

  if (!caseId) {
    const { data: caseRow, error: caseErr } = await supabase
      .from("fi_cases")
      .insert({
        tenant_id: tenantId,
        clinic_id: clinicId,
        patient_id: patientId,
        foundation_patient_id: patientId,
        status: "processing",
        external_id: VISUAL_SUMMARY_E2E_FIXTURE_KEY,
        metadata: caseMetadata,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (caseErr) throw new Error(caseErr.message);
    caseId = String((caseRow as { id: string }).id);
    created.case = true;
  } else {
    const { error: caseUpErr } = await supabase
      .from("fi_cases")
      .update({
        patient_id: patientId,
        foundation_patient_id: patientId,
        metadata: caseMetadata,
        updated_at: now,
      })
      .eq("tenant_id", tenantId)
      .eq("id", caseId);
    if (caseUpErr) throw new Error(caseUpErr.message);
  }

  const { data: existingImage } = await supabase
    .from("fi_patient_images")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .eq("case_id", caseId)
    .contains("metadata", { [VISUAL_SUMMARY_E2E_FIXTURE_METADATA_FLAG]: true })
    .maybeSingle();

  if (!existingImage) {
    const { error: imageErr } = await supabase.from("fi_patient_images").insert({
      tenant_id: tenantId,
      patient_id: patientId,
      case_id: caseId,
      clinic_id: clinicId,
      storage_bucket: "patient-images",
      storage_path: `${tenantId}/${patientId}/e2e-visual-summary-placeholder.jpg`,
      image_category: "post_op",
      imaging_protocol_slot_slug: "immediate_post_op",
      metadata: {
        [VISUAL_SUMMARY_E2E_FIXTURE_METADATA_FLAG]: true,
        fixture_key: VISUAL_SUMMARY_E2E_FIXTURE_KEY,
      },
      created_at: now,
      updated_at: now,
    });
    if (imageErr) {
      warnings.push(`Eligible capture image not created: ${imageErr.message}`);
    } else {
      created.image = true;
    }
  }

  const env: Record<string, string> = {
    FI_E2E_TENANT_ID: tenantId,
    FI_E2E_VISUAL_SUMMARY_CASE_ID: caseId,
    FI_E2E_VISUAL_SUMMARY_PATIENT_ID: patientId,
    FI_E2E_PATIENT_PORTAL_EMAIL: portalEmail,
    FI_E2E_PATIENT_PORTAL_PASSWORD: portalPassword,
    FI_E2E_ALLOW_MUTATIONS: "1",
  };

  return {
    ok: true,
    tenantId,
    patientId,
    caseId,
    portalEmail,
    portalPassword,
    created,
    env,
    warnings,
  };
}