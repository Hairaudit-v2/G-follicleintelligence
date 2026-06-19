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

export type EnterpriseDemoSeedResult = {
  ok: boolean;
  tenantSlug: string;
  tenantId?: string;
  createdTenant: boolean;
  createdClinics: number;
  existingClinics: number;
  createdStaff: number;
  existingStaff: number;
  updatedStaffLinks: number;
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

export async function seedEnterpriseDemoTenant(
  opts?: { supabase?: SupabaseClient; env?: NodeJS.ProcessEnv }
): Promise<EnterpriseDemoSeedResult> {
  const env = opts?.env ?? process.env;
  const warnings: string[] = [];

  const guard = assertEnterpriseDemoSeedAllowed(env);
  if (!guard.ok) {
    return {
      ok: false,
      tenantSlug: ENTERPRISE_DEMO_TENANT_SLUG,
      createdTenant: false,
      createdClinics: 0,
      existingClinics: 0,
      createdStaff: 0,
      existingStaff: 0,
      updatedStaffLinks: 0,
      warnings: [guard.reason],
    };
  }

  const supabase = opts?.supabase ?? supabaseAdmin();

  try {
    const tenantResult = await findOrCreateDemoTenant(supabase);
    if (!tenantResult.ok) {
      return {
        ok: false,
        tenantSlug: ENTERPRISE_DEMO_TENANT_SLUG,
        tenantId: tenantResult.tenantId,
        createdTenant: false,
        createdClinics: 0,
        existingClinics: 0,
        createdStaff: 0,
        existingStaff: 0,
        updatedStaffLinks: 0,
        warnings: [tenantResult.reason],
      };
    }

    await bumpDemoTenantVersionMetadata(supabase, tenantResult.tenantId);

    const clinicResult = await seedDemoClinics(supabase, tenantResult.tenantId);
    warnings.push(...clinicResult.warnings);

    const staffResult = await seedEnterpriseDemoStaffHierarchy(supabase, tenantResult.tenantId);
    warnings.push(...staffResult.warnings);

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
      warnings,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      tenantSlug: ENTERPRISE_DEMO_TENANT_SLUG,
      createdTenant: false,
      createdClinics: 0,
      existingClinics: 0,
      createdStaff: 0,
      existingStaff: 0,
      updatedStaffLinks: 0,
      warnings: [message],
    };
  }
}
