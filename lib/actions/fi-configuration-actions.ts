"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  clinicBelongsToTenant,
  organisationBelongsToTenant,
  upsertFiClinicSettings,
  upsertFiOrganisationSettings,
  upsertFiTenantSettings,
  type WriteFiClinicSettingsPayload,
  type WriteFiOrganisationSettingsPayload,
  type WriteFiTenantSettingsPayload,
} from "@/src/lib/fi/foundation/tenantSettings";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return UUID_RE.test(v.trim());
}

function requireFiAdminKey(adminKey: string): { ok: true } | { ok: false; error: string } {
  const expected = process.env.FI_ADMIN_API_KEY?.trim();
  if (!expected) {
    return { ok: false, error: "FI_ADMIN_API_KEY is not configured on the server." };
  }
  if (!adminKey || adminKey.trim() !== expected) {
    return { ok: false, error: "Invalid or missing admin key." };
  }
  return { ok: true };
}

function trimToNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function optionalBoundedText(v: unknown, max: number, label: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const raw = trimToNull(v);
  if (raw === null) return { ok: true, value: null };
  if (raw.length > max) return { ok: false, error: `${label} is too long (max ${max} characters).` };
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(raw)) {
    return { ok: false, error: `${label} contains invalid characters.` };
  }
  return { ok: true, value: raw };
}

/** Like optionalBoundedText but allows newline, carriage return, and tab (for address blocks). */
function optionalMultilineBoundedText(
  v: unknown,
  max: number,
  label: string
): { ok: true; value: string | null } | { ok: false; error: string } {
  const raw = trimToNull(v);
  if (raw === null) return { ok: true, value: null };
  if (raw.length > max) return { ok: false, error: `${label} is too long (max ${max} characters).` };
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw)) {
    return { ok: false, error: `${label} contains invalid characters.` };
  }
  return { ok: true, value: raw };
}

function optionalHttpUrl(v: unknown, label: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const raw = trimToNull(v);
  if (raw === null) return { ok: true, value: null };
  const lower = raw.toLowerCase();
  if (!lower.startsWith("https://") && !lower.startsWith("http://")) {
    return { ok: false, error: `${label} must be empty or start with http:// or https://.` };
  }
  if (raw.length > 2048) return { ok: false, error: `${label} is too long.` };
  return { ok: true, value: raw };
}

function optionalEmail(v: unknown, label: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const raw = trimToNull(v);
  if (raw === null) return { ok: true, value: null };
  if (raw.length > 254) return { ok: false, error: `${label} is too long.` };
  const simple = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!simple.test(raw)) return { ok: false, error: `${label} does not look like a valid email address.` };
  return { ok: true, value: raw };
}

function optionalColour(v: unknown, label: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const raw = trimToNull(v);
  if (raw === null) return { ok: true, value: null };
  if (raw.length > 32) return { ok: false, error: `${label} is too long.` };
  if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(raw)) {
    return { ok: false, error: `${label} must be empty or a hex colour like #abc or #aabbcc.` };
  }
  return { ok: true, value: raw };
}

function optionalTimezone(v: unknown, label: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const raw = trimToNull(v);
  if (raw === null) return { ok: true, value: null };
  if (raw.length > 64) return { ok: false, error: `${label} is too long.` };
  if (!/^[A-Za-z0-9_/+\-.]+$/.test(raw)) {
    return { ok: false, error: `${label} may only contain letters, numbers, and / _ + - .` };
  }
  return { ok: true, value: raw };
}

async function assertTenantExists(tenantId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const { data, error } = await supabase.from("fi_tenants").select("id").eq("id", tid).maybeSingle();
  if (error) return { ok: false, error: "Could not verify tenant." };
  if (!data) return { ok: false, error: "Tenant not found." };
  return { ok: true };
}

export async function upsertTenantSettingsAction(input: {
  adminKey: string;
  tenantId: string;
  brand_name?: string;
  logo_url?: string;
  primary_colour?: string;
  secondary_colour?: string;
  accent_colour?: string;
  support_email?: string;
  default_timezone?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = requireFiAdminKey(input.adminKey);
  if (!gate.ok) return gate;

  const tenantId = trimToNull(input.tenantId);
  if (!tenantId || !isUuid(tenantId)) return { ok: false, error: "Invalid tenant id." };

  const t = await assertTenantExists(tenantId);
  if (!t.ok) return t;

  const brand = optionalBoundedText(input.brand_name, 200, "Brand name");
  if (!brand.ok) return brand;
  const logo = optionalHttpUrl(input.logo_url, "Logo URL");
  if (!logo.ok) return logo;
  const p1 = optionalColour(input.primary_colour, "Primary colour");
  if (!p1.ok) return p1;
  const p2 = optionalColour(input.secondary_colour, "Secondary colour");
  if (!p2.ok) return p2;
  const p3 = optionalColour(input.accent_colour, "Accent colour");
  if (!p3.ok) return p3;
  const em = optionalEmail(input.support_email, "Support email");
  if (!em.ok) return em;
  const tz = optionalTimezone(input.default_timezone, "Default timezone");
  if (!tz.ok) return tz;

  const payload: WriteFiTenantSettingsPayload = {
    brand_name: brand.value,
    logo_url: logo.value,
    primary_colour: p1.value,
    secondary_colour: p2.value,
    accent_colour: p3.value,
    support_email: em.value,
    default_timezone: tz.value,
  };

  try {
    await upsertFiTenantSettings(tenantId, payload);
    revalidatePath(`/fi-admin/${tenantId}/configuration`);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function upsertOrganisationSettingsAction(input: {
  adminKey: string;
  tenantId: string;
  organisationId: string;
  brand_name?: string;
  logo_url?: string;
  primary_colour?: string;
  secondary_colour?: string;
  accent_colour?: string;
  website_url?: string;
  support_email?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = requireFiAdminKey(input.adminKey);
  if (!gate.ok) return gate;

  const tenantId = trimToNull(input.tenantId);
  const organisationId = trimToNull(input.organisationId);
  if (!tenantId || !isUuid(tenantId)) return { ok: false, error: "Invalid tenant id." };
  if (!organisationId || !isUuid(organisationId)) return { ok: false, error: "Invalid organisation id." };

  const t = await assertTenantExists(tenantId);
  if (!t.ok) return t;

  let belongs = false;
  try {
    belongs = await organisationBelongsToTenant(tenantId, organisationId);
  } catch {
    return { ok: false, error: "Could not verify organisation for tenant." };
  }
  if (!belongs) return { ok: false, error: "Organisation not found for this tenant." };

  const brand = optionalBoundedText(input.brand_name, 200, "Brand name");
  if (!brand.ok) return brand;
  const logo = optionalHttpUrl(input.logo_url, "Logo URL");
  if (!logo.ok) return logo;
  const p1 = optionalColour(input.primary_colour, "Primary colour");
  if (!p1.ok) return p1;
  const p2 = optionalColour(input.secondary_colour, "Secondary colour");
  if (!p2.ok) return p2;
  const p3 = optionalColour(input.accent_colour, "Accent colour");
  if (!p3.ok) return p3;
  const web = optionalHttpUrl(input.website_url, "Website URL");
  if (!web.ok) return web;
  const em = optionalEmail(input.support_email, "Support email");
  if (!em.ok) return em;

  const payload: WriteFiOrganisationSettingsPayload = {
    organisation_id: organisationId,
    brand_name: brand.value,
    logo_url: logo.value,
    primary_colour: p1.value,
    secondary_colour: p2.value,
    accent_colour: p3.value,
    website_url: web.value,
    support_email: em.value,
  };

  try {
    await upsertFiOrganisationSettings(tenantId, payload);
    revalidatePath(`/fi-admin/${tenantId}/configuration`);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function upsertClinicSettingsAction(input: {
  adminKey: string;
  tenantId: string;
  clinicId: string;
  display_name?: string;
  booking_url?: string;
  public_intake_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  timezone?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = requireFiAdminKey(input.adminKey);
  if (!gate.ok) return gate;

  const tenantId = trimToNull(input.tenantId);
  const clinicId = trimToNull(input.clinicId);
  if (!tenantId || !isUuid(tenantId)) return { ok: false, error: "Invalid tenant id." };
  if (!clinicId || !isUuid(clinicId)) return { ok: false, error: "Invalid clinic id." };

  const t = await assertTenantExists(tenantId);
  if (!t.ok) return t;

  let belongs = false;
  try {
    belongs = await clinicBelongsToTenant(tenantId, clinicId);
  } catch {
    return { ok: false, error: "Could not verify clinic for tenant." };
  }
  if (!belongs) return { ok: false, error: "Clinic not found for this tenant." };

  const display = optionalBoundedText(input.display_name, 200, "Display name");
  if (!display.ok) return display;
  const book = optionalHttpUrl(input.booking_url, "Booking URL");
  if (!book.ok) return book;
  const intake = optionalHttpUrl(input.public_intake_url, "Public intake URL");
  if (!intake.ok) return intake;
  const phone = optionalBoundedText(input.phone, 64, "Phone");
  if (!phone.ok) return phone;
  const em = optionalEmail(input.email, "Clinic email");
  if (!em.ok) return em;
  const addr = optionalMultilineBoundedText(input.address, 2000, "Address");
  if (!addr.ok) return addr;
  const tz = optionalTimezone(input.timezone, "Timezone");
  if (!tz.ok) return tz;

  const payload: WriteFiClinicSettingsPayload = {
    clinic_id: clinicId,
    display_name: display.value,
    booking_url: book.value,
    public_intake_url: intake.value,
    phone: phone.value,
    email: em.value,
    address: addr.value,
    timezone: tz.value,
  };

  try {
    await upsertFiClinicSettings(tenantId, payload);
    revalidatePath(`/fi-admin/${tenantId}/configuration`);
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}
