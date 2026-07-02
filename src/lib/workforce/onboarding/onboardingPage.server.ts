import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { insertFiStaff } from "@/src/lib/staff/staff.server";
import { STAFF_ROLE_KEYS, STAFF_ROLE_LABELS } from "@/src/lib/staffAccess/staffAccessRegistry";
import { splitFullName } from "@/src/lib/workforce-os/staffLifecycleCore";

import type {
  CreateOnboardingStaffInput,
  OnboardingChecklistState,
  OnboardingClinicOption,
  OnboardingInvitationStatus,
  OnboardingPageModel,
  OnboardingStaffRow,
} from "./onboardingTypes";
import { syncOnboardingChecklistFromState } from "./onboardingChecklist.server";

const ONBOARDING_SOURCE = "workforce_os_onboarding_centre";

function mapInvitationStatus(raw: unknown): OnboardingInvitationStatus {
  const s = String(raw ?? "pending").trim().toLowerCase();
  if (s === "accepted" || s === "expired") return s;
  return "pending";
}

function mapChecklist(raw: Record<string, unknown> | null): OnboardingChecklistState {
  if (!raw) {
    return {
      accountCreated: false,
      pinChosen: false,
      permissionsAssigned: false,
      trainingPending: true,
    };
  }
  return {
    accountCreated: Boolean(raw.account_created),
    pinChosen: Boolean(raw.pin_chosen),
    permissionsAssigned: Boolean(raw.permissions_assigned),
    trainingPending: Boolean(raw.training_pending),
  };
}

/** Production fi_clinics columns used by Onboarding Centre (display_name only — no name column). */
export const ONBOARDING_FI_CLINICS_SELECT = "id, display_name";

export function mapOnboardingClinicOption(row: {
  id: string;
  display_name?: string | null;
}): OnboardingClinicOption {
  const label = String(row.display_name ?? "").trim() || "Clinic";
  return { id: String(row.id), name: label };
}

async function loadClinics(
  tenantId: string,
  client?: SupabaseClient
): Promise<OnboardingClinicOption[]> {
  const { data, error } = await (client ?? supabaseAdmin())
    .from("fi_clinics")
    .select(ONBOARDING_FI_CLINICS_SELECT)
    .eq("tenant_id", tenantId)
    .order("display_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapOnboardingClinicOption(r as { id: string; display_name?: string | null }));
}

function buildRoleOptions(): { value: string; label: string }[] {
  return STAFF_ROLE_KEYS.map((key) => ({
    value: key,
    label: STAFF_ROLE_LABELS[key],
  }));
}

export async function loadOnboardingPageModel(
  tenantId: string,
  client?: SupabaseClient
): Promise<OnboardingPageModel> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();

  const [membersRes, clinics] = await Promise.all([
    supabase
      .from("fi_staff_members")
      .select(
        "id, full_name, email, role_code, clinic_id, employment_type, employment_status, fi_staff_id, created_at"
      )
      .eq("tenant_id", tid)
      .is("archived_at", null)
      .is("merged_into", null)
      .in("employment_status", ["pending_onboarding", "inactive"])
      .order("created_at", { ascending: false }),
    loadClinics(tid, supabase),
  ]);
  if (membersRes.error) throw new Error(membersRes.error.message);

  const memberIds = ((membersRes.data ?? []) as { id: string }[]).map((m) => String(m.id));
  const clinicById = new Map(clinics.map((c) => [c.id, c.name]));

  let invitations: Record<string, unknown>[] = [];
  let checklists: Record<string, unknown>[] = [];
  if (memberIds.length) {
    const [invRes, chkRes] = await Promise.all([
      supabase
        .from("fi_staff_onboarding_invitations")
        .select("id, staff_member_id, status, invited_at, expires_at, accepted_at")
        .eq("tenant_id", tid)
        .in("staff_member_id", memberIds)
        .order("invited_at", { ascending: false }),
      supabase
        .from("fi_staff_onboarding_checklists")
        .select("*")
        .eq("tenant_id", tid)
        .in("staff_member_id", memberIds),
    ]);
    if (invRes.error) throw new Error(invRes.error.message);
    if (chkRes.error) throw new Error(chkRes.error.message);
    invitations = (invRes.data ?? []) as Record<string, unknown>[];
    checklists = (chkRes.data ?? []) as Record<string, unknown>[];
  }

  const latestInviteByMember = new Map<string, Record<string, unknown>>();
  for (const inv of invitations) {
    const mid = String(inv.staff_member_id);
    if (!latestInviteByMember.has(mid)) latestInviteByMember.set(mid, inv);
  }
  const checklistByMember = new Map(
    checklists.map((c) => [String(c.staff_member_id), c as Record<string, unknown>])
  );

  const staff: OnboardingStaffRow[] = ((membersRes.data ?? []) as Record<string, unknown>[]).map(
    (raw) => {
      const id = String(raw.id);
      const clinicId = raw.clinic_id != null ? String(raw.clinic_id) : null;
      const inv = latestInviteByMember.get(id);
      return {
        id,
        fullName: String(raw.full_name ?? "Staff"),
        email: raw.email != null ? String(raw.email) : null,
        roleCode: raw.role_code != null ? String(raw.role_code) : null,
        clinicId,
        clinicName: clinicId ? (clinicById.get(clinicId) ?? null) : null,
        employmentType: raw.employment_type != null ? String(raw.employment_type) : null,
        employmentStatus: String(raw.employment_status ?? "pending_onboarding"),
        fiStaffId: raw.fi_staff_id != null ? String(raw.fi_staff_id) : null,
        createdAt: String(raw.created_at),
        invitation: inv
          ? {
              id: String(inv.id),
              status: mapInvitationStatus(inv.status),
              invitedAt: String(inv.invited_at),
              expiresAt: String(inv.expires_at),
              acceptedAt: inv.accepted_at != null ? String(inv.accepted_at) : null,
            }
          : null,
        checklist: mapChecklist(checklistByMember.get(id) ?? null),
      };
    }
  );

  return { staff, clinics, roleOptions: buildRoleOptions() };
}

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

  const names = splitFullName(fullName);
  const roleCode = input.data.roleCode.trim() || "consultant";

  const fiStaff = await insertFiStaff(
    tid,
    {
      full_name: fullName,
      staff_role: roleCode,
      email,
      is_active: false,
    },
    supabase
  );

  await supabase
    .from("fi_staff")
    .update({
      employment_status: "pending_onboarding",
      identity_source: "local",
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", fiStaff.id);

  const { data: member, error: memberError } = await supabase
    .from("fi_staff_members")
    .insert({
      tenant_id: tid,
      fi_staff_id: fiStaff.id,
      full_name: fullName,
      first_name: names.first_name || null,
      last_name: names.last_name || null,
      email,
      role_code: roleCode,
      employment_type: input.data.employmentType,
      employment_status: "pending_onboarding",
      clinic_id: input.data.clinicId?.trim() || null,
      identity_source: "local",
      source_system: ONBOARDING_SOURCE,
      source_snapshot: { created_via: ONBOARDING_SOURCE },
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (memberError) throw new Error(memberError.message);

  const staffMemberId = String((member as { id: string }).id);

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
  if (checklistError) throw new Error(checklistError.message);

  await syncOnboardingChecklistFromState(tid, staffMemberId, supabase);

  return { staffMemberId, fiStaffId: fiStaff.id };
}

export async function expireStaleOnboardingInvitations(
  tenantId: string,
  client?: SupabaseClient
): Promise<void> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const supabase = client ?? supabaseAdmin();
  const now = new Date().toISOString();
  await supabase
    .from("fi_staff_onboarding_invitations")
    .update({ status: "expired", updated_at: now })
    .eq("tenant_id", tid)
    .eq("status", "pending")
    .lt("expires_at", now);
}

export function newOnboardingToken(): string {
  return randomUUID();
}
