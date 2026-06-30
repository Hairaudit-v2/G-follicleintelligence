import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isProductionEnv } from "@/src/lib/env/zod-helpers";
import {
  buildEnterpriseDemoTenantMetadata,
  ENTERPRISE_DEMO_CLINICS,
  ENTERPRISE_DEMO_TENANT_NAME,
  ENTERPRISE_DEMO_TENANT_SLUG,
  isEnterpriseDemoTenantMetadata,
} from "./enterpriseDemoConstants";
import { seedEnterpriseDemoStaffHierarchy } from "./enterpriseDemoStaffSeed.server";
import { seedEnterpriseDemoPatientsAndConsultations } from "./enterpriseDemoPatientsSeed.server";
import { seedEnterpriseDemoSurgeries } from "./enterpriseDemoSurgeriesSeed.server";
import { seedEnterpriseDemoImagingAndAudit } from "./enterpriseDemoImagingAuditSeed.server";
import { seedEnterpriseDemoFinancialOs } from "./enterpriseDemoFinancialSeed.server";
import {
  ENTERPRISE_DEMO_DEFAULT_VOLUME,
  type EnterpriseDemoVolumeOptions,
} from "./enterpriseDemoVolumeOptions";

export type EnterpriseDemoSeedResult = {
  ok: boolean;
  /** Primary failure reason when `ok` is false (guard, tenant refusal, or thrown error message). */
  error?: string;
  tenantSlug: string;
  tenantId?: string;
  createdTenant: boolean;
  createdClinics: number;
  existingClinics: number;
  createdStaff: number;
  existingStaff: number;
  updatedStaffLinks: number;
  createdPatients: number;
  existingPatients: number;
  createdConsultations: number;
  existingConsultations: number;
  createdClinicalDetails: number;
  existingClinicalDetails: number;
  createdCases: number;
  existingCases: number;
  createdBookings: number;
  existingBookings: number;
  createdSurgeries: number;
  existingSurgeries: number;
  createdTeamAssignments: number;
  existingTeamAssignments: number;
  createdGraftSessions: number;
  existingGraftSessions: number;
  createdGraftEvents: number;
  existingGraftEvents: number;
  createdImages: number;
  existingImages: number;
  createdProtocolSessions: number;
  existingProtocolSessions: number;
  createdOutcomeAudits: number;
  existingOutcomeAudits: number;
  createdInvoices: number;
  existingInvoices: number;
  createdInvoiceItems: number;
  createdPaymentRequests: number;
  existingPaymentRequests: number;
  createdPayments: number;
  existingPayments: number;
  updatedCaseFranchiseRisk: number;
  existingCaseFranchiseRisk: number;
  updatedBookingFinancialStatus: number;
  linkedConsultations: number;
  createdDemoUsers: number;
  warnings: string[];
};

type TenantRow = {
  id: string;
  name: string;
  slug: string;
};

type ClinicRow = {
  id: string;
  display_name: string;
  metadata: Record<string, unknown> | null;
};

function clinicMetadataSlug(row: ClinicRow): string | null {
  const slug = row.metadata?.slug;
  return typeof slug === "string" && slug.trim() ? slug.trim() : null;
}

function findClinicBySlug(rows: ClinicRow[], slug: string): ClinicRow | undefined {
  return rows.find((row) => clinicMetadataSlug(row) === slug);
}

export function assertEnterpriseDemoSeedAllowed(
  env: NodeJS.ProcessEnv = process.env
): { ok: true } | { ok: false; reason: string } {
  const allowProductionSeed = env.ALLOW_ENTERPRISE_DEMO_SEED === "true";
  if (isProductionEnv(env) && !allowProductionSeed) {
    return {
      ok: false,
      reason:
        "Production environment detected. Set ALLOW_ENTERPRISE_DEMO_SEED=true to seed the enterprise demo tenant.",
    };
  }
  return { ok: true };
}

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

async function findOrCreateDemoTenant(
  supabase: SupabaseClient
): Promise<
  | { ok: true; tenantId: string; createdTenant: boolean }
  | { ok: false; reason: string; tenantId?: string }
> {
  const { data: existing, error: findErr } = await supabase
    .from("fi_tenants")
    .select("id, name, slug")
    .eq("slug", ENTERPRISE_DEMO_TENANT_SLUG)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);

  if (existing?.id) {
    const tenantId = String((existing as TenantRow).id);
    const metadata = await loadTenantSettingsMetadata(supabase, tenantId);
    if (!isEnterpriseDemoTenantMetadata(metadata)) {
      return {
        ok: false,
        reason: `Tenant slug "${ENTERPRISE_DEMO_TENANT_SLUG}" exists but is not marked as enterprise demo mode. Refusing to modify a non-demo tenant.`,
        tenantId,
      };
    }
    return { ok: true, tenantId, createdTenant: false };
  }

  const { data: inserted, error: insErr } = await supabase
    .from("fi_tenants")
    .insert({ name: ENTERPRISE_DEMO_TENANT_NAME, slug: ENTERPRISE_DEMO_TENANT_SLUG })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);

  const tenantId = String((inserted as { id: string }).id);
  const now = new Date().toISOString();
  const { error: settingsErr } = await supabase.from("fi_tenant_settings").insert({
    tenant_id: tenantId,
    brand_name: ENTERPRISE_DEMO_TENANT_NAME,
    default_timezone: "UTC",
    metadata: buildEnterpriseDemoTenantMetadata(),
    created_at: now,
    updated_at: now,
  });
  if (settingsErr) throw new Error(settingsErr.message);

  return { ok: true, tenantId, createdTenant: true };
}

async function bumpDemoTenantVersionMetadata(
  supabase: SupabaseClient,
  tenantId: string
): Promise<void> {
  const metadata = await loadTenantSettingsMetadata(supabase, tenantId);
  if (!metadata || !isEnterpriseDemoTenantMetadata(metadata)) return;

  const nextMetadata = {
    ...metadata,
    ...buildEnterpriseDemoTenantMetadata(),
  };

  const { error } = await supabase
    .from("fi_tenant_settings")
    .update({
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
}

async function seedDemoClinics(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ createdClinics: number; existingClinics: number; warnings: string[] }> {
  const warnings: string[] = [];
  let createdClinics = 0;
  let existingClinics = 0;

  const { data: clinicRows, error: clinicErr } = await supabase
    .from("fi_clinics")
    .select("id, display_name, metadata")
    .eq("tenant_id", tenantId);
  if (clinicErr) throw new Error(clinicErr.message);

  const existingRows = (clinicRows ?? []).map((row) => {
    const raw = row as { id: string; display_name: string; metadata: unknown };
    const metadata =
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null;
    return {
      id: String(raw.id),
      display_name: String(raw.display_name),
      metadata,
    } satisfies ClinicRow;
  });

  const now = new Date().toISOString();

  for (const clinic of ENTERPRISE_DEMO_CLINICS) {
    const hit = findClinicBySlug(existingRows, clinic.slug);
    if (hit) {
      existingClinics += 1;
      continue;
    }

    const nameCollision = existingRows.find((row) => row.display_name === clinic.name);
    if (nameCollision) {
      warnings.push(
        `Clinic "${clinic.name}" exists without demo slug metadata; skipped insert for slug "${clinic.slug}".`
      );
      existingClinics += 1;
      continue;
    }

    const clinicMetadata = {
      slug: clinic.slug,
      timezone: clinic.timezone,
      country: clinic.country,
      city: clinic.city,
      enterprise_demo_clinic: true,
    };

    const { data: insertedClinic, error: insClinicErr } = await supabase
      .from("fi_clinics")
      .insert({
        tenant_id: tenantId,
        display_name: clinic.name,
        metadata: clinicMetadata,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();
    if (insClinicErr) throw new Error(insClinicErr.message);

    const clinicId = String((insertedClinic as { id: string }).id);
    const { error: clinicSettingsErr } = await supabase.from("fi_clinic_settings").insert({
      tenant_id: tenantId,
      clinic_id: clinicId,
      display_name: clinic.name,
      timezone: clinic.timezone,
      metadata: {
        slug: clinic.slug,
        country: clinic.country,
        city: clinic.city,
      },
      created_at: now,
      updated_at: now,
    });
    if (clinicSettingsErr) throw new Error(clinicSettingsErr.message);

    existingRows.push({
      id: clinicId,
      display_name: clinic.name,
      metadata: clinicMetadata,
    });
    createdClinics += 1;
  }

  return { createdClinics, existingClinics, warnings };
}

export async function seedEnterpriseDemoTenant(opts?: {
  supabase?: SupabaseClient;
  env?: NodeJS.ProcessEnv;
  volume?: EnterpriseDemoVolumeOptions;
}): Promise<EnterpriseDemoSeedResult> {
  const env = opts?.env ?? process.env;
  const volume: EnterpriseDemoVolumeOptions = opts?.volume ?? ENTERPRISE_DEMO_DEFAULT_VOLUME;
  const warnings: string[] = [];

  const guard = assertEnterpriseDemoSeedAllowed(env);
  if (!guard.ok) {
    console.error("[enterprise-demo] Seed blocked:", guard.reason);
    return {
      ok: false,
      error: guard.reason,
      tenantSlug: ENTERPRISE_DEMO_TENANT_SLUG,
      createdTenant: false,
      createdClinics: 0,
      existingClinics: 0,
      createdStaff: 0,
      existingStaff: 0,
      updatedStaffLinks: 0,
      createdPatients: 0,
      existingPatients: 0,
      createdConsultations: 0,
      existingConsultations: 0,
      createdClinicalDetails: 0,
      existingClinicalDetails: 0,
      createdCases: 0,
      existingCases: 0,
      createdBookings: 0,
      existingBookings: 0,
      createdSurgeries: 0,
      existingSurgeries: 0,
      createdTeamAssignments: 0,
      existingTeamAssignments: 0,
      createdGraftSessions: 0,
      existingGraftSessions: 0,
      createdGraftEvents: 0,
      existingGraftEvents: 0,
      createdImages: 0,
      existingImages: 0,
      createdProtocolSessions: 0,
      existingProtocolSessions: 0,
      createdOutcomeAudits: 0,
      existingOutcomeAudits: 0,
      createdInvoices: 0,
      existingInvoices: 0,
      createdInvoiceItems: 0,
      createdPaymentRequests: 0,
      existingPaymentRequests: 0,
      createdPayments: 0,
      existingPayments: 0,
      updatedCaseFranchiseRisk: 0,
      existingCaseFranchiseRisk: 0,
      updatedBookingFinancialStatus: 0,
      linkedConsultations: 0,
      createdDemoUsers: 0,
      warnings: [guard.reason],
    };
  }

  const supabase = opts?.supabase ?? supabaseAdmin();

  try {
    console.log("[enterprise-demo] Resolving demo tenant...");
    const tenantResult = await findOrCreateDemoTenant(supabase);
    if (!tenantResult.ok) {
      console.error("[enterprise-demo] Tenant resolution failed:", tenantResult.reason);
      return {
        ok: false,
        error: tenantResult.reason,
        tenantSlug: ENTERPRISE_DEMO_TENANT_SLUG,
        tenantId: tenantResult.tenantId,
        createdTenant: false,
        createdClinics: 0,
        existingClinics: 0,
        createdStaff: 0,
        existingStaff: 0,
        updatedStaffLinks: 0,
        createdPatients: 0,
        existingPatients: 0,
        createdConsultations: 0,
        existingConsultations: 0,
        createdClinicalDetails: 0,
        existingClinicalDetails: 0,
        createdCases: 0,
        existingCases: 0,
        createdBookings: 0,
        existingBookings: 0,
        createdSurgeries: 0,
        existingSurgeries: 0,
        createdTeamAssignments: 0,
        existingTeamAssignments: 0,
        createdGraftSessions: 0,
        existingGraftSessions: 0,
        createdGraftEvents: 0,
        existingGraftEvents: 0,
        createdImages: 0,
        existingImages: 0,
        createdProtocolSessions: 0,
        existingProtocolSessions: 0,
        createdOutcomeAudits: 0,
        existingOutcomeAudits: 0,
        createdInvoices: 0,
        existingInvoices: 0,
        createdInvoiceItems: 0,
        createdPaymentRequests: 0,
        existingPaymentRequests: 0,
        createdPayments: 0,
        existingPayments: 0,
        updatedCaseFranchiseRisk: 0,
        existingCaseFranchiseRisk: 0,
        updatedBookingFinancialStatus: 0,
        linkedConsultations: 0,
        createdDemoUsers: 0,
        warnings: [tenantResult.reason],
      };
    }

    await bumpDemoTenantVersionMetadata(supabase, tenantResult.tenantId);
    console.log("[enterprise-demo] Tenant ready:", tenantResult.tenantId);

    console.log("[enterprise-demo] Seeding clinics...");
    const clinicResult = await seedDemoClinics(supabase, tenantResult.tenantId);
    console.log(
      "[enterprise-demo] Clinics:",
      clinicResult.createdClinics,
      "created,",
      clinicResult.existingClinics,
      "existing"
    );
    warnings.push(...clinicResult.warnings);

    console.log("[enterprise-demo] Seeding staff hierarchy...");
    const staffResult = await seedEnterpriseDemoStaffHierarchy(supabase, tenantResult.tenantId);
    console.log(
      "[enterprise-demo] Staff:",
      staffResult.createdStaff,
      "created,",
      staffResult.existingStaff,
      "existing"
    );
    warnings.push(...staffResult.warnings);

    console.log("[enterprise-demo] Seeding patients and consultations...");
    const patientsResult = await seedEnterpriseDemoPatientsAndConsultations(
      supabase,
      tenantResult.tenantId,
      volume
    );
    console.log(
      "[enterprise-demo] Patients:",
      patientsResult.createdPatients,
      "created,",
      patientsResult.existingPatients,
      "existing"
    );
    warnings.push(...patientsResult.warnings);

    console.log("[enterprise-demo] Seeding surgeries...");
    const surgeriesResult = await seedEnterpriseDemoSurgeries(
      supabase,
      tenantResult.tenantId,
      volume
    );
    warnings.push(...surgeriesResult.warnings);

    console.log("[enterprise-demo] Seeding imaging and audit...");
    const imagingAuditResult = await seedEnterpriseDemoImagingAndAudit(
      supabase,
      tenantResult.tenantId,
      volume
    );
    warnings.push(...imagingAuditResult.warnings);

    console.log("[enterprise-demo] Seeding financial OS...");
    const financialResult = await seedEnterpriseDemoFinancialOs(
      supabase,
      tenantResult.tenantId,
      volume
    );
    warnings.push(...financialResult.warnings);
    console.log("[enterprise-demo] Core seed completed successfully");

    return {
      ok: true,
      tenantSlug: ENTERPRISE_DEMO_TENANT_SLUG,
      tenantId: tenantResult.tenantId,
      createdTenant: tenantResult.createdTenant,
      createdClinics: clinicResult.createdClinics,
      existingClinics: clinicResult.existingClinics,
      createdStaff: staffResult.createdStaff,
      existingStaff: staffResult.existingStaff,
      updatedStaffLinks: staffResult.updatedStaffLinks,
      createdPatients: patientsResult.createdPatients,
      existingPatients: patientsResult.existingPatients,
      createdConsultations: patientsResult.createdConsultations,
      existingConsultations: patientsResult.existingConsultations,
      createdClinicalDetails: patientsResult.createdClinicalDetails,
      existingClinicalDetails: patientsResult.existingClinicalDetails,
      createdCases: surgeriesResult.createdCases,
      existingCases: surgeriesResult.existingCases,
      createdBookings: surgeriesResult.createdBookings,
      existingBookings: surgeriesResult.existingBookings,
      createdSurgeries: surgeriesResult.createdSurgeries,
      existingSurgeries: surgeriesResult.existingSurgeries,
      createdTeamAssignments: surgeriesResult.createdTeamAssignments,
      existingTeamAssignments: surgeriesResult.existingTeamAssignments,
      createdGraftSessions: surgeriesResult.createdGraftSessions,
      existingGraftSessions: surgeriesResult.existingGraftSessions,
      createdGraftEvents: surgeriesResult.createdGraftEvents,
      existingGraftEvents: surgeriesResult.existingGraftEvents,
      createdImages: imagingAuditResult.createdImages,
      existingImages: imagingAuditResult.existingImages,
      createdProtocolSessions: imagingAuditResult.createdProtocolSessions,
      existingProtocolSessions: imagingAuditResult.existingProtocolSessions,
      createdOutcomeAudits: imagingAuditResult.createdOutcomeAudits,
      existingOutcomeAudits: imagingAuditResult.existingOutcomeAudits,
      createdInvoices: financialResult.createdInvoices,
      existingInvoices: financialResult.existingInvoices,
      createdInvoiceItems: financialResult.createdInvoiceItems,
      createdPaymentRequests: financialResult.createdPaymentRequests,
      existingPaymentRequests: financialResult.existingPaymentRequests,
      createdPayments: financialResult.createdPayments,
      existingPayments: financialResult.existingPayments,
      updatedCaseFranchiseRisk: financialResult.updatedCaseFranchiseRisk,
      existingCaseFranchiseRisk: financialResult.existingCaseFranchiseRisk,
      updatedBookingFinancialStatus: financialResult.updatedBookingFinancialStatus,
      linkedConsultations: surgeriesResult.linkedConsultations,
      createdDemoUsers: surgeriesResult.createdDemoUsers,
      warnings,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[enterprise-demo] Seed failed:", message);
    if (e instanceof Error && e.stack) console.error(e.stack);
    throw e;
  }
}
