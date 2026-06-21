import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readFiOsNexusCreateAuthUser } from "@/src/lib/nexus/fiOsNexusEnv.server";
import { validateFiOsNexusRoleCodes } from "@/src/lib/nexus/fiOsNexusRoles";
import type {
  NexusProvisionPayload,
  ProvisionResult,
} from "@/src/lib/nexus/nexusProvisioningTypes";
import { GLOBAL_PROFESSIONAL_ID_RE, UUID_RE } from "@/src/lib/nexus/nexusProvisioningTypes";
import {
  readExternalProfessionalState,
  writeNexusProvisioningAudit,
} from "@/src/lib/nexus/readExternalProfessionalState.server";
import { logStructured } from "@/src/lib/server/structuredLog";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NexusProvisionDeps = {
  assertTenantExists: (tenantId: string) => Promise<boolean>;
  assertSiteBelongsToTenant: (siteId: string, tenantId: string) => Promise<boolean>;
};

const defaultDeps: NexusProvisionDeps = {
  async assertTenantExists(tenantId: string) {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.from("fi_tenants").select("id").eq("id", tenantId).maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data?.id);
  },
  async assertSiteBelongsToTenant(siteId: string, tenantId: string) {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("fi_clinics")
      .select("id")
      .eq("id", siteId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data?.id);
  },
};

function validateProvisionPayload(payload: NexusProvisionPayload): { ok: true } | { ok: false; error: string } {
  const globalProfessionalId = payload.globalProfessionalId?.trim() ?? "";
  if (!GLOBAL_PROFESSIONAL_ID_RE.test(globalProfessionalId)) {
    return { ok: false, error: "Invalid globalProfessionalId." };
  }

  const professionalType = payload.professionalType?.trim() ?? "";
  if (!professionalType) {
    return { ok: false, error: "professionalType is required." };
  }

  const tenantId = payload.tenantId?.trim() ?? "";
  if (!UUID_RE.test(tenantId)) {
    return { ok: false, error: "Invalid tenantId." };
  }

  const siteId = payload.siteId?.trim() ?? "";
  if (siteId && !UUID_RE.test(siteId)) {
    return { ok: false, error: "Invalid siteId." };
  }

  const email = payload.email?.trim() ?? "";
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Valid email is required." };
  }

  const staffType = payload.staffType?.trim() ?? "";
  if (!staffType) {
    return { ok: false, error: "staffType is required." };
  }

  if (!Array.isArray(payload.approvedRoles)) {
    return { ok: false, error: "approvedRoles must be an array." };
  }

  const roleValidation = validateFiOsNexusRoleCodes(payload.approvedRoles);
  if (!roleValidation.ok) {
    return { ok: false, error: `Invalid role(s): ${roleValidation.invalidRoles.join(", ")}` };
  }

  return { ok: true };
}

async function upsertExternalProfessional(
  supabase: SupabaseClient,
  payload: NexusProvisionPayload,
  globalProfessionalId: string
): Promise<void> {
  const row = {
    global_professional_id: globalProfessionalId,
    source_system: payload.sourceSystem?.trim() || "iiohr",
    email: payload.email.trim(),
    name: payload.name?.trim() || null,
    professional_type: payload.professionalType.trim(),
    certification_level: payload.certificationLevel?.trim() || null,
    deployment_ready: payload.deploymentReady ?? false,
    nexus_created: true,
  };

  const { error } = await supabase.from("fi_nexus_external_professionals").upsert(row, {
    onConflict: "global_professional_id",
  });
  if (error) throw new Error(error.message);
}

async function upsertTenantMembership(
  supabase: SupabaseClient,
  payload: NexusProvisionPayload,
  globalProfessionalId: string,
  tenantId: string,
  siteId: string | null
): Promise<void> {
  const row = {
    global_professional_id: globalProfessionalId,
    tenant_id: tenantId,
    site_id: siteId,
    membership_status: payload.membershipStatus?.trim() || "pending",
    nexus_created: true,
  };

  const { error } = await supabase.from("fi_nexus_tenant_memberships").upsert(row, {
    onConflict: "global_professional_id,tenant_id",
  });
  if (error) throw new Error(error.message);
}

async function upsertStaffProfile(
  supabase: SupabaseClient,
  payload: NexusProvisionPayload,
  globalProfessionalId: string,
  tenantId: string,
  siteId: string | null
): Promise<void> {
  const { data: existing, error: existingErr } = await supabase
    .from("fi_nexus_staff_profiles")
    .select("id, active")
    .eq("global_professional_id", globalProfessionalId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existingErr) throw new Error(existingErr.message);

  const row = {
    global_professional_id: globalProfessionalId,
    tenant_id: tenantId,
    site_id: siteId,
    staff_type: payload.staffType.trim(),
    display_name: payload.displayName?.trim() || payload.name?.trim() || null,
    email: payload.email.trim(),
    active: existing?.active ?? false,
    nexus_created: true,
  };

  const { error } = await supabase.from("fi_nexus_staff_profiles").upsert(row, {
    onConflict: "global_professional_id,tenant_id",
  });
  if (error) throw new Error(error.message);
}

async function assignApprovedRolesIdempotently(
  supabase: SupabaseClient,
  globalProfessionalId: string,
  tenantId: string,
  approvedRoles: string[]
): Promise<void> {
  for (const roleCode of approvedRoles) {
    const { data: existing, error: existingErr } = await supabase
      .from("fi_nexus_role_assignments")
      .select("id, active")
      .eq("global_professional_id", globalProfessionalId)
      .eq("tenant_id", tenantId)
      .eq("role_code", roleCode)
      .maybeSingle();

    if (existingErr) throw new Error(existingErr.message);

    if (existing?.active) {
      continue;
    }

    if (existing && !existing.active) {
      const { error: reactivateErr } = await supabase
        .from("fi_nexus_role_assignments")
        .update({
          active: true,
          revoked_at: null,
          assigned_by: "nexus",
          nexus_created: true,
        })
        .eq("id", existing.id);
      if (reactivateErr) throw new Error(reactivateErr.message);
      continue;
    }

    const { error: insertErr } = await supabase.from("fi_nexus_role_assignments").insert({
      global_professional_id: globalProfessionalId,
      tenant_id: tenantId,
      role_code: roleCode,
      assigned_by: "nexus",
      active: true,
      nexus_created: true,
    });
    if (insertErr) throw new Error(insertErr.message);
  }
}

async function maybeCreateAuthUserForNexus(payload: NexusProvisionPayload): Promise<void> {
  if (!readFiOsNexusCreateAuthUser()) return;

  logStructured("info", "nexus_auth_user_creation_skipped", {
    reason: "FI_OS_NEXUS_CREATE_AUTH_USER is enabled but auth user creation is not wired in Phase 9A.",
    email_domain: payload.email.split("@")[1] ?? null,
  });
}

export async function provisionExternalProfessionalFromNexus(
  payload: NexusProvisionPayload,
  client?: SupabaseClient,
  deps: NexusProvisionDeps = defaultDeps
): Promise<ProvisionResult> {
  const validation = validateProvisionPayload(payload);
  if (!validation.ok) {
    return { ok: false, error: validation.error, httpStatus: 400 };
  }

  const roleValidation = validateFiOsNexusRoleCodes(payload.approvedRoles);
  if (!roleValidation.ok) {
    return { ok: false, error: `Invalid role(s): ${roleValidation.invalidRoles.join(", ")}`, httpStatus: 400 };
  }

  const globalProfessionalId = payload.globalProfessionalId.trim();
  const tenantId = payload.tenantId.trim();
  const siteId = payload.siteId?.trim() || null;

  const supabase = client ?? supabaseAdmin();

  let beforeStateResult: Awaited<ReturnType<typeof readExternalProfessionalState>> | null = null;
  try {
    beforeStateResult = await readExternalProfessionalState(globalProfessionalId, supabase);
  } catch {
    beforeStateResult = null;
  }

  try {
    const tenantExists = await deps.assertTenantExists(tenantId);
    if (!tenantExists) {
      await writeNexusProvisioningAudit(
        {
          globalProfessionalId,
          actionType: "provision",
          payload: payload as unknown as Record<string, unknown>,
          result: "failure",
          failureReason: "tenant_not_found",
        },
        supabase
      );
      return { ok: false, error: "Tenant not found.", httpStatus: 404 };
    }

    if (siteId) {
      const siteValid = await deps.assertSiteBelongsToTenant(siteId, tenantId);
      if (!siteValid) {
        await writeNexusProvisioningAudit(
          {
            globalProfessionalId,
            actionType: "provision",
            payload: payload as unknown as Record<string, unknown>,
            result: "failure",
            failureReason: "site_not_found_for_tenant",
          },
          supabase
        );
        return { ok: false, error: "siteId does not belong to tenant.", httpStatus: 400 };
      }
    }

    await upsertExternalProfessional(supabase, payload, globalProfessionalId);
    await upsertTenantMembership(supabase, payload, globalProfessionalId, tenantId, siteId);
    await upsertStaffProfile(supabase, payload, globalProfessionalId, tenantId, siteId);
    await assignApprovedRolesIdempotently(supabase, globalProfessionalId, tenantId, roleValidation.roles);
    await maybeCreateAuthUserForNexus(payload);

    const stateResult = await readExternalProfessionalState(globalProfessionalId, supabase);
    if (!stateResult.ok) {
      return { ok: false, error: stateResult.error, httpStatus: stateResult.httpStatus };
    }

    await writeNexusProvisioningAudit(
      {
        globalProfessionalId,
        actionType: "provision",
        payload: payload as unknown as Record<string, unknown>,
        beforeState: beforeStateResult?.ok ? (beforeStateResult.state as unknown as Record<string, unknown>) : null,
        afterState: stateResult.state as unknown as Record<string, unknown>,
        result: "success",
      },
      supabase
    );

    return { ok: true, state: stateResult.state };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provision failed.";
    try {
      await writeNexusProvisioningAudit(
        {
          globalProfessionalId,
          actionType: "provision",
          payload: payload as unknown as Record<string, unknown>,
          result: "failure",
          failureReason: message,
        },
        supabase
      );
    } catch {
      /* best effort */
    }
    return { ok: false, error: message, httpStatus: 500 };
  }
}
