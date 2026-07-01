"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertFiTenantExists,
  isFiAdminUuid,
  requireFiAdminKey,
} from "@/lib/server/fiAdminKeyGate";
import { organisationBelongsToTenant } from "@/src/lib/fi/foundation/tenantSettings";
import type { OrganisationType } from "@/src/lib/fi/foundation/types";

const ORG_TYPES: OrganisationType[] = [
  "clinical_network",
  "commercial_partner",
  "standards_program",
  "internal",
  "other",
];

function trimToNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function requiredBoundedName(
  v: unknown,
  max: number,
  label: string
): { ok: true; value: string } | { ok: false; error: string } {
  const raw = trimToNull(v);
  if (raw === null) return { ok: false, error: `${label} is required.` };
  if (raw.length > max)
    return { ok: false, error: `${label} is too long (max ${max} characters).` };
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(raw)) {
    return { ok: false, error: `${label} contains invalid characters.` };
  }
  return { ok: true, value: raw };
}

/** Normalise and validate URL-style slug segment(s). */
function validateOrganisationSlug(
  v: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  const raw = trimToNull(v);
  if (raw === null) return { ok: false, error: "Slug is required." };
  const s = raw.toLowerCase();
  if (s.length > 80) return { ok: false, error: "Slug is too long (max 80 characters)." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) {
    return {
      ok: false,
      error:
        "Slug must use lowercase letters, digits, and single hyphens between segments (e.g. evolved-perth).",
    };
  }
  return { ok: true, value: s };
}

function parseOrganisationType(
  v: unknown
): { ok: true; value: OrganisationType } | { ok: false; error: string } {
  const s = trimToNull(v);
  if (!s) return { ok: false, error: "Organisation type is required." };
  if (!ORG_TYPES.includes(s as OrganisationType)) {
    return { ok: false, error: "Invalid organisation type." };
  }
  return { ok: true, value: s as OrganisationType };
}

export async function createFiOrganisationAction(input: {
  adminKey: string;
  tenantId: string;
  name: string;
  slug: string;
  organisation_type: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenantId = trimToNull(input.tenantId);
  if (!tenantId || !isFiAdminUuid(tenantId)) return { ok: false, error: "Invalid tenant id." };

  const gate = requireFiAdminKey(input.adminKey, tenantId);
  if (!gate.ok) return gate;

  const t = await assertFiTenantExists(tenantId);
  if (!t.ok) return t;

  const name = requiredBoundedName(input.name, 200, "Organisation name");
  if (!name.ok) return name;
  const slug = validateOrganisationSlug(input.slug);
  if (!slug.ok) return slug;
  const orgType = parseOrganisationType(input.organisation_type);
  if (!orgType.ok) return orgType;

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("fi_organisations").insert({
    tenant_id: tenantId,
    name: name.value,
    slug: slug.value,
    organisation_type: orgType.value,
    metadata: {},
  });

  if (error?.code === "23505") {
    return { ok: false, error: "An organisation with this slug already exists for this tenant." };
  }
  if (error) {
    return { ok: false, error: "Could not create organisation. Try again or contact support." };
  }

  revalidatePath(`/fi-admin/${tenantId}/directory`);
  revalidatePath(`/fi-admin/${tenantId}/configuration`);
  return { ok: true };
}

export async function createFiClinicAction(input: {
  adminKey: string;
  tenantId: string;
  display_name: string;
  organisation_id?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenantId = trimToNull(input.tenantId);
  if (!tenantId || !isFiAdminUuid(tenantId)) return { ok: false, error: "Invalid tenant id." };

  const gate = requireFiAdminKey(input.adminKey, tenantId);
  if (!gate.ok) return gate;

  const t = await assertFiTenantExists(tenantId);
  if (!t.ok) return t;

  const display = requiredBoundedName(input.display_name, 200, "Clinic display name");
  if (!display.ok) return display;

  const orgRaw = trimToNull(input.organisation_id);
  let organisationId: string | null = null;
  if (orgRaw) {
    if (!isFiAdminUuid(orgRaw)) return { ok: false, error: "Invalid organisation id." };
    let belongs = false;
    try {
      belongs = await organisationBelongsToTenant(tenantId, orgRaw);
    } catch {
      return { ok: false, error: "Could not verify organisation for this tenant." };
    }
    if (!belongs) return { ok: false, error: "Organisation not found for this tenant." };
    organisationId = orgRaw;
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("fi_clinics").insert({
    tenant_id: tenantId,
    organisation_id: organisationId,
    display_name: display.value,
    metadata: {},
  });

  if (error?.code === "23505") {
    return {
      ok: false,
      error: "This clinic could not be created because of a duplicate constraint.",
    };
  }
  if (error) {
    return { ok: false, error: "Could not create clinic. Try again or contact support." };
  }

  revalidatePath(`/fi-admin/${tenantId}/directory`);
  revalidatePath(`/fi-admin/${tenantId}/configuration`);
  return { ok: true };
}
