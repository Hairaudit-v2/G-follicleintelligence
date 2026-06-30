import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  insertFiStaff,
  loadStaffMemberForTenant,
  updateFiStaff,
} from "@/src/lib/staff/staff.server";
import type { NexusProvisionPayload } from "@/src/lib/nexus/nexusProvisioningTypes";
import { WORKFORCE_IDENTITY_SOURCE_SYSTEMS } from "@/src/lib/workforce-os/workforceIdentitySources";
import { sanitizeWorkforceIdentityMetadata } from "@/src/lib/workforce-os/workforceIdentityMetadata";
import {
  getStaffIdentityLinksByExternalId,
  upsertStaffIdentityLink,
} from "@/src/lib/workforce-os/workforceIdentityLinks.server";

export type NexusFiStaffBridgeResult = {
  staffId: string;
  createdStaff: boolean;
  createdLink: boolean;
  updatedLink: boolean;
};

function emailKey(email: string | null | undefined): string | null {
  if (email == null) return null;
  const t = email.trim().toLowerCase();
  return t || null;
}

function mapNexusStaffRole(professionalType: string, staffType: string): string {
  const pt = professionalType.trim().toLowerCase();
  const st = staffType.trim().toLowerCase();
  if (pt.includes("surgeon") || st.includes("surgeon")) return "surgeon";
  if (pt.includes("nurse") || st.includes("nurse")) return "nurse";
  if (pt.includes("technician") || st.includes("technician")) return "technician";
  if (pt.includes("consult") || st.includes("consult")) return "consultant";
  if (st === "clinical") return "consultant";
  return "consultant";
}

async function findStaffByEmail(
  supabase: SupabaseClient,
  tenantId: string,
  email: string
): Promise<string | null> {
  const key = emailKey(email);
  if (!key) return null;

  const { data, error } = await supabase
    .from("fi_staff")
    .select("id")
    .eq("tenant_id", tenantId)
    .ilike("email", key)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.id ? String(data.id) : null;
}

/**
 * Materialises or updates the FI operational staff row and Nexus identity link when a global
 * professional is provisioned into a tenant. Does not duplicate Nexus records — links via
 * `fi_staff_source_ids` with `source_system = iiohr_nexus`.
 */
export async function linkNexusProfessionalToFiStaff(
  payload: NexusProvisionPayload,
  globalProfessionalId: string,
  tenantId: string,
  siteId: string | null,
  client?: SupabaseClient
): Promise<NexusFiStaffBridgeResult> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const globalId = globalProfessionalId.trim();
  const supabase = client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const existingLink = await getStaffIdentityLinksByExternalId(
    tid,
    WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_NEXUS,
    globalId,
    supabase
  );

  let staffId = existingLink?.staffId ?? null;
  let createdStaff = false;

  if (!staffId) {
    const byEmail = await findStaffByEmail(supabase, tid, payload.email);
    staffId = byEmail;
  }

  const displayName =
    payload.displayName?.trim() || payload.name?.trim() || payload.email.split("@")[0] || "Staff";
  const staffRole = mapNexusStaffRole(payload.professionalType, payload.staffType);

  if (!staffId) {
    const created = await insertFiStaff(
      tid,
      {
        full_name: displayName,
        email: payload.email.trim(),
        staff_role: staffRole,
        is_active: false,
      },
      supabase
    );
    staffId = created.id;
    createdStaff = true;
  } else {
    const existing = await loadStaffMemberForTenant(tid, staffId, supabase);
    if (existing) {
      const patch: {
        full_name?: string;
        email?: string | null;
        staff_role?: string;
      } = {};
      if (!existing.full_name?.trim() && displayName) patch.full_name = displayName;
      if (!existing.email?.trim() && payload.email?.trim()) patch.email = payload.email.trim();
      if (existing.staff_role === "needs_review" && staffRole !== "needs_review") {
        patch.staff_role = staffRole;
      }
      if (Object.keys(patch).length > 0) {
        await updateFiStaff(tid, staffId, patch, supabase);
      }
    }
  }

  const nexusProfileId = `${globalId}::${tid}`;
  const metadata = sanitizeWorkforceIdentityMetadata({
    global_professional_id: globalId,
    nexus_profile_id: nexusProfileId,
    sync_status: "active",
    primary_fi_clinic_id: siteId?.trim() || undefined,
    competency_source: "iiohr_nexus",
  });

  const hadLink = Boolean(existingLink);
  await upsertStaffIdentityLink(
    {
      tenantId: tid,
      staffId,
      sourceSystem: WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_NEXUS,
      sourceStaffId: globalId,
      metadata,
      lastSyncedAt: now,
    },
    supabase
  );

  return {
    staffId,
    createdStaff,
    createdLink: !hadLink,
    updatedLink: hadLink,
  };
}

/**
 * Marks Nexus identity link as revoked on provisioning rollback. Does not delete `fi_staff`.
 */
export async function markNexusIdentityLinkRevoked(
  tenantId: string,
  globalProfessionalId: string,
  client?: SupabaseClient
): Promise<void> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const globalId = globalProfessionalId.trim();
  const supabase = client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const link = await getStaffIdentityLinksByExternalId(
    tid,
    WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_NEXUS,
    globalId,
    supabase
  );
  if (!link) return;

  await upsertStaffIdentityLink(
    {
      tenantId: tid,
      staffId: link.staffId,
      sourceSystem: WORKFORCE_IDENTITY_SOURCE_SYSTEMS.IIOHR_NEXUS,
      sourceStaffId: globalId,
      metadata: { sync_status: "revoked" },
      lastSyncedAt: now,
    },
    supabase
  );
}
