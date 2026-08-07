import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertEnterpriseDemoSeedAllowed } from "@/src/lib/enterprise-demo/enterpriseDemoSeed.server";
import { executeSandboxSeedApply } from "@/src/lib/onboarding-os/sandboxSeedApply.server";
import {
  buildClinicDeploymentPlan,
  buildSandboxSeedPlan,
} from "@/src/lib/onboarding-os/tenantProvisioningCore";
import { createPaymentRecord } from "@/src/lib/payments/paymentRecordMutations.server";

import {
  CLINIC_DEMO_CLINIC_NAME,
  CLINIC_DEMO_METADATA,
  CLINIC_DEMO_PACK_CODE,
  CLINIC_DEMO_SESSION_ID,
  CLINIC_DEMO_TEMPLATE_CODE,
  CLINIC_DEMO_TENANT_NAME,
  CLINIC_DEMO_TENANT_SLUG,
  CLINIC_DEMO_TIMEZONE,
  isClinicDemoTenantMetadata,
} from "./clinicDemoConstants";
import {
  seedClinicShowcaseJamesChen,
  type ClinicShowcaseJamesChenSeedResult,
} from "./clinicDemoShowcaseJamesChenSeed.server";

export type ClinicDemoSeedResult = {
  ok: boolean;
  tenantSlug: string;
  tenantId?: string;
  clinicId?: string;
  createdTenant: boolean;
  createdClinic: boolean;
  sandboxWarnings: string[];
  createdDeposits: number;
  existingDeposits: number;
  jamesChen?: ClinicShowcaseJamesChenSeedResult | null;
  warnings: string[];
  error?: string;
};

async function loadTenantSettingsMetadata(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("fi_tenant_settings")
    .select("metadata")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const raw = (data as { metadata?: unknown } | null)?.metadata;
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

async function findOrCreateClinicDemoTenant(
  supabase: SupabaseClient
): Promise<
  | { ok: true; tenantId: string; createdTenant: boolean }
  | { ok: false; reason: string }
> {
  const { data: existing, error: findErr } = await supabase
    .from("fi_tenants")
    .select("id, slug")
    .eq("slug", CLINIC_DEMO_TENANT_SLUG)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);

  const now = new Date().toISOString();

  if (existing?.id) {
    const tenantId = String((existing as { id: string }).id);
    const metadata = await loadTenantSettingsMetadata(supabase, tenantId);
    if (metadata && !isClinicDemoTenantMetadata(metadata)) {
      return {
        ok: false,
        reason: `Tenant slug "${CLINIC_DEMO_TENANT_SLUG}" exists but is not marked as clinic demo mode.`,
      };
    }
    await supabase
      .from("fi_tenants")
      .update({
        is_demo: true,
        is_production_visible: true,
        archived_at: null,
        archived_by: null,
        archive_reason: null,
        updated_at: now,
      })
      .eq("id", tenantId);
    return { ok: true, tenantId, createdTenant: false };
  }

  const { data: inserted, error: insErr } = await supabase
    .from("fi_tenants")
    .insert({
      name: CLINIC_DEMO_TENANT_NAME,
      slug: CLINIC_DEMO_TENANT_SLUG,
      is_demo: true,
      is_production_visible: true,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);

  const tenantId = String((inserted as { id: string }).id);
  const { error: settingsErr } = await supabase.from("fi_tenant_settings").insert({
    tenant_id: tenantId,
    brand_name: CLINIC_DEMO_TENANT_NAME,
    default_timezone: CLINIC_DEMO_TIMEZONE,
    metadata: { ...CLINIC_DEMO_METADATA },
    created_at: now,
    updated_at: now,
  });
  if (settingsErr) throw new Error(settingsErr.message);

  return { ok: true, tenantId, createdTenant: true };
}

async function findOrCreateDefaultClinic(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ clinicId: string; createdClinic: boolean }> {
  const { data: existing, error } = await supabase
    .from("fi_clinics")
    .select("id, metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  const rows = existing ?? [];
  if (rows[0]) {
    return { clinicId: String((rows[0] as { id: string }).id), createdClinic: false };
  }

  const now = new Date().toISOString();
  const { data: inserted, error: insErr } = await supabase
    .from("fi_clinics")
    .insert({
      tenant_id: tenantId,
      display_name: CLINIC_DEMO_CLINIC_NAME,
      metadata: {
        slug: CLINIC_DEMO_TENANT_SLUG,
        timezone: CLINIC_DEMO_TIMEZONE,
        clinic_demo: true,
      },
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);

  const clinicId = String((inserted as { id: string }).id);
  const { error: settingsErr } = await supabase.from("fi_clinic_settings").insert({
    tenant_id: tenantId,
    clinic_id: clinicId,
    display_name: CLINIC_DEMO_CLINIC_NAME,
    timezone: CLINIC_DEMO_TIMEZONE,
    metadata: { slug: CLINIC_DEMO_TENANT_SLUG, clinic_demo: true },
    created_at: now,
    updated_at: now,
  });
  if (settingsErr) throw new Error(settingsErr.message);

  return { clinicId, createdClinic: true };
}

async function ensurePendingDepositOnFirstSurgeryBooking(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ created: number; existing: number }> {
  const { data: bookings, error } = await supabase
    .from("fi_bookings")
    .select("id, patient_id, case_id, booking_type, start_at")
    .eq("tenant_id", tenantId)
    .eq("booking_type", "surgery")
    .order("start_at", { ascending: true })
    .limit(3);
  if (error) throw new Error(error.message);

  let created = 0;
  let existing = 0;
  for (const row of bookings ?? []) {
    const booking = row as {
      id: string;
      patient_id: string | null;
      case_id: string | null;
    };
    if (!booking.patient_id) continue;

    const { data: pay, error: findErr } = await supabase
      .from("fi_payment_records")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("booking_id", booking.id)
      .eq("payment_context", "surgery")
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (pay) {
      existing += 1;
      continue;
    }

    await createPaymentRecord(
      tenantId,
      {
        payment_context: "surgery",
        patient_id: booking.patient_id,
        case_id: booking.case_id ?? undefined,
        booking_id: booking.id,
        amount_expected: 1500,
        amount_paid: 0,
        currency: "AUD",
        status: "pending",
        notes: "Follicle Demo Clinic — outstanding surgery deposit (synthetic)",
      },
      null
    );
    created += 1;
    break;
  }
  return { created, existing };
}

export async function seedFollicleDemoClinic(opts?: {
  supabase?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
}): Promise<ClinicDemoSeedResult> {
  const env = opts?.env ?? process.env;
  const guard = assertEnterpriseDemoSeedAllowed(env);
  if (!guard.ok) {
    return {
      ok: false,
      tenantSlug: CLINIC_DEMO_TENANT_SLUG,
      createdTenant: false,
      createdClinic: false,
      sandboxWarnings: [],
      createdDeposits: 0,
      existingDeposits: 0,
      warnings: [guard.reason],
      error: guard.reason,
    };
  }

  const supabase = opts?.supabase ?? supabaseAdmin();
  const warnings: string[] = [];

  try {
    const tenant = await findOrCreateClinicDemoTenant(supabase);
    if (!tenant.ok) {
      return {
        ok: false,
        tenantSlug: CLINIC_DEMO_TENANT_SLUG,
        createdTenant: false,
        createdClinic: false,
        sandboxWarnings: [],
        createdDeposits: 0,
        existingDeposits: 0,
        warnings: [tenant.reason],
        error: tenant.reason,
      };
    }

    const clinic = await findOrCreateDefaultClinic(supabase, tenant.tenantId);
    const generatedAt = new Date().toISOString();

    const provisioningInput = {
      tenantName: CLINIC_DEMO_TENANT_NAME,
      tenantSlug: CLINIC_DEMO_TENANT_SLUG,
      defaultClinicDisplayName: CLINIC_DEMO_CLINIC_NAME,
      defaultTimezone: CLINIC_DEMO_TIMEZONE,
      firstTenantAdminEmail: "demo-admin@sandbox.fi-demo.invalid",
      deploymentTemplateCode: CLINIC_DEMO_TEMPLATE_CODE,
      sandboxSeedEnabled: true,
    };

    const deploymentPlan = buildClinicDeploymentPlan(provisioningInput);
    const plan = buildSandboxSeedPlan({
      sessionId: CLINIC_DEMO_SESSION_ID,
      tenantId: tenant.tenantId,
      tenantSlug: CLINIC_DEMO_TENANT_SLUG,
      templateCode: CLINIC_DEMO_TEMPLATE_CODE,
      deploymentPlan,
      packCode: CLINIC_DEMO_PACK_CODE,
      generatedAt,
    });
    if (!plan) {
      return {
        ok: false,
        tenantSlug: CLINIC_DEMO_TENANT_SLUG,
        tenantId: tenant.tenantId,
        clinicId: clinic.clinicId,
        createdTenant: tenant.createdTenant,
        createdClinic: clinic.createdClinic,
        sandboxWarnings: [],
        createdDeposits: 0,
        existingDeposits: 0,
        warnings: ["Failed to build sandbox seed plan"],
        error: "Failed to build sandbox seed plan for Follicle Demo Clinic.",
      };
    }

    const applied = await executeSandboxSeedApply({
      supabase,
      tenantId: tenant.tenantId,
      sessionId: CLINIC_DEMO_SESSION_ID,
      timezone: CLINIC_DEMO_TIMEZONE,
      plan,
      deploymentPlan,
      packCode: CLINIC_DEMO_PACK_CODE,
      generatedAt,
    });
    warnings.push(...applied.warnings);

    const deposits = await ensurePendingDepositOnFirstSurgeryBooking(supabase, tenant.tenantId);

    console.log("[clinic-demo] Starting James Chen Package B showcase seed");
    const jamesChen = await seedClinicShowcaseJamesChen(supabase, tenant.tenantId);
    console.log(
      "[clinic-demo] James Chen showcase seed completed: ok=",
      jamesChen.ok,
      `completeness=${jamesChen.completenessScore}`,
      jamesChen.patientId ? `patientId=${jamesChen.patientId}` : "",
      jamesChen.error ? `error=${jamesChen.error}` : ""
    );
    warnings.push(...jamesChen.warnings);
    if (!jamesChen.ok) {
      warnings.push(
        `James Chen Package B seed incomplete: ${jamesChen.error ?? "unknown error"}. Reception board data remains usable.`
      );
    }

    return {
      ok: true,
      tenantSlug: CLINIC_DEMO_TENANT_SLUG,
      tenantId: tenant.tenantId,
      clinicId: clinic.clinicId,
      createdTenant: tenant.createdTenant,
      createdClinic: clinic.createdClinic,
      sandboxWarnings: applied.warnings,
      createdDeposits: deposits.created,
      existingDeposits: deposits.existing,
      jamesChen,
      warnings,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      tenantSlug: CLINIC_DEMO_TENANT_SLUG,
      createdTenant: false,
      createdClinic: false,
      sandboxWarnings: [],
      createdDeposits: 0,
      existingDeposits: 0,
      warnings: [message],
      error: message,
    };
  }
}
