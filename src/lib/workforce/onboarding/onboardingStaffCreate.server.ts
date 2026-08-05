import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { STAFF_LIFECYCLE_AUDIT_EVENTS } from "@/src/lib/team/identity/staffLifecycleTypes";
import {
  loadIdentityLinksForTenant,
  loadStaffMembersForReconciliation,
} from "@/src/lib/workforce/identityReconciliation.server";
import {
  provisionOnboardingStaffPair,
  rollbackOnboardingStaffPair,
} from "@/src/lib/workforce/staffTenantLinkRepair.server";

import type { CreateOnboardingStaffInput } from "./onboardingTypes";
import { syncOnboardingChecklistFromState } from "./onboardingChecklist.server";
import {
  evaluateOnboardingStaffCreation,
  ONBOARDING_AUDIT_SOURCE,
  ONBOARDING_STAFF_SOURCE,
} from "./onboardingStaffCreateCore";

const ONBOARDING_SOURCE = ONBOARDING_STAFF_SOURCE;

async function insertOnboardingStaffAudit(
  supabase: SupabaseClient,
  row: {
    tenantId: string;
    staffMemberId: string;
    fiStaffId: string;
    actorFiUserId?: string | null;
    email: string;
    fullName: string;
    roleCode: string;
  }
): Promise<void> {
  const { error } = await supabase.from("fi_staff_member_audit_events").insert({
    tenant_id: row.tenantId,
    staff_member_id: row.staffMemberId,
    event_type: STAFF_LIFECYCLE_AUDIT_EVENTS.ONBOARDING_CREATED,
    source: ONBOARDING_AUDIT_SOURCE,
    metadata: {
      fi_staff_id: row.fiStaffId,
      actor_fi_user_id: row.actorFiUserId ?? null,
      email: row.email,
      full_name: row.fullName,
      role_code: row.roleCode,
      created_via: ONBOARDING_SOURCE,
    },
  });
  if (error) throw new Error(error.message);
}

/**
 * Create an onboarding staff member. Linked scheduling ↔ lifecycle provision
 * is delegated to staffTenantLinkRepair (explicit repair / provision boundary).
 */
export async function createOnboardingStaffMember(input: {
  tenantId: string;
  data: CreateOnboardingStaffInput;
  actorFiUserId?: string | null;
  client?: SupabaseClient;
}): Promise<{ staffMemberId: string; fiStaffId: string }> {
  const tid = assertNonEmptyUuid(input.tenantId, "tenantId");
  const supabase = input.client ?? supabaseAdmin();
  const now = new Date().toISOString();

  const fullName = input.data.fullName.trim();
  const email = input.data.email.trim().toLowerCase();
  if (!fullName) throw new Error("Name is required.");
  if (!email || !email.includes("@")) throw new Error("A valid email is required.");

  const [staffMembers, identityLinks] = await Promise.all([
    loadStaffMembersForReconciliation(tid, supabase),
    loadIdentityLinksForTenant(tid, supabase),
  ]);
  const creationDecision = evaluateOnboardingStaffCreation({
    tenantId: tid,
    email,
    fullName,
    staffMembers,
    identityLinks,
  });
  if (creationDecision.action === "reject") {
    throw new Error(creationDecision.message);
  }

  const roleCode = input.data.roleCode.trim() || "consultant";

  const provisioned = await provisionOnboardingStaffPair({
    tenantId: tid,
    fullName,
    email,
    roleCode,
    employmentType: input.data.employmentType,
    clinicId: input.data.clinicId,
    sourceSystem: ONBOARDING_SOURCE,
    client: supabase,
    now,
  });

  const { fiStaffId, staffMemberId, createdFiStaff } = provisioned;

  const { error: checklistError } = await supabase.from("fi_staff_onboarding_checklists").insert({
    tenant_id: tid,
    staff_member_id: staffMemberId,
    account_created: true,
    pin_chosen: false,
    permissions_assigned: false,
    training_pending: true,
    created_at: now,
    updated_at: now,
  });
  if (checklistError) {
    await rollbackOnboardingStaffPair({
      tenantId: tid,
      fiStaffId,
      staffMemberId,
      createdFiStaff,
      client: supabase,
    });
    throw new Error(checklistError.message);
  }

  try {
    await syncOnboardingChecklistFromState(tid, staffMemberId, supabase);
    await insertOnboardingStaffAudit(supabase, {
      tenantId: tid,
      staffMemberId,
      fiStaffId,
      actorFiUserId: input.actorFiUserId,
      email,
      fullName,
      roleCode,
    });
  } catch (e) {
    await rollbackOnboardingStaffPair({
      tenantId: tid,
      fiStaffId,
      staffMemberId,
      createdFiStaff,
      client: supabase,
    });
    throw e;
  }

  return { staffMemberId, fiStaffId };
}
