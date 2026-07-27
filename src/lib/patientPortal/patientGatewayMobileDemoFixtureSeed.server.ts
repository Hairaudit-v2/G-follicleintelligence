/**
 * FI-PATIENT-APP-2A.1 — idempotent synthetic fixture for mobile gateway auth parity.
 * Approved demo-data path: creates/links portal auth without touching golden SMOKETEST patients.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  PATIENT_GATEWAY_MOBILE_DEMO_BOOKING_FLAG,
  PATIENT_GATEWAY_MOBILE_DEMO_EMAIL_DEFAULT,
  PATIENT_GATEWAY_MOBILE_DEMO_FIXTURE_FLAG,
  PATIENT_GATEWAY_MOBILE_DEMO_FIXTURE_KEY,
} from "./patientGatewayMobileDemoFixtureCore";

export type PatientGatewayMobileDemoFixtureResult = {
  ok: true;
  tenantId: string;
  patientId: string;
  personId: string;
  authUserId: string;
  portalEmail: string;
  /** Present only for operator local use — never log in audits/evidence. */
  portalPassword: string;
  created: {
    person: boolean;
    patient: boolean;
    authUser: boolean;
    bookings: boolean;
  };
  warnings: string[];
};

type SeedOpts = {
  tenantId: string;
  portalEmail?: string;
  portalPassword?: string;
  client?: SupabaseClient;
};

function fixtureEmail(opts: SeedOpts): string {
  return (
    opts.portalEmail?.trim() ||
    process.env.FI_E2E_PATIENT_GATEWAY_MOBILE_EMAIL?.trim() ||
    PATIENT_GATEWAY_MOBILE_DEMO_EMAIL_DEFAULT
  );
}

function fixturePassword(opts: SeedOpts): string {
  return (
    opts.portalPassword?.trim() ||
    process.env.FI_E2E_PATIENT_GATEWAY_MOBILE_PASSWORD?.trim() ||
    "E2ePatientGatewayMobile!2026"
  );
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
      if ((meta as Record<string, unknown>)[PATIENT_GATEWAY_MOBILE_DEMO_FIXTURE_FLAG] === true) {
        return {
          id: String((row as { id: string }).id),
          person_id: String((row as { person_id: string }).person_id),
        };
      }
    }
  }
  return null;
}

async function ensureFixtureAppointments(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    patientId: string;
    personId: string;
    clinicId: string | null;
  }
): Promise<{ created: boolean; warning?: string }> {
  const { data: existing, error: existingErr } = await supabase
    .from("fi_bookings")
    .select("id, metadata")
    .eq("tenant_id", opts.tenantId)
    .eq("patient_id", opts.patientId)
    .limit(50);
  if (existingErr) {
    return { created: false, warning: `Could not inspect fixture bookings: ${existingErr.message}` };
  }

  const hasFixtureBooking = (existing ?? []).some((row) => {
    const meta = (row as { metadata?: unknown }).metadata;
    return (
      meta &&
      typeof meta === "object" &&
      !Array.isArray(meta) &&
      (meta as Record<string, unknown>)[PATIENT_GATEWAY_MOBILE_DEMO_BOOKING_FLAG] === true
    );
  });
  if (hasFixtureBooking) {
    return { created: false };
  }

  const nowMs = Date.now();
  const upcomingStart = new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString();
  const upcomingEnd = new Date(nowMs + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString();
  const pastStart = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString();
  const pastEnd = new Date(nowMs - 30 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString();
  const now = new Date(nowMs).toISOString();
  const fixtureMeta = {
    [PATIENT_GATEWAY_MOBILE_DEMO_BOOKING_FLAG]: true,
    fixture_key: PATIENT_GATEWAY_MOBILE_DEMO_FIXTURE_KEY,
  };

  const rows = [
    {
      tenant_id: opts.tenantId,
      patient_id: opts.patientId,
      person_id: opts.personId,
      clinic_id: opts.clinicId,
      room_id: null,
      room_required: false,
      assigned_staff_id: null,
      assigned_user_id: null,
      booking_type: "prp",
      booking_status: "confirmed",
      title: "PRP Treatment",
      description: null,
      start_at: upcomingStart,
      end_at: upcomingEnd,
      timezone: "Australia/Sydney",
      location: null,
      metadata: fixtureMeta,
      cancelled_at: null,
      cancelled_by_user_id: null,
      cancellation_reason: null,
      created_by_user_id: null,
      created_at: now,
      updated_at: now,
    },
    {
      tenant_id: opts.tenantId,
      patient_id: opts.patientId,
      person_id: opts.personId,
      clinic_id: opts.clinicId,
      room_id: null,
      room_required: false,
      assigned_staff_id: null,
      assigned_user_id: null,
      booking_type: "consultation",
      booking_status: "completed",
      title: "Consultation",
      description: null,
      start_at: pastStart,
      end_at: pastEnd,
      timezone: "Australia/Sydney",
      location: null,
      metadata: fixtureMeta,
      cancelled_at: null,
      cancelled_by_user_id: null,
      cancellation_reason: null,
      created_by_user_id: null,
      created_at: now,
      updated_at: now,
    },
  ];

  const { error: insertErr } = await supabase.from("fi_bookings").insert(rows);
  if (insertErr) {
    return { created: false, warning: `Could not seed fixture bookings: ${insertErr.message}` };
  }
  return { created: true };
}

/**
 * Ensure one unambiguous:
 * auth.users → fi_patients.portal_auth_user_id → active patient + person + tenant
 */
export async function seedPatientGatewayMobileDemoFixture(
  opts: SeedOpts
): Promise<PatientGatewayMobileDemoFixtureResult> {
  const warnings: string[] = [];
  const supabase = opts.client ?? supabaseAdmin();
  const tenantId = opts.tenantId.trim();
  if (!tenantId) throw new Error("tenantId is required.");

  const portalEmail = fixtureEmail(opts);
  const portalPassword = fixturePassword(opts);
  const now = new Date().toISOString();
  const created = { person: false, patient: false, authUser: false, bookings: false };

  const { authUserId, created: authCreated } = await ensurePortalAuthUser(
    supabase,
    portalEmail,
    portalPassword
  );
  created.authUser = authCreated;

  const clinicId = await loadFirstClinicId(supabase, tenantId);
  if (!clinicId) {
    warnings.push("No clinic found for tenant; patient created without primary_clinic_id.");
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
        patient_status: "active",
        updated_at: now,
      })
      .eq("tenant_id", tenantId)
      .eq("id", patientId);
    if (linkErr) throw new Error(linkErr.message);
  } else {
    const personMetadata = {
      display_name: "E2E Patient Gateway Mobile",
      preferred_name: "Gateway Demo",
      email: portalEmail,
      email_normalized: portalEmail.toLowerCase(),
      [PATIENT_GATEWAY_MOBILE_DEMO_FIXTURE_FLAG]: true,
      fixture_key: PATIENT_GATEWAY_MOBILE_DEMO_FIXTURE_KEY,
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
      [PATIENT_GATEWAY_MOBILE_DEMO_FIXTURE_FLAG]: true,
      fixture_key: PATIENT_GATEWAY_MOBILE_DEMO_FIXTURE_KEY,
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

  // Fail closed if another patient already owns this portal link (ambiguous).
  const { data: linkRows, error: linkCheckErr } = await supabase
    .from("fi_patients")
    .select("id")
    .eq("portal_auth_user_id", authUserId)
    .limit(3);
  if (linkCheckErr) throw new Error(linkCheckErr.message);
  if ((linkRows ?? []).length !== 1) {
    throw new Error(
      `Portal mapping is not unique for mobile demo fixture (count=${(linkRows ?? []).length}).`
    );
  }

  const bookingSeed = await ensureFixtureAppointments(supabase, {
    tenantId,
    patientId,
    personId,
    clinicId,
  });
  created.bookings = bookingSeed.created;
  if (bookingSeed.warning) warnings.push(bookingSeed.warning);

  return {
    ok: true,
    tenantId,
    patientId,
    personId,
    authUserId,
    portalEmail,
    portalPassword,
    created,
    warnings,
  };
}
